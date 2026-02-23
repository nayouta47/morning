export const COST_SCALE = 1.15

export const ACTION_DURATION_MS = {
  gatherWood: 30000,
  gatherScrap: 35000,
} as const

export const BUILDING_CYCLE_MS = 10000
export const SMELTING_CYCLE_MS = 60000

const UPGRADE_COST_DIVISOR = 4

function discountCost(value: number): number {
  return Math.max(1, Math.ceil(value / UPGRADE_COST_DIVISOR))
}

export const UPGRADE_DEFS = {
  betterAxe: {
    name: '도끼 개선',
    baseCost: { wood: 40, iron: 5 },
    effectText: '🪵 뗄감 줍기 +1',
  },
  sortingWork: {
    name: '분류 작업',
    baseCost: { wood: 70, iron: 20 },
    effectText: '🗑️ 고물 줍기 +1',
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
  moduleCraftingII: {
    name: '모듈 제작 II',
    baseCost: { wood: 240, iron: 120 },
    effectText: '모듈 제작 II 해금',
  },
} as const

export const RESEARCH_PANEL_UPGRADE_KEYS = ['moduleCraftingII'] as const

export const WEAPON_CRAFT_DURATION_MS = 30000

export const SMALL_HEAL_POTION_HEAL = 8
export const SMALL_HEAL_POTION_COOLDOWN_MS = 5000

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
