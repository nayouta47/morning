import {
  CRAFT_RECIPE_DEFS,
  getCraftRecipeCost,
  getCraftRecipeDuration,
  getModuleCraftTierLabel,
  getSelectedModuleCraftTier,
  isCraftRecipeUnlocked,
  type CraftRecipeKey,
} from '../../data/crafting.ts'
import type { ArmorType, GameState } from '../state.ts'
import { SHOVEL_MAX_STACK, getShovelCount } from '../rewards.ts'
import { canAfford, payCost } from './costs.ts'
import { narrate } from './logging.ts'

export function cycleArmorCraftType(state: GameState, step: -1 | 1): void {
  const types: ArmorType[] = ['junkArmor', 'ironArmor']
  const idx = types.indexOf(state.selectedArmorCraftType)
  const next = idx + step
  if (next < 0 || next >= types.length) return
  state.selectedArmorCraftType = types[next]
}

export function cycleModuleCraftTier(state: GameState, step: -1 | 1): void {
  const nextTier = state.selectedModuleCraftTier + step
  if (nextTier < 1 || nextTier > 3) return
  state.selectedModuleCraftTier = nextTier as 1 | 2 | 3
}

export function startCraft(state: GameState, recipeKey: CraftRecipeKey): void {
  const recipe = CRAFT_RECIPE_DEFS[recipeKey]

  if (recipeKey === 'shovel' && getShovelCount(state) >= SHOVEL_MAX_STACK) {
    narrate(state, '삽이 이미 충분하다.')
    return
  }

  if (!isCraftRecipeUnlocked(state, recipeKey)) {
    narrate(state, '요구 조건이 부족합니다.')
    return
  }

  if (state.craftProgress[recipeKey] > 0) {
    narrate(state, '작업이 이미 진행 중이다.')
    return
  }

  const recipeCost = getCraftRecipeCost(state, recipeKey)
  if (!canAfford(state.resources, recipeCost)) {
    narrate(state, '자원이 부족하다.')
    return
  }

  if (recipeKey === 'module') {
    state.moduleCraftTierInProgress = getSelectedModuleCraftTier(state)
  }

  const recipeDuration = getCraftRecipeDuration(state, recipeKey)
  payCost(state.resources, recipeCost)
  state.craftProgress[recipeKey] = recipeDuration
  const recipeLabel = recipeKey === 'module' ? getModuleCraftTierLabel(state.moduleCraftTierInProgress ?? 1) : recipe.label
  narrate(state, `${recipeLabel}을(를) 만들기 시작한다.`)
}
