import type { GameState } from '../../../core/state.ts'
import { RESOURCE_DEFS, type ResourceId } from '../../../data/resources.ts'

const LOADOUT_ITEM_IDS: ResourceId[] = ['syntheticFood', 'smallHealPotion']

function getBackpackResourceAmount(state: GameState, resourceId: ResourceId): number {
  return state.exploration.backpack.reduce((sum, entry) => (entry.resource === resourceId ? sum + entry.amount : sum), 0)
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

export function renderLoadoutBody(state: GameState): string {
  const canStart = Boolean(state.selectedWeaponId)
  const blockReason = canStart ? '' : '<p class="hint">출발 조건: 무기 1개를 선택하세요.</p>'

  return `<div class="exploration-loadout"><p class="hint">탐험 준비: 무기/배낭을 수동으로 정리하고 출발합니다.</p>${renderLoadoutWeaponSelection(state)}<section class="exploration-loadout-items"><p class="hint">배낭 적재</p><ul>${renderLoadoutItemRows(state)}</ul></section>${renderBackpackGrid(state)}<p class="hint">HP <strong id="exploration-hp">${state.exploration.hp}/${state.exploration.maxHp}</strong></p>${blockReason}<button id="exploration-start" ${canStart ? '' : 'disabled'}>출발</button></div>`
}

export function getSyntheticFoodButtonState(state: GameState): { amount: number; disabled: boolean } {
  const amount = getBackpackResourceAmount(state, 'syntheticFood')
  return {
    amount,
    disabled: state.exploration.phase === 'combat' || amount <= 0 || state.exploration.hp >= state.exploration.maxHp,
  }
}

export function renderExplorationBackpackGrid(state: GameState): string {
  return renderBackpackGrid(state)
}
