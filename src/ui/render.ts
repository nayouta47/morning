import {
  BUILDING_CYCLE_MS,
  MODULE_CRAFT_COST,
  SHOVEL_CRAFT_COST,
  UPGRADE_DEFS,
  WEAPON_BASE_STATS,
  WEAPON_CRAFT_COST,
  WEAPON_CRAFT_DURATION_MS,
  getUpgradeCost,
} from '../data/balance.ts'
import { getBuildingCost } from '../core/actions.ts'
import { getCraftRecipeMissingRequirement } from '../data/crafting.ts'
import type { GameState, ModuleType, WeaponInstance } from '../core/state.ts'

type ActionPhase = 'ready' | 'cooldown' | 'locked'

type ActionGaugeView = {
  phase: ActionPhase
  progress: number
  disabled: boolean
  label: string
  timeText: string
}

type Handlers = {
  onGatherWood: () => void
  onGatherScrap: () => void
  onBuyLumberMill: () => void
  onBuyMiner: () => void
  onBuyWorkbench: () => void
  onBuyLab: () => void
  onBuyUpgrade: (key: keyof typeof UPGRADE_DEFS) => void
  onSelectTab: (tab: 'base' | 'assembly') => void
  onCraftPistol: () => void
  onCraftRifle: () => void
  onCraftModule: () => void
  onCraftShovel: () => void
  onSelectWeapon: (weaponId: string) => void
  onReorderWeapons: (sourceWeaponId: string, targetWeaponId: string | null) => void
  onEquipModule: (moduleType: ModuleType, slotIndex: number) => void
  onMoveEquippedModule: (fromSlotIndex: number, toSlotIndex: number) => void
  onUnequipModule: (slotIndex: number) => void
}

export type ActionUI = {
  gatherWood: ActionGaugeView
  gatherScrap: ActionGaugeView
}

const MODULE_EMOJI: Record<ModuleType, string> = {
  damage: '💥',
  cooldown: '⏱️',
}

const MODULE_LABEL: Record<ModuleType, string> = {
  damage: '공격력 +1',
  cooldown: '쿨다운 -1s',
}

let selectedModuleType: ModuleType | null = null

function fmt(n: number): string {
  return n.toFixed(1)
}

const RESOURCE_LABEL: Record<'wood' | 'scrap' | 'iron' | 'chromium' | 'molybdenum' | 'shovel', string> = {
  wood: '🌲 나무',
  scrap: '🧰 고물',
  iron: '⛓️ 철',
  chromium: '🧪 크롬',
  molybdenum: '⚙️ 몰리브덴',
  shovel: '⛏️ 삽',
}

