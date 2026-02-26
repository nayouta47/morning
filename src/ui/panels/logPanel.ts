import type { GameState } from '../../core/state.ts'

export function renderCompactLogPanel(state: GameState): string {
  return `<section class="panel logs logs--compact"><h2>로그</h2><ul id="log-list" data-signature="${state.log.length}:${state.log[state.log.length - 1] ?? ''}">${[...state.log].reverse().map((line) => `<li>${line}</li>`).join('')}</ul></section>`
}
