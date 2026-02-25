import { MODULE_POWER_COST, getWeaponModuleLayerStats } from '../../core/moduleEffects.ts'
import type { GameState, ModuleType, WeaponInstance } from '../../core/state.ts'
import { getActiveWeaponSlots } from '../../core/weaponSlots.ts'

const MODULE_EMOJI: Record<ModuleType, string> = {
  damage: '💥',
  cooldown: '⏱️',
  blockAmplifierUp: '📡▲',
  blockAmplifierDown: '📡▼',
  preheater: '🔥',
  heatAmplifierLeft: '♨️◀',
  heatAmplifierRight: '♨️▶',
}
const MODULE_NAME: Record<ModuleType, string> = {
  damage: '공격력 칩',
  cooldown: '가속 칩',
  blockAmplifierUp: '차단 증폭기(상)',
  blockAmplifierDown: '차단 증폭기(하)',
  preheater: '예열기 칩',
  heatAmplifierLeft: '열 증폭기(좌)',
  heatAmplifierRight: '열 증폭기(우)',
}
const MODULE_LABEL: Record<ModuleType, string> = {
  damage: '기본 공격력 +1, 증폭 시 추가 +1 · 전력 ⚡5',
  cooldown: '기본 가속 +10, 증폭 시 추가 +10 · 전력 ⚡5',
  blockAmplifierUp: '전력 ⚡2',
  blockAmplifierDown: '전력 ⚡2',
  preheater: '전투 시작 즉시 발사 준비 · 전력 ⚡7',
  heatAmplifierLeft: '전력 ⚡4',
  heatAmplifierRight: '전력 ⚡4',
}

const MODULE_EFFECT_DETAIL: Record<ModuleType, { base: string; amplified: string }> = {
  damage: {
    base: '공격력 +1',
    amplified: '공격력 +1',
  },
  cooldown: {
    base: '가속 +10',
    amplified: '가속 +10',
  },
  blockAmplifierUp: {
    base: '위쪽 1칸 증폭(중첩) + 좌우 슬롯 차단',
    amplified: '해당 없음',
  },
  blockAmplifierDown: {
    base: '아래쪽 1칸 증폭(중첩) + 좌우 슬롯 차단',
    amplified: '해당 없음',
  },
  preheater: {
    base: '전투 시작 즉시 발사 준비',
    amplified: '해당 없음',
  },
  heatAmplifierLeft: {
    base: '즉시 왼쪽 1칸 증폭 +2',
    amplified: '열장 페널티: 증폭 방향 1칸 고열 10 + 나머지 인접 3칸 고열 5(증폭기 칩 장착 칸 제외), ⌊열⌋만큼 증폭 감소 및 슬롯 정지',
  },
  heatAmplifierRight: {
    base: '즉시 오른쪽 1칸 증폭 +2',
    amplified: '열장 페널티: 증폭 방향 1칸 고열 10 + 나머지 인접 3칸 고열 5(증폭기 칩 장착 칸 제외), ⌊열⌋만큼 증폭 감소 및 슬롯 정지',
  },
}

type InfluenceCellKind = 'empty' | 'center' | 'amp' | 'block' | 'heatWarm' | 'heatHigh' | 'ampHeatHigh'

type InfluenceCell = {
  x: number
  y: number
  kind: InfluenceCellKind
}

const MINI_GRID_SIZE = 5
const MINI_GRID_CENTER = Math.floor(MINI_GRID_SIZE / 2)

function setInfluenceCell(grid: InfluenceCellKind[][], dx: number, dy: number, kind: InfluenceCellKind): void {
  const x = MINI_GRID_CENTER + dx
  const y = MINI_GRID_CENTER + dy
  if (x < 0 || x >= MINI_GRID_SIZE || y < 0 || y >= MINI_GRID_SIZE) return
  grid[y][x] = kind
}

function getAmplifierMiniGrid(moduleType: ModuleType): InfluenceCell[] | null {
  if (
    moduleType !== 'blockAmplifierUp'
    && moduleType !== 'blockAmplifierDown'
    && moduleType !== 'heatAmplifierLeft'
    && moduleType !== 'heatAmplifierRight'
  ) {
    return null
  }

  const grid = Array.from({ length: MINI_GRID_SIZE }, () => Array.from({ length: MINI_GRID_SIZE }, () => 'empty' as InfluenceCellKind))
  setInfluenceCell(grid, 0, 0, 'center')

  if (moduleType === 'blockAmplifierUp') {
    setInfluenceCell(grid, 0, -1, 'amp')
    setInfluenceCell(grid, -1, 0, 'block')
    setInfluenceCell(grid, 1, 0, 'block')
  } else if (moduleType === 'blockAmplifierDown') {
    setInfluenceCell(grid, 0, 1, 'amp')
    setInfluenceCell(grid, -1, 0, 'block')
    setInfluenceCell(grid, 1, 0, 'block')
  } else if (moduleType === 'heatAmplifierLeft') {
    setInfluenceCell(grid, -1, 0, 'ampHeatHigh')
    setInfluenceCell(grid, 0, -1, 'heatWarm')
    setInfluenceCell(grid, 0, 1, 'heatWarm')
    setInfluenceCell(grid, 1, 0, 'heatWarm')
  } else if (moduleType === 'heatAmplifierRight') {
    setInfluenceCell(grid, 1, 0, 'ampHeatHigh')
    setInfluenceCell(grid, 0, -1, 'heatWarm')
    setInfluenceCell(grid, 0, 1, 'heatWarm')
    setInfluenceCell(grid, -1, 0, 'heatWarm')
  }

  return grid.flatMap((row, y) => row.map((kind, x) => ({ x, y, kind })))
}

