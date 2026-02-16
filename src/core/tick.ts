import { BUILDING_CYCLE_MS, TICK_MS } from '../data/balance.ts'
import type { GameState } from './state.ts'
import { appendLog } from './actions.ts'
import { evaluateUnlocks } from './unlocks.ts'

function processBuildingCycle(state: GameState, key: 'lumberMill' | 'miner'): void {
  const count = state.buildings[key]
  if (count <= 0) {
    state.productionProgress[key] = 0
    return
  }

  state.productionProgress[key] += TICK_MS

  while (state.productionProgress[key] >= BUILDING_CYCLE_MS) {
    state.productionProgress[key] -= BUILDING_CYCLE_MS
    if (key === 'lumberMill') {
      state.resources.wood += count
      appendLog(state, `벌목소 생산: 나무 +${count}`)
    } else {
      state.resources.metal += count
      appendLog(state, `채굴기 생산: 금속 +${count}`)
    }
  }
}

export function runTick(state: GameState): void {
  processBuildingCycle(state, 'lumberMill')
  processBuildingCycle(state, 'miner')

  const unlockLogs = evaluateUnlocks(state)
  unlockLogs.forEach((line) => appendLog(state, line))
}

export function startTicker(onTick: () => void): number {
  return window.setInterval(onTick, TICK_MS)
}
