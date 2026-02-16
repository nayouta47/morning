import { BUILDING_BASE_COST, COST_SCALE, UPGRADE_DEFS, getUpgradeCost } from '../data/balance.ts'
import type { GameState, Resources } from './state.ts'
import { evaluateUnlocks } from './unlocks.ts'

type BuildingKey = keyof typeof BUILDING_BASE_COST
type UpgradeKey = keyof typeof UPGRADE_DEFS

function pushLog(state: GameState, text: string): void {
  state.log.push(text)
  if (state.log.length > 30) {
    state.log.splice(0, state.log.length - 30)
  }
}

function canAfford(resources: Resources, cost: Resources): boolean {
  return resources.wood >= cost.wood && resources.metal >= cost.metal
}

function payCost(resources: Resources, cost: Resources): void {
  resources.wood -= cost.wood
  resources.metal -= cost.metal
}

export function getBuildingCost(state: GameState, key: BuildingKey): Resources {
  const count = state.buildings[key]
  const base = BUILDING_BASE_COST[key]
  return {
    wood: Math.ceil(base.wood * COST_SCALE ** count),
    metal: Math.ceil(base.metal * COST_SCALE ** count),
  }
}

function applyUnlocks(state: GameState): void {
  const logs = evaluateUnlocks(state)
  logs.forEach((line) => pushLog(state, line))
}

export function gatherWood(state: GameState): void {
  const amount = 1 + (state.upgrades.betterAxe ? 1 : 0)
  state.resources.wood += amount
  pushLog(state, `나무 +${amount}`)
  applyUnlocks(state)
}

export function gatherMetal(state: GameState): void {
  if (!state.unlocks.metalAction) {
    pushLog(state, '아직 금속을 찾을 방법이 없다.')
    return
  }

  const amount = 1 + (state.upgrades.sortingWork ? 1 : 0)
  state.resources.metal += amount
  pushLog(state, `금속 +${amount}`)
  applyUnlocks(state)
}

export function buyBuilding(state: GameState, key: BuildingKey): void {
  const unlocked = key === 'lumberMill' ? state.unlocks.lumberMill : state.unlocks.miner
  if (!unlocked) return

  const cost = getBuildingCost(state, key)
  if (!canAfford(state.resources, cost)) {
    pushLog(state, '자원이 부족합니다.')
    return
  }

  payCost(state.resources, cost)
  state.buildings[key] += 1
  const name = key === 'lumberMill' ? '벌목소' : '채굴기'
  pushLog(state, `${name} 건설 (${state.buildings[key]})`)
  applyUnlocks(state)
}

export function buyUpgrade(state: GameState, key: UpgradeKey): void {
  if (state.upgrades[key]) return

  const def = UPGRADE_DEFS[key]
  const cost = getUpgradeCost(key)
  if (!canAfford(state.resources, cost)) {
    pushLog(state, '자원이 부족합니다.')
    return
  }

  payCost(state.resources, cost)
  state.upgrades[key] = true
  pushLog(state, `업그레이드 완료: ${def.name}`)
}

export function appendLog(state: GameState, text: string): void {
  pushLog(state, text)
}
