import type { GameState } from '../../core/state.ts'
import { RESOURCE_DEFS, getResourceDisplay, type ResourceId } from '../../data/resources.ts'
import { renderExplorationCombatOverlay } from './combatOverlay.ts'
import { getBiomeAt } from '../../data/maps/index.ts'

const LOADOUT_ITEM_IDS: ResourceId[] = ['syntheticFood', 'smallHealPotion']

function getBackpackResourceAmount(state: GameState, resourceId: ResourceId): number {
  return state.exploration.backpack.reduce((sum, entry) => (entry.resource === resourceId ? sum + entry.amount : sum), 0)
}

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
      else if (state.exploration.visited.includes(`${xx},${yy}`)) tokens.push(getBiomeAt(xx, yy).emoji)
      else tokens.push('⬛')
    }
    rows.push(tokens.join(' '))
  }
  return rows.join('\n')
}

function renderBackpackGrid(state: GameState): string {
  const usedSlots = state.exploration.backpack.length
  const slots: string[] = []

  for (let i = 0; i < state.exploration.backpackCapacity; i += 1) {
    const entry = state.exploration.backpack[i]
    if (!entry) {
      slots.push('<li class="backpack-slot empty" aria-label="빈 슬롯"></li>')
      continue
    }

    const def = RESOURCE_DEFS[entry.resource]
    slots.push(
      `<li class="backpack-slot filled" aria-label="${def.label} x${entry.amount}"><span class="backpack-icon" aria-hidden="true">${def.emoji}</span><span class="backpack-count">${entry.amount}</span></li>`,
    )
  }

  return `<section class="exploration-backpack" aria-label="탐험 배낭"><p class="hint">배낭 슬롯 <strong>${usedSlots}/${state.exploration.backpackCapacity}</strong> · 회복 아이템 스택 1 / 기타 16</p><ul class="backpack-grid">${slots.join('')}</ul></section>`
}

function renderSyntheticFoodControl(state: GameState): string {
  const amount = getBackpackResourceAmount(state, 'syntheticFood')
  const blockedByCombat = state.exploration.phase === 'combat'
  const disabled = blockedByCombat || amount <= 0 || state.exploration.hp >= state.exploration.maxHp
  return `<button id="exploration-use-synthetic-food" type="button" ${disabled ? 'disabled' : ''}>인조식량 사용 (${amount})</button>`
}

function renderLoadoutWeaponSelection(state: GameState): string {
  if (state.weapons.length === 0) return '<p class="hint">보유 무기가 없습니다. 무기 조립 탭에서 먼저 제작하세요.</p>'

  const rows = state.weapons
    .map((weapon) => {
      const selected = weapon.id === state.selectedWeaponId
      const label = weapon.type === 'rifle' ? '소총' : '권총'
      return `<button class="weapon-item ${selected ? 'selected' : ''}" type="button" data-weapon-id="${weapon.id}" aria-pressed="${selected}">${label} · ${weapon.id}</button>`
    })
    .join('')

  return `<div class="exploration-loadout-weapons"><p class="hint">무기 선택 (필수)</p><div id="exploration-loadout-weapon-list">${rows}</div></div>`
}

function renderLoadoutItemRows(state: GameState): string {
  return LOADOUT_ITEM_IDS.map((resourceId) => {
    const def = RESOURCE_DEFS[resourceId]
    const carried = getBackpackResourceAmount(state, resourceId)
    const owned = state.resources[resourceId]
    return `<li class="exploration-loadout-item"><span>${def.emoji} ${def.label}</span><span class="hint">적재 ${carried} · 보유 ${owned}</span><div class="exploration-loadout-item-controls"><button type="button" data-loadout-remove="${resourceId}" ${carried <= 0 ? 'disabled' : ''}>-</button><button type="button" data-loadout-add="${resourceId}" ${owned <= 0 ? 'disabled' : ''}>+</button></div></li>`
  }).join('')
}

function renderLoadoutBody(state: GameState): string {
  const canStart = Boolean(state.selectedWeaponId)
  const blockReason = canStart ? '' : '<p class="hint">출발 조건: 무기 1개를 선택하세요.</p>'

  return `<div class="exploration-loadout"><p class="hint">탐험 준비: 무기/배낭을 수동으로 정리하고 출발합니다.</p>${renderLoadoutWeaponSelection(state)}<section class="exploration-loadout-items"><p class="hint">배낭 적재</p><ul>${renderLoadoutItemRows(state)}</ul></section>${renderBackpackGrid(state)}<p class="hint">HP <strong id="exploration-hp">${state.exploration.hp}/${state.exploration.maxHp}</strong></p>${blockReason}<button id="exploration-start" ${canStart ? '' : 'disabled'}>출발</button></div>`
}