function formatCraftCost(cost: Partial<Record<'wood' | 'iron' | 'chromium' | 'molybdenum' | 'scrap', number>>): string {
  const keys: Array<'wood' | 'scrap' | 'iron' | 'chromium' | 'molybdenum'> = ['wood', 'scrap', 'iron', 'chromium', 'molybdenum']
  return keys
    .filter((key) => (cost[key] ?? 0) > 0)
    .map((key) => `${cost[key]} ${RESOURCE_LABEL[key]}`)
    .join(', ')
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function formatBuildingTime(progress: number, isActive: boolean): string {
  const totalSec = BUILDING_CYCLE_MS / 1000
  if (!isActive) return `- / ${totalSec.toFixed(1)}s`
  const remainingSec = (1 - clamp01(progress)) * totalSec
  return `${remainingSec.toFixed(1)}s / ${totalSec.toFixed(1)}s`
}

function formatActionTime(progress: number, totalMs: number, isActive: boolean): string {
  const totalSec = totalMs / 1000
  if (!isActive) return `- / ${totalSec.toFixed(1)}s`
  const remainingSec = (1 - clamp01(progress)) * totalSec
  return `${remainingSec.toFixed(1)}s / ${totalSec.toFixed(1)}s`
}

type ProductionBuildingKey = 'lumberMill' | 'miner'

type BuildingGaugeView = {
  progress: number
  percentText: string
  timeText: string
}

function getBuildingGaugeView(state: GameState, key: ProductionBuildingKey, now = Date.now()): BuildingGaugeView {
  const isActive = state.buildings[key] > 0
  if (!isActive) {
    return {
      progress: 0,
      percentText: '대기',
      timeText: formatBuildingTime(0, false),
    }
  }

  const baseProgressMs = state.productionProgress[key]
  const elapsedSinceUpdate = Math.max(0, now - state.lastUpdate)
  const smoothedProgressMs = (baseProgressMs + elapsedSinceUpdate) % BUILDING_CYCLE_MS
  const progress = clamp01(smoothedProgressMs / BUILDING_CYCLE_MS)

  return {
    progress,
    percentText: `${Math.round(progress * 100)}%`,
    timeText: formatBuildingTime(progress, true),
  }
}

function setText(app: ParentNode, selector: string, text: string): void {
  const node = app.querySelector<HTMLElement>(selector)
  if (node && node.textContent !== text) node.textContent = text
}

function setHidden(app: ParentNode, selector: string, hidden: boolean): void {
  const node = app.querySelector<HTMLElement>(selector)
  if (node) {
    if (hidden) node.setAttribute('hidden', '')
    else node.removeAttribute('hidden')
  }
}

function getEventTargetElement(eventTarget: EventTarget | null): Element | null {
  if (!eventTarget) return null
  if (eventTarget instanceof Element) return eventTarget
  if (eventTarget instanceof Node) return eventTarget.parentElement
  return null
}

function renderGaugeButton(id: string, text: string, ariaLabel: string, action: ActionGaugeView): string {
  const progress = Math.round(clamp01(action.progress) * 100)
  return `
    <button id="${id}" class="gauge-action gauge-${action.phase}" aria-label="${ariaLabel}" ${action.disabled ? 'disabled' : ''}>
      <span class="gauge-fill" style="width:${progress}%"></span>
      <span class="gauge-content">
        <span class="gauge-title">${text}</span>
        <span class="gauge-meta">
          <span class="gauge-state">${action.label}</span>
          <span class="gauge-time">${action.timeText}</span>
        </span>
      </span>
    </button>
  `
}

function renderBuildingGauge(id: string, title: string, progress: number, stateText: string, timeText: string): string {
  const width = Math.round(clamp01(progress) * 100)
  return `
    <div class="building-gauge" role="group" aria-label="${title} 진행 상태" tabindex="0" id="${id}">
      <span class="gauge-fill" style="width:${width}%"></span>
      <span class="gauge-content">
        <span class="gauge-title">${title}</span>
        <span class="gauge-meta">
          <span class="gauge-state">${stateText}</span>
          <span class="gauge-time">${timeText}</span>
        </span>
      </span>
    </div>
  `
}

function patchActionGauge(app: ParentNode, id: string, action: ActionGaugeView): void {
  const button = app.querySelector<HTMLButtonElement>(`#${id}`)
  if (!button) return

  const progress = Math.round(clamp01(action.progress) * 100)
  button.classList.remove('gauge-ready', 'gauge-cooldown', 'gauge-locked')
  button.classList.add(`gauge-${action.phase}`)
  button.disabled = action.disabled

  const fill = button.querySelector<HTMLElement>('.gauge-fill')
  if (fill) fill.style.width = `${progress}%`

  const state = button.querySelector<HTMLElement>('.gauge-state')
  if (state) state.textContent = action.label

  const time = button.querySelector<HTMLElement>('.gauge-time')
  if (time) time.textContent = action.timeText
}

function patchBuildingGauge(app: ParentNode, id: string, progress: number, stateText: string, timeText: string): void {
  const gauge = app.querySelector<HTMLElement>(`#${id}`)
  if (!gauge) return

  const width = Math.round(clamp01(progress) * 100)
  const fill = gauge.querySelector<HTMLElement>('.gauge-fill')
  if (fill) fill.style.width = `${width}%`

  const state = gauge.querySelector<HTMLElement>('.gauge-state')
  if (state) state.textContent = stateText

  const time = gauge.querySelector<HTMLElement>('.gauge-time')
  if (time) time.textContent = timeText
}

function patchLogs(app: ParentNode, state: GameState): void {
  const logList = app.querySelector<HTMLUListElement>('#log-list')
  if (!logList) return

  const signature = `${state.log.length}:${state.log[state.log.length - 1] ?? ''}`
  if (logList.dataset.signature === signature) return

  logList.innerHTML = [...state.log].reverse().map((line) => `<li>${line}</li>`).join('')
  logList.dataset.signature = signature
}

function getActiveSlots(weapon: WeaponInstance): Set<number> {
  if (weapon.type === 'pistol') {
    return new Set([22, 23, 24, 25, 26, 27])
  }
  return new Set([13, 14, 15, 16, 23, 24, 25, 26])
}

function getSelectedWeapon(state: GameState): WeaponInstance | null {
  if (!state.selectedWeaponId) return null
  return state.weapons.find((w) => w.id === state.selectedWeaponId) ?? null
}

function getWeaponStats(weapon: WeaponInstance): {
  baseDamage: number
  baseCooldown: number
  finalDamage: number
  finalCooldown: number
} {
  const base = WEAPON_BASE_STATS[weapon.type]
  let damageBonus = 0
  let cooldownBonus = 0
  weapon.slots.forEach((moduleType) => {
    if (!moduleType) return
    if (moduleType === 'damage') damageBonus += 1
    if (moduleType === 'cooldown') cooldownBonus += 1
  })

  return {
    baseDamage: base.damage,
    baseCooldown: base.cooldown,
    finalDamage: base.damage + damageBonus,
    finalCooldown: Math.max(0.5, base.cooldown - cooldownBonus),
  }
}

function craftView(remainingMs: number, lockedReason: string | null = null): ActionGaugeView {
  if (lockedReason) {
    return {
      phase: 'locked',
      progress: 0,
      disabled: true,
      label: '잠김',
      timeText: lockedReason,
    }
  }

  if (remainingMs <= 0) {
    return {
      phase: 'ready',
      progress: 1,
      disabled: false,
      label: '준비됨',
      timeText: formatActionTime(0, WEAPON_CRAFT_DURATION_MS, false),
    }
  }
  const progress = (WEAPON_CRAFT_DURATION_MS - remainingMs) / WEAPON_CRAFT_DURATION_MS
  return {
    phase: 'cooldown',
    progress,
    disabled: true,
    label: '진행 중',
    timeText: formatActionTime(progress, WEAPON_CRAFT_DURATION_MS, true),
  }
}

function renderCraftActions(state: GameState): string {
  const pistolView = craftView(state.craftProgress.pistol, getCraftRecipeMissingRequirement(state, 'pistol'))
  const rifleView = craftView(state.craftProgress.rifle, getCraftRecipeMissingRequirement(state, 'rifle'))
  const moduleView = craftView(state.craftProgress.module, getCraftRecipeMissingRequirement(state, 'module'))
  const shovelView = craftView(state.craftProgress.shovel, getCraftRecipeMissingRequirement(state, 'shovel'))

  return `
    <div class="craft-actions" role="group" aria-label="제작 행동">
      ${renderGaugeButton(
        'craft-pistol',
        `권총 제작 (30초 · ${formatCraftCost(WEAPON_CRAFT_COST.pistol)})`,
        '권총 제작',
        pistolView,
      )}
      ${renderGaugeButton(
        'craft-rifle',
        `소총 제작 (30초 · ${formatCraftCost(WEAPON_CRAFT_COST.rifle)})`,
        '소총 제작',
        rifleView,
      )}
      ${renderGaugeButton(
        'craft-module',
        `모듈 제작 (30초 · ${MODULE_CRAFT_COST.wood} ${RESOURCE_LABEL.wood}, ${MODULE_CRAFT_COST.iron} ${RESOURCE_LABEL.iron})`,
        '모듈 제작',
        moduleView,
      )}
      ${renderGaugeButton(
        'craft-shovel',
        `⛏️ 삽 제작 (30초 · ${formatCraftCost(SHOVEL_CRAFT_COST)})`,
        '⛏️ 삽 제작',
        shovelView,
      )}
    </div>
  `
}

function renderAssemblyPanel(state: GameState): string {
  syncSelectedModuleType(state)

  const selected = getSelectedWeapon(state)
  const stats = selected ? getWeaponStats(selected) : null
  const active = selected ? getActiveSlots(selected) : new Set<number>()

  return `
    <section class="panel assembly ${state.activeTab === 'assembly' ? '' : 'hidden'}" id="panel-assembly">
      <h2>무기 조립</h2>
      <div class="assembly-grid">
        <aside class="weapon-list" aria-label="무기 인벤토리">
          <h3>무기 인벤토리</h3>
          <div id="weapon-list-items" data-signature=""></div>
        </aside>
        <div class="weapon-board-wrap">
          <h3>선택 무기 슬롯 (5x10)</h3>
          <div id="weapon-board" class="weapon-board" role="grid" aria-label="무기 슬롯 보드"></div>
          <p class="hint" id="weapon-stat-text">
            ${
              stats
                ? `<span class="base-stat">기본 공격력 ${stats.baseDamage} / 기본 쿨다운 ${stats.baseCooldown.toFixed(1)}s</span> | <span class="final-stat">최종 공격력 ${stats.finalDamage} / 최종 쿨다운 ${stats.finalCooldown.toFixed(1)}s</span>`
                : '무기를 선택하세요.'
            }
          </p>
          <p class="hint">장착: 모듈을 드래그 후 활성 슬롯에 드롭 / 해제: 우클릭(대체: 휠 클릭)</p>
          <div id="active-signature" data-sig="${[...active].join(',')}" hidden></div>
        </div>
      </div>
      <div class="module-grid">
        <section class="module-detail" aria-label="모듈 상세 정보">
          <h3>모듈 상세</h3>
          <p id="module-detail-effect" class="module-effect hint">${selectedModuleType ? MODULE_LABEL[selectedModuleType] : '모듈을 선택하세요.'}</p>
        </section>
        <section class="module-inventory" aria-label="모듈 인벤토리">
          <h3>보유 모듈</h3>
          <div id="module-list-items" class="module-list" data-signature=""></div>
        </section>
      </div>
    </section>
  `
}

function patchTabs(app: ParentNode, state: GameState): void {
  const baseTab = app.querySelector<HTMLButtonElement>('#tab-base')
  const assTab = app.querySelector<HTMLButtonElement>('#tab-assembly')
  const panelBase = app.querySelector<HTMLElement>('#panel-base')
  const panelAssembly = app.querySelector<HTMLElement>('#panel-assembly')
  if (!baseTab || !assTab || !panelBase || !panelAssembly) return

  const isBase = state.activeTab === 'base'
  baseTab.classList.toggle('active', isBase)
  assTab.classList.toggle('active', !isBase)
  baseTab.setAttribute('aria-selected', String(isBase))
  assTab.setAttribute('aria-selected', String(!isBase))
  panelBase.classList.toggle('hidden', !isBase)
  panelAssembly.classList.toggle('hidden', isBase)
}

function patchWeaponInventory(app: ParentNode, state: GameState): void {
  const root = app.querySelector<HTMLDivElement>('#weapon-list-items')
  if (!root) return
  const sig = `${state.selectedWeaponId}:${state.weapons
    .map((w) => `${w.id}:${w.slots.filter((slot) => slot !== null).length}`)
    .join('|')}`
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

function syncSelectedModuleType(state: GameState): void {
  if (selectedModuleType && state.modules[selectedModuleType] > 0) return
  selectedModuleType = (Object.keys(state.modules) as ModuleType[]).find((type) => state.modules[type] > 0) ?? null
}

function patchModuleDetail(app: ParentNode, state: GameState): void {
  syncSelectedModuleType(state)
  const detail = app.querySelector<HTMLElement>('#module-detail-effect')
  if (!detail) return
  const text = selectedModuleType ? MODULE_LABEL[selectedModuleType] : '모듈을 선택하세요.'
  if (detail.textContent !== text) detail.textContent = text
}

function patchModuleInventory(app: ParentNode, state: GameState): void {
  syncSelectedModuleType(state)

  const root = app.querySelector<HTMLDivElement>('#module-list-items')
  if (!root) return
  const sig = `${state.modules.damage}:${state.modules.cooldown}:${selectedModuleType ?? 'none'}`
  if (root.dataset.signature === sig) return

  const entries = (Object.keys(state.modules) as ModuleType[])
    .filter((type) => state.modules[type] > 0)
    .map(
      (type) => `<div class="module-item ${selectedModuleType === type ? 'selected' : ''}" draggable="true" data-module-type="${type}" aria-label="${MODULE_LABEL[type]} 모듈 ${state.modules[type]}개">
        <span class="module-emoji" aria-hidden="true">${MODULE_EMOJI[type]}</span>
        <span class="module-count">x${state.modules[type]}</span>
      </div>`,
    )

  root.innerHTML = entries.join('')
  if (entries.length === 0) root.innerHTML = '<p class="hint">모듈이 없습니다.</p>'
  root.dataset.signature = sig
}

function patchWeaponBoard(app: ParentNode, state: GameState): void {
  const board = app.querySelector<HTMLDivElement>('#weapon-board')
  if (!board) return
  const selected = getSelectedWeapon(state)
  if (!selected) {
    board.innerHTML = '<p class="hint">무기를 선택하면 슬롯 보드가 표시됩니다.</p>'
    return
  }

  const active = getActiveSlots(selected)
  const sig = `${selected.id}:${selected.slots.join('|')}:${[...active].join(',')}`
  if (board.dataset.signature === sig) return

  board.innerHTML = Array.from({ length: 50 }, (_, index) => {
    const moduleType = selected.slots[index]
    const isActive = active.has(index)
    const isFilled = Boolean(moduleType)
    const slotState = moduleType ? `${MODULE_LABEL[moduleType]} 장착됨` : '비어 있음'
    return `<div
      class="slot ${isActive ? 'active' : 'inactive'} ${isFilled ? 'filled' : ''}"
      role="gridcell"
      data-slot-index="${index}"
      data-accepts="${isActive ? 'true' : 'false'}"
      ${moduleType ? `data-module-type="${moduleType}" draggable="true"` : ''}
      aria-label="슬롯 ${index + 1} ${isActive ? '활성' : '비활성'} ${slotState}"
      tabindex="0"
    >${moduleType ? MODULE_EMOJI[moduleType] : ''}</div>`
  }).join('')

  board.dataset.signature = sig

  const stats = getWeaponStats(selected)
  const statText = app.querySelector<HTMLElement>('#weapon-stat-text')
  if (statText) {
    statText.innerHTML = `<span class="base-stat">기본 공격력 ${stats.baseDamage} / 기본 쿨다운 ${stats.baseCooldown.toFixed(
      1,
    )}s</span> | <span class="final-stat">최종 공격력 ${stats.finalDamage} / 최종 쿨다운 ${stats.finalCooldown.toFixed(1)}s</span>`
  }
}

function patchCraftButtons(app: ParentNode, state: GameState): void {
  patchActionGauge(app, 'craft-pistol', craftView(state.craftProgress.pistol, getCraftRecipeMissingRequirement(state, 'pistol')))
  patchActionGauge(app, 'craft-rifle', craftView(state.craftProgress.rifle, getCraftRecipeMissingRequirement(state, 'rifle')))
  patchActionGauge(app, 'craft-module', craftView(state.craftProgress.module, getCraftRecipeMissingRequirement(state, 'module')))
  patchActionGauge(app, 'craft-shovel', craftView(state.craftProgress.shovel, getCraftRecipeMissingRequirement(state, 'shovel')))
}

export function patchAnimatedUI(state: GameState, actionUI: ActionUI, now = Date.now()): void {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  patchTabs(app, state)

  patchActionGauge(app, 'gather-wood', actionUI.gatherWood)
  patchActionGauge(app, 'gather-scrap', actionUI.gatherScrap)

  setText(app, '#res-wood', fmt(state.resources.wood))
  setText(app, '#res-scrap', fmt(state.resources.scrap))
  setText(app, '#res-iron', fmt(state.resources.iron))
  setText(app, '#res-chromium', fmt(state.resources.chromium))
  setText(app, '#res-molybdenum', fmt(state.resources.molybdenum))
  setText(app, '#res-shovel', `${state.resources.shovel}`)

  setText(app, '#gather-wood-title', `🌲 나무 줍기 (+${6 + (state.upgrades.betterAxe ? 1 : 0)})`)
  setText(app, '#gather-scrap-title', `🧰 고물 줍기 (+${7 + (state.upgrades.sortingWork ? 1 : 0)})`)

  const gatherScrapButton = app.querySelector<HTMLButtonElement>('#gather-scrap')
  if (gatherScrapButton) gatherScrapButton.setAttribute('aria-label', state.unlocks.scrapAction ? '🧰 고물 줍기 행동' : '잠긴 🧰 고물 줍기 행동')
  setHidden(app, '#scrap-hint', state.unlocks.scrapAction)

  const lumberCost = getBuildingCost(state, 'lumberMill')
  const minerCost = getBuildingCost(state, 'miner')
  const workbenchCost = getBuildingCost(state, 'workbench')
  const labCost = getBuildingCost(state, 'lab')

  const buyLumber = app.querySelector<HTMLButtonElement>('#buy-lumber')
  if (buyLumber) buyLumber.disabled = !state.unlocks.lumberMill
  setText(app, '#buy-lumber-label', `벌목기 설치 (${lumberCost.scrap} ${RESOURCE_LABEL.scrap})`)

  const buyMiner = app.querySelector<HTMLButtonElement>('#buy-miner')
  if (buyMiner) buyMiner.disabled = !state.unlocks.miner
  setText(app, '#buy-miner-label', `분쇄기 설치 (${minerCost.wood} ${RESOURCE_LABEL.wood}, ${minerCost.scrap} ${RESOURCE_LABEL.scrap})`)

  setText(app, '#buy-workbench-label', `제작대 설치 (${workbenchCost.wood} ${RESOURCE_LABEL.wood}, ${workbenchCost.scrap} ${RESOURCE_LABEL.scrap})`)
  setText(app, '#buy-lab-label', `실험실 설치 (${labCost.wood} ${RESOURCE_LABEL.wood}, ${labCost.scrap} ${RESOURCE_LABEL.scrap}, ${labCost.iron} ${RESOURCE_LABEL.iron})`)

  setText(app, '#lumber-count', `${state.buildings.lumberMill}`)
  setText(app, '#lumber-output', `${state.buildings.lumberMill}`)
  setText(app, '#miner-count', `${state.buildings.miner}`)
  setText(app, '#miner-output', `${state.buildings.miner}`)
  setText(app, '#workbench-count', `${state.buildings.workbench}`)
  setText(app, '#lab-count', `${state.buildings.lab}`)

  const lumberGauge = getBuildingGaugeView(state, 'lumberMill', now)
  const minerGauge = getBuildingGaugeView(state, 'miner', now)

  patchBuildingGauge(app, 'lumber-progress', lumberGauge.progress, lumberGauge.percentText, lumberGauge.timeText)
  patchBuildingGauge(app, 'miner-progress', minerGauge.progress, minerGauge.percentText, minerGauge.timeText)

  setHidden(app, '#upgrades-panel', state.buildings.lab <= 0)

  ;(Object.keys(UPGRADE_DEFS) as Array<keyof typeof UPGRADE_DEFS>).forEach((key) => {
    const def = UPGRADE_DEFS[key]
    const done = state.upgrades[key as keyof typeof state.upgrades]
    const cost = getUpgradeCost(key)

    const upgradeButton = app.querySelector<HTMLButtonElement>(`button[data-upgrade="${key}"]`)
    if (upgradeButton) {
      upgradeButton.disabled = done
      const label = `${def.name} (${cost.wood} ${RESOURCE_LABEL.wood}, ${cost.iron} ${RESOURCE_LABEL.iron})`
      if (upgradeButton.textContent !== label) upgradeButton.textContent = label
    }

    setText(app, `#upgrade-hint-${key}`, `${def.effectText}${done ? ' (완료)' : ''}`)
  })

  patchCraftButtons(app, state)
  patchWeaponInventory(app, state)
  patchWeaponBoard(app, state)
  patchModuleInventory(app, state)
  patchModuleDetail(app, state)
  patchLogs(app, state)
}

export function renderApp(state: GameState, handlers: Handlers, actionUI: ActionUI, now = Date.now()): void {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  const focusedId = (document.activeElement as HTMLElement | null)?.id ?? null

  const lumberCost = getBuildingCost(state, 'lumberMill')
  const minerCost = getBuildingCost(state, 'miner')
  const workbenchCost = getBuildingCost(state, 'workbench')
  const labCost = getBuildingCost(state, 'lab')

  const lumberGauge = getBuildingGaugeView(state, 'lumberMill', now)
  const minerGauge = getBuildingGaugeView(state, 'miner', now)

  app.innerHTML = `
    <main class="layout">
      <h1>Morning</h1>
      <section class="tabs" role="tablist" aria-label="메인 탭">
        <button id="tab-base" class="tab-btn ${state.activeTab === 'base' ? 'active' : ''}" role="tab" aria-selected="${
          state.activeTab === 'base'
        }" aria-controls="panel-base">거점</button>
        <button id="tab-assembly" class="tab-btn ${state.activeTab === 'assembly' ? 'active' : ''}" role="tab" aria-selected="${
          state.activeTab === 'assembly'
        }" aria-controls="panel-assembly">무기 조립</button>
      </section>

      <section id="panel-base" class="panel-stack ${state.activeTab === 'base' ? '' : 'hidden'}">
      <section class="panel resources">
        <h2>자원</h2>
        <div class="resources-split">
          <section class="resources-owned" aria-label="보유 자원">
            <p>${RESOURCE_LABEL.wood}: <strong id="res-wood">${fmt(state.resources.wood)}</strong></p>
            <p>${RESOURCE_LABEL.scrap}: <strong id="res-scrap">${fmt(state.resources.scrap)}</strong></p>
            <p>${RESOURCE_LABEL.iron}: <strong id="res-iron">${fmt(state.resources.iron)}</strong></p>
            <p>${RESOURCE_LABEL.chromium}: <strong id="res-chromium">${fmt(state.resources.chromium)}</strong></p>
            <p>${RESOURCE_LABEL.molybdenum}: <strong id="res-molybdenum">${fmt(state.resources.molybdenum)}</strong></p>
            <p>${RESOURCE_LABEL.shovel}: <strong id="res-shovel">${state.resources.shovel}</strong></p>
          </section>
          <section class="resources-buildings" aria-label="설치된 건물">
            <p>벌목기: <span id="lumber-count">${state.buildings.lumberMill}</span> (10초마다 +<span id="lumber-output">${state.buildings.lumberMill}</span> ${RESOURCE_LABEL.wood})</p>
            <p>분쇄기: <span id="miner-count">${state.buildings.miner}</span> (10초마다 최대 <span id="miner-output">${state.buildings.miner}</span> ${RESOURCE_LABEL.scrap} 처리)</p>
            <p>제작대: <span id="workbench-count">${state.buildings.workbench}</span></p>
            <p>실험실: <span id="lab-count">${state.buildings.lab}</span></p>
          </section>
        </div>
      </section>

      <section class="panel actions">
        <h2>행동</h2>
        ${renderGaugeButton('gather-wood', `🌲 나무 줍기 (+${6 + (state.upgrades.betterAxe ? 1 : 0)})`, '🌲 나무 줍기 행동', actionUI.gatherWood)}
        ${renderGaugeButton(
          'gather-scrap',
          `🧰 고물 줍기 (+${7 + (state.upgrades.sortingWork ? 1 : 0)})`,
          state.unlocks.scrapAction ? '🧰 고물 줍기 행동' : '잠긴 🧰 고물 줍기 행동',
          actionUI.gatherScrap,
        )}
        <p class="hint" id="scrap-hint" ${state.unlocks.scrapAction ? 'hidden' : ''}>해금 조건: ${RESOURCE_LABEL.shovel} 1개 이상</p>
      </section>

      <section id="crafting-panel" class="panel crafting">
        <h2>제작</h2>
        ${renderCraftActions(state)}
      </section>

      <section class="panel buildings">
        <h2>건설</h2>
        <button id="buy-lumber" aria-label="벌목기 설치" ${state.unlocks.lumberMill ? '' : 'disabled'}>
          <span id="buy-lumber-label">벌목기 설치 (${lumberCost.scrap} ${RESOURCE_LABEL.scrap})</span>
        </button>

        <button id="buy-miner" aria-label="분쇄기 설치" ${state.unlocks.miner ? '' : 'disabled'}>
          <span id="buy-miner-label">분쇄기 설치 (${minerCost.wood} ${RESOURCE_LABEL.wood}, ${minerCost.scrap} ${RESOURCE_LABEL.scrap})</span>
        </button>

        <button id="buy-workbench" aria-label="제작대 설치">
          <span id="buy-workbench-label">제작대 설치 (${workbenchCost.wood} ${RESOURCE_LABEL.wood}, ${workbenchCost.scrap} ${RESOURCE_LABEL.scrap})</span>
        </button>

        <button id="buy-lab" aria-label="실험실 설치">
          <span id="buy-lab-label">실험실 설치 (${labCost.wood} ${RESOURCE_LABEL.wood}, ${labCost.scrap} ${RESOURCE_LABEL.scrap}, ${labCost.iron} ${RESOURCE_LABEL.iron})</span>
        </button>

        ${renderBuildingGauge(
          'lumber-progress',
          '벌목기 가동',
          lumberGauge.progress,
          lumberGauge.percentText,
          lumberGauge.timeText,
        )}

        ${renderBuildingGauge(
          'miner-progress',
          '분쇄기 가동',
          minerGauge.progress,
          minerGauge.percentText,
          minerGauge.timeText,
        )}
      </section>

      <section id="upgrades-panel" class="panel upgrades" ${state.buildings.lab > 0 ? '' : 'hidden'}>
        <h2>업그레이드</h2>
        ${Object.entries(UPGRADE_DEFS)
          .map(([key, def]) => {
            const done = state.upgrades[key as keyof typeof state.upgrades]
            const cost = getUpgradeCost(key as keyof typeof UPGRADE_DEFS)
            return `
              <button data-upgrade="${key}" aria-label="업그레이드 ${def.name}" ${done ? 'disabled' : ''}>
                ${def.name} (${cost.wood} ${RESOURCE_LABEL.wood}, ${cost.iron} ${RESOURCE_LABEL.iron})
              </button>
              <p class="hint" id="upgrade-hint-${key}">${def.effectText}${done ? ' (완료)' : ''}</p>
            `
          })
          .join('')}
      </section>
      </section>

      ${renderAssemblyPanel(state)}

      <section class="panel logs">
        <h2>로그</h2>
        <ul id="log-list" data-signature="${state.log.length}:${state.log[state.log.length - 1] ?? ''}">
          ${[...state.log].reverse().map((line) => `<li>${line}</li>`).join('')}
        </ul>
      </section>
    </main>
  `

  app.querySelector<HTMLButtonElement>('#gather-wood .gauge-title')?.setAttribute('id', 'gather-wood-title')
  app.querySelector<HTMLButtonElement>('#gather-scrap .gauge-title')?.setAttribute('id', 'gather-scrap-title')

  app.querySelector<HTMLButtonElement>('#tab-base')?.addEventListener('click', () => handlers.onSelectTab('base'))
  app.querySelector<HTMLButtonElement>('#tab-assembly')?.addEventListener('click', () => handlers.onSelectTab('assembly'))

  app.querySelector<HTMLButtonElement>('#gather-wood')?.addEventListener('click', handlers.onGatherWood)
  app.querySelector<HTMLButtonElement>('#gather-scrap')?.addEventListener('click', handlers.onGatherScrap)
  app.querySelector<HTMLButtonElement>('#buy-lumber')?.addEventListener('click', handlers.onBuyLumberMill)
  app.querySelector<HTMLButtonElement>('#buy-miner')?.addEventListener('click', handlers.onBuyMiner)
  app.querySelector<HTMLButtonElement>('#buy-workbench')?.addEventListener('click', handlers.onBuyWorkbench)
  app.querySelector<HTMLButtonElement>('#buy-lab')?.addEventListener('click', handlers.onBuyLab)

  app.querySelectorAll<HTMLButtonElement>('button[data-upgrade]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.upgrade as keyof typeof UPGRADE_DEFS
      handlers.onBuyUpgrade(key)
    })
  })

  app.querySelector<HTMLButtonElement>('#craft-pistol')?.addEventListener('click', handlers.onCraftPistol)
  app.querySelector<HTMLButtonElement>('#craft-rifle')?.addEventListener('click', handlers.onCraftRifle)
  app.querySelector<HTMLButtonElement>('#craft-module')?.addEventListener('click', handlers.onCraftModule)
  app.querySelector<HTMLButtonElement>('#craft-shovel')?.addEventListener('click', handlers.onCraftShovel)

  const selectModuleForDetail = (eventTarget: EventTarget | null): void => {
    const target = getEventTargetElement(eventTarget)
    const moduleItem = target?.closest<HTMLElement>('[data-module-type]')
    const moduleType = moduleItem?.getAttribute('data-module-type') as ModuleType | null
    if (!moduleType) return
    selectedModuleType = moduleType
    patchModuleInventory(app, state)
    patchModuleDetail(app, state)
  }

  app.addEventListener('pointerdown', (event) => {
    selectModuleForDetail(event.target)
  })

  app.addEventListener('click', (event) => {
    const target = getEventTargetElement(event.target)
    const button = target?.closest<HTMLElement>('[data-weapon-id]')
    if (!button) return
    const id = button.getAttribute('data-weapon-id')
    if (id) handlers.onSelectWeapon(id)
  })

  app.addEventListener('dragstart', (event) => {
    selectModuleForDetail(event.target)

    const target = getEventTargetElement(event.target)
    if (!target || !event.dataTransfer) return

    const weaponItem = target.closest<HTMLElement>('#weapon-list-items [data-weapon-id]')
    if (weaponItem) {
      const weaponId = weaponItem.getAttribute('data-weapon-id')
      if (!weaponId) return
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/weapon-drag-kind', 'inventory')
      event.dataTransfer.setData('text/weapon-id', weaponId)
      return
    }

    const moduleItem = target.closest<HTMLElement>('#module-list-items [data-module-type]')
    if (moduleItem) {
      const moduleType = moduleItem.getAttribute('data-module-type') as ModuleType | null
      if (!moduleType) return
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/module-drag-kind', 'inventory')
      event.dataTransfer.setData('text/module-type', moduleType)
      return
    }

    const slot = target.closest<HTMLElement>('[data-slot-index].filled')
    if (!slot || !state.selectedWeaponId) return
    const moduleType = slot.getAttribute('data-module-type') as ModuleType | null
    if (!moduleType) return
    const slotIndex = Number(slot.getAttribute('data-slot-index'))
    if (!Number.isFinite(slotIndex)) return

    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/module-drag-kind', 'slot')
    event.dataTransfer.setData('text/module-type', moduleType)
    event.dataTransfer.setData('text/module-slot-index', String(slotIndex))
    event.dataTransfer.setData('text/module-weapon-id', state.selectedWeaponId)
  })

  app.addEventListener('dragover', (event) => {
    if (!event.dataTransfer) return
    const target = getEventTargetElement(event.target)
    if (!target) return

    const weaponDragKind = event.dataTransfer.getData('text/weapon-drag-kind')
    if (weaponDragKind === 'inventory' && target.closest<HTMLElement>('#weapon-list-items')) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      return
    }

    const dragKind = event.dataTransfer.getData('text/module-drag-kind')

    const slot = target.closest<HTMLElement>('[data-slot-index]')
    if (slot) {
      if (slot.getAttribute('data-accepts') !== 'true') return
      if (dragKind === 'inventory' && slot.classList.contains('filled')) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      return
    }

    const inventoryPanel = target.closest<HTMLElement>('.module-inventory')
    if (inventoryPanel && dragKind === 'slot') {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
    }
  })

  app.addEventListener('drop', (event) => {
    if (!event.dataTransfer) return

    const target = getEventTargetElement(event.target)
    if (!target) return

    const weaponDragKind = event.dataTransfer.getData('text/weapon-drag-kind')
    if (weaponDragKind === 'inventory') {
      const sourceWeaponId = event.dataTransfer.getData('text/weapon-id')
      if (!sourceWeaponId) return

      const weaponList = target.closest<HTMLElement>('#weapon-list-items')
      if (!weaponList) return

      const targetWeapon = target.closest<HTMLElement>('[data-weapon-id]')
      const targetWeaponId = targetWeapon?.getAttribute('data-weapon-id') ?? null

      event.preventDefault()
      handlers.onReorderWeapons(sourceWeaponId, targetWeaponId)
      return
    }

    const dragKind = event.dataTransfer.getData('text/module-drag-kind')
    const moduleType = event.dataTransfer.getData('text/module-type') as ModuleType
    if (moduleType !== 'damage' && moduleType !== 'cooldown') return

    const inventoryPanel = target.closest<HTMLElement>('.module-inventory')
    if (inventoryPanel && dragKind === 'slot') {
      const sourceSlotIndex = Number(event.dataTransfer.getData('text/module-slot-index'))
      const sourceWeaponId = event.dataTransfer.getData('text/module-weapon-id')
      if (!Number.isFinite(sourceSlotIndex) || !state.selectedWeaponId || sourceWeaponId !== state.selectedWeaponId) return
      event.preventDefault()
      handlers.onUnequipModule(sourceSlotIndex)
      return
    }

    const slot = target.closest<HTMLElement>('[data-slot-index]')
    if (!slot) return

    const slotIndex = Number(slot.getAttribute('data-slot-index'))
    if (!Number.isFinite(slotIndex)) return
    if (slot.getAttribute('data-accepts') !== 'true') return

    if (dragKind === 'inventory') {
      if (slot.classList.contains('filled')) return
      event.preventDefault()
      handlers.onEquipModule(moduleType, slotIndex)
      return
    }

    if (dragKind === 'slot') {
      const sourceSlotIndex = Number(event.dataTransfer.getData('text/module-slot-index'))
      const sourceWeaponId = event.dataTransfer.getData('text/module-weapon-id')
      if (!Number.isFinite(sourceSlotIndex) || !state.selectedWeaponId || sourceWeaponId !== state.selectedWeaponId) return
      event.preventDefault()
      handlers.onMoveEquippedModule(sourceSlotIndex, slotIndex)
    }
  })

  app.addEventListener('contextmenu', (event) => {
    const target = getEventTargetElement(event.target)
    const slot = target?.closest<HTMLElement>('[data-slot-index]')
    if (!slot || !slot.classList.contains('filled')) return
    event.preventDefault()
    const slotIndex = Number(slot.getAttribute('data-slot-index'))
    if (!Number.isFinite(slotIndex)) return
    handlers.onUnequipModule(slotIndex)
  })

  app.addEventListener('auxclick', (event) => {
    if (event.button !== 1) return
    const target = getEventTargetElement(event.target)
    const slot = target?.closest<HTMLElement>('[data-slot-index]')
    if (!slot || !slot.classList.contains('filled')) return
    const slotIndex = Number(slot.getAttribute('data-slot-index'))
    if (!Number.isFinite(slotIndex)) return
    handlers.onUnequipModule(slotIndex)
  })

  if (focusedId) {
    const nextFocus = app.querySelector<HTMLElement>(`#${focusedId}`)
    nextFocus?.focus()
  }
}
