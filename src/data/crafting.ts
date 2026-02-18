import type { CraftProgress, GameState, ModuleType, WeaponType } from '../core/state.ts'
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
    costs: { iron: 200, chromium: 5, molybdenum: 1 },
    requirements: [{ kind: 'building', building: 'workbench', count: 1 }],
    outputs: [{ kind: 'weapon', weaponType: 'rifle', count: 1 }],
  },
  module: {
    id: 'module',
    label: '모듈',
    durationMs: WEAPON_CRAFT_DURATION_MS,
    costs: { iron: 10, molybdenum: 1 },
    requirements: [{ kind: 'building', building: 'workbench', count: 1 }],
    outputs: [{ kind: 'moduleRandom', pool: ['damage', 'cooldown'], count: 1 }],
  },
  shovel: {
    id: 'shovel',
    label: '삽',
    durationMs: WEAPON_CRAFT_DURATION_MS,
    costs: { wood: 10 },
    requirements: [],
    outputs: [{ kind: 'resource', resource: 'shovel', amount: 1 }],
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
    costs: { scrap: 80, iron: 40, cobalt: 2 },
    requirements: [
      { kind: 'building', building: 'workbench', count: 1 },
      { kind: 'building', building: 'droneController', count: 1 },
    ],
    outputs: [{ kind: 'resource', resource: 'scavengerDrone', amount: 1 }],
  },
}

const SHOVEL_CRAFT_BASE_WOOD_COST = 10
const SHOVEL_CRAFT_COST_GROWTH = 1.35

export function getCraftRecipeCost(state: GameState, recipe: CraftRecipeKey): ResourceCost {
  if (recipe !== 'shovel') return CRAFT_RECIPE_DEFS[recipe].costs

  const shovelCount = Math.min(SHOVEL_MAX_STACK, getShovelCount(state))
  const woodCost = Math.ceil(SHOVEL_CRAFT_BASE_WOOD_COST * SHOVEL_CRAFT_COST_GROWTH ** shovelCount)
  return { wood: woodCost }
}

export function getCraftRecipeMissingRequirement(state: GameState, recipe: CraftRecipeKey): string | null {
  return getMissingRequirementFromList(state, CRAFT_RECIPE_DEFS[recipe].requirements)
}

export function isCraftRecipeUnlocked(state: GameState, recipe: CraftRecipeKey): boolean {
  return areRequirementsMet(state, CRAFT_RECIPE_DEFS[recipe].requirements)
}
