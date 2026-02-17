import { ACTION_DURATION_MS, BUILDING_CYCLE_MS } from '../data/balance.ts'
import type { GameState } from './state.ts'
import { getGatherScrapReward, getGatherWoodReward } from './rewards.ts'

export const ACTION_DEFS = {
  gatherWood: {
    durationMs: ACTION_DURATION_MS.gatherWood,
    startLog: '🪵 뗄감 줍기 시작',
    runningLog: '이미 뗄감을 줍는 중입니다.',
    completeLogPrefix: '🪵 뗄감',
    rewardResource: 'wood',
    getRewardAmount: getGatherWoodReward,
  },
  gatherScrap: {
    durationMs: ACTION_DURATION_MS.gatherScrap,
    startLog: '🗑️ 고물 줍기 시작',
    runningLog: '이미 고물을 줍는 중입니다.',
    completeLogPrefix: '🗑️ 고물',
    rewardResource: 'scrap',
    getRewardAmount: getGatherScrapReward,
  },
} as const satisfies Record<
  string,
  {
    durationMs: number
    startLog: string
    runningLog: string
    completeLogPrefix: string
    rewardResource: keyof GameState['resources']
    getRewardAmount: (state: GameState) => number
  }
>

export type ActionKey = keyof typeof ACTION_DEFS

export const ACTION_KEYS = Object.keys(ACTION_DEFS) as ActionKey[]

export const PRODUCTION_DEFS = {
  lumberMill: {
    cycleMs: BUILDING_CYCLE_MS,
    runningKey: 'lumberMill',
  },
  miner: {
    cycleMs: BUILDING_CYCLE_MS,
    runningKey: 'miner',
  },
  scavenger: {
    cycleMs: BUILDING_CYCLE_MS,
    runningKey: 'scavenger',
  },
} as const

export type ProductionKey = keyof typeof PRODUCTION_DEFS

export const PRODUCTION_KEYS = Object.keys(PRODUCTION_DEFS) as ProductionKey[]
