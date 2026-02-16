export const RESOURCE_DEFS = {
  wood: { id: 'wood', label: '나무', emoji: '🪵', order: 1, precision: 1 },
  scrap: { id: 'scrap', label: '고물', emoji: '🗑️', order: 2, precision: 1 },
  iron: { id: 'iron', label: '철', emoji: '⛓️', order: 3, precision: 1 },
  chromium: { id: 'chromium', label: '크롬', emoji: '🟢', order: 4, precision: 1 },
  molybdenum: { id: 'molybdenum', label: '몰리브덴', emoji: '🔵', order: 5, precision: 1 },
  shovel: { id: 'shovel', label: '삽', emoji: '🪏', order: 6, precision: 0 },
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
