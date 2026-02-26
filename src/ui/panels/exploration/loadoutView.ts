import type { GameState } from '../../../core/state.ts'
import { getBackpackUsedWeight, getBackpackResourceAmount } from '../../../core/explorationBackpack.ts'
import { RESOURCE_DEFS, type ResourceId } from '../../../data/resources.ts'
import { renderGaugeButton } from '../basePanel.ts'
import type { ActionGaugeView } from '../../types.ts'

const LOADOUT_ITEM_IDS: ResourceId[] = ['syntheticFood', 'smallHealPotion']

function renderBackpackHeatmap(state: GameState): string {
  const usedWeight = getBackpackUsedWeight(state.exploration.backpack)
  const maxWeight = state.exploration.backpackMaxWeight
  const ratio = maxWeight > 0 ? Math.min(1, usedWeight / maxWeight) : 0

  const cells = [...state.exploration.backpack]
    .sort((a, b) => b.amount - a.amount)
    .map((entry) => {
      const def = RESOURCE_DEFS[entry.resource]
      const share = usedWeight > 0 ? (entry.amount / usedWeight) * 100 : 0
      return `<li class="backpack-heat-cell" style="--weight-share:${Math.max(1, entry.amount)}" aria-label="${def.label} ${entry.amount}개, 비중 ${share.toFixed(1)}%"><span class="backpack-heat-icon" aria-hidden="true">${def.emoji}</span><span class="backpack-heat-label">${def.label}</span><span class="backpack-heat-amount">${entry.amount}</span></li>`
    })
    .join('')

  return `<section class="exploration-backpack" aria-label="탐험 배낭"><p class="hint">가방 무게 <strong>${usedWeight} / ${maxWeight}</strong></p><div class="backpack-weight-bar" role="meter" aria-valuemin="0" aria-valuemax="${maxWeight}" aria-valuenow="${usedWeight}" aria-label="가방 무게 ${usedWeight}/${maxWeight}"><span class="backpack-weight-fill" style="width:${Math.floor(ratio * 100)}%"></span></div><ul class="backpack-heatmap">${cells || '<li class="backpack-heat-empty">비어 있음</li>'}</ul></section>`
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
    const carried = getBackpackResourceAmount(state.exploration.backpack, resourceId)
    const owned = state.resources[resourceId]
    return `<li class="exploration-loadout-item"><span>${def.emoji} ${def.label}</span><span class="hint">적재 ${carried} · 보유 ${owned}</span><div class="exploration-loadout-item-controls"><button type="button" data-loadout-remove="${resourceId}" ${carried <= 0 ? 'disabled' : ''}>-</button><button type="button" data-loadout-add="${resourceId}" ${owned <= 0 ? 'disabled' : ''}>+</button></div></li>`
  }).join('')
}

function getBlockReason(state: GameState, canStart: boolean): string {
  if (!state.isGuideRobotRecovered) return '출발 조건: 먼저 파괴된 안내견을 주워 오세요.'
  if (state.buildings.laikaRepair <= 0) return '출발 조건: 안내견 로봇 수리를 완료하세요.'
  if (!canStart) return '출발 조건: 무기 1개를 선택하세요.'
  return ''
}

export function renderLoadoutBody(state: GameState, recoverGuideRobot: ActionGaugeView): string {
  const canStart = Boolean(state.selectedWeaponId) && state.isGuideRobotRecovered && state.buildings.laikaRepair > 0
  const blockReason = getBlockReason(state, Boolean(state.selectedWeaponId))
  const preconditionSection = state.isGuideRobotRecovered
    ? '<p class="hint">파괴된 안내견 회수 완료.</p>'
    : renderGaugeButton('recover-guide-robot', '파괴된 안내견 줍기', '파괴된 안내견 줍기', recoverGuideRobot)

  return `<div class="exploration-loadout"><p class="hint">탐험 준비: 무기/배낭을 수동으로 정리하고 출발합니다.</p><section class="action-group" aria-label="탐험 사전 조건"><h3 class="subheading">사전 조건</h3>${preconditionSection}</section>${renderLoadoutWeaponSelection(state)}<section class="exploration-loadout-items"><p class="hint">배낭 적재</p><ul>${renderLoadoutItemRows(state)}</ul></section>${renderBackpackHeatmap(state)}<p class="hint">HP <strong id="exploration-hp">${state.exploration.hp}/${state.exploration.maxHp}</strong></p>${blockReason ? `<p class="hint">${blockReason}</p>` : ''}<button id="exploration-start" ${canStart ? '' : 'disabled'}>출발</button></div>`
}

export function getSyntheticFoodButtonState(state: GameState): { amount: number; disabled: boolean } {
  const amount = getBackpackResourceAmount(state.exploration.backpack, 'syntheticFood')
  return {
    amount,
    disabled: state.exploration.phase === 'combat' || amount <= 0 || state.exploration.hp >= state.exploration.maxHp,
  }
}

export function renderExplorationBackpackHeatmap(state: GameState): string {
  return renderBackpackHeatmap(state)
}
