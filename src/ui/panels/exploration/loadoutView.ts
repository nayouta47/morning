import type { ArmorType, GameState } from '../../../core/state.ts'
import { getBackpackUsedWeight, getBackpackResourceAmount, getResourceUnitWeight } from '../../../core/explorationBackpack.ts'
import { RESOURCE_DEFS, type ResourceId } from '../../../data/resources.ts'
import { getWeaponModuleLayerStats, getWeaponWeight } from '../../../core/moduleEffects.ts'
import { ARMOR_HP } from '../../../data/crafting.ts'
const LOADOUT_ITEM_IDS: ResourceId[] = ['syntheticFood', 'smallHealPotion']

// ── Squarified treemap ────────────────────────────────────────────────────────

type TmInput = { key: string; label: string; emoji: string; value: number; cls: string }
type TmCell  = TmInput & { x: number; y: number; w: number; h: number }

function tmWorst(row: TmInput[], w: number, h: number, total: number): number {
  if (row.length === 0) return Infinity
  const sum = row.reduce((s, i) => s + i.value, 0)
  let worst = 0
  if (w >= h) {
    const colW = (sum / total) * w
    for (const item of row) {
      const cellH = (item.value / sum) * h
      if (cellH <= 0) return Infinity
      const r = Math.max(colW / cellH, cellH / colW)
      if (r > worst) worst = r
    }
  } else {
    const rowH = (sum / total) * h
    for (const item of row) {
      const cellW = (item.value / sum) * w
      if (cellW <= 0) return Infinity
      const r = Math.max(rowH / cellW, cellW / rowH)
      if (r > worst) worst = r
    }
  }
  return worst
}

function tmLayout(items: TmInput[], x: number, y: number, w: number, h: number, total: number, out: TmCell[]): void {
  if (items.length === 0 || w <= 0 || h <= 0) return
  if (items.length === 1) { out.push({ ...items[0], x, y, w, h }); return }

  const row: TmInput[] = []
  let worst = Infinity
  for (const item of items) {
    if (item.value <= 0) continue
    const r = tmWorst([...row, item], w, h, total)
    if (row.length > 0 && r > worst) break
    row.push(item)
    worst = r
  }
  if (row.length === 0) return

  const rowSum = row.reduce((s, i) => s + i.value, 0)
  if (w >= h) {
    const colW = (rowSum / total) * w
    let cy = y
    for (const item of row) {
      const cellH = (item.value / rowSum) * h
      out.push({ ...item, x, y: cy, w: colW, h: cellH })
      cy += cellH
    }
    tmLayout(items.slice(row.length), x + colW, y, w - colW, h, total - rowSum, out)
  } else {
    const rowH = (rowSum / total) * h
    let cx = x
    for (const item of row) {
      const cellW = (item.value / rowSum) * w
      out.push({ ...item, x: cx, y, w: cellW, h: rowH })
      cx += cellW
    }
    tmLayout(items.slice(row.length), x, y + rowH, w, h - rowH, total - rowSum, out)
  }
}

// ── renderBackpackHeatmap (squarified treemap) ────────────────────────────────

export function renderBackpackHeatmap(state: GameState): string {
  const usedWeight = getBackpackUsedWeight(state.exploration.backpack)
  const maxWeight = state.exploration.backpackMaxWeight
  const weapon = state.weapons.find((w) => w.id === state.selectedWeaponId)
  const weaponWeight = weapon ? getWeaponWeight(weapon) : 0
  const totalValue = maxWeight  // always 50 — fixed square

  const items: TmInput[] = []

  if (weapon && weaponWeight > 0) {
    const label = weapon.type === 'rifle' ? '소총' : '권총'
    items.push({ key: 'weapon', label: `${label} ${weaponWeight.toFixed(1)}kg`, emoji: '🔫', value: weaponWeight, cls: 'tm-weapon' })
  }

  for (const entry of state.exploration.backpack) {
    const def = RESOURCE_DEFS[entry.resource]
    const itemWeight = Math.floor(entry.amount) * getResourceUnitWeight(entry.resource)
    if (itemWeight <= 0) continue
    items.push({ key: entry.resource, label: `${def.label} ${itemWeight.toFixed(1)}kg`, emoji: def.emoji, value: itemWeight, cls: 'tm-item' })
  }

  const emptyWeight = maxWeight - weaponWeight - usedWeight
  if (emptyWeight > 0.001) {
    items.push({ key: 'empty', label: `여유 ${emptyWeight.toFixed(1)}kg`, emoji: '', value: emptyWeight, cls: 'tm-empty' })
  }

  items.sort((a, b) => b.value - a.value)

  const cells: TmCell[] = []
  tmLayout(items, 0, 0, 100, 100, totalValue, cells)

  const cellsHtml = cells.map((c) => {
    const showContent = c.w > 8 && c.h > 8
    const inner = showContent
      ? `${c.emoji ? `<span class="tm-emoji">${c.emoji}</span>` : ''}<span class="tm-label">${c.label}</span>`
      : ''
    return `<div class="tm-cell ${c.cls}" style="left:${c.x.toFixed(3)}%;top:${c.y.toFixed(3)}%;width:${c.w.toFixed(3)}%;height:${c.h.toFixed(3)}%" title="${c.label}">${inner}</div>`
  }).join('')

  return `<section class="exploration-backpack" aria-label="탐험 배낭"><p class="hint">배낭 <strong>${usedWeight.toFixed(1)} / ${maxWeight}</strong> · 무기 <strong>${weaponWeight.toFixed(1)}kg</strong></p><div class="backpack-treemap">${cellsHtml}</div></section>`
}

