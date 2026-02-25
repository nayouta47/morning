import type { CraftProgress, GameState, ModuleType, ModuleCraftTier, WeaponType } from '../core/state.ts'
import { SHOVEL_MAX_STACK, getShovelCount } from '../core/rewards.ts'
import type { ResourceCost } from './resources.ts'
import { getMissingRequirementFromList, areRequirementsMet, type Requirement } from '../core/requirements.ts'
import { WEAPON_CRAFT_DURATION_MS } from './balance.ts'

export type CraftRecipeKey = keyof CraftProgress

type CraftOutput =
  | { kind: 'weapon'; weaponType: WeaponType; count: number }
  | { kind: 'resource'; resource: keyof GameState['resources']; amount: number }
  | { kind: 'moduleRandom'; pool: ModuleType[]; count: number }

export type CraftRecipeDef = {
  id: CraftRecipeKey
  label: string
  durationMs: number
  costs: ResourceCost
  requirements: Requirement[]
  outputs: CraftOutput[]
}

export const CRAFT_RECIPE_DEFS: Record<CraftRecipeKey, CraftRecipeDef> = {
  pistol: {
    id: 'pistol',
    label: '권총',
    durationMs: WEAPON_CRAFT_DURATION_MS,
    costs: { iron: 50, chromium: 1 },
    requirements: [{ kind: 'building', building: 'workbench', count: 1 }],
    outputs: [{ kind: 'weapon', weaponType: 'pistol', count: 1 }],
  },
  rifle: {
    id: 'rifle',
    label: '소총',
    durationMs: WEAPON_CRAFT_DURATION_MS,
    costs: { iron: 200, lowAlloySteel: 2 },
    requirements: [{ kind: 'building', building: 'workbench', count: 1 }],
    outputs: [{ kind: 'weapon', weaponType: 'rifle', count: 1 }],
  },
  module: {
    id: 'module',
    label: '모듈 제작 I',
    durationMs: WEAPON_CRAFT_DURATION_MS,
    costs: { iron: 200, molybdenum: 1 },
    requirements: [{ kind: 'building', building: 'workbench', count: 1 }],
    outputs: [{ kind: 'moduleRandom', pool: ['damage', 'cooldown', 'blockAmplifierUp', 'blockAmplifierDown'], count: 1 }],
  },
  shovel: {
    id: 'shovel',
    label: '삽',
    durationMs: WEAPON_CRAFT_DURATION_MS,
    costs: { wood: 10 },
    requirements: [],
    outputs: [{ kind: 'resource', resource: 'shovel', amount: 1 }],
  },


  syntheticFood: {
    id: 'syntheticFood',
    label: '인조식량',
    durationMs: WEAPON_CRAFT_DURATION_MS,
    costs: { carbon: 1 },
    requirements: [{ kind: 'building', building: 'workbench', count: 1 }],
    outputs: [{ kind: 'resource', resource: 'syntheticFood', amount: 1 }],
  },
  smallHealPotion: {
    id: 'smallHealPotion',
    label: '회복약(소)',
    durationMs: WEAPON_CRAFT_DURATION_MS,
    costs: { iron: 10, chromium: 1, carbon: 1 },
    requirements: [{ kind: 'building', building: 'workbench', count: 1 }],
    outputs: [{ kind: 'resource', resource: 'smallHealPotion', amount: 1 }],
  },
  scavengerDrone: {
    id: 'scavengerDrone',
    label: '스캐빈저 드론',
    durationMs: WEAPON_CRAFT_DURATION_MS,
    costs: { iron: 500, cobalt: 2 },
    requirements: [
      { kind: 'building', building: 'workbench', count: 1 },
      { kind: 'building', building: 'droneController', count: 1 },
    ],
    outputs: [{ kind: 'resource', resource: 'scavengerDrone', amount: 1 }],
  },
}

const SHOVEL_CRAFT_BASE_WOOD_COST = 10
const SHOVEL_CRAFT_COST_GROWTH = 1.35
const SHOVEL_CRAFT_BASE_DURATION_MS = 10_000
const SHOVEL_CRAFT_DURATION_INCREMENT_MS = 3_000
const SCAVENGER_DRONE_BASE_IRON_COST = 500
const SCAVENGER_DRONE_COBALT_COST = 2
const SCAVENGER_DRONE_IRON_COST_GROWTH = 1.15