function renderInfluenceMiniGrid(moduleType: ModuleType): string {
  const cells = getAmplifierMiniGrid(moduleType)
  if (!cells) return ''

  const cellLabel: Record<InfluenceCellKind, string> = {
    empty: '',
    center: '●',
    amp: '+',
    block: '10',
    heatWarm: '5',
    heatHigh: '10',
    ampHeatHigh: '10',
  }

  const gridCells = cells
    .map((cell) => `<span class="influence-cell ${cell.kind}" aria-hidden="true">${cellLabel[cell.kind]}</span>`)
    .join('')

  return `<div class="influence-preview" aria-label="모듈 영향 미니 지도"><div class="influence-grid" role="img" aria-label="중앙은 모듈 위치, +는 증폭, 5는 고열 패널티, 10은 고열/차단 패널티">${gridCells}</div><div class="influence-legend"><span class="legend-item"><span class="swatch center"></span>중심</span><span class="legend-item"><span class="swatch amp"></span>증폭</span><span class="legend-item"><span class="swatch block"></span>차단 10</span><span class="legend-item"><span class="swatch warm"></span>고열 5</span><span class="legend-item"><span class="swatch high"></span>고열 10</span></div></div>`
}

function renderModuleDetail(moduleType: ModuleType | null): string {
  if (!moduleType) return '<p id="module-detail-effect" class="module-effect hint">모듈을 선택하세요.</p>'
  const miniGrid = renderInfluenceMiniGrid(moduleType)
  const detail = MODULE_EFFECT_DETAIL[moduleType]

  return `<div id="module-detail-effect" class="module-effect-cards" aria-label="모듈 효과 상세">
    <article class="module-effect-card module-effect-base" aria-label="기본효과">
      <h4>기본효과</h4>
      <p class="hint">${detail.base}</p>
    </article>
    <article class="module-effect-card module-effect-amp" aria-label="증폭효과">
      <h4>증폭효과</h4>
      <p class="hint">${detail.amplified}</p>
    </article>
  </div>${miniGrid}`
}

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
    ? '<span class="power-warning-text">모듈 효과 차단</span>'
    : ''

  return `<div class="power-summary ${overloaded ? 'overload' : 'normal'}"><span class="power-summary-value">전력 ${usage} / ${capacity}</span><span class="power-summary-badge">${statusLabel}</span>${overloadHint}${projected}</div>`
}

