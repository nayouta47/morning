import type { GameState } from './state.ts'

export const DEFAULT_COMPANION_NAME = '안내견 로봇'

export const COMPANION_DEPART_MESSAGES = [
  '가 코를 킁킁거리며 잔해 속으로 사라진다.',
  '가 꼬리를 흔들며 골목 저편으로 달려나갔다.',
  '가 낑낑거리며 고물 냄새를 따라간다.',
  '가 먼지 투성이 폐허를 향해 총총 걸어 들어간다.',
]

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
