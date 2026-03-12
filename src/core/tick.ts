import { BUILDING_CYCLE_MS, COMPANION_IDLE_MAX_MS, COMPANION_IDLE_MIN_MS, SMELTING_CYCLE_MS, WEAPON_CRAFT_DURATION_MS } from '../data/balance.ts'
import type { GameState, ModuleType, SmeltingProcessKey, WeaponType } from './state.ts'
import { narrate, handleExplorationDeath } from './actions.ts'
import { FLEE_SUCCESS_CHANCE, createEnemyLootTable, getSelectedWeapon, getWeaponCombatStats } from './combat.ts'
import { getDungeonDef } from '../data/maps/index.ts'
import { evaluateUnlocks } from './unlocks.ts'
import { advanceCountdownProcess, advanceCycleProgress } from './process.ts'
import { CRAFT_RECIPE_DEFS, getModuleCraftPoolByTier, getModuleCraftTierLabel, type CraftRecipeKey } from '../data/crafting.ts'
import { MODULE_METADATA } from '../data/modules.ts'
import { addResourceWithCap, getResourceStorageCap } from './resourceCaps.ts'
import { SHOVEL_MAX_STACK, getGatherWoodReward, getGatherScrapDurationMs, getShovelCount, resolveGatherScrapReward } from './rewards.ts'
import { COMPANION_DEPART_MESSAGES, getCompanionName } from './companion.ts'
import { CONTACT_FAMILY_LOGS } from './actions/baseActions.ts'

const MAX_ELAPSED_MS = 24 * 60 * 60 * 1000
const CHROMIUM_CHANCE_PER_SCRAP = 0.008
const MOLYBDENUM_CHANCE_PER_SCRAP = 0.0015

type ProductionBuildingKey = 'lumberMill' | 'scavenger'

function logDiscardedOverflow(state: GameState, resourceId: keyof GameState['resources'], discarded: number): void {
  if (discarded <= 0) return
  void state
  void resourceId
}

function processBuildingElapsed(state: GameState, key: ProductionBuildingKey, elapsedMs: number, storageCap: number): void {
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
    const { discarded } = addResourceWithCap(state.resources, 'scrap', capacity, storageCap)
    logDiscardedOverflow(state, 'scrap', discarded)
    return
  }

  const { discarded } = addResourceWithCap(state.resources, 'wood', capacity, storageCap)
  logDiscardedOverflow(state, 'wood', discarded)
}

function processMinerElapsed(state: GameState, key: 'crushScrap' | 'crushSiliconMass', elapsedMs: number, storageCap: number): void {
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
    const ironGain = addResourceWithCap(state.resources, 'iron', processed, storageCap)

    let chromium = 0
    let molybdenum = 0
    for (let i = 0; i < processed; i += 1) {
      if (Math.random() < CHROMIUM_CHANCE_PER_SCRAP) chromium += 1
      if (Math.random() < MOLYBDENUM_CHANCE_PER_SCRAP) molybdenum += 1
    }

    const chromiumYield = chromium * 10
    const molybdenumYield = molybdenum * 10

    const chromiumGain = chromiumYield > 0 ? addResourceWithCap(state.resources, 'chromium', chromiumYield, storageCap) : { added: 0, discarded: 0 }
    const molybdenumGain =
      molybdenumYield > 0 ? addResourceWithCap(state.resources, 'molybdenum', molybdenumYield, storageCap) : { added: 0, discarded: 0 }

    logDiscardedOverflow(state, 'iron', ironGain.discarded)
    logDiscardedOverflow(state, 'chromium', chromiumGain.discarded)
    logDiscardedOverflow(state, 'molybdenum', molybdenumGain.discarded)
    return
  }

  const processed = Math.min(attempts, Math.floor(state.resources.siliconMass))
  if (processed > 0) {
    state.resources.siliconMass -= processed
    const cobaltGain = addResourceWithCap(state.resources, 'cobalt', processed, storageCap)
    logDiscardedOverflow(state, 'cobalt', cobaltGain.discarded)
  }
}

function processSmeltingElapsed(state: GameState, key: SmeltingProcessKey, elapsedMs: number, storageCap: number): void {
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
      const carbonGain = addResourceWithCap(state.resources, 'carbon', possible, storageCap)
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
      const lowAlloyGain = addResourceWithCap(state.resources, 'lowAlloySteel', produced, storageCap)
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
      const highAlloyGain = addResourceWithCap(state.resources, 'highAlloySteel', produced, storageCap)
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
    const siliconIngotGain = siliconIngot > 0 ? addResourceWithCap(state.resources, 'siliconIngot', siliconIngot, storageCap) : { added: 0, discarded: 0 }
    const nickelGain = nickel > 0 ? addResourceWithCap(state.resources, 'nickel', nickel, storageCap) : { added: 0, discarded: 0 }
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
  narrate(state, `${type === 'pistol' ? '권총' : '소총'}이 완성됐다. ${id}.`)
}

