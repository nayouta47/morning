import { MODULE_POWER_COST, SLOT_PENALTY_MAJOR, getEffectiveActiveWeaponSlots, getWeaponModuleLayerStats } from '../../core/moduleEffects.ts'
import { WEAPON_DISPLAY_STATS } from '../../data/balance.ts'
import { MODULE_EMOJI, MODULE_METADATA, MODULE_NAME_KR, MODULE_TYPES } from '../../data/modules.ts'
import type { GameState, ModuleType, WeaponInstance } from '../../core/state.ts'
import { renderModuleDetail } from './assembly/moduleDetailView.ts'
import { renderSlotPenaltyOverlay } from './assembly/slotPenaltyView.ts'

type PowerPreview = {
  usage: number
  capacity: number
  overloaded: boolean
  slotIndex: number
}

let selectedModuleType: ModuleType | null = null
let selectedModuleSelectionSource: 'inventory' | 'slot' | 'auto' | null = null
let powerPreview: PowerPreview | null = null

function getActiveSlots(weapon: WeaponInstance): Set<number> {
  return getEffectiveActiveWeaponSlots(weapon)
}

function getSelectedWeapon(state: GameState): WeaponInstance | null {
  if (!state.selectedWeaponId) return null
  return state.weapons.find((w) => w.id === state.selectedWeaponId) ?? null
}

function getWeaponStats(weapon: WeaponInstance) {
  return getWeaponModuleLayerStats(weapon)
}

function renderPowerSummary(stats: ReturnType<typeof getWeaponStats>, preview: PowerPreview | null): string {
  const currentUsage = stats.power.usage
  const capacity = preview?.capacity ?? stats.power.capacity
  const overloaded = preview?.overloaded ?? stats.power.overloaded
  const statusLabel = overloaded ? '과부하' : '정상'

  const delta = preview ? preview.usage - currentUsage : 0
  const deltaLabel = preview
    ? delta > 0
      ? `(⬆️${delta})`
      : delta < 0
        ? `(⬇️${Math.abs(delta)})`
        : '(↔0)'
    : ''

  const overloadHint = overloaded
    ? '<span class="power-warning-text">모듈 효과 차단</span>'
    : ''

  return `<div class="power-summary ${overloaded ? 'overload' : 'normal'}"><span class="power-summary-value">전력 ${currentUsage}${deltaLabel} / ${capacity}</span><span class="power-summary-badge">${statusLabel}</span>${overloadHint}</div>`
}

function renderWeaponStatCards(stats: ReturnType<typeof getWeaponStats>, weapon: WeaponInstance): string {
  const finalClass = stats.power.overloaded ? 'final-stat subdued' : 'final-stat'
  const overloadLine = stats.power.overloaded
    ? '<p class="stat-warning">⚠ 과부하 상태: 모듈 효과 차단</p>'
    : '<p class="stat-warning normal">모듈 효과 정상 적용 중</p>'
  const displayStats = WEAPON_DISPLAY_STATS[weapon.type]

  return `<article class="weapon-stat-card" aria-label="선택 무기 현재 스펙">
      <h3>현재 무기 스펙</h3>
      ${overloadLine}
      <div class="weapon-stat-card-grid">
        <div class="weapon-stat-item"><span class="weapon-stat-label">기본 공격력</span><strong class="weapon-stat-value">${stats.baseDamage}</strong></div>
        <div class="weapon-stat-item"><span class="weapon-stat-label">최종 공격력</span><strong class="weapon-stat-value ${finalClass}">${stats.finalDamage}</strong></div>
        <div class="weapon-stat-item"><span class="weapon-stat-label">기본 쿨다운</span><strong class="weapon-stat-value">${stats.baseCooldownSec.toFixed(1)}s</strong></div>
        <div class="weapon-stat-item"><span class="weapon-stat-label">최종 쿨다운</span><strong class="weapon-stat-value ${finalClass}">${stats.finalCooldownSec.toFixed(1)}s</strong></div>
        <div class="weapon-stat-item"><span class="weapon-stat-label">명중률</span><strong class="weapon-stat-value">${displayStats.accuracy}%</strong></div>
        <div class="weapon-stat-item"><span class="weapon-stat-label">사거리</span><strong class="weapon-stat-value">${displayStats.range}m</strong></div>
        <div class="weapon-stat-item"><span class="weapon-stat-label">중량</span><strong class="weapon-stat-value">${displayStats.weight.toFixed(1)}kg</strong></div>
      </div>
      <p class="weapon-stat-haste">가속 ${stats.totalHaste >= 0 ? '+' : ''}${stats.totalHaste}</p>
    </article>`
}

