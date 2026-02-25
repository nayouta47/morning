import { BUILDING_CYCLE_MS, SMELTING_CYCLE_MS, WEAPON_CRAFT_DURATION_MS } from '../data/balance.ts'
import type { GameState, ModuleType, SmeltingProcessKey, WeaponType } from './state.ts'
import { appendLog, handleExplorationDeath } from './actions.ts'
import { FLEE_SUCCESS_CHANCE, createEnemyLootTable, getSelectedWeapon, getWeaponCombatStats } from './combat.ts'
import { evaluateUnlocks } from './unlocks.ts'
import { advanceCountdownProcess, advanceCycleProgress } from './process.ts'
import { CRAFT_RECIPE_DEFS, getModuleCraftPoolByTier, getModuleCraftTierLabel, type CraftRecipeKey } from '../data/crafting.ts'
import { getResourceDisplay } from '../data/resources.ts'
import { addResourceWithCap } from './resourceCaps.ts'
import { SHOVEL_MAX_STACK, getGatherWoodReward, getShovelCount, resolveGatherScrapReward } from './rewards.ts'

const MAX_ELAPSED_MS = 24 * 60 * 60 * 1000
const CHROMIUM_CHANCE_PER_SCRAP = 0.008
const MOLYBDENUM_CHANCE_PER_SCRAP = 0.0015

type ProductionBuildingKey = 'lumberMill' | 'scavenger'

function logDiscardedOverflow(state: GameState, resourceId: keyof GameState['resources'], discarded: number): void {
  if (discarded <= 0) return
  appendLog(state, `${getResourceDisplay(resourceId)} 저장 한도 도달: +${discarded} 손실`)
}

function processBuildingElapsed(state: GameState, key: ProductionBuildingKey, elapsedMs: number): void {
  const count = key === 'scavenger' ? 1 : state.buildings[key]
  const scavengerEnabled = state.buildings.droneController > 0 && state.resources.scavengerDrone > 0

  if (count <= 0 || (key === 'scavenger' && !scavengerEnabled)) {
    state.productionProgress[key] = 0
    return
  }

  if (!state.productionRunning[key]) return

  const { nextProgressMs, cycles } = advanceCycleProgress(state.productionProgress[key], elapsedMs, BUILDING_CYCLE_MS)
  state.productionProgress[key] = nextProgressMs
  if (cycles <= 0) return

  const capacity = cycles * count

  if (key === 'scavenger') {
    const { added, discarded } = addResourceWithCap(state.resources, 'scrap', capacity)
    appendLog(state, `스캐빈저 가동: 🗑️ 고물 +${added}`)
    logDiscardedOverflow(state, 'scrap', discarded)
    return
  }

  const { added, discarded } = addResourceWithCap(state.resources, 'wood', capacity)
  appendLog(state, `벌목기 생산: 🪵 뗄감 +${added}`)
  logDiscardedOverflow(state, 'wood', discarded)
}

function processMinerElapsed(state: GameState, key: 'crushScrap' | 'crushSiliconMass', elapsedMs: number): void {
  const count = Math.max(0, Math.floor(state.buildings.miner))
  if (count <= 0) {
    state.minerProgress[key] = 0
    return
  }

  const allocated = Math.max(0, Math.floor(state.minerAllocation[key]))
  if (allocated <= 0) {
    state.minerProgress[key] = 0
    return
  }

  if (!state.minerProcessRunning[key]) return

  const { nextProgressMs, cycles } = advanceCycleProgress(state.minerProgress[key], elapsedMs, BUILDING_CYCLE_MS)
  state.minerProgress[key] = nextProgressMs
  if (cycles <= 0) return

  const attempts = cycles * allocated
  if (key === 'crushScrap') {
    const processed = Math.min(attempts, Math.floor(state.resources.scrap))
    if (processed <= 0) return

    state.resources.scrap -= processed
    const ironGain = addResourceWithCap(state.resources, 'iron', processed)

    let chromium = 0
    let molybdenum = 0
    for (let i = 0; i < processed; i += 1) {
      if (Math.random() < CHROMIUM_CHANCE_PER_SCRAP) chromium += 1
      if (Math.random() < MOLYBDENUM_CHANCE_PER_SCRAP) molybdenum += 1
    }

    const chromiumGain = chromium > 0 ? addResourceWithCap(state.resources, 'chromium', chromium) : { added: 0, discarded: 0 }
    const molybdenumGain =
      molybdenum > 0 ? addResourceWithCap(state.resources, 'molybdenum', molybdenum) : { added: 0, discarded: 0 }

    const bonusParts: string[] = []
    if (chromiumGain.added > 0) bonusParts.push(`🟢 +${chromiumGain.added}`)
    if (molybdenumGain.added > 0) bonusParts.push(`🔵 +${molybdenumGain.added}`)

    const bonusText = bonusParts.length > 0 ? ` (${bonusParts.join(', ')})` : ''
    appendLog(state, `고물 분쇄: 🗑️ 고물 -${processed}, ⛓️ 철 +${ironGain.added}${bonusText}`)
    logDiscardedOverflow(state, 'iron', ironGain.discarded)
    logDiscardedOverflow(state, 'chromium', chromiumGain.discarded)
    logDiscardedOverflow(state, 'molybdenum', molybdenumGain.discarded)
    return
  }

  const processed = Math.min(attempts, Math.floor(state.resources.siliconMass))
  if (processed > 0) {
    state.resources.siliconMass -= processed
    const cobaltGain = addResourceWithCap(state.resources, 'cobalt', processed)
    appendLog(state, `규소 덩어리 분쇄: 🧱 규소 덩어리 -${processed}, 🟣 코발트 +${cobaltGain.added}`)
    logDiscardedOverflow(state, 'cobalt', cobaltGain.discarded)
  }
}

