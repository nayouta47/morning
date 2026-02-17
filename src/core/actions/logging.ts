import type { GameState } from '../state.ts'

export function pushLog(state: GameState, text: string): void {
  state.log.push(text)
  if (state.log.length > 30) {
    state.log.splice(0, state.log.length - 30)
  }
}

export function appendLog(state: GameState, text: string): void {
  pushLog(state, text)
}
