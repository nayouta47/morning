import type { GameState } from '../core/state.ts'
import { getBuildingCost } from '../core/actions.ts'
import { SHOVEL_MAX_STACK, getGatherScrapReward, getGatherWoodReward } from '../core/rewards.ts'
import { UPGRADE_DEFS, getUpgradeCost } from '../data/balance.ts'
import { getBuildingLabel } from '../data/buildings.ts'
import { formatCost, formatResourceAmount, formatResourceValue } from '../data/resources.ts'
import type { ActionUI, Handlers } from './types.ts'
import { bindUIInteractions } from './interactions.ts'
import { setHidden, setText } from './view.ts'
import { patchModuleDetail, patchModuleInventory, patchWeaponBoard, patchWeaponInventory, renderAssemblyPanel } from './panels/assemblyPanel.ts'
import { patchActionGauge, patchBuildingGauge, patchCraftButtons, renderBasePanel, getBuildingGaugeView } from './panels/basePanel.ts'
import { patchExplorationCombatOverlay } from './panels/combatOverlay.ts'
import { patchExplorationBody, renderExplorationMap, renderExplorationPanel } from './panels/explorationPanel.ts'
import { patchCodexPanel, renderCodexPanel } from './panels/codexPanel.ts'

export type { ActionUI } from './types.ts'

function patchTabs(app: ParentNode, state: GameState): void {
  const baseTab = app.querySelector<HTMLButtonElement>('#tab-base')
  const assTab = app.querySelector<HTMLButtonElement>('#tab-assembly')
  const explorationTab = app.querySelector<HTMLButtonElement>('#tab-exploration')
  const codexTab = app.querySelector<HTMLButtonElement>('#tab-codex')
  const panelBase = app.querySelector<HTMLElement>('#panel-base')
  const panelAssembly = app.querySelector<HTMLElement>('#panel-assembly')
  const panelExploration = app.querySelector<HTMLElement>('#panel-exploration')
  const panelCodex = app.querySelector<HTMLElement>('#panel-codex')
  if (!baseTab || !assTab || !explorationTab || !codexTab || !panelBase || !panelAssembly || !panelExploration || !panelCodex) return

  const isBase = state.activeTab === 'base'
  const isAssembly = state.activeTab === 'assembly'
  const isExploration = state.activeTab === 'exploration'
  const isCodex = state.activeTab === 'codex'
  const explorationActive = state.exploration.mode === 'active'
  const assemblyUnlocked = state.buildings.workbench >= 1
  const explorationUnlocked = state.buildings.vehicleRepair >= 1

  baseTab.classList.toggle('active', isBase)
  assTab.classList.toggle('active', isAssembly)
  explorationTab.classList.toggle('active', isExploration)
  codexTab.classList.toggle('active', isCodex)

  baseTab.setAttribute('aria-selected', String(isBase))
  assTab.setAttribute('aria-selected', String(isAssembly))
  assTab.textContent = assemblyUnlocked ? '무기 조립' : '무기 조립(잠김)'
  explorationTab.setAttribute('aria-selected', String(isExploration))
  explorationTab.textContent = explorationUnlocked ? '탐험' : '탐험(잠김)'
  codexTab.setAttribute('aria-selected', String(isCodex))

  baseTab.disabled = explorationActive
  assTab.disabled = explorationActive || !assemblyUnlocked
  explorationTab.disabled = !explorationUnlocked
  codexTab.disabled = explorationActive

  panelBase.classList.toggle('hidden', !isBase)
  panelAssembly.classList.toggle('hidden', !isAssembly)
  panelExploration.classList.toggle('hidden', !isExploration)
  panelCodex.classList.toggle('hidden', !isCodex)
}

function patchLogs(app: ParentNode, state: GameState): void {
  const logList = app.querySelector<HTMLUListElement>('#log-list')
  if (!logList) return
  const signature = `${state.log.length}:${state.log[state.log.length - 1] ?? ''}`
  if (logList.dataset.signature === signature) return
  logList.innerHTML = [...state.log].reverse().map((line) => `<li>${line}</li>`).join('')
  logList.dataset.signature = signature
}