function makeModule(state: GameState, type: ModuleType): void {
  state.modules[type] += 1
  narrate(state, `모듈이 나왔다. ${MODULE_METADATA[type].craftLogLabel}`)
}

function resolveCraftCompletion(state: GameState, key: CraftRecipeKey, storageCap: number): void {
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
        }
        return
      }

      const gain = addResourceWithCap(state.resources, output.resource, output.amount, storageCap)
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
    narrate(state, `${getModuleCraftTierLabel(moduleTier)} 제작이 끝났다.`)
    state.moduleCraftTierInProgress = null
  }
}

function processCraftElapsed(state: GameState, key: CraftRecipeKey, elapsedMs: number, storageCap: number): void {
  const current = state.craftProgress[key]
  if (current <= 0) return

  const { nextRemainingMs, completed } = advanceCountdownProcess(current, elapsedMs)
  state.craftProgress[key] = nextRemainingMs
  if (!completed) return

  resolveCraftCompletion(state, key, storageCap)
}

function resolveGatherCompletion(state: GameState, key: 'goToWork' | 'gatherWood' | 'gatherScrap' | 'recoverGuideRobot' | 'goForWalk' | 'contactFamily', storageCap: number): void {
  if (key === 'goToWork') {
    state.resources.cash += 2
    narrate(state, '일을 마치고 돌아왔다. 💵현금 2를 벌었다.')
    return
  }
  if (key === 'gatherWood') {
    const amount = getGatherWoodReward(state)
    const gain = addResourceWithCap(state.resources, 'wood', amount, storageCap)
    logDiscardedOverflow(state, 'wood', gain.discarded)
    return
  }

  if (key === 'gatherScrap') {
    state.companionIsAutoGathering = false
    const amount = resolveGatherScrapReward(state)
    const gain = addResourceWithCap(state.resources, 'scrap', amount, storageCap)
    if (state.buildings.laikaRepair > 0) {
      state.companionScrapGatherCount += 1
      const name = getCompanionName(state)
      const returnLogs = [
        `${name}가 고철을 잔뜩 물고 돌아왔다.`,
        `${name}가 꼬리를 흔들며 고물 더미를 내려놓는다.`,
        `${name}가 낡은 부품들을 발 앞에 가지런히 쌓아놓고 앉는다.`,
        `폐허 냄새를 잔뜩 묻힌 ${name}가 총총걸음으로 돌아왔다.`,
      ]
      narrate(state, returnLogs[Math.floor(Math.random() * returnLogs.length)])
      state.companionIdleRemainingMs = COMPANION_IDLE_MIN_MS + Math.random() * (COMPANION_IDLE_MAX_MS - COMPANION_IDLE_MIN_MS)
    }
    logDiscardedOverflow(state, 'scrap', gain.discarded)
    return
  }

  if (key === 'contactFamily') {
    narrate(state, CONTACT_FAMILY_LOGS[Math.floor(Math.random() * CONTACT_FAMILY_LOGS.length)])
    return
  }

  if (key === 'goForWalk') {
    state.walkCount += 1
    const name = state.dogName ?? '강아지'
    narrate(state, `🐕🚶 ${name}와(과) 산책을 마쳤다.`)
    return
  }

  state.isGuideRobotRecovered = true
  state.actionProgress.recoverGuideRobot = 0
  narrate(state, '막대기로 눌러보니 허파의 바람이 빠지며 움츠리는 것처럼 경련을 일으킨다.')
  narrate(state, '구조가 생각보다 단순한 것 같다. 수리할 수 있을지도.')
}

function tryAutoGatherScrap(state: GameState): void {
  if (state.buildings.laikaRepair <= 0) return
  if (!state.unlocks.scrapAction) return
  if (state.actionProgress.gatherScrap > 0) return
  if (state.companionIdleRemainingMs > 0) return

  state.actionProgress.gatherScrap = getGatherScrapDurationMs(state)
  state.companionIsAutoGathering = true
  const name = getCompanionName(state)
  narrate(state, name + COMPANION_DEPART_MESSAGES[Math.floor(Math.random() * COMPANION_DEPART_MESSAGES.length)])
}

