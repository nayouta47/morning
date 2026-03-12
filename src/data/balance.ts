import type { ResourceCost } from './resources.ts'

export const COST_SCALE = 1.15

export const ACTION_DURATION_MS = {
  goToWork: 8000,
  gatherWood: 5000,
  gatherScrap: 35000,
  recoverGuideRobot: 7000,
  goForWalk: 10000,
  contactFamily: 6000,
  cryoSleep: 4000,
} as const

export const BUILDING_CYCLE_MS = 10000
export const SMELTING_CYCLE_MS = 60000

const UPGRADE_COST_DIVISOR = 4

function discountCost(value: number): number {
  return Math.max(1, Math.ceil(value / UPGRADE_COST_DIVISOR))
}

export const UPGRADE_DEFS = {
  adoptDog: {
    name: '강아지 분양받기',
    cost: { cash: 3 },
    effectText: '산책하기 해금',
  },
  visitHospital: {
    name: '병원가기',
    cost: { cash: 3 },
    effectText: '다음 단계 해금',
  },
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
  organicFilament: {
    name: '유기물 필라멘트',
    baseCost: { wood: 180, iron: 70 },
    effectText: '무작위맛 통조림·회복약(소) 제작 해금',
  },
  moduleCraftingII: {
    name: '배선:코발트 라이너',
    baseCost: { wood: 240, iron: 120, chromium: 40, molybdenum: 12, cobalt: 8 },
    effectText: '모듈 제작 II 해금',
  },
  moduleCraftingIII: {
    name: '패키징:고합금강',
    baseCost: { wood: 320, iron: 180, cobalt: 20, highAlloySteel: 4 },
    effectText: '모듈 제작 III 해금',
  },
  cannedMetalTech: {
    name: '금속 통조림 기술',
    cost: { iron: 1200, lowAlloySteel: 12 },
    effectText: '창고 상한 5000',
  },
} as const

export const RESEARCH_PANEL_GROUPS = [
  {
    label: '일상',
    keys: ['adoptDog', 'visitHospital'] as const,
    requiresLab: false,
  },
  {
    label: '모듈 연구',
    keys: ['moduleCraftingII', 'moduleCraftingIII'] as const,
    requiresLab: true,
  },
  {
    label: '생산 연구',
    keys: ['organicFilament', 'cannedMetalTech'] as const,
    requiresLab: true,
  },
] as const

export const RESEARCH_PANEL_UPGRADE_KEYS = RESEARCH_PANEL_GROUPS.flatMap((g) => g.keys)

export const COMPANION_IDLE_MIN_MS = 15_000
export const COMPANION_IDLE_MAX_MS = 45_000

export const WEAPON_CRAFT_DURATION_MS = 30000

export const SMALL_HEAL_POTION_HEAL = 8
export const SMALL_HEAL_POTION_COOLDOWN_MS = 5000

export const WEAPON_BASE_STATS = {
  pistol: { damage: 3, cooldown: 5 },
  rifle: { damage: 8, cooldown: 10 },
} as const

export const WEAPON_DISPLAY_STATS = {
  pistol: { accuracy: 82, range: 30, weight: 1.2 },
  rifle: { accuracy: 74, range: 95, weight: 4.1 },
} as const

export function getUpgradeCost(key: keyof typeof UPGRADE_DEFS): ResourceCost {
  const def = UPGRADE_DEFS[key]
  if ('cost' in def) return def.cost

  return Object.fromEntries(
    Object.entries(def.baseCost)
      .filter(([, amount]) => amount > 0)
      .map(([resourceId, amount]) => [resourceId, discountCost(amount)]),
  ) as ResourceCost
}