function renderLoadoutWeaponSelection(state: GameState): string {
  if (state.weapons.length === 0) return '<p class="hint">보유 무기가 없습니다. 무기 조립 탭에서 먼저 제작하세요.</p>'

  const rows = state.weapons
    .map((weapon) => {
      const selected = weapon.id === state.selectedWeaponId
      const label = weapon.type === 'rifle' ? '소총' : '권총'
      const w = getWeaponWeight(weapon)
      const moduleCount = weapon.slots.filter((s) => s !== null).length
      const stats = getWeaponModuleLayerStats(weapon)
      const dps = (stats.finalDamage / stats.finalCooldownSec).toFixed(2)
      return `<button class="weapon-item ${selected ? 'selected' : ''}" type="button" data-weapon-id="${weapon.id}" aria-pressed="${selected}">${label} · ${w.toFixed(1)}kg · 모듈 ${moduleCount}개 · DPS ${dps}</button>`
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
    return `<li class="exploration-loadout-item"><span>${def.emoji} ${def.label}</span><div class="exploration-loadout-item-controls"><button type="button" data-loadout-clear="${resourceId}" aria-label="${def.label} 전부 내리기" ${carried <= 0 ? 'disabled' : ''}>«</button><button type="button" data-loadout-remove="${resourceId}" aria-label="${def.label} 1개 내리기" ${carried <= 0 ? 'disabled' : ''}>−</button><span class="loadout-item-amount">${carried}<span class="hint"> / ${owned}</span></span><button type="button" data-loadout-add="${resourceId}" aria-label="${def.label} 1개 올리기" ${owned <= 0 ? 'disabled' : ''}>+</button><button type="button" data-loadout-fill="${resourceId}" aria-label="${def.label} 전부 올리기" ${!canFill ? 'disabled' : ''}>»</button></div></li>`
  }).join('')
}

function renderArmorSection(state: GameState): string {
  const equipped = state.exploration.equippedArmor
  if (equipped) {
    const def = RESOURCE_DEFS[equipped]
    const hp = ARMOR_HP[equipped]
    return `<section class="exploration-loadout-items"><p class="hint">🛡️ 방어구</p><div>${def.emoji} ${def.label} (+${hp} HP) <button type="button" data-unequip-armor>해제</button></div></section>`
  }
  const armorTypes: ArmorType[] = ['junkArmor', 'ironArmor']
  const buttons = armorTypes.map((t) => {
    const def = RESOURCE_DEFS[t]
    const hp = ARMOR_HP[t]
    const owned = state.resources[t] >= 1
    return `<button type="button" data-equip-armor="${t}" ${owned ? '' : 'disabled'}>${def.label} +${hp} HP</button>`
  }).join('')
  return `<section class="exploration-loadout-items"><p class="hint">🛡️ 방어구</p><div>${buttons}</div></section>`
}

function getBlockReason(canStart: boolean): string {
  if (!canStart) return '출발 조건: 무기 1개를 선택하세요.'
  return ''
}

export function renderLoadoutBody(state: GameState): string {
  const canStart = Boolean(state.selectedWeaponId) && state.isGuideRobotRecovered && state.buildings.laikaRepair > 0
  const blockReason = getBlockReason(Boolean(state.selectedWeaponId))

  return `<div class="exploration-loadout"><p class="hint">탐험 준비: 무기/배낭을 수동으로 정리하고 출발합니다.</p><div class="loadout-config-grid">${renderLoadoutWeaponSelection(state)}<section class="exploration-loadout-items"><p class="hint">🎒 배낭 적재</p><ul>${renderLoadoutItemRows(state)}</ul></section>${renderArmorSection(state)}</div>${renderBackpackHeatmap(state)}<p class="hint">HP <strong id="exploration-hp">${state.exploration.hp}/${state.exploration.maxHp}</strong></p>${blockReason ? `<p class="hint">${blockReason}</p>` : ''}<button id="exploration-start" ${canStart ? '' : 'disabled'}>출발</button></div>`
}

export function getSyntheticFoodButtonState(state: GameState): { amount: number; disabled: boolean } {
  const amount = getBackpackResourceAmount(state.exploration.backpack, 'syntheticFood')
  return {
    amount,
    disabled: state.exploration.phase === 'combat' || amount <= 0 || state.exploration.hp >= state.exploration.maxHp,
  }
}
