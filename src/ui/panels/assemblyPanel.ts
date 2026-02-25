import { MODULE_POWER_COST, getWeaponModuleLayerStats } from '../../core/moduleEffects.ts'
import type { GameState, ModuleType, WeaponInstance } from '../../core/state.ts'
import { getActiveWeaponSlots } from '../../core/weaponSlots.ts'

const MODULE_EMOJI: Record<ModuleType, string> = { damage: '💥', cooldown: '⏱️', amplifier: '📡', preheater: '🔥' }
const MODULE_NAME: Record<ModuleType, string> = {
  damage: '공격력 칩',
  cooldown: '가속 칩',
  amplifier: '증폭 칩',
  preheater: '예열기 칩',
}
const MODULE_LABEL: Record<ModuleType, string> = {
  damage: '공격력 +1 · 전력 ⚡5',
  cooldown: '쿨다운 가속 +10 · 전력 ⚡5',
  amplifier: '증폭자 (왼쪽 모듈 효과 +1중첩) · 전력 ⚡2',
  preheater: '예열기 (전투 시작 즉시 발사, 중복 비중첩) · 전력 ⚡7',
}

type PowerPreview = {
  usage: number
  capacity: number
  overloaded: boolean
  slotIndex: number
}

let selectedModuleType: ModuleType | null = null
let powerPreview: PowerPreview | null = null

function getActiveSlots(weapon: WeaponInstance): Set<number> {
  return getActiveWeaponSlots(weapon.type)
}

function getSelectedWeapon(state: GameState): WeaponInstance | null {
  if (!state.selectedWeaponId) return null
  return state.weapons.find((w) => w.id === state.selectedWeaponId) ?? null
}

function getWeaponStats(weapon: WeaponInstance) {
  return getWeaponModuleLayerStats(weapon)
}

function renderPowerSummary(stats: ReturnType<typeof getWeaponStats>, preview: PowerPreview | null): string {
  const usage = preview?.usage ?? stats.power.usage
  const capacity = preview?.capacity ?? stats.power.capacity
  const overloaded = preview?.overloaded ?? stats.power.overloaded
  const statusLabel = overloaded ? '과부하' : '정상'

  const projected = preview
    ? `<span class="power-preview ${preview.overloaded ? 'risk' : 'safe'}">예상 전력 ${preview.usage} / ${preview.capacity}${preview.overloaded ? ' · 드롭 시 과부하 위험' : ''}</span>`
    : ''

  const overloadHint = overloaded
    ? '<span class="power-warning-text">모듈 효과 비활성</span>'
    : ''

  return `<div class="power-summary ${overloaded ? 'overload' : 'normal'}"><span class="power-summary-value">전력 ${usage} / ${capacity}</span><span class="power-summary-badge">${statusLabel}</span>${overloadHint}${projected}</div>`
}

function renderWeaponStatText(stats: ReturnType<typeof getWeaponStats>): string {
  const finalClass = stats.power.overloaded ? 'final-stat subdued' : 'final-stat'
  const overloadLine = stats.power.overloaded
    ? '<span class="stat-warning">⚠ 과부하 상태: 모듈 효과 비활성</span>'
    : '<span class="stat-warning normal">모듈 효과 정상 적용 중</span>'

  return `${overloadLine}<span class="base-stat">기본 공격력 ${stats.baseDamage} / 기본 쿨다운 ${stats.baseCooldownSec.toFixed(1)}s</span> | <span class="${finalClass}">최종 공격력 ${stats.finalDamage} / 최종 쿨다운 ${stats.finalCooldownSec.toFixed(1)}s (가속 ${stats.totalHaste >= 0 ? '+' : ''}${stats.totalHaste})</span>`
}

function isModuleTypeEquipped(state: GameState, moduleType: ModuleType): boolean {
  return state.weapons.some((weapon) => weapon.slots.some((slot) => slot === moduleType))
}

