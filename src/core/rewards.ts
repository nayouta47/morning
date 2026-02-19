import type { GameState } from './state.ts'

export const SHOVEL_MAX_STACK = 10
export const AXE_MAX_STACK = 10

export function getShovelCount(state: GameState): number {
  return Math.min(SHOVEL_MAX_STACK, Math.max(0, Math.floor(state.resources.shovel)))
}

export function getAxeCount(state: GameState): number {
  return Math.min(AXE_MAX_STACK, Math.max(0, Math.floor(state.resources.axe)))
}

function getShovelScrapBonus(shovelCount: number): number {
  return shovelCount * 7
}

function getAxeWoodBonus(axeCount: number): number {
  return axeCount * 6
}

export function getGatherWoodReward(state: GameState): number {
  return 6 + (state.upgrades.betterAxe ? 1 : 0) + getAxeWoodBonus(getAxeCount(state))
}

export function getGatherScrapReward(state: GameState): number {
  const base = 7 + (state.upgrades.sortingWork ? 1 : 0)
  return base + getShovelScrapBonus(getShovelCount(state))
}
