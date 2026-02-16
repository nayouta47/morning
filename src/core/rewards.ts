import type { GameState } from './state.ts'

export const SHOVEL_MAX_STACK = 5

export function getShovelCount(state: GameState): number {
  return Math.max(0, Math.floor(state.resources.shovel))
}

export function getGatherWoodReward(state: GameState): number {
  return 6 + (state.upgrades.betterAxe ? 1 : 0)
}

export function getGatherScrapReward(state: GameState): number {
  const base = 7 + (state.upgrades.sortingWork ? 1 : 0)
  return base + getShovelCount(state)
}
