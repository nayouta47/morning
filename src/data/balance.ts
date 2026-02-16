export type ResourceKey = 'wood' | 'metal'

export const COST_SCALE = 1.15

export const TICK_MS = 1000

export const BUILDING_BASE_COST = {
  lumberMill: { wood: 30, metal: 0 },
  miner: { wood: 60, metal: 15 },
} as const

export const BUILDING_BASE_PRODUCTION = {
  lumberMill: { wood: 0.2, metal: 0 },
  miner: { wood: 0, metal: 0.1 },
} as const

export const UPGRADE_DEFS = {
  betterAxe: {
    name: '도끼 개선',
    cost: { wood: 40, metal: 5 },
    effectText: '나무 줍기 +1',
  },
  sortingWork: {
    name: '분류 작업',
    cost: { wood: 70, metal: 20 },
    effectText: '금속 찾기 +1',
  },
  sharpSaw: {
    name: '톱날 개선',
    cost: { wood: 120, metal: 30 },
    effectText: '벌목소 생산 +25%',
  },
  drillBoost: {
    name: '드릴 개선',
    cost: { wood: 160, metal: 50 },
    effectText: '채굴기 생산 +25%',
  },
} as const

export const UNLOCK_CONDITIONS = {
  metalAction: { wood: 20, metal: 0 },
  lumberMill: { wood: 30, metal: 0 },
  miner: { wood: 60, metal: 15 },
} as const
