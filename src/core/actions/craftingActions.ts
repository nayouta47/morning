import {
  CRAFT_RECIPE_DEFS,
  getCraftRecipeCost,
  getCraftRecipeDuration,
  getModuleCraftTierLabel,
  getSelectedModuleCraftTier,
  isCraftRecipeUnlocked,
  type CraftRecipeKey,
} from '../../data/crafting.ts'
import type { GameState } from '../state.ts'
import { SHOVEL_MAX_STACK, getShovelCount } from '../rewards.ts'
import { canAfford, payCost } from './costs.ts'
import { pushLog } from './logging.ts'

export function cycleModuleCraftTier(state: GameState, step: -1 | 1): void {
  const nextTier = state.selectedModuleCraftTier + step
  if (nextTier < 1 || nextTier > 2) return
  state.selectedModuleCraftTier = nextTier as 1 | 2
}

export function startCraft(state: GameState, recipeKey: CraftRecipeKey): void {
  const recipe = CRAFT_RECIPE_DEFS[recipeKey]

  if (recipeKey === 'shovel' && getShovelCount(state) >= SHOVEL_MAX_STACK) {
    pushLog(state, '삽 보유량이 최대치입니다.')
    return
  }

  if (!isCraftRecipeUnlocked(state, recipeKey)) {
    pushLog(state, '요구 조건이 부족합니다.')
    return
  }

  if (state.craftProgress[recipeKey] > 0) {
    pushLog(state, '이미 제작 중입니다.')
    return
  }

  const recipeCost = getCraftRecipeCost(state, recipeKey)
  if (!canAfford(state.resources, recipeCost)) {
    pushLog(state, '자원이 부족합니다.')
    return
  }

  if (recipeKey === 'module') {
    state.moduleCraftTierInProgress = getSelectedModuleCraftTier(state)
  }

  const recipeDuration = getCraftRecipeDuration(state, recipeKey)
  payCost(state.resources, recipeCost)
  state.craftProgress[recipeKey] = recipeDuration
  const recipeLabel = recipeKey === 'module' ? getModuleCraftTierLabel(state.moduleCraftTierInProgress ?? 1) : recipe.label
  pushLog(state, `${recipeLabel} 제작 시작 (${Math.round(recipeDuration / 1000)}초)`)
}
