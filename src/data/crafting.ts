import type { Buildings, CraftProgress, GameState } from '../core/state.ts'

export type CraftRecipeKey = keyof CraftProgress

type CraftRecipeDef = {
  requiredBuilding: keyof Buildings | null
}

export const CRAFT_RECIPE_DEFS: Record<CraftRecipeKey, CraftRecipeDef> = {
  pistol: { requiredBuilding: 'workbench' },
  rifle: { requiredBuilding: 'workbench' },
  module: { requiredBuilding: 'workbench' },
  shovel: { requiredBuilding: null },
}

function buildingLabel(key: keyof Buildings): string {
  if (key === 'lumberMill') return '벌목기'
  if (key === 'miner') return '분쇄기'
  if (key === 'workbench') return '제작대'
  return '실험실'
}

export function getCraftRecipeMissingRequirement(state: GameState, recipe: CraftRecipeKey): string | null {
  const requiredBuilding = CRAFT_RECIPE_DEFS[recipe].requiredBuilding
  if (!requiredBuilding) return null
  if (state.buildings[requiredBuilding] > 0) return null
  return `${buildingLabel(requiredBuilding)} 필요`
}

export function isCraftRecipeUnlocked(state: GameState, recipe: CraftRecipeKey): boolean {
  return getCraftRecipeMissingRequirement(state, recipe) === null
}