function processSmeltingElapsed(state: GameState, key: SmeltingProcessKey, elapsedMs: number): void {
  const allocated = Math.max(0, Math.floor(state.smeltingAllocation[key]))
  if (allocated <= 0) {
    state.smeltingProgress[key] = 0
    return
  }

  if (!state.smeltingProcessRunning[key]) return

  const { nextProgressMs, cycles } = advanceCycleProgress(state.smeltingProgress[key], elapsedMs, SMELTING_CYCLE_MS)
  state.smeltingProgress[key] = nextProgressMs
  if (cycles <= 0) return

  const attempts = cycles * allocated
  if (key === 'burnWood') {
    const possible = Math.min(attempts, Math.floor(state.resources.wood / 1000))
    if (possible > 0) {
      state.resources.wood -= possible * 1000
      const carbonGain = addResourceWithCap(state.resources, 'carbon', possible)
      appendLog(state, `땔감 태우기: 🪵 뗄감 -${possible * 1000}, ⚫탄소 +${carbonGain.added}`)
      logDiscardedOverflow(state, 'carbon', carbonGain.discarded)
    }
    return
  }

  if (key === 'meltScrap') {
    let produced = 0
    for (let i = 0; i < attempts; i += 1) {
      if (state.resources.scrap < 1000 || state.resources.chromium < 3 || state.resources.molybdenum < 1) continue
      state.resources.scrap -= 1000
      state.resources.chromium -= 3
      state.resources.molybdenum -= 1
      produced += 1
    }
    if (produced > 0) {
      const lowAlloyGain = addResourceWithCap(state.resources, 'lowAlloySteel', produced)
      appendLog(state, `고물 녹이기: 🔗저합금강 +${lowAlloyGain.added}`)
      logDiscardedOverflow(state, 'lowAlloySteel', lowAlloyGain.discarded)
    }
    return
  }

  if (key === 'meltIron') {
    let produced = 0
    for (let i = 0; i < attempts; i += 1) {
      if (state.resources.iron < 1000 || state.resources.nickel < 8) continue
      state.resources.iron -= 1000
      state.resources.nickel -= 8
      produced += 1
    }
    if (produced > 0) {
      const highAlloyGain = addResourceWithCap(state.resources, 'highAlloySteel', produced)
      appendLog(state, `철 녹이기: 🖇️고합금강 +${highAlloyGain.added}`)
      logDiscardedOverflow(state, 'highAlloySteel', highAlloyGain.discarded)
    }
    return
  }

  let siliconIngot = 0
  let nickel = 0
  for (let i = 0; i < attempts; i += 1) {
    if (state.resources.siliconMass < 1) continue
    state.resources.siliconMass -= 1
    if (Math.random() < 0.75) {
      siliconIngot += 1
    } else {
      nickel += 1
    }
  }

  if (siliconIngot > 0 || nickel > 0) {
    const siliconIngotGain = siliconIngot > 0 ? addResourceWithCap(state.resources, 'siliconIngot', siliconIngot) : { added: 0, discarded: 0 }
    const nickelGain = nickel > 0 ? addResourceWithCap(state.resources, 'nickel', nickel) : { added: 0, discarded: 0 }

    const parts: string[] = []
    if (siliconIngotGain.added > 0) parts.push(`🗞️규소 주괴 +${siliconIngotGain.added}`)
    if (nickelGain.added > 0) parts.push(`🟡니켈 +${nickelGain.added}`)
    appendLog(state, parts.length > 0 ? `규소 덩어리 녹이기: ${parts.join(', ')}` : '규소 덩어리 녹이기: 산출물 저장 공간 부족')
    logDiscardedOverflow(state, 'siliconIngot', siliconIngotGain.discarded)
    logDiscardedOverflow(state, 'nickel', nickelGain.discarded)
  }
}

