import { BUILDING_CYCLE_MS, UPGRADE_DEFS, getUpgradeCost } from '../data/balance.ts'
import { getBuildingCost } from '../core/actions.ts'
import type { GameState } from '../core/state.ts'

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
}

export type ActionUI = {
  gatherWood: ActionGaugeView
  gatherMetal: ActionGaugeView
}

function fmt(n: number): string {
  return n.toFixed(1)
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function setText(app: ParentNode, selector: string, text: string): void {
  const node = app.querySelector<HTMLElement>(selector)
  if (node && node.textContent !== text) node.textContent = text
}

function setHidden(app: ParentNode, selector: string, hidden: boolean): void {
  const node = app.querySelector<HTMLElement>(selector)
  if (node) {
    if (hidden) {
      node.setAttribute('hidden', '')
    } else {
      node.removeAttribute('hidden')
    }
  }
}

function renderGaugeButton(id: string, text: string, ariaLabel: string, action: ActionGaugeView): string {
  const progress = Math.round(clamp01(action.progress) * 100)
  return `
    <button
      id="${id}"
      class="gauge-action gauge-${action.phase}"
      aria-label="${ariaLabel}"
      ${action.disabled ? 'disabled' : ''}
    >
      <span class="gauge-fill" style="width:${progress}%"></span>
      <span class="gauge-content">
        <span class="gauge-title">${text}</span>
        <span class="gauge-state">${action.label}</span>
      </span>
    </button>
  `
}

function renderBuildingGauge(id: string, title: string, progress: number, stateText: string): string {
  const width = Math.round(clamp01(progress) * 100)
  return `
    <div class="building-gauge" role="group" aria-label="${title} 진행 상태" tabindex="0" id="${id}">
      <span class="gauge-fill" style="width:${width}%"></span>
      <span class="gauge-content">
        <span class="gauge-title">${title}</span>
        <span class="gauge-state">${stateText}</span>
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
  if (fill) {
    fill.style.width = `${progress}%`
  }

  const state = button.querySelector<HTMLElement>('.gauge-state')
  if (state) {
    state.textContent = action.label
  }
}

function patchBuildingGauge(app: ParentNode, id: string, progress: number, stateText: string): void {
  const gauge = app.querySelector<HTMLElement>(`#${id}`)
  if (!gauge) return

  const width = Math.round(clamp01(progress) * 100)
  const fill = gauge.querySelector<HTMLElement>('.gauge-fill')
  if (fill) {
    fill.style.width = `${width}%`
  }

  const state = gauge.querySelector<HTMLElement>('.gauge-state')
  if (state) {
    state.textContent = stateText
  }
}

function patchLogs(app: ParentNode, state: GameState): void {
  const logList = app.querySelector<HTMLUListElement>('#log-list')
  if (!logList) return

  const signature = `${state.log.length}:${state.log[state.log.length - 1] ?? ''}`
  if (logList.dataset.signature === signature) return

  logList.innerHTML = [...state.log].reverse().map((line) => `<li>${line}</li>`).join('')
  logList.dataset.signature = signature
}

export function patchAnimatedUI(state: GameState, actionUI: ActionUI): void {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  patchActionGauge(app, 'gather-wood', actionUI.gatherWood)
  patchActionGauge(app, 'gather-metal', actionUI.gatherMetal)

  setText(app, '#res-wood', fmt(state.resources.wood))
  setText(app, '#res-metal', fmt(state.resources.metal))

  setText(app, '#gather-wood-title', `나무 줍기 (+${1 + (state.upgrades.betterAxe ? 1 : 0)})`)
  setText(app, '#gather-metal-title', `금속 찾기 (+${1 + (state.upgrades.sortingWork ? 1 : 0)})`)

  const gatherMetalButton = app.querySelector<HTMLButtonElement>('#gather-metal')
  if (gatherMetalButton) {
    gatherMetalButton.setAttribute('aria-label', state.unlocks.metalAction ? '금속 찾기 행동' : '잠긴 금속 찾기 행동')
  }
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

  const lumberProgress = state.buildings.lumberMill > 0 ? state.productionProgress.lumberMill / BUILDING_CYCLE_MS : 0
  const minerProgress = state.buildings.miner > 0 ? state.productionProgress.miner / BUILDING_CYCLE_MS : 0

  patchBuildingGauge(
    app,
    'lumber-progress',
    lumberProgress,
    state.buildings.lumberMill > 0 ? `${Math.round(lumberProgress * 100)}%` : '대기',
  )
  patchBuildingGauge(app, 'miner-progress', minerProgress, state.buildings.miner > 0 ? `${Math.round(minerProgress * 100)}%` : '대기')

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

  patchLogs(app, state)
}

export function renderApp(state: GameState, handlers: Handlers, actionUI: ActionUI): void {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  const focusedId = (document.activeElement as HTMLElement | null)?.id ?? null

  const lumberCost = getBuildingCost(state, 'lumberMill')
  const minerCost = getBuildingCost(state, 'miner')

  const lumberProgress = state.buildings.lumberMill > 0 ? state.productionProgress.lumberMill / BUILDING_CYCLE_MS : 0
  const minerProgress = state.buildings.miner > 0 ? state.productionProgress.miner / BUILDING_CYCLE_MS : 0

  app.innerHTML = `
    <main class="layout">
      <h1>Morning</h1>
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
        ${renderBuildingGauge('lumber-progress', '벌목소 가동', lumberProgress, state.buildings.lumberMill > 0 ? `${Math.round(lumberProgress * 100)}%` : '대기')}

        <p>채굴기: <span id="miner-count">${state.buildings.miner}</span> (10초마다 +<span id="miner-output">${state.buildings.miner}</span> 금속)</p>
        ${renderBuildingGauge('miner-progress', '채굴기 가동', minerProgress, state.buildings.miner > 0 ? `${Math.round(minerProgress * 100)}%` : '대기')}
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

  if (focusedId) {
    const nextFocus = app.querySelector<HTMLElement>(`#${focusedId}`)
    nextFocus?.focus()
  }
}
