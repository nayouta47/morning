import type { GameState } from './state.ts'

export const SHOVEL_MAX_STACK = 5

export function getShovelCount(state: GameState): number {
  return Math.min(SHOVEL_MAX_STACK, Math.max(0, Math.floor(state.resources.shovel)))
}

function getShovelScrapBonus(shovelCount: number): number {
  let bonus = 0
  for (let i = 0; i < shovelCount; i += 1) {
    bonus += SHOVEL_MAX_STACK - i
  }
  return bonus
}

export function getGatherWoodReward(state: GameState): number {
  return 6 + (state.upgrades.betterAxe ? 1 : 0)
}

export function getGatherScrapReward(state: GameState): number {
  const base = 7 + (state.upgrades.sortingWork ? 1 : 0)
  return base + getShovelScrapBonus(getShovelCount(state))
}
