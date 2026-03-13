import type { GameState } from '../../../core/state.ts'
import { getBackpackUsedWeight } from '../../../core/explorationBackpack.ts'
import { getBiomeAt, getDungeonDef } from '../../../data/maps/index.ts'
import { getResourceDisplay, type ResourceId } from '../../../data/resources.ts'
import { renderExplorationCombatOverlay } from '../combatOverlay.ts'
import { getSyntheticFoodButtonState, renderBackpackHeatmap } from './loadoutView.ts'

export function renderExplorationMap(state: GameState): string {
  const { mapWidth, mapHeight } = state.exploration
  const radius = 4
  const { x, y } = state.exploration.position
  const rows: string[] = []

  for (let yy = y - radius; yy <= y + radius; yy += 1) {
    const tokens: string[] = []
    for (let xx = x - radius; xx <= x + radius; xx += 1) {
      if (xx < 0 || yy < 0 || xx >= mapWidth || yy >= mapHeight) tokens.push('⬛')
      else if (xx === x && yy === y) tokens.push('🧍')
      else if (xx === state.exploration.start.x && yy === state.exploration.start.y) tokens.push('🏠')
      else if (state.exploration.visited.includes(`${xx},${yy}`)) tokens.push(getBiomeAt(xx, yy).emoji)
      else tokens.push('⬛')
    }
    rows.push(tokens.join(' '))
  }
  return rows.join('\n')
}

function renderSyntheticFoodControl(state: GameState): string {
  const { amount, disabled } = getSyntheticFoodButtonState(state)
  return `<button id="exploration-use-synthetic-food" type="button" ${disabled ? 'disabled' : ''}>무작위맛 통조림 사용 (${amount})</button>`
}

function renderDungeonProgress(state: GameState): string {
  const { activeDungeon } = state.exploration
  if (!activeDungeon) return ''
  const def = getDungeonDef(activeDungeon.id)
  if (!def) return ''
  return ` · ${def.emoji} ${def.name} ${activeDungeon.currentFloor + 1}/${def.floors.length}층`
}

export function renderActiveBody(state: GameState, now = Date.now()): string {
  const backpackWeight = getBackpackUsedWeight(state.exploration.backpack)
  const biome = getBiomeAt(state.exploration.position.x, state.exploration.position.y)
  const dungeonProgress = renderDungeonProgress(state)
  const baseInfo = `<p class="hint">HP <strong id="exploration-hp">${state.exploration.hp}/${state.exploration.maxHp}</strong> · 위치 <strong id="exploration-pos">(${state.exploration.position.x}, ${state.exploration.position.y})</strong> · 지형 <strong>${biome.name}</strong>${dungeonProgress} · 가방 무게 <strong>${backpackWeight}/${state.exploration.backpackMaxWeight}</strong></p>${renderSyntheticFoodControl(state)}${renderBackpackHeatmap(state)}`

  if (state.exploration.phase === 'dungeon-entry' && state.exploration.activeDungeon) {
    const { activeDungeon } = state.exploration
    const def = getDungeonDef(activeDungeon.id)
    if (def) {
      const floorLabel = activeDungeon.currentFloor > 0 ? `<p class="hint">${activeDungeon.currentFloor + 1}/${def.floors.length}층부터 재진입</p>` : ''
      return `<div class="exploration-active">${baseInfo}<div class="exploration-combat-box dungeon-entry-panel"><p><strong>${def.emoji} ${def.name}</strong></p><p>${def.entryText}</p>${floorLabel}<button id="dungeon-enter">진입</button> <button id="dungeon-cancel">돌아가기</button></div><pre class="exploration-map" id="exploration-map">${renderExplorationMap(state)}</pre></div>`
    }
  }

  if (state.exploration.phase === 'combat' && state.exploration.combat) {
    return `<div class="exploration-active">${baseInfo}<div class="exploration-map-stage"><pre class="exploration-map" id="exploration-map">${renderExplorationMap(state)}</pre><div class="exploration-combat-backdrop" aria-hidden="true"></div>${renderExplorationCombatOverlay(state, now)}</div><p class="hint">전투 중... 자동 사격이 진행됩니다. (도주 시도 가능: 성공률 30%)</p></div>`
  }

  if (state.exploration.phase === 'loot') {
    const lootRows = state.exploration.pendingLoot
      .map((entry) => `<button data-loot-resource="${entry.resource as ResourceId}">${getResourceDisplay(entry.resource)} +${entry.amount}</button>`)
      .join('')
    return `<div class="exploration-active">
  ${baseInfo}
  <pre class="exploration-map" id="exploration-map">${renderExplorationMap(state)}</pre>
</div>
<div class="modal-backdrop exploration-loot-backdrop">
  <div class="modal-card exploration-loot-card">
    <h3 class="exploration-loot-title">⚔️ 전투 종료 — 전리품</h3>
    <div class="exploration-loot-items">${lootRows || '<p class="hint">가져갈 수 있는 전리품이 없다.</p>'}</div>
    <button id="exploration-continue" class="exploration-loot-continue">계속 이동 →</button>
  </div>
</div>`
  }

  return `<div class="exploration-active">${baseInfo}<pre class="exploration-map" id="exploration-map">${renderExplorationMap(state)}</pre><p class="hint">WASD/방향키 이동, 대각선은 Q/E/Z/C · 출발 지점(🏠)으로 돌아오면 자동 귀환</p></div>`
}