function renderExplorationBody(state: GameState, now = Date.now()): string {
  const isActive = state.exploration.mode === 'active'
  if (!isActive) return renderLoadoutBody(state)

  const backpackUsed = state.exploration.backpack.length
  const biome = getBiomeAt(state.exploration.position.x, state.exploration.position.y)
  const baseInfo = `<p class="hint">HP <strong id="exploration-hp">${state.exploration.hp}/${state.exploration.maxHp}</strong> · 위치 <strong id="exploration-pos">(${state.exploration.position.x}, ${state.exploration.position.y})</strong> · 지형 <strong>${biome.name}</strong> · 배낭 슬롯 <strong>${backpackUsed}/${state.exploration.backpackCapacity}</strong></p>${renderSyntheticFoodControl(state)}${renderBackpackGrid(state)}`

  if (state.exploration.phase === 'combat' && state.exploration.combat) {
    return `<div class="exploration-active">${baseInfo}<div class="exploration-map-stage"><pre class="exploration-map" id="exploration-map">${renderExplorationMap(state)}</pre><div class="exploration-combat-backdrop" aria-hidden="true"></div>${renderExplorationCombatOverlay(state, now)}</div><p class="hint">전투 중... 자동 사격이 진행됩니다. (도주 시도 가능: 성공률 30%)</p></div>`
  }

  if (state.exploration.phase === 'loot') {
    const lootRows = state.exploration.pendingLoot
      .map((entry) => `<button data-loot-resource="${entry.resource as ResourceId}">획득: ${getResourceDisplay(entry.resource)} +${entry.amount}</button>`)
      .join('')
    return `<div class="exploration-active">${baseInfo}<div class="exploration-combat-box"><p>전리품 선택</p>${lootRows || '<p class="hint">가져갈 수 있는 전리품이 없다.</p>'}<button id="exploration-continue">계속 이동</button></div><pre class="exploration-map" id="exploration-map">${renderExplorationMap(state)}</pre></div>`
  }

  return `<div class="exploration-active">${baseInfo}<pre class="exploration-map" id="exploration-map">${renderExplorationMap(state)}</pre><p class="hint">WASD/방향키 이동, 대각선은 Q/E/Z/C · 출발 지점(🏠)으로 돌아오면 자동 귀환</p></div>`
}

function getExplorationBodySignature(state: GameState): string {
  const backpackSig = state.exploration.backpack.map((entry) => `${entry.resource}:${entry.amount}`).join('|')
  const lootSig = state.exploration.pendingLoot.map((entry) => `${entry.resource}:${entry.amount}`).join('|')
  return `${state.exploration.mode}:${state.exploration.phase}:${state.selectedWeaponId ?? 'none'}:${backpackSig}:${lootSig}:${state.resources.syntheticFood}:${state.resources.smallHealPotion}`
}

export function renderExplorationPanel(state: GameState, now = Date.now()): string {
  return `<section class="panel exploration ${state.activeTab === 'exploration' ? '' : 'hidden'}" id="panel-exploration" data-mode="${getExplorationBodySignature(state)}"><h2>탐험</h2><div id="exploration-body">${renderExplorationBody(state, now)}</div></section>`
}

export function patchExplorationBody(app: ParentNode, state: GameState): void {
  const panel = app.querySelector<HTMLElement>('#panel-exploration')
  const body = app.querySelector<HTMLElement>('#exploration-body')
  if (!panel || !body) return
  const signature = getExplorationBodySignature(state)
  if (panel.dataset.mode !== signature) {
    panel.dataset.mode = signature
    body.innerHTML = renderExplorationBody(state)
    return
  }

  const syntheticFoodButton = app.querySelector<HTMLButtonElement>('#exploration-use-synthetic-food')
  if (!syntheticFoodButton) return
  const amount = getBackpackResourceAmount(state, 'syntheticFood')
  syntheticFoodButton.disabled = state.exploration.phase === 'combat' || amount <= 0 || state.exploration.hp >= state.exploration.maxHp
  syntheticFoodButton.textContent = `인조식량 사용 (${amount})`
}
