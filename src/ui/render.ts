import { UPGRADE_DEFS } from '../data/balance.ts'
import { getBuildingCost } from '../core/actions.ts'
import type { GameState } from '../core/state.ts'

type Handlers = {
  onGatherWood: () => void
  onGatherMetal: () => void
  onBuyLumberMill: () => void
  onBuyMiner: () => void
  onBuyUpgrade: (key: keyof typeof UPGRADE_DEFS) => void
}

function fmt(n: number): string {
  return n.toFixed(1)
}

export function renderApp(state: GameState, handlers: Handlers): void {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  const lumberCost = getBuildingCost(state, 'lumberMill')
  const minerCost = getBuildingCost(state, 'miner')

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
        <button id="gather-wood">나무 줍기 (+${1 + (state.upgrades.betterAxe ? 1 : 0)})</button>
        <button id="gather-metal" ${state.unlocks.metalAction ? '' : 'disabled'}>
          금속 찾기 (+${1 + (state.upgrades.sortingWork ? 1 : 0)})
        </button>
        ${state.unlocks.metalAction ? '' : '<p class="hint">해금 조건: 나무 20</p>'}
      </section>

      <section class="panel buildings">
        <h2>건물</h2>
        <button id="buy-lumber" ${state.unlocks.lumberMill ? '' : 'disabled'}>
          벌목소 구매 (${lumberCost.wood} 나무)
        </button>
        ${state.unlocks.lumberMill ? '' : '<p class="hint">해금 조건: 나무 30</p>'}

        <button id="buy-miner" ${state.unlocks.miner ? '' : 'disabled'}>
          채굴기 구매 (${minerCost.wood} 나무, ${minerCost.metal} 금속)
        </button>
        ${state.unlocks.miner ? '' : '<p class="hint">해금 조건: 나무 60 + 금속 15</p>'}

        <p>벌목소: ${state.buildings.lumberMill} (틱당 +${(state.buildings.lumberMill * 0.2 * (state.upgrades.sharpSaw ? 1.25 : 1)).toFixed(2)} 나무)</p>
        <p>채굴기: ${state.buildings.miner} (틱당 +${(state.buildings.miner * 0.1 * (state.upgrades.drillBoost ? 1.25 : 1)).toFixed(2)} 금속)</p>
      </section>

      <section class="panel upgrades">
        <h2>업그레이드</h2>
        ${Object.entries(UPGRADE_DEFS)
          .map(([key, def]) => {
            const done = state.upgrades[key as keyof typeof state.upgrades]
            return `
              <button data-upgrade="${key}" ${done ? 'disabled' : ''}>
                ${def.name} (${def.cost.wood} 나무, ${def.cost.metal} 금속)
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
}