export function patchAnimatedUI(state: GameState, actionUI: ActionUI, now = Date.now()): void {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  patchTabs(app, state)

  patchActionGauge(app, 'gather-wood', actionUI.gatherWood)
  patchActionGauge(app, 'gather-scrap', actionUI.gatherScrap)

  setText(app, '#res-wood', formatResourceValue('wood', state.resources.wood))
  setText(app, '#res-scrap', formatResourceValue('scrap', state.resources.scrap))
  setText(app, '#res-iron', formatResourceValue('iron', state.resources.iron))
  setText(app, '#res-chromium', formatResourceValue('chromium', state.resources.chromium))
  setText(app, '#res-molybdenum', formatResourceValue('molybdenum', state.resources.molybdenum))
  setText(app, '#res-cobalt', formatResourceValue('cobalt', state.resources.cobalt))
  setText(app, '#res-shovel', `${formatResourceValue('shovel', state.resources.shovel)}/${SHOVEL_MAX_STACK}`)
  setText(app, '#res-scavenger-drone', formatResourceValue('scavengerDrone', state.resources.scavengerDrone))
  setText(app, '#res-silicon-mass', formatResourceValue('siliconMass', state.resources.siliconMass))

  setText(app, '#gather-wood-title', `🪵 뗄감 줍기 (+${getGatherWoodReward(state)})`)
  setText(app, '#gather-scrap-title', `🗑️ 고물 줍기 (+${getGatherScrapReward(state)})`)

  const gatherScrapButton = app.querySelector<HTMLButtonElement>('#gather-scrap')
  if (gatherScrapButton) gatherScrapButton.setAttribute('aria-label', state.unlocks.scrapAction ? '🗑️ 고물 줍기 행동' : '잠긴 🗑️ 고물 줍기 행동')
  setHidden(app, '#scrap-hint', state.unlocks.scrapAction)

  const lumberCost = getBuildingCost(state, 'lumberMill')
  const minerCost = getBuildingCost(state, 'miner')
  const workbenchCost = getBuildingCost(state, 'workbench')
  const labCost = getBuildingCost(state, 'lab')
  const vehicleRepairCost = getBuildingCost(state, 'vehicleRepair')
  const droneControllerCost = getBuildingCost(state, 'droneController')

  const buyLumber = app.querySelector<HTMLButtonElement>('#buy-lumber')
  if (buyLumber) buyLumber.disabled = !state.unlocks.lumberMill
  setText(app, '#buy-lumber-label', `${getBuildingLabel('lumberMill')} 설치 (${formatResourceAmount('scrap', lumberCost.scrap ?? 0)})`)

  const buyMiner = app.querySelector<HTMLButtonElement>('#buy-miner')
  if (buyMiner) buyMiner.disabled = !state.unlocks.miner
  setText(app, '#buy-miner-label', `${getBuildingLabel('miner')} 설치 (${formatResourceAmount('wood', minerCost.wood ?? 0)}, ${formatResourceAmount('scrap', minerCost.scrap ?? 0)})`)

  const buyLab = app.querySelector<HTMLButtonElement>('#buy-lab')
  const labInstalled = state.buildings.lab >= 1
  if (buyLab) buyLab.disabled = labInstalled
  setText(app, '#buy-lab-label', labInstalled ? `${getBuildingLabel('lab')} (설치 완료)` : `${getBuildingLabel('lab')} 설치 (${formatCost(labCost)})`)

  const buyVehicleRepair = app.querySelector<HTMLButtonElement>('#buy-vehicle-repair')
  const vehicleRepairInstalled = state.buildings.vehicleRepair >= 1
  if (buyVehicleRepair) buyVehicleRepair.disabled = vehicleRepairInstalled
  setText(
    app,
    '#buy-vehicle-repair-label',
    vehicleRepairInstalled
      ? `${getBuildingLabel('vehicleRepair')} (설치 완료)`
      : `${getBuildingLabel('vehicleRepair')} (${formatCost(vehicleRepairCost)})`,
  )

  const buyWorkbench = app.querySelector<HTMLButtonElement>('#buy-workbench')
  const workbenchInstalled = state.buildings.workbench >= 1
  if (buyWorkbench) buyWorkbench.disabled = workbenchInstalled
  setText(app, '#buy-workbench-label', workbenchInstalled ? `${getBuildingLabel('workbench')} (설치 완료)` : `${getBuildingLabel('workbench')} 설치 (${formatCost(workbenchCost)})`)

  const buyDroneController = app.querySelector<HTMLButtonElement>('#buy-drone-controller')
  const droneControllerInstalled = state.buildings.droneController >= 1
  if (buyDroneController) buyDroneController.disabled = droneControllerInstalled
  setText(app, '#buy-drone-controller-label', droneControllerInstalled ? `${getBuildingLabel('droneController')} (설치 완료)` : `${getBuildingLabel('droneController')} 설치 (${formatCost(droneControllerCost)})`)

  const lumberGauge = getBuildingGaugeView(state, 'lumberMill', now)
  const minerGauge = getBuildingGaugeView(state, 'miner', now)
  const scavengerGauge = getBuildingGaugeView(state, 'scavenger', now)
  patchBuildingGauge(app, 'lumber-progress', lumberGauge.progress, lumberGauge.percentText, lumberGauge.timeText, lumberGauge.phase)
  patchBuildingGauge(app, 'miner-progress', minerGauge.progress, minerGauge.percentText, minerGauge.timeText, minerGauge.phase)
  patchBuildingGauge(app, 'scavenger-progress', scavengerGauge.progress, scavengerGauge.percentText, scavengerGauge.timeText, scavengerGauge.phase)

  setText(app, '#lumber-progress .gauge-title', `벌목기 가동 x${state.buildings.lumberMill}`)
  setText(app, '#miner-progress .gauge-title', `분쇄기 가동 x${state.buildings.miner}`)
  setText(app, '#scavenger-progress .gauge-title', `스캐빈저 가동 x${state.resources.scavengerDrone}`)

  setHidden(app, '#upgrades-panel', state.buildings.lab <= 0)
  ;(Object.keys(UPGRADE_DEFS) as Array<keyof typeof UPGRADE_DEFS>).forEach((key) => {
    const def = UPGRADE_DEFS[key]
    const done = state.upgrades[key as keyof typeof state.upgrades]
    const cost = getUpgradeCost(key)
    const upgradeButton = app.querySelector<HTMLButtonElement>(`button[data-upgrade="${key}"]`)
    if (upgradeButton) {
      upgradeButton.disabled = done
      const label = `${def.name} (${formatResourceAmount('wood', cost.wood)}, ${formatResourceAmount('iron', cost.iron)})`
      if (upgradeButton.textContent !== label) upgradeButton.textContent = label
    }
    setText(app, `#upgrade-hint-${key}`, `${def.effectText}${done ? ' (완료)' : ''}`)
  })

  patchCraftButtons(app, state)
  patchWeaponInventory(app, state)
  patchWeaponBoard(app, state)
  patchModuleInventory(app, state)
  patchModuleDetail(app, state)
  patchExplorationBody(app, state)
  patchExplorationCombatOverlay(app, state, now)
  patchCodexPanel(app, state)

  setText(app, '#exploration-hp', `${state.exploration.hp}/${state.exploration.maxHp}`)
  setText(app, '#exploration-pos', `(${state.exploration.position.x}, ${state.exploration.position.y})`)
  setText(app, '#exploration-map', renderExplorationMap(state))

  patchLogs(app, state)
}

