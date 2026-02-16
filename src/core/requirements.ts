import type { GameState } from './state.ts'
import type { ResourceId } from '../data/resources.ts'
import { formatResourceAmount } from '../data/resources.ts'
import { getBuildingLabel, type BuildingId } from '../data/buildings.ts'

export type Requirement =
  | { kind: 'resource'; resource: ResourceId; amount: number }
  | { kind: 'building'; building: BuildingId; count: number }
  | { kind: 'unlock'; unlock: keyof GameState['unlocks']; expected?: boolean }
  | { kind: 'all'; requirements: Requirement[] }
  | { kind: 'any'; requirements: Requirement[] }

export function isRequirementMet(state: GameState, requirement: Requirement): boolean {
  switch (requirement.kind) {
    case 'resource':
      return state.resources[requirement.resource] >= requirement.amount
    case 'building':
      return state.buildings[requirement.building] >= requirement.count
    case 'unlock':
      return state.unlocks[requirement.unlock] === (requirement.expected ?? true)
    case 'all':
      return requirement.requirements.every((entry) => isRequirementMet(state, entry))
    case 'any':
      return requirement.requirements.some((entry) => isRequirementMet(state, entry))
  }
}

export function getRequirementMissingText(state: GameState, requirement: Requirement): string | null {
  switch (requirement.kind) {
    case 'resource':
      return isRequirementMet(state, requirement) ? null : `${formatResourceAmount(requirement.resource, requirement.amount)} 필요`
    case 'building':
      return isRequirementMet(state, requirement) ? null : `${getBuildingLabel(requirement.building)} 필요`
    case 'unlock':
      return isRequirementMet(state, requirement) ? null : `${requirement.unlock} 조건 필요`
    case 'all': {
      for (const entry of requirement.requirements) {
        const missing = getRequirementMissingText(state, entry)
        if (missing) return missing
      }
      return null
    }
    case 'any': {
      if (isRequirementMet(state, requirement)) return null
      const options = requirement.requirements
        .map((entry) => getRequirementMissingText(state, entry))
        .filter((text): text is string => Boolean(text))
      return options.length > 0 ? options.join(' 또는 ') : '조건 필요'
    }
  }
}

export function areRequirementsMet(state: GameState, requirements: Requirement[]): boolean {
  return requirements.every((req) => isRequirementMet(state, req))
}

export function getMissingRequirementFromList(state: GameState, requirements: Requirement[]): string | null {
  for (const req of requirements) {
    const missing = getRequirementMissingText(state, req)
    if (missing) return missing
  }
  return null
}
