import type { GameState } from '../core/state.ts'
import { getBuildingCost } from '../core/actions.ts'
import { SHOVEL_MAX_STACK, getGatherScrapRewardPreview, getGatherWoodReward } from '../core/rewards.ts'
import { getResourceStorageCap } from '../core/resourceCaps.ts'
import { getCompanionName } from '../core/companion.ts'
import { RESEARCH_PANEL_UPGRADE_KEYS, UPGRADE_DEFS, getUpgradeCost } from '../data/balance.ts'
import { getBuildingLabel } from '../data/buildings.ts'
import { formatCost, formatResourceAmount, formatResourceValue, type ResourceId } from '../data/resources.ts'
import type { ActionUI, Handlers } from './types.ts'
import { bindUIInteractions } from './interactions.ts'
import { setHidden, setText } from './view.ts'
import { patchModuleDetail, patchModuleInventory, patchWeaponBoard, patchWeaponInventory, renderAssemblyPanel } from './panels/assemblyPanel.ts'
import { patchActionGauge, patchBuildingGauge, patchCraftButtons, patchMinerPanel, patchSmeltingPanel, renderBasePanel, getBuildingGaugeView } from './panels/basePanel.ts'
import { patchExplorationCombatOverlay } from './panels/combatOverlay.ts'
import { patchExplorationBody, renderExplorationMap, renderExplorationPanel } from './panels/explorationPanel.ts'
import { patchCodexPanel, renderCodexPanel } from './panels/codexPanel.ts'

export type { ActionUI } from './types.ts'


function renderRobotNamingModal(state: GameState): string {
  if (!state.needsRobotNaming) return ''
  const current = state.robotName ?? ''
  return `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="안내견 로봇 이름 설정"><div class="modal-card"><h2>안내견 로봇 이름 정하기</h2><p class="hint">이름은 1~12자, 공백만은 불가합니다.</p><input id="robot-name-input" type="text" maxlength="12" value="${current}" autocomplete="off" /><button id="robot-name-confirm" type="button">확인</button></div></div>`
}

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
  const codexUnlocked = state.buildings.lab >= 1

  baseTab.classList.toggle('active', isBase)
  assTab.classList.toggle('active', isAssembly)
  explorationTab.classList.toggle('active', isExploration)
  codexTab.classList.toggle('active', isCodex)

  baseTab.setAttribute('aria-selected', String(isBase))
  assTab.setAttribute('aria-selected', String(isAssembly))
  assTab.textContent = assemblyUnlocked ? '무기 조립' : '무기 조립(잠김)'
  explorationTab.setAttribute('aria-selected', String(isExploration))
  explorationTab.textContent = '탐험'
  codexTab.setAttribute('aria-selected', String(isCodex))
  codexTab.textContent = codexUnlocked ? '도감' : '도감(잠김)'

  baseTab.disabled = explorationActive
  assTab.disabled = explorationActive || !assemblyUnlocked
  explorationTab.disabled = false
  codexTab.disabled = explorationActive || !codexUnlocked

  panelBase.classList.toggle('hidden', !isBase)
  panelAssembly.classList.toggle('hidden', !isAssembly)
  panelExploration.classList.toggle('hidden', !isExploration)
  panelCodex.classList.toggle('hidden', !isCodex)
}

function patchLogs(app: ParentNode, state: GameState): void {
  const logLists = app.querySelectorAll<HTMLUListElement>('#log-list')
  if (logLists.length <= 0) return
  const signature = `${state.log.length}:${state.log[state.log.length - 1] ?? ''}`
  const html = [...state.log].reverse().map((line) => `<li>${line}</li>`).join('')

  logLists.forEach((logList) => {
    if (logList.dataset.signature === signature) return
    logList.innerHTML = html
    logList.dataset.signature = signature
  })
}

function formatBaseResourceAmount(resourceId: ResourceId, amount: number): string {
  return formatResourceValue(resourceId, amount)
}