function makeWeapon(state: GameState, type: WeaponType): void {
  const prefix = type === 'pistol' ? 'PST' : 'RFL'
  const id = `${prefix}-${String(state.nextWeaponId).padStart(4, '0')}`
  state.nextWeaponId += 1
  state.weapons.push({ id, type, slots: Array.from({ length: 50 }, () => null) })
  if (!state.selectedWeaponId) state.selectedWeaponId = id
  appendLog(state, `${type === 'pistol' ? '권총' : '소총'} 제작 완료: ${id}`)
}

function makeModule(state: GameState, type: ModuleType): void {
  state.modules[type] += 1
  const label =
    type === 'damage'
      ? '💥 공격력(+1)'
      : type === 'cooldown'
        ? '⏱️ 쿨다운 가속(+10)'
        : type === 'blockAmplifierUp'
          ? '📡▲ 차단 증폭기(상)'
          : type === 'blockAmplifierDown'
            ? '📡▼ 차단 증폭기(하)'
            : type === 'heatAmplifierLeft'
              ? '♨️◀ 열 증폭기(좌)'
              : type === 'heatAmplifierRight'
                ? '♨️▶ 열 증폭기(우)'
                : '🔥 예열기(전투 시작 즉시 발사)'
  appendLog(state, `모듈 제작 완료: ${label}`)
}

function resolveCraftCompletion(state: GameState, key: CraftRecipeKey): void {
  const recipe = CRAFT_RECIPE_DEFS[key]
  const moduleTier = key === 'module' ? (state.moduleCraftTierInProgress ?? 1) : null

  recipe.outputs.forEach((output) => {
    if (output.kind === 'weapon') {
      for (let i = 0; i < output.count; i += 1) makeWeapon(state, output.weaponType)
      return
    }

    if (output.kind === 'resource') {
      if (output.resource === 'shovel') {
        const current = getShovelCount(state)
        const addAmount = Math.max(0, Math.min(output.amount, SHOVEL_MAX_STACK - current))
        if (addAmount > 0) {
          state.resources.shovel += addAmount
          appendLog(state, `제작 완료: ${getResourceDisplay(output.resource)} +${addAmount}`)
        } else {
          appendLog(state, `제작 완료: ${getResourceDisplay(output.resource)} 최대치`)
        }
        return
      }

      const gain = addResourceWithCap(state.resources, output.resource, output.amount)
      appendLog(state, `제작 완료: ${getResourceDisplay(output.resource)} +${gain.added}`)
      logDiscardedOverflow(state, output.resource, gain.discarded)
      return
    }

    const pool = key === 'module' && moduleTier ? getModuleCraftPoolByTier(moduleTier) : output.pool
    for (let i = 0; i < output.count; i += 1) {
      const index = Math.floor(Math.random() * pool.length)
      const picked = pool[index] ?? pool[0]
      if (picked) makeModule(state, picked)
    }
  })

  if (key === 'module' && moduleTier) {
    appendLog(state, `${getModuleCraftTierLabel(moduleTier)} 제작 완료`)
    state.moduleCraftTierInProgress = null
  }
}

function processCraftElapsed(state: GameState, key: CraftRecipeKey, elapsedMs: number): void {
  const current = state.craftProgress[key]
  if (current <= 0) return

  const { nextRemainingMs, completed } = advanceCountdownProcess(current, elapsedMs)
  state.craftProgress[key] = nextRemainingMs
  if (!completed) return

  resolveCraftCompletion(state, key)
}

function resolveGatherCompletion(state: GameState, key: 'gatherWood' | 'gatherScrap'): void {
  if (key === 'gatherWood') {
    const amount = getGatherWoodReward(state)
    const gain = addResourceWithCap(state.resources, 'wood', amount)
    appendLog(state, `🪵 뗄감 +${gain.added}`)
    logDiscardedOverflow(state, 'wood', gain.discarded)
    return
  }

  const amount = resolveGatherScrapReward(state)
  const gain = addResourceWithCap(state.resources, 'scrap', amount)
  appendLog(state, `🗑️ 고물 +${gain.added}`)
  logDiscardedOverflow(state, 'scrap', gain.discarded)
}

function processActionElapsed(state: GameState, key: 'gatherWood' | 'gatherScrap', elapsedMs: number): void {
  const current = state.actionProgress[key]
  if (current <= 0) return

  const { nextRemainingMs, completed } = advanceCountdownProcess(current, elapsedMs)
  state.actionProgress[key] = nextRemainingMs
  if (!completed) return

  resolveGatherCompletion(state, key)
}

