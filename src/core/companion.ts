import type { GameState } from './state.ts'

export const DEFAULT_COMPANION_NAME = '안내견 로봇'

export function getCompanionName(state: GameState): string {
  return state.robotName?.trim() || DEFAULT_COMPANION_NAME
}

export function validateCompanionName(name: string): { valid: boolean; normalized: string } {
  const normalized = name.trim()
  return {
    valid: normalized.length >= 1 && normalized.length <= 12,
    normalized,
  }
}
