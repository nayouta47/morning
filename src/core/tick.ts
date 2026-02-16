import { BUILDING_BASE_PRODUCTION, TICK_MS } from '../data/balance.ts'
import type { GameState } from './state.ts'
import { appendLog } from './actions.ts'
import { evaluateUnlocks } from './unlocks.ts'

export function runTick(state: GameState): void {
  let woodPerTick = state.buildings.lumberMill * BUILDING_BASE_PRODUCTION.lumberMill.wood
  let metalPerTick = state.buildings.miner * BUILDING_BASE_PRODUCTION.miner.metal

  if (state.upgrades.sharpSaw) {
    woodPerTick *= 1.25
  }
  if (state.upgrades.drillBoost) {
    metalPerTick *= 1.25
  }

  if (woodPerTick > 0 || metalPerTick > 0) {
    state.resources.wood += woodPerTick
    state.resources.metal += metalPerTick
  }

  const unlockLogs = evaluateUnlocks(state)
  unlockLogs.forEach((line) => appendLog(state, line))
}

export function startTicker(onTick: () => void): number {
  return window.setInterval(onTick, TICK_MS)
}