export function patchAnimatedUI(state: GameState, actionUI: ActionUI, now = Date.now()): void {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  patchTabs(app, state)

  patchActionGauge(app, 'gather-wood', actionUI.gatherWood)
  patchActionGauge(app, 'gather-scrap', actionUI.gatherScrap)
  patchActionGauge(app, 'recover-guide-robot', actionUI.recoverGuideRobot)

  setText(app, '#resource-storage-cap-label', `자원 (최대 ${getResourceStorageCap(state)})`)
  setText(app, '#res-wood', formatBaseResourceAmount('wood', state.resources.wood))
  setText(app, '#res-scrap', formatBaseResourceAmount('scrap', state.resources.scrap))
  setText(app, '#res-iron', formatBaseResourceAmount('iron', state.resources.iron))
  setText(app, '#res-chromium', formatBaseResourceAmount('chromium', state.resources.chromium))
  setText(app, '#res-molybdenum', formatBaseResourceAmount('molybdenum', state.resources.molybdenum))
  setText(app, '#res-cobalt', formatBaseResourceAmount('cobalt', state.resources.cobalt))
  setText(app, '#res-shovel', `${formatResourceValue('shovel', state.resources.shovel)}/${SHOVEL_MAX_STACK}`)
  setText(app, '#res-scavenger-drone', formatBaseResourceAmount('scavengerDrone', state.resources.scavengerDrone))
  setText(app, '#res-synthetic-food', formatBaseResourceAmount('syntheticFood', state.resources.syntheticFood))
  setText(app, '#res-small-heal-potion', formatBaseResourceAmount('smallHealPotion', state.resources.smallHealPotion))
  setText(app, '#res-silicon-mass', formatBaseResourceAmount('siliconMass', state.resources.siliconMass))
  setText(app, '#res-carbon', formatBaseResourceAmount('carbon', state.resources.carbon))
  setText(app, '#res-silicon-ingot', formatBaseResourceAmount('siliconIngot', state.resources.siliconIngot))
  setText(app, '#res-nickel', formatBaseResourceAmount('nickel', state.resources.nickel))
  setText(app, '#res-low-alloy-steel', formatBaseResourceAmount('lowAlloySteel', state.resources.lowAlloySteel))
  setText(app, '#res-high-alloy-steel', formatBaseResourceAmount('highAlloySteel', state.resources.highAlloySteel))

  setText(app, '#gather-wood-title', `🪵 뗄감 줍기 (+${getGatherWoodReward(state)})`)
  setText(app, '#gather-scrap-title', `🗑️ 고물 줍기 (+${getGatherScrapRewardPreview(state)})`)

  const gatherScrapButton = app.querySelector<HTMLButtonElement>('#gather-scrap')
  if (gatherScrapButton) gatherScrapButton.setAttribute('aria-label', state.unlocks.scrapAction ? '🗑️ 고물 줍기 행동' : '잠긴 🗑️ 고물 줍기 행동')
  setHidden(app, '#scrap-hint', state.unlocks.scrapAction)

  const lumberCost = getBuildingCost(state, 'lumberMill')
  const minerCost = getBuildingCost(state, 'miner')
  const workbenchCost = getBuildingCost(state, 'workbench')
  const labCost = getBuildingCost(state, 'lab')
  const laikaRepairCost = getBuildingCost(state, 'laikaRepair')
  const companionName = getCompanionName(state)
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

  const buyLaikaRepair = app.querySelector<HTMLButtonElement>('#buy-laika-repair')
  const laikaRepairInstalled = state.buildings.laikaRepair >= 1
  if (buyLaikaRepair) buyLaikaRepair.disabled = laikaRepairInstalled || !state.isGuideRobotRecovered
  setText(
    app,
    '#buy-laika-repair-label',
    laikaRepairInstalled
      ? `${companionName} 수리 (설치 완료)`
      : state.isGuideRobotRecovered
        ? `${companionName} 수리 (${formatCost(laikaRepairCost)})`
        : `${companionName} 수리 (안내견 회수 필요)`,
  )

  const buyWorkbench = app.querySelector<HTMLButtonElement>('#buy-workbench')
  const workbenchInstalled = state.buildings.workbench >= 1
  if (buyWorkbench) buyWorkbench.disabled = workbenchInstalled
  setText(app, '#buy-workbench-label', workbenchInstalled ? `${getBuildingLabel('workbench')} (설치 완료)` : `${getBuildingLabel('workbench')} 설치 (${formatCost(workbenchCost)})`)

  const buyElectricFurnace = app.querySelector<HTMLButtonElement>('#buy-electric-furnace')
  if (buyElectricFurnace) buyElectricFurnace.disabled = !state.unlocks.electricFurnace
  setText(
    app,
    '#buy-electric-furnace-label',
    state.unlocks.electricFurnace ? `전기로 설치 (${formatCost(getBuildingCost(state, 'electricFurnace'))})` : '전기로 설치 (잠김)',
  )
  setHidden(app, '#electric-furnace-hint', state.unlocks.electricFurnace)

  const buyDroneController = app.querySelector<HTMLButtonElement>('#buy-drone-controller')
  const droneControllerInstalled = state.buildings.droneController >= 1
  if (buyDroneController) buyDroneController.disabled = droneControllerInstalled || !state.unlocks.droneController
  setText(
    app,
    '#buy-drone-controller-label',
    droneControllerInstalled
      ? `${getBuildingLabel('droneController')} (설치 완료)`
      : state.unlocks.droneController
        ? `${getBuildingLabel('droneController')} 설치 (${formatCost(droneControllerCost)})`
        : '드론 컨트롤러 설치 (잠김)',
  )
  setHidden(app, '#drone-controller-hint', state.unlocks.droneController)

  const lumberGauge = getBuildingGaugeView(state, 'lumberMill', now)
  const scavengerGauge = getBuildingGaugeView(state, 'scavenger', now)
  patchBuildingGauge(app, 'lumber-progress', lumberGauge.progress, lumberGauge.percentText, lumberGauge.timeText, lumberGauge.phase)
  patchBuildingGauge(app, 'scavenger-progress', scavengerGauge.progress, scavengerGauge.percentText, scavengerGauge.timeText, scavengerGauge.phase)

  setText(app, '#lumber-progress .gauge-title', `벌목기 가동 x${state.buildings.lumberMill}`)
  setText(app, '#scavenger-progress .gauge-title', `스캐빈저 가동 x${state.resources.scavengerDrone}`)

  patchMinerPanel(app, state, now)
  patchSmeltingPanel(app, state, now)

  setHidden(app, '#upgrades-panel', state.buildings.lab <= 0)
  RESEARCH_PANEL_UPGRADE_KEYS.forEach((key) => {
    const def = UPGRADE_DEFS[key]
    const done = state.upgrades[key]
    const cost = getUpgradeCost(key)
    const upgradeButton = app.querySelector<HTMLButtonElement>(`button[data-upgrade="${key}"]`)
    if (upgradeButton) {
      upgradeButton.disabled = done
      const label = `${def.name} (${formatCost(cost)})`
      if (upgradeButton.textContent !== label) upgradeButton.textContent = label
    }
    setText(app, `#upgrade-hint-${key}`, `${def.effectText}${done ? ' (완료)' : ''}`)
  })

  patchCraftButtons(app, state)
  patchWeaponInventory(app, state)
  patchWeaponBoard(app, state)
  patchModuleInventory(app, state)
  patchModuleDetail(app, state)
  patchExplorationBody(app, state, actionUI.recoverGuideRobot)
  patchExplorationCombatOverlay(app, state, now)
  patchCodexPanel(app, state)

  setText(app, '#exploration-hp', `${state.exploration.hp}/${state.exploration.maxHp}`)
  setText(app, '#exploration-pos', `(${state.exploration.position.x}, ${state.exploration.position.y})`)
  setText(app, '#exploration-map', renderExplorationMap(state))

  patchLogs(app, state)
}