export function renderApp(state: GameState, handlers: Handlers, actionUI: ActionUI, now = Date.now()): void {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  const focusedId = (document.activeElement as HTMLElement | null)?.id ?? null
  const assemblyUnlocked = state.buildings.workbench >= 1
  const explorationUnlocked = state.buildings.vehicleRepair >= 1

  app.innerHTML = `<main class="layout"><h1>Morning</h1><section class="tabs" role="tablist" aria-label="메인 탭"><button id="tab-base" class="tab-btn ${state.activeTab === 'base' ? 'active' : ''}" role="tab" aria-selected="${state.activeTab === 'base'}" aria-controls="panel-base" ${state.exploration.mode === 'active' ? 'disabled' : ''}>거점</button><button id="tab-assembly" class="tab-btn ${state.activeTab === 'assembly' ? 'active' : ''}" role="tab" aria-selected="${state.activeTab === 'assembly'}" aria-controls="panel-assembly" ${state.exploration.mode === 'active' || !assemblyUnlocked ? 'disabled' : ''}>${assemblyUnlocked ? '무기 조립' : '무기 조립(잠김)'}</button><button id="tab-exploration" class="tab-btn ${state.activeTab === 'exploration' ? 'active' : ''}" role="tab" aria-selected="${state.activeTab === 'exploration'}" aria-controls="panel-exploration" ${explorationUnlocked ? '' : 'disabled'}>${explorationUnlocked ? '탐험' : '탐험(잠김)'}</button><button id="tab-codex" class="tab-btn ${state.activeTab === 'codex' ? 'active' : ''}" role="tab" aria-selected="${state.activeTab === 'codex'}" aria-controls="panel-codex" ${state.exploration.mode === 'active' ? 'disabled' : ''}>도감</button></section>${renderBasePanel(state, actionUI, now)}${renderAssemblyPanel(state)}${renderExplorationPanel(state, now)}${renderCodexPanel(state)}<section class="panel logs"><h2>로그</h2><ul id="log-list" data-signature="${state.log.length}:${state.log[state.log.length - 1] ?? ''}">${[...state.log].reverse().map((line) => `<li>${line}</li>`).join('')}</ul></section></main>`

  app.querySelector<HTMLButtonElement>('#gather-wood .gauge-title')?.setAttribute('id', 'gather-wood-title')
  app.querySelector<HTMLButtonElement>('#gather-scrap .gauge-title')?.setAttribute('id', 'gather-scrap-title')

  bindUIInteractions(app, state, handlers)

  if (focusedId) {
    const nextFocus = app.querySelector<HTMLElement>(`#${focusedId}`)
    nextFocus?.focus()
  }
}
