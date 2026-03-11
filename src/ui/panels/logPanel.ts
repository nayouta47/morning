import type { GameState } from '../../core/state.ts'

export function renderCompactLogPanel(state: GameState): string {
  return `<section class="panel logs logs--compact"><div class="logs-header"><h2>로그</h2><button class="log-clear-btn" type="button" data-clear-log aria-label="로그 비우기" title="로그 비우기">🗑️</button></div><ul id="log-list" data-signature="${state.messages.length}:${state.messages[state.messages.length - 1] ?? ''}">${[...state.messages].reverse().map((line) => `<li>${line}</li>`).join('')}</ul></section>`
}