function isModuleTypeEquipped(state: GameState, moduleType: ModuleType): boolean {
  return state.weapons.some((weapon) => weapon.slots.some((slot) => slot === moduleType))
}

function syncSelectedModuleType(state: GameState): void {
  if (selectedModuleType) {
    if (state.modules[selectedModuleType] > 0) return
    if (isModuleTypeEquipped(state, selectedModuleType)) return
  }

  selectedModuleType = MODULE_TYPES.find((type) => state.modules[type] > 0) ?? null
  selectedModuleSelectionSource = selectedModuleType ? 'auto' : null
}

export function setSelectedModuleType(moduleType: ModuleType, source: 'inventory' | 'slot' = 'inventory'): void {
  selectedModuleType = moduleType
  selectedModuleSelectionSource = source
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
      <section class="weapon-list weapon-list-top" aria-label="무기 인벤토리"><h3>무기 인벤토리</h3><div id="weapon-list-items" data-signature=""></div></section>
      <div class="assembly-grid">
        <div class="weapon-board-wrap"><div class="weapon-board-header"><h3>선택 무기 슬롯 (5x10)</h3><button id="copy-selected-weapon-slot-state" class="chip-state-copy-btn" type="button" ${selected ? '' : 'disabled'}>슬롯 상태 복사</button></div><div id="weapon-board" class="weapon-board" role="grid" aria-label="무기 슬롯 보드"></div><div id="power-summary-bar">${stats ? renderPowerSummary(stats, powerPreview) : '<div class="power-summary"><span class="power-summary-value">무기를 선택하세요.</span></div>'}</div><p class="hint">장착: 모듈을 드래그 후 활성 슬롯에 드롭 / 해제: 우클릭(대체: 휠 클릭), 보유 모듈 패널로 드래그</p><div id="active-signature" data-sig="${[...active].join(',')}" hidden></div></div>
        <aside id="weapon-stat-text" class="weapon-stat-area" aria-label="선택 무기 현재 스펙">${stats && selected ? renderWeaponStatCards(stats, selected) : '<p class="hint">무기를 선택하세요.</p>'}</aside>
      </div>
      <div class="module-grid"><section class="module-detail" aria-label="모듈 상세 정보"><h3>모듈 상세</h3><div id="module-detail-content">${renderModuleDetail(selectedModuleType)}</div></section><section class="module-inventory" aria-label="모듈 인벤토리"><h3>보유 모듈</h3><div id="module-list-items" class="module-list" data-signature=""></div></section></div>
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
  const detail = app.querySelector<HTMLElement>('#module-detail-content')
  if (!detail) return
  const sig = selectedModuleType ?? 'none'
  if (detail.dataset.signature === sig) return
  detail.innerHTML = renderModuleDetail(selectedModuleType)
  detail.dataset.signature = sig
}

export function patchModuleInventory(app: ParentNode, state: GameState): void {
  syncSelectedModuleType(state)
  const root = app.querySelector<HTMLDivElement>('#module-list-items')
  if (!root) return
  const moduleSig = MODULE_TYPES.map((type) => state.modules[type]).join(':')
  const sig = `${moduleSig}:${selectedModuleType ?? 'none'}:${selectedModuleSelectionSource ?? 'none'}`
  if (root.dataset.signature === sig) return

  const entries = MODULE_TYPES
    .filter((type) => state.modules[type] > 0)
    .map((type) => {
      const isInventorySelected = selectedModuleType === type && selectedModuleSelectionSource === 'inventory'
      return `<div class="module-item ${isInventorySelected ? 'selected' : ''}" draggable="true" data-module-type="${type}" aria-label="${MODULE_METADATA[type].shortLabel} 모듈 ${state.modules[type]}개"><span class="module-emoji" aria-hidden="true">${MODULE_EMOJI[type]}</span><span class="module-name">${MODULE_NAME_KR[type]} ⚡${MODULE_POWER_COST[type]}</span><span class="module-count">x${state.modules[type]}</span></div>`
    })

  root.innerHTML = entries.join('')
  if (entries.length === 0) root.innerHTML = '<p class="hint">모듈이 없습니다.</p>'
  root.dataset.signature = sig
}

