import type { GameState } from './state.ts'

export const SHOVEL_MAX_STACK = 10
const GATHER_SCRAP_BASE_DURATION_MS = 35000
const GATHER_SCRAP_DURATION_INCREMENT_MS = 5000
const GATHER_SCRAP_THROUGHPUT_DENOMINATOR = 7

export function getShovelCount(state: GameState): number {
  return Math.min(SHOVEL_MAX_STACK, Math.max(0, Math.floor(state.resources.shovel)))
}

function getShovelScrapBonus(shovelCount: number): number {
  return shovelCount * 7
}

export function getGatherWoodReward(state: GameState): number {
  return 6 + (state.upgrades.betterAxe ? 1 : 0)
}

export function getGatherScrapBaseReward(state: GameState): number {
  const base = 7 + (state.upgrades.sortingWork ? 1 : 0)
  return base + getShovelScrapBonus(getShovelCount(state))
}

export function getGatherScrapDurationMs(state: GameState): number {
  return GATHER_SCRAP_BASE_DURATION_MS + getShovelCount(state) * GATHER_SCRAP_DURATION_INCREMENT_MS
}

export function getGatherScrapRewardPreview(state: GameState): number {
  const shovelCount = getShovelCount(state)
  const numerator = getGatherScrapBaseReward(state) * (GATHER_SCRAP_THROUGHPUT_DENOMINATOR + shovelCount)
  return Math.floor((numerator + state.gatherScrapRewardRemainderSevenths) / GATHER_SCRAP_THROUGHPUT_DENOMINATOR)
}

export function resolveGatherScrapReward(state: GameState): number {
  const shovelCount = getShovelCount(state)
  const scaledNumerator =
    getGatherScrapBaseReward(state) * (GATHER_SCRAP_THROUGHPUT_DENOMINATOR + shovelCount) +
    state.gatherScrapRewardRemainderSevenths

  const reward = Math.floor(scaledNumerator / GATHER_SCRAP_THROUGHPUT_DENOMINATOR)
  state.gatherScrapRewardRemainderSevenths = scaledNumerator % GATHER_SCRAP_THROUGHPUT_DENOMINATOR
  return reward
}
