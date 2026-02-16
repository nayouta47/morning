export type ResourceKey = 'wood' | 'scrap' | 'iron' | 'chromium' | 'molybdenum' | 'shovel'

export const COST_SCALE = 1.15

export const ACTION_DURATION_MS = {
  gatherWood: 30000,
  gatherScrap: 35000,
} as const

export const BUILDING_CYCLE_MS = 10000

export const BUILDING_BASE_COST = {
  lumberMill: { wood: 0, scrap: 10, iron: 0 },
  miner: { wood: 200, scrap: 15, iron: 0 },
  workbench: { wood: 120, scrap: 20, iron: 0 },
  lab: { wood: 220, scrap: 50, iron: 30 },
} as const

const UPGRADE_COST_DIVISOR = 4

function discountCost(value: number): number {
  return Math.max(1, Math.ceil(value / UPGRADE_COST_DIVISOR))
}

export const UPGRADE_DEFS = {
  betterAxe: {
    name: '도끼 개선',
    baseCost: { wood: 40, iron: 5 },
    effectText: '나무 줍기 +1',
  },
  sortingWork: {
    name: '분류 작업',
    baseCost: { wood: 70, iron: 20 },
    effectText: '고물 줍기 +1',
  },
  sharpSaw: {
    name: '톱날 개선',
    baseCost: { wood: 120, iron: 30 },
    effectText: '벌목기 생산 +25%',
  },
  drillBoost: {
    name: '드릴 개선',
    baseCost: { wood: 160, iron: 50 },
    effectText: '분쇄기 처리량 +25%',
  },
} as const

export const WEAPON_CRAFT_DURATION_MS = 30000

export const WEAPON_CRAFT_COST = {
  pistol: { iron: 50, chromium: 1 },
  rifle: { iron: 200, chromium: 5, molybdenum: 1 },
} as const

export const SHOVEL_CRAFT_COST = {
  wood: 10,
} as const

export const MODULE_CRAFT_COST = {
  wood: 18,
  iron: 10,
} as const

export const WEAPON_BASE_STATS = {
  pistol: { damage: 3, cooldown: 5 },
  rifle: { damage: 8, cooldown: 10 },
} as const

export function getUpgradeCost(key: keyof typeof UPGRADE_DEFS): { wood: number; iron: number } {
  const base = UPGRADE_DEFS[key].baseCost
  return {
    wood: discountCost(base.wood),
    iron: discountCost(base.iron),
  }
}

export const UNLOCK_CONDITIONS = {
  lumberMill: { wood: 0, scrap: 0, iron: 0 },
  miner: { wood: 0, scrap: 0, iron: 0 },
} as const
