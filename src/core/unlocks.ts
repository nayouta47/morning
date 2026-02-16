import type { GameState } from './state.ts'
import { areRequirementsMet, type Requirement } from './requirements.ts'

type UnlockKey = keyof GameState['unlocks']

type UnlockDef = {
  id: UnlockKey
  requirements: Requirement[]
  log: string
}

const UNLOCK_DEFS: UnlockDef[] = [
  {
    id: 'scrapAction',
    requirements: [{ kind: 'resource', resource: 'shovel', amount: 1 }],
    log: '새 행동 해금: 🗑️ 고물 줍기',
  },
  {
    id: 'lumberMill',
    requirements: [],
    log: '건물 해금: 벌목기',
  },
  {
    id: 'miner',
    requirements: [],
    log: '건물 해금: 분쇄기',
  },
]

export function evaluateUnlocks(state: GameState): string[] {
  const newLogs: string[] = []

  UNLOCK_DEFS.forEach((unlockDef) => {
    if (state.unlocks[unlockDef.id]) return
    if (!areRequirementsMet(state, unlockDef.requirements)) return

    state.unlocks[unlockDef.id] = true
    newLogs.push(unlockDef.log)
  })

  return newLogs
}
