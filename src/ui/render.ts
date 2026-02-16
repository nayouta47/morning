import {
  BUILDING_CYCLE_MS,
  MODULE_CRAFT_COST,
  UPGRADE_DEFS,
  WEAPON_BASE_STATS,
  WEAPON_CRAFT_COST,
  WEAPON_CRAFT_DURATION_MS,
  getUpgradeCost,
} from '../data/balance.ts'
import { getBuildingCost } from '../core/actions.ts'
import type { GameState, ModuleType, WeaponInstance } from '../core/state.ts'

type ActionPhase = 'ready' | 'cooldown' | 'locked'

type ActionGaugeView = {
  phase: ActionPhase
  progress: number
  disabled: boolean
  label: string
}

type Handlers = {
  onGatherWood: () => void
  onGatherMetal: () => void
  onBuyLumberMill: () => void
  onBuyMiner: () => void
  onBuyUpgrade: (key: keyof typeof UPGRADE_DEFS) => void
  onSelectTab: (tab: 'base' | 'assembly') => void
  onCraftPistol: () => void
  onCraftRifle: () => void
  onCraftModule: () => void
  onSelectWeapon: (weaponId: string) => void
  onEquipModule: (moduleType: ModuleType, slotIndex: number) => void
  onUnequipModule: (slotIndex: number) => void
}

export type ActionUI = {
  gatherWood: ActionGaugeView
  gatherMetal: ActionGaugeView
}

const MODULE_EMOJI: Record<ModuleType, string> = {
  damage: '💥',
  cooldown: '⏱️',
}

const MODULE_LABEL: Record<ModuleType, string> = {
  damage: '공격력 +1',
  cooldown: '쿨다운 -1s',
}

function fmt(n: number): string {
  return n.toFixed(1)
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

type BuildingKey = 'lumberMill' | 'miner'

type BuildingGaugeView = {
  progress: number
  percentText: string
  timeText: string
}

function getBuildingGaugeView(state: GameState, key: BuildingKey, now = Date.now()): BuildingGaugeView {
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

function renderGaugeButton(id: string, text: string, ariaLabel: string, action: ActionGaugeView): string {
  const progress = Math.round(clamp01(action.progress) * 100)
  return `
    <button id="${id}" class="gauge-action gauge-${action.phase}" aria-label="${ariaLabel}" ${action.disabled ? 'disabled' : ''}>
      <span class="gauge-fill" style="width:${progress}%"></span>
      <span class="gauge-content">
        <span class="gauge-title">${text}</span>
        <span class="gauge-state">${action.label}</span>
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

function craftView(remainingMs: number): ActionGaugeView {
  if (remainingMs <= 0) return { phase: 'ready', progress: 1, disabled: false, label: '준비됨' }
  const progress = (WEAPON_CRAFT_DURATION_MS - remainingMs) / WEAPON_CRAFT_DURATION_MS
  return { phase: 'cooldown', progress, disabled: true, label: `${Math.ceil(remainingMs / 1000)}초` }
}

function renderCraftActions(state: GameState): string {
  const pistolView = craftView(state.craftProgress.pistol)
  const rifleView = craftView(state.craftProgress.rifle)
  const moduleView = craftView(state.craftProgress.module)

  return `
    <div class="craft-actions" role="group" aria-label="제작 행동">
      ${renderGaugeButton(
        'craft-pistol',
        `권총 제작 (30초 · 나무 ${WEAPON_CRAFT_COST.pistol.wood}, 금속 ${WEAPON_CRAFT_COST.pistol.metal})`,
        '권총 제작',
        pistolView,
      )}
      ${renderGaugeButton(
        'craft-rifle',
        `소총 제작 (30초 · 나무 ${WEAPON_CRAFT_COST.rifle.wood}, 금속 ${WEAPON_CRAFT_COST.rifle.metal})`,
        '소총 제작',
        rifleView,
      )}
      ${renderGaugeButton(
        'craft-module',
        `모듈 제작 (30초 · 나무 ${MODULE_CRAFT_COST.wood}, 금속 ${MODULE_CRAFT_COST.metal})`,
        '모듈 제작',
        moduleView,
      )}
    </div>
  `
}

function renderAssemblyPanel(state: GameState): string {
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
      <div class="module-inventory" aria-label="모듈 인벤토리">
        <h3>보유 모듈</h3>
        <div id="module-list-items" class="module-list" data-signature=""></div>
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
  const sig = `${state.weapons.length}:${state.selectedWeaponId}:${state.weapons.map((w) => w.id).join('|')}`
  if (root.dataset.signature === sig) return
  root.innerHTML = state.weapons
    .map(
      (w) => `<button class="weapon-item ${w.id === state.selectedWeaponId ? 'selected' : ''}" data-weapon-id="${w.id}" aria-label="${
        w.type === 'pistol' ? '권총' : '소총'
      } ${w.id}">${w.type === 'pistol' ? '권총' : '소총'} · ${w.id}</button>`,
    )
    .join('')
  if (state.weapons.length === 0) root.innerHTML = '<p class="hint">제작된 무기가 없습니다.</p>'
  root.dataset.signature = sig
}

