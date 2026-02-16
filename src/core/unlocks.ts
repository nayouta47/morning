import { UNLOCK_CONDITIONS } from '../data/balance.ts'
import type { GameState, Resources } from './state.ts'

type UnlockKey = keyof typeof UNLOCK_CONDITIONS

const UNLOCK_LOG: Record<UnlockKey, string> = {
  metalAction: '새 행동 해금: 금속 찾기',
  lumberMill: '건물 해금: 벌목소',
  miner: '건물 해금: 채굴기',
}

type CostLike = { readonly wood: number; readonly metal: number }

function meetsCost(resources: Resources, cost: CostLike): boolean {
  return resources.wood >= cost.wood && resources.metal >= cost.metal
}

export function evaluateUnlocks(state: GameState): string[] {
  const newLogs: string[] = []
  ;(Object.keys(UNLOCK_CONDITIONS) as UnlockKey[]).forEach((key) => {
    if (state.unlocks[key]) return

    if (meetsCost(state.resources, UNLOCK_CONDITIONS[key])) {
      state.unlocks[key] = true
      newLogs.push(UNLOCK_LOG[key])
    }
  })

  return newLogs
}
