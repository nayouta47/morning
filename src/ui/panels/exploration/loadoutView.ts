import type { GameState } from '../../../core/state.ts'
import { getBackpackUsedWeight, getBackpackResourceAmount } from '../../../core/explorationBackpack.ts'
import { RESOURCE_DEFS, type ResourceId } from '../../../data/resources.ts'
import { WEAPON_DISPLAY_STATS } from '../../../data/balance.ts'
import type { ActionGaugeView } from '../../types.ts'

const LOADOUT_ITEM_IDS: ResourceId[] = ['syntheticFood', 'smallHealPotion']

export function renderBackpackHeatmap(state: GameState): string {
  const usedWeight = getBackpackUsedWeight(state.exploration.backpack)
  const maxWeight = state.exploration.backpackMaxWeight
  const ratio = maxWeight > 0 ? Math.min(1, usedWeight / maxWeight) : 0

  const selectedWeapon = state.weapons.find((w) => w.id === state.selectedWeaponId)
  const weaponWeight = selectedWeapon ? WEAPON_DISPLAY_STATS[selectedWeapon.type].weight : 0
  const totalLoad = (usedWeight + weaponWeight).toFixed(1)

  const weaponCell = selectedWeapon
    ? `<li class="backpack-heat-cell backpack-heat-weapon" style="--weight-share:${Math.max(1, Math.round(weaponWeight))}" aria-label="${selectedWeapon.type === 'rifle' ? '소총' : '권총'} ${weaponWeight}kg"><span class="backpack-heat-icon" aria-hidden="true">🔫</span><span class="backpack-heat-label">${selectedWeapon.type === 'rifle' ? '소총' : '권총'}</span><span class="backpack-heat-amount">${weaponWeight}kg</span></li>`
    : ''

  const itemCells = [...state.exploration.backpack]
    .sort((a, b) => b.amount - a.amount)
    .map((entry) => {
      const def = RESOURCE_DEFS[entry.resource]
      const share = usedWeight > 0 ? (entry.amount / usedWeight) * 100 : 0
      return `<li class="backpack-heat-cell" style="--weight-share:${Math.max(1, entry.amount)}" aria-label="${def.label} ${entry.amount}개, 비중 ${share.toFixed(1)}%"><span class="backpack-heat-icon" aria-hidden="true">${def.emoji}</span><span class="backpack-heat-label">${def.label}</span><span class="backpack-heat-amount">${entry.amount}</span></li>`
    })
    .join('')

  const cells = weaponCell + itemCells

  return `<section class="exploration-backpack" aria-label="탐험 배낭"><p class="hint">아이템 <strong>${usedWeight} / ${maxWeight}</strong> · 총 하중 <strong>${totalLoad}</strong></p><div class="backpack-weight-bar" role="meter" aria-valuemin="0" aria-valuemax="${maxWeight}" aria-valuenow="${usedWeight}" aria-label="가방 무게 ${usedWeight}/${maxWeight}"><span class="backpack-weight-fill" style="width:${Math.floor(ratio * 100)}%"></span></div><ul class="backpack-heatmap">${cells || '<li class="backpack-heat-empty">비어 있음</li>'}</ul></section>`
}

function renderLoadoutWeaponSelection(state: GameState): string {
  if (state.weapons.length === 0) return '<p class="hint">보유 무기가 없습니다. 무기 조립 탭에서 먼저 제작하세요.</p>'

  const rows = state.weapons
    .map((weapon) => {
      const selected = weapon.id === state.selectedWeaponId
      const label = weapon.type === 'rifle' ? '소총' : '권총'
      const w = WEAPON_DISPLAY_STATS[weapon.type].weight
      return `<button class="weapon-item ${selected ? 'selected' : ''}" type="button" data-weapon-id="${weapon.id}" aria-pressed="${selected}">${label} · ${w}kg</button>`
    })
    .join('')

  return `<div class="exploration-loadout-weapons"><p class="hint">🔫 무기 (필수)</p><div id="exploration-loadout-weapon-list">${rows}</div></div>`
}

function renderLoadoutItemRows(state: GameState): string {
  return LOADOUT_ITEM_IDS.map((resourceId) => {
    const def = RESOURCE_DEFS[resourceId]
    const carried = getBackpackResourceAmount(state.exploration.backpack, resourceId)
    const owned = state.resources[resourceId]
    const canFill = owned > 0
    return `<li class="exploration-loadout-item"><span>${def.emoji} ${def.label}</span><span class="hint">${carried} / ${owned}</span><div class="exploration-loadout-item-controls"><button type="button" data-loadout-remove="${resourceId}" ${carried <= 0 ? 'disabled' : ''}>-</button><button type="button" data-loadout-add="${resourceId}" ${owned <= 0 ? 'disabled' : ''}>+</button><button type="button" data-loadout-fill="${resourceId}" ${!canFill ? 'disabled' : ''}>전부</button></div></li>`
  }).join('')
}

function getBlockReason(canStart: boolean): string {
  if (!canStart) return '출발 조건: 무기 1개를 선택하세요.'
  return ''
}

export function renderLoadoutBody(state: GameState, _recoverGuideRobot: ActionGaugeView): string {
  const canStart = Boolean(state.selectedWeaponId) && state.isGuideRobotRecovered && state.buildings.laikaRepair > 0
  const blockReason = getBlockReason(Boolean(state.selectedWeaponId))

  return `<div class="exploration-loadout"><p class="hint">탐험 준비: 무기/배낭을 수동으로 정리하고 출발합니다.</p><div class="loadout-config-grid">${renderLoadoutWeaponSelection(state)}<section class="exploration-loadout-items"><p class="hint">🎒 배낭 적재</p><ul>${renderLoadoutItemRows(state)}</ul></section></div>${renderBackpackHeatmap(state)}<p class="hint">HP <strong id="exploration-hp">${state.exploration.hp}/${state.exploration.maxHp}</strong></p>${blockReason ? `<p class="hint">${blockReason}</p>` : ''}<button id="exploration-start" ${canStart ? '' : 'disabled'}>출발</button></div>`
}

export function getSyntheticFoodButtonState(state: GameState): { amount: number; disabled: boolean } {
  const amount = getBackpackResourceAmount(state.exploration.backpack, 'syntheticFood')
  return {
    amount,
    disabled: state.exploration.phase === 'combat' || amount <= 0 || state.exploration.hp >= state.exploration.maxHp,
  }
}
