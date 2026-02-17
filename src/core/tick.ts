import { WEAPON_CRAFT_DURATION_MS } from '../data/balance.ts'
import type { GameState, ModuleType, WeaponType } from './state.ts'
import { appendLog, handleExplorationDeath } from './actions.ts'
import { createEnemyLootTable, getSelectedWeapon, getWeaponCombatStats } from './combat.ts'
import { evaluateUnlocks } from './unlocks.ts'
import { advanceCountdownProcess, advanceCycleProgress } from './process.ts'
import { CRAFT_RECIPE_DEFS, type CraftRecipeKey } from '../data/crafting.ts'
import { getResourceDisplay } from '../data/resources.ts'
import { SHOVEL_MAX_STACK, getShovelCount } from './rewards.ts'
import { ACTION_DEFS, ACTION_KEYS, PRODUCTION_DEFS, PRODUCTION_KEYS, type ActionKey, type ProductionKey } from './timedDefs.ts'

const MAX_ELAPSED_MS = 24 * 60 * 60 * 1000
const CHROMIUM_CHANCE_PER_SCRAP = 0.008
const MOLYBDENUM_CHANCE_PER_SCRAP = 0.0015

function processBuildingElapsed(state: GameState, key: ProductionKey, elapsedMs: number): void {
  const count = key === 'scavenger' ? 1 : state.buildings[key]
  const scavengerEnabled = state.buildings.droneController > 0 && state.resources.scavengerDrone > 0

  if (count <= 0 || (key === 'scavenger' && !scavengerEnabled)) {
    state.productionProgress[key] = 0
    return
  }

  const def = PRODUCTION_DEFS[key]
  if (!state.productionRunning[def.runningKey]) return

  const { nextProgressMs, cycles } = advanceCycleProgress(state.productionProgress[key], elapsedMs, def.cycleMs)
  state.productionProgress[key] = nextProgressMs
  if (cycles <= 0) return

  const capacity = cycles * count

  if (key === 'scavenger') {
    state.resources.scrap += capacity
    appendLog(state, `스캐빈저 가동: 🗑️ 고물 +${capacity}`)
    return
  }

  if (key === 'lumberMill') {
    state.resources.wood += capacity
    appendLog(state, `벌목기 생산: 🪵 뗄감 +${capacity}`)
    return
  }

  const processed = Math.min(capacity, Math.floor(state.resources.scrap))
  if (processed <= 0) return

  state.resources.scrap -= processed
  state.resources.iron += processed

  let chromium = 0
  let molybdenum = 0
  for (let i = 0; i < processed; i += 1) {
    if (Math.random() < CHROMIUM_CHANCE_PER_SCRAP) chromium += 1
    if (Math.random() < MOLYBDENUM_CHANCE_PER_SCRAP) molybdenum += 1
  }

  if (chromium > 0) state.resources.chromium += chromium
  if (molybdenum > 0) state.resources.molybdenum += molybdenum

  const bonusParts: string[] = []
  if (chromium > 0) bonusParts.push(`🟢 크롬 +${chromium}`)
  if (molybdenum > 0) bonusParts.push(`🔵 몰리브덴 +${molybdenum}`)

  const bonusText = bonusParts.length > 0 ? ` (${bonusParts.join(', ')})` : ''
  appendLog(state, `분쇄기 처리: 🗑️ 고물 -${processed}, ⛓️ 철 +${processed}${bonusText}`)
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
  appendLog(state, `모듈 제작 완료: ${type === 'damage' ? '💥 공격력(+1)' : '⏱️ 쿨다운(-1초)'}`)
}

function resolveCraftCompletion(state: GameState, key: CraftRecipeKey): void {
  const recipe = CRAFT_RECIPE_DEFS[key]

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

      state.resources[output.resource] += output.amount
      appendLog(state, `제작 완료: ${getResourceDisplay(output.resource)} +${output.amount}`)
      return
    }

    for (let i = 0; i < output.count; i += 1) {
      const index = Math.floor(Math.random() * output.pool.length)
      const picked = output.pool[index] ?? output.pool[0]
      if (picked) makeModule(state, picked)
    }
  })
}

function processCraftElapsed(state: GameState, key: CraftRecipeKey, elapsedMs: number): void {
  const current = state.craftProgress[key]
  if (current <= 0) return

  const { nextRemainingMs, completed } = advanceCountdownProcess(current, elapsedMs)
  state.craftProgress[key] = nextRemainingMs
  if (!completed) return

  resolveCraftCompletion(state, key)
}

function resolveGatherCompletion(state: GameState, key: ActionKey): void {
  const def = ACTION_DEFS[key]
  const amount = def.getRewardAmount(state)
  state.resources[def.rewardResource] += amount
  appendLog(state, `${def.completeLogPrefix} +${amount}`)
}

function processActionElapsed(state: GameState, key: ActionKey, elapsedMs: number): void {
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

  combat.playerAttackElapsedMs += elapsedMs
  while (combat.playerAttackElapsedMs >= weaponStats.cooldownMs && combat.enemyHp > 0) {
    combat.playerAttackElapsedMs -= weaponStats.cooldownMs
    combat.enemyHp = Math.max(0, combat.enemyHp - weaponStats.damage)
    appendLog(state, `당신이 공격했다. ${combat.enemyName} HP ${combat.enemyHp}/${combat.enemyMaxHp}`)
  }

  if (combat.enemyHp <= 0) {
    state.exploration.phase = 'loot'
    state.exploration.combat = null
    state.exploration.pendingLoot = createEnemyLootTable()
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

  if (state.exploration.hp <= 0) {
    handleExplorationDeath(state)
  }
}

export function advanceState(state: GameState, now = Date.now()): void {
  const prev = Number.isFinite(state.lastUpdate) ? state.lastUpdate : now
  const elapsed = Math.max(0, Math.min(MAX_ELAPSED_MS, now - prev))
  state.lastUpdate = now

  if (elapsed <= 0) return

  PRODUCTION_KEYS.forEach((productionKey) => processBuildingElapsed(state, productionKey, elapsed))

  ;(Object.keys(CRAFT_RECIPE_DEFS) as CraftRecipeKey[]).forEach((recipeKey) => processCraftElapsed(state, recipeKey, elapsed))

  ACTION_KEYS.forEach((actionKey) => processActionElapsed(state, actionKey, elapsed))
  processExplorationCombat(state, elapsed)

  const unlockLogs = evaluateUnlocks(state)
  unlockLogs.forEach((line) => appendLog(state, line))
}

export function getCraftRatio(remainingMs: number): number {
  return Math.min(1, Math.max(0, (WEAPON_CRAFT_DURATION_MS - remainingMs) / WEAPON_CRAFT_DURATION_MS))
}
