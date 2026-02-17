import { CRAFT_RECIPE_DEFS, getCraftRecipeCost, isCraftRecipeUnlocked, type CraftRecipeKey } from '../../data/crafting.ts'
import type { GameState } from '../state.ts'
import { SHOVEL_MAX_STACK, getShovelCount } from '../rewards.ts'
import { canAfford, payCost } from './costs.ts'
import { pushLog } from './logging.ts'

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

  payCost(state.resources, recipeCost)
  state.craftProgress[recipeKey] = recipe.durationMs
  pushLog(state, `${recipe.label} 제작 시작 (${Math.round(recipe.durationMs / 1000)}초)`)
}
