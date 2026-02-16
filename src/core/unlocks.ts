import { UNLOCK_CONDITIONS } from '../data/balance.ts'
import type { GameState, Resources } from './state.ts'

type ThresholdUnlockKey = keyof typeof UNLOCK_CONDITIONS

type UnlockKey = keyof GameState['unlocks']

const UNLOCK_LOG: Record<UnlockKey, string> = {
  scrapAction: '새 행동 해금: 🧰 고물 줍기',
  lumberMill: '건물 해금: 벌목기',
  miner: '건물 해금: 분쇄기',
}

type CostLike = { readonly wood: number; readonly scrap: number; readonly iron: number }

function meetsCost(resources: Resources, cost: CostLike): boolean {
  return resources.wood >= cost.wood && resources.scrap >= cost.scrap && resources.iron >= cost.iron
}

export function evaluateUnlocks(state: GameState): string[] {
  const newLogs: string[] = []

  if (!state.unlocks.scrapAction && state.resources.shovel >= 1) {
    state.unlocks.scrapAction = true
    newLogs.push(UNLOCK_LOG.scrapAction)
  }

  ;(Object.keys(UNLOCK_CONDITIONS) as ThresholdUnlockKey[]).forEach((key) => {
    if (state.unlocks[key]) return

    if (meetsCost(state.resources, UNLOCK_CONDITIONS[key])) {
      state.unlocks[key] = true
      newLogs.push(UNLOCK_LOG[key])
    }
  })

  return newLogs
}