export function getSelectedModuleCraftTier(state: GameState): ModuleCraftTier {
  if (state.selectedModuleCraftTier === 3) return 3
  if (state.selectedModuleCraftTier === 2) return 2
  return 1
}

export function getActiveModuleCraftTier(state: GameState): ModuleCraftTier {
  return state.moduleCraftTierInProgress ?? getSelectedModuleCraftTier(state)
}

export function getModuleCraftTierLabel(tier: ModuleCraftTier): string {
  if (tier === 3) return '모듈 제작 III'
  if (tier === 2) return '모듈 제작 II'
  return '모듈 제작 I'
}

export function getModuleCraftPoolByTier(tier: ModuleCraftTier): ModuleType[] {
  return tier >= 2
    ? ['preheater', 'heatAmplifierLeft', 'heatAmplifierRight']
    : ['damage', 'cooldown', 'blockAmplifierUp', 'blockAmplifierDown']
}

export function getCraftRecipeDuration(state: GameState, recipe: CraftRecipeKey): number {
  if (recipe === 'module') {
    const base = CRAFT_RECIPE_DEFS.module.durationMs
    const tier = getActiveModuleCraftTier(state)
    if (tier === 3) return base * 3
    if (tier === 2) return base * 2
    return base
  }

  if (recipe !== 'shovel') return CRAFT_RECIPE_DEFS[recipe].durationMs

  const shovelCount = Math.min(SHOVEL_MAX_STACK, getShovelCount(state))
  return SHOVEL_CRAFT_BASE_DURATION_MS + shovelCount * SHOVEL_CRAFT_DURATION_INCREMENT_MS
}

export function getCraftRecipeCost(state: GameState, recipe: CraftRecipeKey): ResourceCost {
  if (recipe === 'module') {
    const tier = getActiveModuleCraftTier(state)
    if (tier === 3) {
      return { lowAlloySteel: 1, highAlloySteel: 1, cobalt: 1 }
    }
    if (tier === 2) {
      return { iron: 200, chromium: 4, molybdenum: 2, cobalt: 1 }
    }
    return CRAFT_RECIPE_DEFS.module.costs
  }

  if (recipe === 'shovel') {
    const shovelCount = Math.min(SHOVEL_MAX_STACK, getShovelCount(state))
    const woodCost = Math.ceil(SHOVEL_CRAFT_BASE_WOOD_COST * SHOVEL_CRAFT_COST_GROWTH ** shovelCount)
    return { wood: woodCost }
  }

  if (recipe === 'scavengerDrone') {
    const droneCount = Math.max(0, Math.floor(state.resources.scavengerDrone))
    const ironCost = Math.ceil(SCAVENGER_DRONE_BASE_IRON_COST * SCAVENGER_DRONE_IRON_COST_GROWTH ** droneCount)
    return {
      iron: ironCost,
      cobalt: SCAVENGER_DRONE_COBALT_COST,
    }
  }

  return CRAFT_RECIPE_DEFS[recipe].costs
}

export function getCraftRecipeMissingRequirement(state: GameState, recipe: CraftRecipeKey): string | null {
  const missing = getMissingRequirementFromList(state, CRAFT_RECIPE_DEFS[recipe].requirements)
  if (missing) return missing
  if ((recipe === 'syntheticFood' || recipe === 'smallHealPotion') && !state.upgrades.organicFilament) {
    return '연구 필요: 유기물 필라멘트'
  }
  if (recipe === 'module') {
    const tier = getSelectedModuleCraftTier(state)
    if (tier >= 3 && !state.upgrades.moduleCraftingIII) return '연구 필요: 모듈 제작 III'
    if (tier >= 2 && !state.upgrades.moduleCraftingII) return '연구 필요: 모듈 제작 II'
  }
  return null
}

export function isCraftRecipeUnlocked(state: GameState, recipe: CraftRecipeKey): boolean {
  if (!areRequirementsMet(state, CRAFT_RECIPE_DEFS[recipe].requirements)) return false
  if ((recipe === 'syntheticFood' || recipe === 'smallHealPotion') && !state.upgrades.organicFilament) return false
  if (recipe === 'module') {
    const tier = getSelectedModuleCraftTier(state)
    if (tier >= 3 && !state.upgrades.moduleCraftingIII) return false
    if (tier >= 2 && !state.upgrades.moduleCraftingII) return false
  }
  return true
}