let _bindController: AbortController | null = null

export function renderApp(state: GameState, handlers: Handlers, actionUI: ActionUI, now = Date.now()): void {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  const focusedId = (document.activeElement as HTMLElement | null)?.id ?? null
  const assemblyUnlocked = state.buildings.workbench >= 1
  const codexUnlocked = state.buildings.lab >= 1

  app.innerHTML = `<main class="layout"><div class="top-controls"><button id="cheat-accelerate-base-time" class="cheat-btn" type="button">치트 - 시간 가속(10분)</button><button id="delete-data" class="cheat-btn danger" type="button">데이터 삭제</button></div><h1>Morning</h1><section class="tabs" role="tablist" aria-label="메인 탭"><button id="tab-base" class="tab-btn ${state.activeTab === 'base' ? 'active' : ''}" role="tab" aria-selected="${state.activeTab === 'base'}" aria-controls="panel-base" ${state.exploration.mode === 'active' ? 'disabled' : ''}>거점</button><button id="tab-assembly" class="tab-btn ${state.activeTab === 'assembly' ? 'active' : ''}" role="tab" aria-selected="${state.activeTab === 'assembly'}" aria-controls="panel-assembly" ${state.exploration.mode === 'active' || !assemblyUnlocked ? 'disabled' : ''}>${assemblyUnlocked ? '무기 조립' : '무기 조립(잠김)'}</button><button id="tab-exploration" class="tab-btn ${state.activeTab === 'exploration' ? 'active' : ''}" role="tab" aria-selected="${state.activeTab === 'exploration'}" aria-controls="panel-exploration">탐험</button><button id="tab-codex" class="tab-btn ${state.activeTab === 'codex' ? 'active' : ''}" role="tab" aria-selected="${state.activeTab === 'codex'}" aria-controls="panel-codex" ${state.exploration.mode === 'active' || !codexUnlocked ? 'disabled' : ''}>${codexUnlocked ? '도감' : '도감(잠김)'}</button></section><div class="content-layout"><div class="content-panels">${renderBasePanel(state, actionUI, now)}${renderAssemblyPanel(state)}${renderExplorationPanel(state, actionUI.recoverGuideRobot, now)}${renderCodexPanel(state)}</div></div></main>${renderRobotNamingModal(state)}`

  app.querySelector<HTMLButtonElement>('#gather-wood .gauge-title')?.setAttribute('id', 'gather-wood-title')
  app.querySelector<HTMLButtonElement>('#gather-scrap .gauge-title')?.setAttribute('id', 'gather-scrap-title')

  _bindController?.abort()
  _bindController = new AbortController()
  bindUIInteractions(app, state, handlers, _bindController.signal)

  if (focusedId) {
    const nextFocus = app.querySelector<HTMLElement>(`#${focusedId}`)
    nextFocus?.focus()
  }
}
