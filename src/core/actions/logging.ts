import type { GameState } from '../state.ts'

export function narrate(state: GameState, text: string): void {
  state.messages.push(text)
  if (state.messages.length > 30) {
    state.messages.splice(0, state.messages.length - 30)
  }
}
