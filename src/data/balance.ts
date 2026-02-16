export type ResourceKey = 'wood' | 'metal'

export const COST_SCALE = 1.15

export const ACTION_DURATION_MS = {
  gatherWood: 5000,
  gatherMetal: 7000,
} as const

export const BUILDING_CYCLE_MS = 10000

export const BUILDING_BASE_COST = {
  lumberMill: { wood: 30, metal: 0 },
  miner: { wood: 60, metal: 15 },
} as const

const UPGRADE_COST_DIVISOR = 4

function discountCost(value: number): number {
  return Math.max(1, Math.ceil(value / UPGRADE_COST_DIVISOR))
}

export const UPGRADE_DEFS = {
  betterAxe: {
    name: '도끼 개선',
    baseCost: { wood: 40, metal: 5 },
    effectText: '나무 줍기 +1',
  },
  sortingWork: {
    name: '분류 작업',
    baseCost: { wood: 70, metal: 20 },
    effectText: '금속 찾기 +1',
  },
  sharpSaw: {
    name: '톱날 개선',
    baseCost: { wood: 120, metal: 30 },
    effectText: '벌목소 생산 +25%',
  },
  drillBoost: {
    name: '드릴 개선',
    baseCost: { wood: 160, metal: 50 },
    effectText: '채굴기 생산 +25%',
  },
} as const

export const WEAPON_CRAFT_DURATION_MS = 30000

export const WEAPON_CRAFT_COST = {
  pistol: { wood: 25, metal: 8 },
  rifle: { wood: 50, metal: 20 },
} as const

export const MODULE_CRAFT_COST = {
  wood: 18,
  metal: 10,
} as const

export const WEAPON_BASE_STATS = {
  pistol: { damage: 3, cooldown: 5 },
  rifle: { damage: 8, cooldown: 10 },
} as const

export function getUpgradeCost(key: keyof typeof UPGRADE_DEFS): { wood: number; metal: number } {
  const base = UPGRADE_DEFS[key].baseCost
  return {
    wood: discountCost(base.wood),
    metal: discountCost(base.metal),
  }
}

export const UNLOCK_CONDITIONS = {
  metalAction: { wood: 20, metal: 0 },
  lumberMill: { wood: 30, metal: 0 },
  miner: { wood: 60, metal: 15 },
} as const
