import { BUILDING_CYCLE_MS } from '../data/balance.ts'
import type { GameState } from './state.ts'
import { appendLog } from './actions.ts'
import { evaluateUnlocks } from './unlocks.ts'

const MAX_ELAPSED_MS = 24 * 60 * 60 * 1000

type BuildingKey = 'lumberMill' | 'miner'

function processBuildingElapsed(state: GameState, key: BuildingKey, elapsedMs: number): void {
  const count = state.buildings[key]
  if (count <= 0) {
    state.productionProgress[key] = 0
    return
  }

  state.productionProgress[key] += elapsedMs
  const cycles = Math.floor(state.productionProgress[key] / BUILDING_CYCLE_MS)
  if (cycles <= 0) return

  state.productionProgress[key] -= cycles * BUILDING_CYCLE_MS
  const amount = cycles * count

  if (key === 'lumberMill') {
    state.resources.wood += amount
    appendLog(state, `벌목소 생산: 나무 +${amount}`)
  } else {
    state.resources.metal += amount
    appendLog(state, `채굴기 생산: 금속 +${amount}`)
  }
}

export function advanceState(state: GameState, now = Date.now()): void {
  const prev = Number.isFinite(state.lastUpdate) ? state.lastUpdate : now
  const elapsed = Math.max(0, Math.min(MAX_ELAPSED_MS, now - prev))
  state.lastUpdate = now

  if (elapsed <= 0) return

  processBuildingElapsed(state, 'lumberMill', elapsed)
  processBuildingElapsed(state, 'miner', elapsed)

  const unlockLogs = evaluateUnlocks(state)
  unlockLogs.forEach((line) => appendLog(state, line))
}