function patchModuleInventory(app: ParentNode, state: GameState): void {
  const root = app.querySelector<HTMLDivElement>('#module-list-items')
  if (!root) return
  const sig = `${state.modules.damage}:${state.modules.cooldown}`
  if (root.dataset.signature === sig) return

  const entries = (Object.keys(state.modules) as ModuleType[])
    .filter((type) => state.modules[type] > 0)
    .map(
      (type) => `<div class="module-item" draggable="true" data-module-type="${type}" aria-label="${MODULE_LABEL[type]} 모듈 ${state.modules[type]}개">
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
  patchActionGauge(app, 'craft-pistol', craftView(state.craftProgress.pistol))
  patchActionGauge(app, 'craft-rifle', craftView(state.craftProgress.rifle))
  patchActionGauge(app, 'craft-module', craftView(state.craftProgress.module))
}

export function patchAnimatedUI(state: GameState, actionUI: ActionUI, now = Date.now()): void {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  patchTabs(app, state)

  patchActionGauge(app, 'gather-wood', actionUI.gatherWood)
  patchActionGauge(app, 'gather-metal', actionUI.gatherMetal)

  setText(app, '#res-wood', fmt(state.resources.wood))
  setText(app, '#res-metal', fmt(state.resources.metal))

  setText(app, '#gather-wood-title', `나무 줍기 (+${1 + (state.upgrades.betterAxe ? 1 : 0)})`)
  setText(app, '#gather-metal-title', `금속 찾기 (+${1 + (state.upgrades.sortingWork ? 1 : 0)})`)

  const gatherMetalButton = app.querySelector<HTMLButtonElement>('#gather-metal')
  if (gatherMetalButton) gatherMetalButton.setAttribute('aria-label', state.unlocks.metalAction ? '금속 찾기 행동' : '잠긴 금속 찾기 행동')
  setHidden(app, '#metal-hint', state.unlocks.metalAction)

  const lumberCost = getBuildingCost(state, 'lumberMill')
  const minerCost = getBuildingCost(state, 'miner')

  const buyLumber = app.querySelector<HTMLButtonElement>('#buy-lumber')
  if (buyLumber) buyLumber.disabled = !state.unlocks.lumberMill
  setText(app, '#buy-lumber-label', `벌목소 구매 (${lumberCost.wood} 나무)`)
  setHidden(app, '#lumber-hint', state.unlocks.lumberMill)

  const buyMiner = app.querySelector<HTMLButtonElement>('#buy-miner')
  if (buyMiner) buyMiner.disabled = !state.unlocks.miner
  setText(app, '#buy-miner-label', `채굴기 구매 (${minerCost.wood} 나무, ${minerCost.metal} 금속)`)
  setHidden(app, '#miner-hint', state.unlocks.miner)

  setText(app, '#lumber-count', `${state.buildings.lumberMill}`)
  setText(app, '#lumber-output', `${state.buildings.lumberMill}`)
  setText(app, '#miner-count', `${state.buildings.miner}`)
  setText(app, '#miner-output', `${state.buildings.miner}`)

  const lumberGauge = getBuildingGaugeView(state, 'lumberMill', now)
  const minerGauge = getBuildingGaugeView(state, 'miner', now)

  patchBuildingGauge(app, 'lumber-progress', lumberGauge.progress, lumberGauge.percentText, lumberGauge.timeText)
  patchBuildingGauge(app, 'miner-progress', minerGauge.progress, minerGauge.percentText, minerGauge.timeText)

  ;(Object.keys(UPGRADE_DEFS) as Array<keyof typeof UPGRADE_DEFS>).forEach((key) => {
    const def = UPGRADE_DEFS[key]
    const done = state.upgrades[key as keyof typeof state.upgrades]
    const cost = getUpgradeCost(key)

    const upgradeButton = app.querySelector<HTMLButtonElement>(`button[data-upgrade="${key}"]`)
    if (upgradeButton) {
      upgradeButton.disabled = done
      const label = `${def.name} (${cost.wood} 나무, ${cost.metal} 금속)`
      if (upgradeButton.textContent !== label) upgradeButton.textContent = label
    }

    setText(app, `#upgrade-hint-${key}`, `${def.effectText}${done ? ' (완료)' : ''}`)
  })

  patchCraftButtons(app, state)
  patchWeaponInventory(app, state)
  patchWeaponBoard(app, state)
  patchModuleInventory(app, state)
  patchLogs(app, state)
}