function renderWeaponStatText(stats: ReturnType<typeof getWeaponStats>): string {
  const finalClass = stats.power.overloaded ? 'final-stat subdued' : 'final-stat'
  const overloadLine = stats.power.overloaded
    ? '<span class="stat-warning">⚠ 과부하 상태: 모듈 효과 차단</span>'
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
      <div class="assembly-grid">
        <aside class="weapon-list" aria-label="무기 인벤토리"><h3>무기 인벤토리</h3><div id="weapon-list-items" data-signature=""></div></aside>
        <div class="weapon-board-wrap"><h3>선택 무기 슬롯 (5x10)</h3><div id="weapon-board" class="weapon-board" role="grid" aria-label="무기 슬롯 보드"></div><div id="power-summary-bar">${stats ? renderPowerSummary(stats, powerPreview) : '<div class="power-summary"><span class="power-summary-value">무기를 선택하세요.</span></div>'}</div><p class="hint" id="weapon-stat-text">${stats ? renderWeaponStatText(stats) : '무기를 선택하세요.'}</p><p class="hint">장착: 모듈을 드래그 후 활성 슬롯에 드롭 / 해제: 우클릭(대체: 휠 클릭), 보유 모듈 패널로 드래그</p><div id="active-signature" data-sig="${[...active].join(',')}" hidden></div></div>
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
  const sig = `${state.modules.damage}:${state.modules.cooldown}:${state.modules.blockAmplifierUp}:${state.modules.blockAmplifierDown}:${state.modules.preheater}:${state.modules.heatAmplifierLeft}:${state.modules.heatAmplifierRight}:${selectedModuleType ?? 'none'}:${selectedModuleSelectionSource ?? 'none'}`
  if (root.dataset.signature === sig) return

  const entries = (Object.keys(state.modules) as ModuleType[])
    .filter((type) => state.modules[type] > 0)
    .map((type) => {
      const isInventorySelected = selectedModuleType === type && selectedModuleSelectionSource === 'inventory'
      return `<div class="module-item ${isInventorySelected ? 'selected' : ''}" draggable="true" data-module-type="${type}" aria-label="${MODULE_LABEL[type]} 모듈 ${state.modules[type]}개"><span class="module-emoji" aria-hidden="true">${MODULE_EMOJI[type]}</span><span class="module-name">${MODULE_NAME[type]} ⚡${MODULE_POWER_COST[type]}</span><span class="module-count">x${state.modules[type]}</span></div>`
    })

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
  const sig = `${selected.id}:${selected.slots.join('|')}:${stats.slotAmplification.join('|')}:${stats.slotAmplificationReduction.join('|')}:${stats.slotHeatHigh.join('|')}:${stats.slotHeatWarm.join('|')}:${stats.slotHeatCold.join('|')}:${stats.slotPenaltyDisabled.map((v) => (v ? '1' : '0')).join('')}:${[...active].join(',')}:${previewSig}`
  if (board.dataset.signature === sig) return

  board.innerHTML = Array.from({ length: 50 }, (_, index) => {
    const moduleType = selected.slots[index]
    const isActive = active.has(index)
    const isPenaltyDisabled = stats.slotPenaltyDisabled[index] ?? false
    const isDisabled = stats.slotDisabled[index] ?? !isActive
    const isFilled = Boolean(moduleType)
    const amplificationCount = stats.slotAmplification[index] ?? 0
    const heatHigh = Math.max(0, stats.slotHeatHigh[index] ?? 0)
    const heatWarm = Math.max(0, stats.slotHeatWarm[index] ?? 0)
    const heatCold = Math.max(0, stats.slotHeatCold[index] ?? 0)
    const heatTotal = heatHigh + heatWarm + heatCold
    const heatReduction = stats.slotAmplificationReduction[index] ?? 0
    const heatFill = Math.min(1, heatTotal)
    const shouldNormalize = heatTotal > 1
    const heatSegments = [
      { kind: 'high', value: heatHigh },
      { kind: 'warm', value: heatWarm },
      { kind: 'cold', value: heatCold },
    ].filter((segment) => segment.value > 0)
    const heatGauge = heatTotal > 0
      ? `<span class="slot-heat-gauge" aria-hidden="true"><span class="slot-heat-fill" style="width:${(heatFill * 100).toFixed(1)}%">${heatSegments
        .map((segment) => {
          const denominator = shouldNormalize ? heatTotal : heatFill
          const segmentRatio = denominator > 0 ? segment.value / denominator : 0
          return `<span class="slot-heat-segment ${segment.kind}" style="width:${(segmentRatio * 100).toFixed(1)}%"></span>`
        })
        .join('')}</span></span>`
      : ''
    const ampBadge = moduleType && amplificationCount > 0 ? `<span class="slot-amplify" aria-label="증폭 +${amplificationCount}">+${amplificationCount}</span>` : ''
    const disableOverlay = isPenaltyDisabled ? '<span class="slot-disable-x" aria-hidden="true">✕</span>' : ''
    const slotState = moduleType
      ? `${MODULE_LABEL[moduleType]} 장착됨${amplificationCount > 0 ? `, 증폭 +${amplificationCount}` : ''}${heatReduction > 0 ? `, 열 페널티 -${heatReduction}` : ''}`
      : '비어 있음'
    const slotStatus = !isActive ? '기본 차단' : isPenaltyDisabled ? '증폭 페널티로 차단' : '활성'
    const previewClass = powerPreview?.slotIndex === index && !isDisabled ? (powerPreview.overloaded ? 'preview-overload' : 'preview-safe') : ''
    const heatState = heatTotal > 0 ? `, 상태 게이지 ${heatTotal.toFixed(1)}` : ''
    return `<div class="slot ${isActive ? 'active' : 'inactive'} ${isDisabled ? 'disabled' : ''} ${isPenaltyDisabled ? 'penalty-disabled' : ''} ${isFilled ? 'filled' : ''} ${previewClass}" role="gridcell" data-slot-index="${index}" data-accepts="${isActive ? 'true' : 'false'}" ${moduleType ? `data-module-type="${moduleType}" draggable="true"` : ''} aria-label="슬롯 ${index + 1} ${slotStatus} ${slotState}${heatState}" aria-disabled="${isDisabled ? 'true' : 'false'}" tabindex="0">${heatGauge}${moduleType ? `${MODULE_EMOJI[moduleType]}${ampBadge}` : ''}${disableOverlay}</div>`
  }).join('')

  board.dataset.signature = sig
  const statText = app.querySelector<HTMLElement>('#weapon-stat-text')
  if (statText) statText.innerHTML = renderWeaponStatText(stats)

  const summary = app.querySelector<HTMLElement>('#power-summary-bar')
  if (summary) summary.innerHTML = renderPowerSummary(stats, powerPreview)
}