function processExplorationCombat(state: GameState, elapsedMs: number): void {
  if (state.exploration.mode !== 'active' || state.exploration.phase !== 'combat') return
  const combat = state.exploration.combat
  if (!combat) return

  const weaponStats = getWeaponCombatStats(getSelectedWeapon(state))

  combat.smallHealPotionCooldownRemainingMs = Math.max(0, combat.smallHealPotionCooldownRemainingMs - elapsedMs)

  combat.playerAttackElapsedMs += elapsedMs
  while (combat.playerAttackElapsedMs >= weaponStats.cooldownMs && combat.enemyHp > 0) {
    combat.playerAttackElapsedMs -= weaponStats.cooldownMs
    combat.enemyHp = Math.max(0, combat.enemyHp - weaponStats.damage)
    appendLog(state, `당신이 공격했다. ${combat.enemyName} HP ${combat.enemyHp}/${combat.enemyMaxHp}`)
  }

  if (combat.enemyHp <= 0) {
    state.exploration.phase = 'loot'
    state.exploration.combat = null
    state.exploration.pendingLoot = createEnemyLootTable(combat.enemyId)
    const codex = state.enemyCodex[combat.enemyId]
    if (codex) codex.defeatCount += 1
    appendLog(state, `${combat.enemyName} 처치.`)
    appendLog(state, '전리품을 고른다.')
    return
  }

  combat.enemyAttackElapsedMs += elapsedMs
  while (combat.enemyAttackElapsedMs >= combat.enemyAttackCooldownMs && state.exploration.hp > 0) {
    combat.enemyAttackElapsedMs -= combat.enemyAttackCooldownMs
    state.exploration.hp = Math.max(0, state.exploration.hp - combat.enemyDamage)
    appendLog(state, `${combat.enemyName}의 타격. HP ${state.exploration.hp}/${state.exploration.maxHp}`)
  }

  if (combat.fleeGaugeRunning) {
    combat.fleeGaugeElapsedMs = Math.min(combat.fleeGaugeDurationMs, combat.fleeGaugeElapsedMs + elapsedMs)

    if (combat.fleeGaugeElapsedMs >= combat.fleeGaugeDurationMs) {
      combat.fleeGaugeRunning = false
      combat.fleeGaugeElapsedMs = 0

      if (Math.random() < FLEE_SUCCESS_CHANCE) {
        state.exploration.phase = 'moving'
        state.exploration.combat = null
        appendLog(state, '도주 성공! 전투에서 벗어났다.')
        return
      }

      appendLog(state, '도주 실패... 전투를 이어간다.')
    }
  }

  if (state.exploration.hp <= 0) {
    handleExplorationDeath(state)
  }
}

function advanceBaseByElapsed(state: GameState, elapsed: number): void {
  if (elapsed <= 0) return

  processBuildingElapsed(state, 'lumberMill', elapsed)
  processMinerElapsed(state, 'crushScrap', elapsed)
  processMinerElapsed(state, 'crushSiliconMass', elapsed)
  processBuildingElapsed(state, 'scavenger', elapsed)

  processSmeltingElapsed(state, 'burnWood', elapsed)
  processSmeltingElapsed(state, 'meltScrap', elapsed)
  processSmeltingElapsed(state, 'meltIron', elapsed)
  processSmeltingElapsed(state, 'meltSiliconMass', elapsed)

  ;(Object.keys(CRAFT_RECIPE_DEFS) as CraftRecipeKey[]).forEach((recipeKey) => processCraftElapsed(state, recipeKey, elapsed))

  processActionElapsed(state, 'gatherWood', elapsed)
  processActionElapsed(state, 'gatherScrap', elapsed)
}

export function advanceState(state: GameState, now = Date.now()): void {
  const prev = Number.isFinite(state.lastUpdate) ? state.lastUpdate : now
  const elapsed = Math.max(0, Math.min(MAX_ELAPSED_MS, now - prev))
  state.lastUpdate = now

  if (elapsed <= 0) return

  advanceBaseByElapsed(state, elapsed)
  processExplorationCombat(state, elapsed)

  const unlockLogs = evaluateUnlocks(state)
  unlockLogs.forEach((line) => appendLog(state, line))
}

export function advanceBaseOnlyStateByElapsed(state: GameState, elapsedMs: number, now = Date.now()): void {
  const elapsed = Math.max(0, Math.min(MAX_ELAPSED_MS, elapsedMs))
  state.lastUpdate = now

  if (elapsed <= 0) return

  advanceBaseByElapsed(state, elapsed)

  const unlockLogs = evaluateUnlocks(state)
  unlockLogs.forEach((line) => appendLog(state, line))
}

export function getCraftRatio(remainingMs: number): number {
  return Math.min(1, Math.max(0, (WEAPON_CRAFT_DURATION_MS - remainingMs) / WEAPON_CRAFT_DURATION_MS))
}
