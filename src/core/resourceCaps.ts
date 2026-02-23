import { RESOURCE_IDS, type ResourceId } from '../data/resources.ts'
import type { Resources } from './state.ts'

export const RESOURCE_STORAGE_CAP = 2000

const EXCLUDED_FROM_GLOBAL_CAP = new Set<ResourceId>(['shovel', 'scavengerDrone', 'smallHealPotion', 'syntheticFood'])

export function isCappedResource(resourceId: ResourceId): boolean {
  return !EXCLUDED_FROM_GLOBAL_CAP.has(resourceId)
}

export function clampResourceAmount(resourceId: ResourceId, amount: number): number {
  const finiteAmount = Number.isFinite(amount) ? amount : 0
  const normalized = Math.max(0, finiteAmount)
  if (!isCappedResource(resourceId)) return normalized
  return Math.min(RESOURCE_STORAGE_CAP, normalized)
}

export function clampResourcesToStorageCaps(resources: Resources): void {
  RESOURCE_IDS.forEach((resourceId) => {
    resources[resourceId] = clampResourceAmount(resourceId, resources[resourceId])
  })
}

export function addResourceWithCap(
  resources: Resources,
  resourceId: ResourceId,
  amount: number,
): { added: number; discarded: number } {
  const delta = Math.max(0, Number.isFinite(amount) ? amount : 0)
  if (delta <= 0) return { added: 0, discarded: 0 }

  const current = clampResourceAmount(resourceId, resources[resourceId])
  const next = clampResourceAmount(resourceId, current + delta)
  resources[resourceId] = next

  const added = Math.max(0, next - current)
  return { added, discarded: Math.max(0, delta - added) }
}
