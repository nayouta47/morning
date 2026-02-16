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

export function patchAnimatedUI(state: GameState, actionUI: ActionUI): void {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  patchActionGauge(app, 'gather-wood', actionUI.gatherWood)
  patchActionGauge(app, 'gather-metal', actionUI.gatherMetal)

  const lumberProgress = state.buildings.lumberMill > 0 ? state.productionProgress.lumberMill / BUILDING_CYCLE_MS : 0
  const minerProgress = state.buildings.miner > 0 ? state.productionProgress.miner / BUILDING_CYCLE_MS : 0

  patchBuildingGauge(
    app,
    'lumber-progress',
    lumberProgress,
    state.buildings.lumberMill > 0 ? `${Math.round(lumberProgress * 100)}%` : '대기',
  )
  patchBuildingGauge(app, 'miner-progress', minerProgress, state.buildings.miner > 0 ? `${Math.round(minerProgress * 100)}%` : '대기')
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
        <p>나무: <strong>${fmt(state.resources.wood)}</strong></p>
        <p>금속: <strong>${fmt(state.resources.metal)}</strong></p>
      </section>

      <section class="panel actions">
        <h2>행동</h2>
        ${renderGaugeButton(
          'gather-wood',
          `나무 줍기 (+${1 + (state.upgrades.betterAxe ? 1 : 0)})`,
          '나무 줍기 행동',
          actionUI.gatherWood,
        )}
        ${renderGaugeButton(
          'gather-metal',
          `금속 찾기 (+${1 + (state.upgrades.sortingWork ? 1 : 0)})`,
          state.unlocks.metalAction ? '금속 찾기 행동' : '잠긴 금속 찾기 행동',
          actionUI.gatherMetal,
        )}
        ${state.unlocks.metalAction ? '' : '<p class="hint">해금 조건: 나무 20</p>'}
      </section>

      <section class="panel buildings">
        <h2>건물</h2>
        <button id="buy-lumber" aria-label="벌목소 구매" ${state.unlocks.lumberMill ? '' : 'disabled'}>
          벌목소 구매 (${lumberCost.wood} 나무)
        </button>
        ${state.unlocks.lumberMill ? '' : '<p class="hint">해금 조건: 나무 30</p>'}

        <button id="buy-miner" aria-label="채굴기 구매" ${state.unlocks.miner ? '' : 'disabled'}>
          채굴기 구매 (${minerCost.wood} 나무, ${minerCost.metal} 금속)
        </button>
        ${state.unlocks.miner ? '' : '<p class="hint">해금 조건: 나무 60 + 금속 15</p>'}

        <p>벌목소: ${state.buildings.lumberMill} (10초마다 +${state.buildings.lumberMill} 나무)</p>
        ${renderBuildingGauge('lumber-progress', '벌목소 가동', lumberProgress, state.buildings.lumberMill > 0 ? `${Math.round(lumberProgress * 100)}%` : '대기')}

        <p>채굴기: ${state.buildings.miner} (10초마다 +${state.buildings.miner} 금속)</p>
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
              <p class="hint">${def.effectText}${done ? ' (완료)' : ''}</p>
            `
          })
          .join('')}
      </section>

      <section class="panel logs">
        <h2>로그</h2>
        <ul>
          ${[...state.log].reverse().map((line) => `<li>${line}</li>`).join('')}
        </ul>
      </section>
    </main>
  `

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
