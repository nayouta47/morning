import type { LootEntry } from './state.ts'
import type { ResourceId } from '../data/resources.ts'

export const EXPLORATION_BACKPACK_MAX_WEIGHT = 50

const RESOURCE_UNIT_WEIGHT: Partial<Record<ResourceId, number>> = {
  scrap: 0.1,
  iron: 0.3,
}
const DEFAULT_UNIT_WEIGHT = 1

export function getResourceUnitWeight(resourceId: ResourceId): number {
  return RESOURCE_UNIT_WEIGHT[resourceId] ?? DEFAULT_UNIT_WEIGHT
}

export function getBackpackResourceAmount(backpack: LootEntry[], resourceId: ResourceId): number {
  return backpack.reduce((sum, entry) => (entry.resource === resourceId ? sum + entry.amount : sum), 0)
}

export function getBackpackUsedWeight(backpack: LootEntry[]): number {
  return backpack.reduce((sum, entry) => sum + Math.max(0, Math.floor(entry.amount)) * getResourceUnitWeight(entry.resource), 0)
}

export function getBackpackRemainingWeight(backpack: LootEntry[], maxWeight: number): number {
  return Math.max(0, maxWeight - getBackpackUsedWeight(backpack))
}

export function addResourceToBackpack(
  backpack: LootEntry[],
  resourceId: ResourceId,
  amount: number,
  maxWeight: number,
): { added: number; remaining: number } {
  const requested = Math.max(0, Math.floor(amount))
  if (requested <= 0) return { added: 0, remaining: 0 }

  const unitWeight = getResourceUnitWeight(resourceId)
  const remainingWeight = getBackpackRemainingWeight(backpack, maxWeight)
  const maxAddable = unitWeight > 0 ? Math.floor(remainingWeight / unitWeight) : requested
  const added = Math.min(requested, maxAddable)

  if (added > 0) {
    const existing = backpack.find((entry) => entry.resource === resourceId)
    if (existing) {
      existing.amount += added
    } else {
      backpack.push({ resource: resourceId, amount: added })
    }
  }

  return { added, remaining: requested - added }
}

export function removeResourceFromBackpack(backpack: LootEntry[], resourceId: ResourceId, amount: number): number {
  const requested = Math.max(0, Math.floor(amount))
  if (requested <= 0) return 0

  const entry = backpack.find((item) => item.resource === resourceId)
  if (!entry) return 0

  const removed = Math.min(requested, entry.amount)
  entry.amount -= removed

  if (entry.amount <= 0) {
    const index = backpack.indexOf(entry)
    if (index >= 0) backpack.splice(index, 1)
  }

  return removed
}

export function normalizeBackpackEntries(entries: unknown, maxWeight = EXPLORATION_BACKPACK_MAX_WEIGHT): LootEntry[] {
  if (!Array.isArray(entries)) return []

  const normalized: LootEntry[] = []
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue
    const resource = (entry as { resource?: unknown }).resource
    const amount = (entry as { amount?: unknown }).amount
    if (typeof resource !== 'string' || typeof amount !== 'number') continue

    const { remaining } = addResourceToBackpack(normalized, resource as ResourceId, amount, maxWeight)
    if (remaining > 0) break
  }

  return normalized
}
