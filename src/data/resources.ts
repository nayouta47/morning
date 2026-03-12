export const RESOURCE_DEFS = {
  cash: { id: 'cash', label: '현금', emoji: '💵', order: 0, precision: 0 },
  wood: { id: 'wood', label: '뗄감', emoji: '🪵', order: 1, precision: 1 },
  scrap: { id: 'scrap', label: '고물', emoji: '🗑️', order: 2, precision: 1 },
  iron: { id: 'iron', label: '철', emoji: '⛓️', order: 3, precision: 1 },
  chromium: { id: 'chromium', label: '크롬', emoji: '🟢', order: 4, precision: 1 },
  molybdenum: { id: 'molybdenum', label: '몰리브덴', emoji: '🔵', order: 5, precision: 1 },
  cobalt: { id: 'cobalt', label: '코발트', emoji: '🟣', order: 6, precision: 1 },
  shovel: { id: 'shovel', label: '삽', emoji: '🪏', order: 7, precision: 0 },
  scavengerDrone: { id: 'scavengerDrone', label: '스캐빈저 드론', emoji: '🛸', order: 8, precision: 0 },
  syntheticFood: { id: 'syntheticFood', label: '무작위맛 통조림', emoji: '🍱', order: 9, precision: 0 },
  smallHealPotion: { id: 'smallHealPotion', label: '회복약(소)', emoji: '🧪', order: 10, precision: 0 },
  siliconMass: { id: 'siliconMass', label: '규소 덩어리', emoji: '🧱', order: 11, precision: 0 },
  carbon: { id: 'carbon', label: '탄소', emoji: '⚫', order: 12, precision: 0 },
  siliconIngot: { id: 'siliconIngot', label: '규소 주괴', emoji: '🗞️', order: 13, precision: 0 },
  nickel: { id: 'nickel', label: '니켈', emoji: '🟡', order: 14, precision: 0 },
  lowAlloySteel: { id: 'lowAlloySteel', label: '저합금강', emoji: '🔗', order: 15, precision: 0 },
  highAlloySteel: { id: 'highAlloySteel', label: '고합금강', emoji: '🖇️', order: 16, precision: 0 },
} as const

export type ResourceId = keyof typeof RESOURCE_DEFS

export type ResourceCost = Partial<Record<ResourceId, number>>

export const RESOURCE_IDS = Object.keys(RESOURCE_DEFS) as ResourceId[]

export function getResourceDisplay(resourceId: ResourceId): string {
  const def = RESOURCE_DEFS[resourceId]
  return `${def.emoji}${def.label}`
}

export function formatResourceAmount(resourceId: ResourceId, amount: number | string): string {
  return `${getResourceDisplay(resourceId)} ${amount}`
}

export function formatResourceValue(resourceId: ResourceId, amount: number): string {
  const precision = RESOURCE_DEFS[resourceId].precision
  return amount.toFixed(precision)
}

export function formatCost(cost: ResourceCost): string {
  return RESOURCE_IDS
    .filter((id) => (cost[id] ?? 0) > 0)
    .sort((a, b) => RESOURCE_DEFS[a].order - RESOURCE_DEFS[b].order)
    .map((id) => formatResourceAmount(id, cost[id] ?? 0))
    .join(', ')
}