function processActionElapsed(state: GameState, key: 'goToWork' | 'gatherWood' | 'gatherScrap' | 'recoverGuideRobot' | 'goForWalk' | 'contactFamily', elapsedMs: number, storageCap: number): void {
  const current = state.actionProgress[key]
  if (current <= 0) return

  const { nextRemainingMs, completed } = advanceCountdownProcess(current, elapsedMs)
  state.actionProgress[key] = nextRemainingMs
  if (!completed) return

  resolveGatherCompletion(state, key, storageCap)
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
    narrate(state, `${combat.enemyName}에게 타격. (${combat.enemyHp}/${combat.enemyMaxHp})`)
  }

  if (combat.enemyHp <= 0) {
    state.exploration.phase = 'loot'
    state.exploration.combat = null
    const dungeonMultiplier = state.exploration.activeDungeon
      ? (getDungeonDef(state.exploration.activeDungeon.id)?.floors[state.exploration.activeDungeon.currentFloor]?.rewardMultiplier ?? 1)
      : 1
    state.exploration.pendingLoot = createEnemyLootTable(combat.enemyId, dungeonMultiplier)
    const codex = state.enemyCodex[combat.enemyId]
    if (codex) codex.defeatCount += 1
    narrate(state, `${combat.enemyName}을(를) 쓰러뜨렸다.`)
    return
  }

  combat.enemyAttackElapsedMs += elapsedMs
  while (combat.enemyAttackElapsedMs >= combat.enemyAttackCooldownMs && state.exploration.hp > 0) {
    combat.enemyAttackElapsedMs -= combat.enemyAttackCooldownMs
    state.exploration.hp = Math.max(0, state.exploration.hp - combat.enemyDamage)
    narrate(state, `${combat.enemyName}의 공격. (${state.exploration.hp}/${state.exploration.maxHp})`)
  }

  if (combat.fleeGaugeRunning) {
    combat.fleeGaugeElapsedMs = Math.min(combat.fleeGaugeDurationMs, combat.fleeGaugeElapsedMs + elapsedMs)

    if (combat.fleeGaugeElapsedMs >= combat.fleeGaugeDurationMs) {
      combat.fleeGaugeRunning = false
      combat.fleeGaugeElapsedMs = 0

      if (Math.random() < FLEE_SUCCESS_CHANCE) {
        state.exploration.phase = 'moving'
        state.exploration.combat = null
        narrate(state, '도주 성공! 전투에서 벗어났다.')
        return
      }

      narrate(state, '도주 실패... 전투를 이어간다.')
    }
  }

  if (state.exploration.hp <= 0) {
    handleExplorationDeath(state)
  }
}

function advanceBaseByElapsed(state: GameState, elapsed: number): void {
  if (elapsed <= 0) return

  const storageCap = getResourceStorageCap(state)

  processBuildingElapsed(state, 'lumberMill', elapsed, storageCap)
  processMinerElapsed(state, 'crushScrap', elapsed, storageCap)
  processMinerElapsed(state, 'crushSiliconMass', elapsed, storageCap)
  processBuildingElapsed(state, 'scavenger', elapsed, storageCap)

  processSmeltingElapsed(state, 'burnWood', elapsed, storageCap)
  processSmeltingElapsed(state, 'meltScrap', elapsed, storageCap)
  processSmeltingElapsed(state, 'meltIron', elapsed, storageCap)
  processSmeltingElapsed(state, 'meltSiliconMass', elapsed, storageCap)

  ;(Object.keys(CRAFT_RECIPE_DEFS) as CraftRecipeKey[]).forEach((recipeKey) => processCraftElapsed(state, recipeKey, elapsed, storageCap))

  processActionElapsed(state, 'goToWork', elapsed, storageCap)
  processActionElapsed(state, 'gatherWood', elapsed, storageCap)
  processActionElapsed(state, 'gatherScrap', elapsed, storageCap)
  processActionElapsed(state, 'contactFamily', elapsed, storageCap)
  processActionElapsed(state, 'goForWalk', elapsed, storageCap)
  if (state.companionIdleRemainingMs > 0) {
    state.companionIdleRemainingMs = Math.max(0, state.companionIdleRemainingMs - elapsed)
  }
  tryAutoGatherScrap(state)
  processActionElapsed(state, 'recoverGuideRobot', elapsed, storageCap)
}

export function advanceState(state: GameState, now = Date.now()): void {
  const prev = Number.isFinite(state.lastUpdate) ? state.lastUpdate : now
  const elapsed = Math.max(0, Math.min(MAX_ELAPSED_MS, now - prev))
  state.lastUpdate = now

  if (elapsed <= 0) return

  advanceBaseByElapsed(state, elapsed)
  processExplorationCombat(state, elapsed)

  const unlockMessages = evaluateUnlocks(state)
  unlockMessages.forEach((line) => narrate(state, line))
}

export function advanceBaseOnlyStateByElapsed(state: GameState, elapsedMs: number, now = Date.now()): void {
  const elapsed = Math.max(0, Math.min(MAX_ELAPSED_MS, elapsedMs))
  state.lastUpdate = now

  if (elapsed <= 0) return

  advanceBaseByElapsed(state, elapsed)

  const unlockMessages = evaluateUnlocks(state)
  unlockMessages.forEach((line) => narrate(state, line))
}

export function getCraftRatio(remainingMs: number): number {
  return Math.min(1, Math.max(0, (WEAPON_CRAFT_DURATION_MS - remainingMs) / WEAPON_CRAFT_DURATION_MS))
}
