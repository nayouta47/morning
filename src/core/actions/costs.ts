import type { ResourceCost, ResourceId } from '../../data/resources.ts'
import type { Resources } from '../state.ts'

export function canAfford(resources: Resources, cost: ResourceCost): boolean {
  return Object.entries(cost).every(([key, value]) => {
    if (!value || value <= 0) return true
    return resources[key as ResourceId] >= value
  })
}

export function payCost(resources: Resources, cost: ResourceCost): void {
  Object.entries(cost).forEach(([key, value]) => {
    if (!value || value <= 0) return
    resources[key as ResourceId] -= value
  })
}