function syncSelectedModuleType(state: GameState): void {
  if (selectedModuleType) {
    if (state.modules[selectedModuleType] > 0) return
    if (isModuleTypeEquipped(state, selectedModuleType)) return
  }

  selectedModuleType = (Object.keys(state.modules) as ModuleType[]).find((type) => state.modules[type] > 0) ?? null
}

export function setSelectedModuleType(moduleType: ModuleType): void {
  selectedModuleType = moduleType
}

export function setAssemblyPowerPreview(preview: PowerPreview | null): void {
  powerPreview = preview
}

export function renderAssemblyPanel(state: GameState): string {
  syncSelectedModuleType(state)
  const selected = getSelectedWeapon(state)
  const stats = selected ? getWeaponStats(selected) : null
  const active = selected ? getActiveSlots(selected) : new Set<number>()

  return `<section class="panel assembly ${state.activeTab === 'assembly' ? '' : 'hidden'}" id="panel-assembly">
      <h2>무기 조립</h2>
      <div class="assembly-grid">
        <aside class="weapon-list" aria-label="무기 인벤토리"><h3>무기 인벤토리</h3><div id="weapon-list-items" data-signature=""></div></aside>
        <div class="weapon-board-wrap"><h3>선택 무기 슬롯 (5x10)</h3><div id="weapon-board" class="weapon-board" role="grid" aria-label="무기 슬롯 보드"></div><div id="power-summary-bar">${stats ? renderPowerSummary(stats, powerPreview) : '<div class="power-summary"><span class="power-summary-value">무기를 선택하세요.</span></div>'}</div><p class="hint" id="weapon-stat-text">${stats ? renderWeaponStatText(stats) : '무기를 선택하세요.'}</p><p class="hint">장착: 모듈을 드래그 후 활성 슬롯에 드롭 / 해제: 우클릭(대체: 휠 클릭), 보유 모듈 패널로 드래그</p><div id="active-signature" data-sig="${[...active].join(',')}" hidden></div></div>
      </div>
      <div class="module-grid"><section class="module-detail" aria-label="모듈 상세 정보"><h3>모듈 상세</h3><p id="module-detail-effect" class="module-effect hint">${selectedModuleType ? MODULE_LABEL[selectedModuleType] : '모듈을 선택하세요.'}</p></section><section class="module-inventory" aria-label="모듈 인벤토리"><h3>보유 모듈</h3><div id="module-list-items" class="module-list" data-signature=""></div></section></div>
    </section>`
}

export function patchWeaponInventory(app: ParentNode, state: GameState): void {
  const root = app.querySelector<HTMLDivElement>('#weapon-list-items')
  if (!root) return
  const sig = `${state.selectedWeaponId}:${state.weapons.map((w) => `${w.id}:${w.slots.filter((slot) => slot !== null).length}`).join('|')}`
  if (root.dataset.signature === sig) return
  root.innerHTML = state.weapons
    .map((w) => {
      const emoji = w.type === 'pistol' ? '🔫' : '🪖'
      const name = w.type === 'pistol' ? '권총' : '소총'
      const displayId = `#${w.id.split('-')[1] ?? w.id}`
      const equippedCount = w.slots.filter((slot) => slot !== null).length
      return `<button class="weapon-item ${w.id === state.selectedWeaponId ? 'selected' : ''}" data-weapon-id="${w.id}" draggable="true" aria-label="${name} ${displayId}">${emoji} ${name} · ${displayId} · 🧮x${equippedCount}</button>`
    })
    .join('')
  if (state.weapons.length === 0) root.innerHTML = '<p class="hint">제작된 무기가 없습니다.</p>'
  root.dataset.signature = sig
}

export function patchModuleDetail(app: ParentNode, state: GameState): void {
  syncSelectedModuleType(state)
  const detail = app.querySelector<HTMLElement>('#module-detail-effect')
  if (!detail) return
  const text = selectedModuleType ? MODULE_LABEL[selectedModuleType] : '모듈을 선택하세요.'
  if (detail.textContent !== text) detail.textContent = text
}

