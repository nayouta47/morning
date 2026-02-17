import type { GameState } from '../../core/state.ts'
import { getResourceDisplay, type ResourceId } from '../../data/resources.ts'
import { renderExplorationCombatOverlay } from './combatOverlay.ts'

export function renderExplorationMap(state: GameState): string {
  const size = state.exploration.mapSize
  const radius = 4
  const { x, y } = state.exploration.position
  const rows: string[] = []

  for (let yy = y - radius; yy <= y + radius; yy += 1) {
    const tokens: string[] = []
    for (let xx = x - radius; xx <= x + radius; xx += 1) {
      if (xx < 0 || yy < 0 || xx >= size || yy >= size) tokens.push('⬛')
      else if (xx === x && yy === y) tokens.push('🧍')
      else if (xx === state.exploration.start.x && yy === state.exploration.start.y) tokens.push('🏠')
      else if (state.exploration.visited.includes(`${xx},${yy}`)) tokens.push('▫️')
      else tokens.push('⬛')
    }
    rows.push(tokens.join(' '))
  }
  return rows.join('\n')
}

function renderExplorationBody(state: GameState): string {
  const isActive = state.exploration.mode === 'active'
  if (!isActive) {
    return `<div class="exploration-loadout"><p class="hint">탐험 준비: 인벤토리/무기 조합을 확인한 뒤 수동으로 출발합니다.</p><p class="hint">선택 무기: <strong>${state.selectedWeaponId ?? '없음'}</strong></p><p class="hint">HP <strong id="exploration-hp">${state.exploration.hp}/${state.exploration.maxHp}</strong></p><button id="exploration-start">탐험 출발</button></div>`
  }

  const backpackUsed = state.exploration.backpack.reduce((sum, entry) => sum + entry.amount, 0)
  const baseInfo = `<p class="hint">HP <strong id="exploration-hp">${state.exploration.hp}/${state.exploration.maxHp}</strong> · 위치 <strong id="exploration-pos">(${state.exploration.position.x}, ${state.exploration.position.y})</strong> · 배낭 <strong>${backpackUsed}/${state.exploration.backpackCapacity}</strong></p>`

  if (state.exploration.phase === 'combat' && state.exploration.combat) {
    return `<div class="exploration-active">${baseInfo}<div class="exploration-map-stage"><pre class="exploration-map" id="exploration-map">${renderExplorationMap(state)}</pre><div class="exploration-combat-backdrop" aria-hidden="true"></div>${renderExplorationCombatOverlay(state)}</div><p class="hint">전투 중... 자동 사격이 진행됩니다. (도주 불가)</p></div>`
  }

  if (state.exploration.phase === 'loot') {
    const lootRows = state.exploration.pendingLoot
      .map((entry) => `<button data-loot-resource="${entry.resource as ResourceId}">획득: ${getResourceDisplay(entry.resource)} +${entry.amount}</button>`)
      .join('')
    return `<div class="exploration-active">${baseInfo}<div class="exploration-combat-box"><p>전리품 선택</p>${lootRows || '<p class="hint">가져갈 수 있는 전리품이 없다.</p>'}<button id="exploration-continue">계속 이동</button></div><pre class="exploration-map" id="exploration-map">${renderExplorationMap(state)}</pre></div>`
  }

  return `<div class="exploration-active">${baseInfo}<pre class="exploration-map" id="exploration-map">${renderExplorationMap(state)}</pre><p class="hint">WASD/방향키 이동, 대각선은 Q/E/Z/C · 출발 지점(🏠)으로 돌아오면 자동 귀환</p></div>`
}

export function renderExplorationPanel(state: GameState): string {
  return `<section class="panel exploration ${state.activeTab === 'exploration' ? '' : 'hidden'}" id="panel-exploration" data-mode="${state.exploration.mode}:${state.exploration.phase}:${state.exploration.pendingLoot.length}"><h2>탐험</h2><div id="exploration-body">${renderExplorationBody(state)}</div></section>`
}

export function patchExplorationBody(app: ParentNode, state: GameState): void {
  const panel = app.querySelector<HTMLElement>('#panel-exploration')
  const body = app.querySelector<HTMLElement>('#exploration-body')
  if (!panel || !body) return
  const signature = `${state.exploration.mode}:${state.exploration.phase}:${state.exploration.pendingLoot.length}`
  if (panel.dataset.mode === signature) return
  panel.dataset.mode = signature
  body.innerHTML = renderExplorationBody(state)
}
