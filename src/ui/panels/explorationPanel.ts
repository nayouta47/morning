import type { GameState } from '../../core/state.ts'
import { renderActiveBody, renderExplorationMap } from './exploration/activeView.ts'
import { getSyntheticFoodButtonState, renderLoadoutBody } from './exploration/loadoutView.ts'
import { renderCompactLogPanel } from './logPanel.ts'

function renderExplorationBody(state: GameState, now = Date.now()): string {
  const isActive = state.exploration.mode === 'active'
  if (isActive) return renderActiveBody(state, now)
  if (!state.isGuideRobotRecovered) {
    return '<div class="exploration-gate"><p class="hint">사전 조건을 진행 중입니다.</p></div>'
  }
  if (state.buildings.laikaRepair <= 0) {
    return '<div class="exploration-gate"><p class="hint">이곳은 어둡고 복잡하며, 건설자에 의해 끊임없이 구조가 변화한다. 도움 없이 먼 곳에 가는 것은 자살행위이다.</p></div>'
  }
  return renderLoadoutBody(state)
}

function getExplorationBodySignature(state: GameState): string {
  const backpackSig = state.exploration.backpack.map((entry) => `${entry.resource}:${entry.amount}`).join('|')
  const lootSig = state.exploration.pendingLoot.map((entry) => `${entry.resource}:${entry.amount}`).join('|')
  const weaponsSig = state.weapons.map((weapon) => `${weapon.id}:${weapon.type}`).join('|')
  return `${state.exploration.mode}:${state.exploration.phase}:${state.selectedWeaponId ?? 'none'}:${weaponsSig}:${backpackSig}:${lootSig}:${state.resources.syntheticFood}:${state.resources.smallHealPotion}:${state.isGuideRobotRecovered}:${state.buildings.laikaRepair}:${state.exploration.equippedArmor ?? 'none'}:${state.resources.junkArmor}:${state.resources.ironArmor}`
}

export function renderExplorationPanel(state: GameState, now = Date.now()): string {
  return `<section class="exploration-tab ${state.activeTab === 'exploration' ? '' : 'hidden'}" id="panel-exploration" data-mode="${getExplorationBodySignature(state)}"><div class="tab-top-row">${renderCompactLogPanel(state)}<section class="panel exploration"><h2>탐험</h2><div id="exploration-body">${renderExplorationBody(state, now)}</div></section></div></section>`
}

export { renderExplorationMap }

export function patchExplorationBody(app: ParentNode, state: GameState): void {
  const panel = app.querySelector<HTMLElement>('#panel-exploration')
  const body = app.querySelector<HTMLElement>('#exploration-body')
  if (!panel || !body) return
  const signature = getExplorationBodySignature(state)
  if (panel.dataset.mode !== signature) {
    panel.dataset.mode = signature
    body.innerHTML = renderExplorationBody(state)
    return
  }

  const syntheticFoodButton = app.querySelector<HTMLButtonElement>('#exploration-use-synthetic-food')
  if (!syntheticFoodButton) return
  const { amount, disabled } = getSyntheticFoodButtonState(state)
  syntheticFoodButton.disabled = disabled
  syntheticFoodButton.textContent = `무작위맛 통조림 사용 (${amount})`
}
