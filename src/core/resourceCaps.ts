import { RESOURCE_IDS, type ResourceId } from '../data/resources.ts'
import type { GameState, Resources } from './state.ts'

export const BASE_RESOURCE_STORAGE_CAP = 2000
export const EXPANDED_RESOURCE_STORAGE_CAP = 5000

const EXCLUDED_FROM_GLOBAL_CAP = new Set<ResourceId>(['cash', 'shovel', 'scavengerDrone', 'smallHealPotion', 'syntheticFood'])

export function getResourceStorageCap(state: Pick<GameState, 'upgrades'>): number {
  return state.upgrades.cannedMetalTech ? EXPANDED_RESOURCE_STORAGE_CAP : BASE_RESOURCE_STORAGE_CAP
}

export function isCappedResource(resourceId: ResourceId): boolean {
  return !EXCLUDED_FROM_GLOBAL_CAP.has(resourceId)
}

export function clampResourceAmount(resourceId: ResourceId, amount: number, storageCap = BASE_RESOURCE_STORAGE_CAP): number {
  const finiteAmount = Number.isFinite(amount) ? amount : 0
  const normalized = Math.max(0, finiteAmount)
  if (!isCappedResource(resourceId)) return normalized
  return Math.min(storageCap, normalized)
}

export function clampResourcesToStorageCaps(resources: Resources, storageCap = BASE_RESOURCE_STORAGE_CAP): void {
  RESOURCE_IDS.forEach((resourceId) => {
    resources[resourceId] = clampResourceAmount(resourceId, resources[resourceId], storageCap)
  })
}

export function addResourceWithCap(
  resources: Resources,
  resourceId: ResourceId,
  amount: number,
  storageCap = BASE_RESOURCE_STORAGE_CAP,
): { added: number; discarded: number } {
  const delta = Math.max(0, Number.isFinite(amount) ? amount : 0)
  if (delta <= 0) return { added: 0, discarded: 0 }

  const current = clampResourceAmount(resourceId, resources[resourceId], storageCap)
  const next = clampResourceAmount(resourceId, current + delta, storageCap)
  resources[resourceId] = next

  const added = Math.max(0, next - current)
  return { added, discarded: Math.max(0, delta - added) }
}