export function patchWeaponBoard(app: ParentNode, state: GameState): void {
  const board = app.querySelector<HTMLDivElement>('#weapon-board')
  if (!board) return
  const copyButton = app.querySelector<HTMLButtonElement>('#copy-selected-weapon-slot-state')
  const selected = getSelectedWeapon(state)
  if (!selected) {
    if (copyButton) copyButton.disabled = true
    board.innerHTML = '<p class="hint">무기를 선택하면 슬롯 보드가 표시됩니다.</p>'
    return
  }

  if (copyButton) copyButton.disabled = false

  const active = getActiveSlots(selected)
  const stats = getWeaponStats(selected)
  const previewSig = powerPreview ? `${powerPreview.slotIndex}:${powerPreview.usage}:${powerPreview.capacity}:${powerPreview.overloaded ? 1 : 0}` : 'none'
  const sig = `${selected.id}:${selected.slots.join('|')}:${stats.slotAmplification.join('|')}:${stats.slotAmplificationReduction.join('|')}:${stats.totalPenalty.join('|')}:${stats.heatPenalty.join('|')}:${stats.blockPenalty.join('|')}:${stats.slotPenaltyDisabled.map((v) => (v ? '1' : '0')).join('')}:${[...active].join(',')}:${previewSig}`
  if (board.dataset.signature === sig) return

  board.innerHTML = Array.from({ length: 50 }, (_, index) => {
    const moduleType = selected.slots[index]
    const isActive = active.has(index)
    const isPenaltyDisabled = stats.slotPenaltyDisabled[index] ?? false
    const baseInactive = !isActive
    const activePenaltyStopped = isActive && isPenaltyDisabled
    const activeUsable = isActive
    const isDisabled = baseInactive || activePenaltyStopped
    const isFilled = Boolean(moduleType)
    const amplificationCount = stats.slotAmplification[index] ?? 0
    const penaltyTotal = Math.max(0, stats.totalPenalty[index] ?? 0)
    const penaltyHeat = Math.max(0, stats.heatPenalty[index] ?? 0)
    const penaltyBlock = Math.max(0, stats.blockPenalty[index] ?? 0)
    const penaltyReduction = stats.slotAmplificationReduction[index] ?? 0
    const penaltyOverlay = renderSlotPenaltyOverlay(penaltyHeat, penaltyBlock)
    const disableOverlay = activePenaltyStopped ? '<span class="slot-disable-x" aria-hidden="true">✕</span>' : ''
    const slotState = moduleType
      ? `${MODULE_METADATA[moduleType].shortLabel} 장착됨${amplificationCount > 0 ? `, 증폭 +${amplificationCount}` : ''}${penaltyReduction > 0 ? `, 증폭 감소 -${penaltyReduction}` : ''}`
      : '비어 있음'
    const slotStatus = baseInactive ? '기본 차단' : activePenaltyStopped ? '총 패널티로 일시 정지' : '활성'
    const previewClass = powerPreview?.slotIndex === index && isActive ? (powerPreview.overloaded ? 'preview-overload' : 'preview-safe') : ''
    const penaltyState = penaltyTotal > 0 ? `, 총 패널티 ${penaltyTotal}(열기 패널티 ${penaltyHeat} + 차단 패널티 ${penaltyBlock})` : ''
    const penaltyBreakdown = penaltyTotal > 0 ? `열기 ${penaltyHeat}/${SLOT_PENALTY_MAJOR}, 차단 ${penaltyBlock}/${SLOT_PENALTY_MAJOR}, 총합 ${penaltyTotal}/${SLOT_PENALTY_MAJOR}` : '패널티 없음'
    return `<div class="slot ${baseInactive ? 'base-inactive inactive' : ''} ${activeUsable ? 'active active-usable' : ''} ${activePenaltyStopped ? 'active active-penalty-stopped penalty-disabled' : ''} ${isDisabled ? 'disabled' : ''} ${isFilled ? 'filled' : ''} ${previewClass}" role="gridcell" data-slot-index="${index}" data-accepts="${activeUsable ? 'true' : 'false'}" ${moduleType ? `data-module-type="${moduleType}" draggable="true"` : ''} aria-label="슬롯 ${index + 1} ${slotStatus} ${slotState}${penaltyState}" title="${penaltyBreakdown}" aria-disabled="${isDisabled ? 'true' : 'false'}" tabindex="0">${penaltyOverlay}${moduleType ? `<span class="slot-module-emoji" aria-hidden="true">${MODULE_EMOJI[moduleType]}</span>` : ''}${disableOverlay}</div>`
  }).join('')

  board.dataset.signature = sig
  const statText = app.querySelector<HTMLElement>('#weapon-stat-text')
  if (statText) statText.innerHTML = renderWeaponStatCards(stats, selected)

  const summary = app.querySelector<HTMLElement>('#power-summary-bar')
  if (summary) summary.innerHTML = renderPowerSummary(stats, powerPreview)
}