export function patchModuleInventory(app: ParentNode, state: GameState): void {
  syncSelectedModuleType(state)
  const root = app.querySelector<HTMLDivElement>('#module-list-items')
  if (!root) return
  const sig = `${state.modules.damage}:${state.modules.cooldown}:${state.modules.amplifier}:${state.modules.preheater}:${selectedModuleType ?? 'none'}`
  if (root.dataset.signature === sig) return

  const entries = (Object.keys(state.modules) as ModuleType[])
    .filter((type) => state.modules[type] > 0)
    .map((type) => `<div class="module-item ${selectedModuleType === type ? 'selected' : ''}" draggable="true" data-module-type="${type}" aria-label="${MODULE_LABEL[type]} 모듈 ${state.modules[type]}개"><span class="module-emoji" aria-hidden="true">${MODULE_EMOJI[type]}</span><span class="module-name">${MODULE_NAME[type]} ⚡${MODULE_POWER_COST[type]}</span><span class="module-count">x${state.modules[type]}</span></div>`)

  root.innerHTML = entries.join('')
  if (entries.length === 0) root.innerHTML = '<p class="hint">모듈이 없습니다.</p>'
  root.dataset.signature = sig
}

export function patchWeaponBoard(app: ParentNode, state: GameState): void {
  const board = app.querySelector<HTMLDivElement>('#weapon-board')
  if (!board) return
  const selected = getSelectedWeapon(state)
  if (!selected) {
    board.innerHTML = '<p class="hint">무기를 선택하면 슬롯 보드가 표시됩니다.</p>'
    return
  }

  const active = getActiveSlots(selected)
  const stats = getWeaponStats(selected)
  const previewSig = powerPreview ? `${powerPreview.slotIndex}:${powerPreview.usage}:${powerPreview.capacity}:${powerPreview.overloaded ? 1 : 0}` : 'none'
  const sig = `${selected.id}:${selected.slots.join('|')}:${stats.slotAmplification.join('|')}:${[...active].join(',')}:${previewSig}`
  if (board.dataset.signature === sig) return

  board.innerHTML = Array.from({ length: 50 }, (_, index) => {
    const moduleType = selected.slots[index]
    const isActive = active.has(index)
    const isFilled = Boolean(moduleType)
    const amplificationCount = stats.slotAmplification[index] ?? 0
    const ampBadge = moduleType && amplificationCount > 0 ? `<span class="slot-amplify" aria-label="증폭 +${amplificationCount}">+${amplificationCount}</span>` : ''
    const slotState = moduleType ? `${MODULE_LABEL[moduleType]} 장착됨${amplificationCount > 0 ? `, 증폭 +${amplificationCount}` : ''}` : '비어 있음'
    const previewClass = powerPreview?.slotIndex === index ? (powerPreview.overloaded ? 'preview-overload' : 'preview-safe') : ''
    return `<div class="slot ${isActive ? 'active' : 'inactive'} ${isFilled ? 'filled' : ''} ${previewClass}" role="gridcell" data-slot-index="${index}" data-accepts="${isActive ? 'true' : 'false'}" ${moduleType ? `data-module-type="${moduleType}" draggable="true"` : ''} aria-label="슬롯 ${index + 1} ${isActive ? '활성' : '비활성'} ${slotState}" tabindex="0">${moduleType ? `${MODULE_EMOJI[moduleType]}${ampBadge}` : ''}</div>`
  }).join('')

  board.dataset.signature = sig
  const statText = app.querySelector<HTMLElement>('#weapon-stat-text')
  if (statText) statText.innerHTML = renderWeaponStatText(stats)

  const summary = app.querySelector<HTMLElement>('#power-summary-bar')
  if (summary) summary.innerHTML = renderPowerSummary(stats, powerPreview)
}