export function renderApp(state: GameState, handlers: Handlers, actionUI: ActionUI, now = Date.now()): void {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  const focusedId = (document.activeElement as HTMLElement | null)?.id ?? null

  const lumberCost = getBuildingCost(state, 'lumberMill')
  const minerCost = getBuildingCost(state, 'miner')

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
        <p>나무: <strong id="res-wood">${fmt(state.resources.wood)}</strong></p>
        <p>금속: <strong id="res-metal">${fmt(state.resources.metal)}</strong></p>
      </section>

      <section class="panel actions">
        <h2>행동</h2>
        ${renderGaugeButton('gather-wood', `나무 줍기 (+${1 + (state.upgrades.betterAxe ? 1 : 0)})`, '나무 줍기 행동', actionUI.gatherWood)}
        ${renderGaugeButton(
          'gather-metal',
          `금속 찾기 (+${1 + (state.upgrades.sortingWork ? 1 : 0)})`,
          state.unlocks.metalAction ? '금속 찾기 행동' : '잠긴 금속 찾기 행동',
          actionUI.gatherMetal,
        )}
        <p class="hint" id="metal-hint" ${state.unlocks.metalAction ? 'hidden' : ''}>해금 조건: 나무 20</p>

        <h3 class="subheading">제작</h3>
        ${renderCraftActions(state)}
      </section>

      <section class="panel buildings">
        <h2>건물</h2>
        <button id="buy-lumber" aria-label="벌목소 구매" ${state.unlocks.lumberMill ? '' : 'disabled'}>
          <span id="buy-lumber-label">벌목소 구매 (${lumberCost.wood} 나무)</span>
        </button>
        <p class="hint" id="lumber-hint" ${state.unlocks.lumberMill ? 'hidden' : ''}>해금 조건: 나무 30</p>

        <button id="buy-miner" aria-label="채굴기 구매" ${state.unlocks.miner ? '' : 'disabled'}>
          <span id="buy-miner-label">채굴기 구매 (${minerCost.wood} 나무, ${minerCost.metal} 금속)</span>
        </button>
        <p class="hint" id="miner-hint" ${state.unlocks.miner ? 'hidden' : ''}>해금 조건: 나무 60 + 금속 15</p>

        <p>벌목소: <span id="lumber-count">${state.buildings.lumberMill}</span> (10초마다 +<span id="lumber-output">${state.buildings.lumberMill}</span> 나무)</p>
        ${renderBuildingGauge(
          'lumber-progress',
          '벌목소 가동',
          lumberGauge.progress,
          lumberGauge.percentText,
          lumberGauge.timeText,
        )}

        <p>채굴기: <span id="miner-count">${state.buildings.miner}</span> (10초마다 +<span id="miner-output">${state.buildings.miner}</span> 금속)</p>
        ${renderBuildingGauge(
          'miner-progress',
          '채굴기 가동',
          minerGauge.progress,
          minerGauge.percentText,
          minerGauge.timeText,
        )}
      </section>

      <section class="panel upgrades">
        <h2>업그레이드</h2>
        ${Object.entries(UPGRADE_DEFS)
          .map(([key, def]) => {
            const done = state.upgrades[key as keyof typeof state.upgrades]
            const cost = getUpgradeCost(key as keyof typeof UPGRADE_DEFS)
            return `
              <button data-upgrade="${key}" aria-label="업그레이드 ${def.name}" ${done ? 'disabled' : ''}>
                ${def.name} (${cost.wood} 나무, ${cost.metal} 금속)
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
  app.querySelector<HTMLButtonElement>('#gather-metal .gauge-title')?.setAttribute('id', 'gather-metal-title')

  app.querySelector<HTMLButtonElement>('#tab-base')?.addEventListener('click', () => handlers.onSelectTab('base'))
  app.querySelector<HTMLButtonElement>('#tab-assembly')?.addEventListener('click', () => handlers.onSelectTab('assembly'))

  app.querySelector<HTMLButtonElement>('#gather-wood')?.addEventListener('click', handlers.onGatherWood)
  app.querySelector<HTMLButtonElement>('#gather-metal')?.addEventListener('click', handlers.onGatherMetal)
  app.querySelector<HTMLButtonElement>('#buy-lumber')?.addEventListener('click', handlers.onBuyLumberMill)
  app.querySelector<HTMLButtonElement>('#buy-miner')?.addEventListener('click', handlers.onBuyMiner)

  app.querySelectorAll<HTMLButtonElement>('button[data-upgrade]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.upgrade as keyof typeof UPGRADE_DEFS
      handlers.onBuyUpgrade(key)
    })
  })

  app.querySelector<HTMLButtonElement>('#craft-pistol')?.addEventListener('click', handlers.onCraftPistol)
  app.querySelector<HTMLButtonElement>('#craft-rifle')?.addEventListener('click', handlers.onCraftRifle)
  app.querySelector<HTMLButtonElement>('#craft-module')?.addEventListener('click', handlers.onCraftModule)

  app.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    const button = target.closest<HTMLElement>('[data-weapon-id]')
    if (!button) return
    const id = button.getAttribute('data-weapon-id')
    if (id) handlers.onSelectWeapon(id)
  })

  app.addEventListener('dragstart', (event) => {
    const target = event.target as HTMLElement
    const moduleItem = target.closest<HTMLElement>('[data-module-type]')
    if (!moduleItem || !event.dataTransfer) return
    const moduleType = moduleItem.getAttribute('data-module-type') as ModuleType | null
    if (!moduleType) return
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/module-type', moduleType)
  })

  app.addEventListener('dragover', (event) => {
    const target = event.target as HTMLElement
    const slot = target.closest<HTMLElement>('[data-slot-index]')
    if (!slot) return
    if (slot.getAttribute('data-accepts') !== 'true' || slot.classList.contains('filled')) return
    event.preventDefault()
    event.dataTransfer!.dropEffect = 'move'
  })

  app.addEventListener('drop', (event) => {
    const target = event.target as HTMLElement
    const slot = target.closest<HTMLElement>('[data-slot-index]')
    if (!slot || !event.dataTransfer) return
    const moduleType = event.dataTransfer.getData('text/module-type') as ModuleType
    if (moduleType !== 'damage' && moduleType !== 'cooldown') return
    const slotIndex = Number(slot.getAttribute('data-slot-index'))
    if (!Number.isFinite(slotIndex)) return
    if (slot.getAttribute('data-accepts') !== 'true' || slot.classList.contains('filled')) return
    event.preventDefault()
    handlers.onEquipModule(moduleType, slotIndex)
  })

  app.addEventListener('contextmenu', (event) => {
    const target = event.target as HTMLElement
    const slot = target.closest<HTMLElement>('[data-slot-index]')
    if (!slot || !slot.classList.contains('filled')) return
    event.preventDefault()
    const slotIndex = Number(slot.getAttribute('data-slot-index'))
    if (!Number.isFinite(slotIndex)) return
    handlers.onUnequipModule(slotIndex)
  })

  app.addEventListener('auxclick', (event) => {
    if (event.button !== 1) return
    const target = event.target as HTMLElement
    const slot = target.closest<HTMLElement>('[data-slot-index]')
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
