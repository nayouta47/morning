import type { GameState } from './state.ts'

const SAVE_KEY = 'morning-save-v1'
const AUTOSAVE_MS = 5000

export function saveGame(state: GameState): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state))
}

export function loadGame(): GameState | null {
  const raw = localStorage.getItem(SAVE_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as GameState
  } catch {
    return null
  }
}

export function startAutosave(getState: () => GameState): number {
  return window.setInterval(() => {
    saveGame(getState())
  }, AUTOSAVE_MS)
}
