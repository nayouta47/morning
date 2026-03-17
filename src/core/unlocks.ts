import type { GameState } from './state.ts'
import { areRequirementsMet, type Requirement } from './requirements.ts'

type UnlockKey = keyof GameState['unlocks']

type UnlockDef = {
  id: UnlockKey
  requirements: Requirement[]
  message: string
}

const UNLOCK_DEFS: UnlockDef[] = [
  {
    id: 'scrapAction',
    requirements: [{ kind: 'resource', resource: 'shovel', amount: 1 }],
    message: '삽이 생겼다. 이제 폐허를 뒤질 수 있다.',
  },
  {
    id: 'lumberMill',
    requirements: [],
    message: '벌목기를 세울 수 있겠다.',
  },
  {
    id: 'miner',
    requirements: [],
    message: '분쇄기를 조립할 수 있겠다.',
  },
  {
    id: 'electricFurnace',
    requirements: [{ kind: 'building', building: 'lab', count: 1 }],
    message: '전기로를 만들 수 있겠다.',
  },
  {
    id: 'droneController',
    requirements: [{ kind: 'building', building: 'lab', count: 1 }],
    message: '드론을 운용할 수 있겠다.',
  },
  {
    id: 'lab',
    requirements: [{ kind: 'building', building: 'workbench', count: 1 }],
    message: '연구할 수 있는 장비를 만들 수 있겠다.',
  },
  {
    id: 'workbench',
    requirements: [{ kind: 'building', building: 'miner', count: 1 }],
    message: '정밀 가공 장비를 만들 수 있겠다.',
  },
]

export function evaluateUnlocks(state: GameState): string[] {
  const newMessages: string[] = []

  UNLOCK_DEFS.forEach((unlockDef) => {
    if (state.unlocks[unlockDef.id]) return
    if (!areRequirementsMet(state, unlockDef.requirements)) return

    state.unlocks[unlockDef.id] = true
    newMessages.push(unlockDef.message)
  })

  return newMessages
}
