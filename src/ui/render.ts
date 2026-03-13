import type { GameState } from '../core/state.ts'
import { getBuildingCost } from '../core/actions.ts'
import { SHOVEL_MAX_STACK, getGatherScrapRewardPreview, getGatherWoodReward } from '../core/rewards.ts'
import { getResourceStorageCap } from '../core/resourceCaps.ts'
import { getCompanionName } from '../core/companion.ts'
import { RESEARCH_PANEL_UPGRADE_KEYS, UPGRADE_DEFS, getUpgradeCost } from '../data/balance.ts'
import { getBuildingLabel } from '../data/buildings.ts'
import { EVENT_NAMES } from '../data/events.ts'
import { formatCost, formatResourceAmount, formatResourceValue } from '../data/resources.ts'
import type { ActionGaugeView, ActionUI, Handlers } from './types.ts'
import { bindUIInteractions } from './interactions.ts'
import { setHidden, setText } from './view.ts'
import { patchModuleDetail, patchModuleInventory, patchWeaponBoard, patchWeaponInventory, renderAssemblyPanel } from './panels/assemblyPanel.ts'
import { patchActionGauge, patchBuildingGauge, patchCraftButtons, patchMinerPanel, patchSmeltingPanel, renderBasePanel, getBuildingGaugeView, renderGaugeButton } from './panels/basePanel.ts'
import { patchExplorationCombatOverlay } from './panels/combatOverlay.ts'
import { patchExplorationBody, renderExplorationMap, renderExplorationPanel } from './panels/explorationPanel.ts'
import { patchCodexPanel, renderCodexPanel } from './panels/codexPanel.ts'
import { patchBodyPanel, renderBodyPanel } from './panels/bodyPanel.ts'
import { patchDogPanel, renderDogPanel } from './panels/dogPanel.ts'
import { patchAndroidPanel, renderAndroidPanel } from './panels/androidPanel.ts'

export type { ActionUI } from './types.ts'


function renderDogNamingModal(state: GameState): string {
  if (!state.needsDogNaming) return ''
  return `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="강아지 이름 설정"><div class="modal-card"><h2>🐕 강아지 이름 정하기</h2><p class="hint">이름은 1~12자, 공백만은 불가합니다.</p><input id="dog-name-input" type="text" maxlength="12" value="강아지" autocomplete="off" /><button id="dog-name-confirm" type="button">확인</button></div></div>`
}

function renderCollapseEventModal(state: GameState): string {
  if (state.walkCount < 3 || state.collapseEventDismissed) return ''
  return `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="쓰러지는 이벤트"><div class="modal-card"><h2>사건 <span class="modal-subtitle">— ${EVENT_NAMES.collapse}</span></h2><p>시야에 어둠이 내려앉는다.<br>가까이 짖는 소리가 들린다.</p><button id="collapse-event-dismiss" type="button">의식을 잃는다</button></div></div>`
}

function renderTerminalIllnessModal(state: GameState, cryoSleepAction: ActionGaugeView): string {
  if (!state.upgrades.visitHospital || state.terminalIllnessEventDismissed) return ''
  return `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="불치병 이벤트"><div class="modal-card"><h2>사건 <span class="modal-subtitle">— ${EVENT_NAMES.terminalIllness}</span></h2><p>담당의는 종이를 내려놓았다.<br>이름도 어려운 퇴행성 질환. 진행을 늦출 수 없다.<br>냉동 수면 프로그램이 있다고 했다.<br>깨어날 수 있다는 보장은 없다.</p>${renderGaugeButton('cryo-sleep-confirm', '냉동 수면을 받아들인다', '냉동 수면 확정', cryoSleepAction)}</div></div>`
}

function renderTimePassedModal(state: GameState): string {
  if (!state.terminalIllnessEventDismissed || state.timePassedEventDismissed) return ''
  return `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="시간 경과 이벤트"><div class="modal-card"><h2>사건 <span class="modal-subtitle">— ${EVENT_NAMES.timePassed}</span></h2><p>눈을 떴다. 천장이 낯설다.<br>아주 잠깐 낮잠을 잔 것 같다.<br>화면에는 숫자가 하나 떠 있었다. 72.</p><button id="time-passed-dismiss" type="button">현재를 받아들인다</button></div></div>`
}

function renderRelapseModal(state: GameState, cryoSleepAction: ActionGaugeView): string {
  if (!state.timePassedEventDismissed || state.goToWorkPostEventCount < 5 || state.relapseEventDismissed) return ''
  return `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="재발작 이벤트"><div class="modal-card"><h2>사건 <span class="modal-subtitle">— ${EVENT_NAMES.relapse}</span></h2><p>시야가 흐려졌다. 바닥이 기울어진다.<br>다시.</p>${renderGaugeButton('cryo-sleep-confirm', '냉동 수면을 받아들인다', '냉동 수면 확정', cryoSleepAction)}</div></div>`
}

function renderLookAroundModal(state: GameState, recoverGuideRobot: ActionGaugeView): string {
  if (!state.relapseEventDismissed || state.isGuideRobotRecovered) return ''
  return `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="주위를 바라보다 이벤트"><div class="modal-card"><h2>사건 <span class="modal-subtitle">— ${EVENT_NAMES.lookAround}</span></h2><p>천장이 보이지 않는 콘크리트 구조물들이 성벽을 이루며 매일매일 하늘을 삼키고 있다.<br>그러나 지표면을 뒤덮은 뼈와 사이버네틱스 쓰레기들이, 성벽의 부재를 증명하고 있다.</p>${renderGaugeButton('recover-guide-robot', '파괴된 안내견 줍기', '파괴된 안내견 줍기', recoverGuideRobot)}</div></div>`
}

function renderOwnerlessThingModal(state: GameState, takeAndroid: ActionGaugeView): string {
  if (!state.ownerlessThingTriggered || state.isAndroidRecovered) return ''
  const name = getCompanionName(state)
  return `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="주인 없는 것 이벤트"><div class="modal-card"><h2>사건 <span class="modal-subtitle">— ${EVENT_NAMES.ownerlessThing}</span></h2><p>밖으로 나왔다. 인간형 로봇이 입구에 남아 있다.<br>가던 길을 간다.<br>${name}이 멈춘다.<br>뒤를 돌아본다.<br>돌아간다.<br>인간형 로봇의 손상된 다리 근처에서 낑낑거린다.<br>"...뭐야. 나한테 그러는 거야?"<br>"됐어. 가라니까."<br>${name}이 움직이지 않는다.<br>"......이 장난감 정말 고장 난 거 아니야?"</p>${renderGaugeButton('take-android', '데리고 간다', '데리고 간다', takeAndroid)}</div></div>`
}

function renderRobotNamingModal(state: GameState): string {
  if (!state.needsRobotNaming) return ''
  const current = state.robotName ?? ''
  return `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="안내견 로봇 이름 설정"><div class="modal-card"><h2>안내견 로봇 이름 정하기</h2><p class="hint">이름은 1~12자, 공백만은 불가합니다.</p><input id="robot-name-input" type="text" maxlength="12" value="${current}" autocomplete="off" /><button id="robot-name-confirm" type="button">확인</button></div></div>`
}

function patchTabs(app: ParentNode, state: GameState): void {
  const baseTab = app.querySelector<HTMLButtonElement>('#tab-base')
  const assTab = app.querySelector<HTMLButtonElement>('#tab-assembly')
  const bodyTab = app.querySelector<HTMLButtonElement>('#tab-body')
  const explorationTab = app.querySelector<HTMLButtonElement>('#tab-exploration')
  const codexTab = app.querySelector<HTMLButtonElement>('#tab-codex')
  const dogTab = app.querySelector<HTMLButtonElement>('#tab-dog')
  const androidTab = app.querySelector<HTMLButtonElement>('#tab-android')
  const panelBase = app.querySelector<HTMLElement>('#panel-base')
  const panelAssembly = app.querySelector<HTMLElement>('#panel-assembly')
  const panelBody = app.querySelector<HTMLElement>('#panel-body')
  const panelAndroid = app.querySelector<HTMLElement>('#panel-android')
  const panelExploration = app.querySelector<HTMLElement>('#panel-exploration')
  const panelCodex = app.querySelector<HTMLElement>('#panel-codex')
  const panelDog = app.querySelector<HTMLElement>('#panel-dog')
  if (!baseTab || !assTab || !bodyTab || !explorationTab || !codexTab || !panelBase || !panelAssembly || !panelBody || !panelExploration || !panelCodex) return

  const isBase = state.activeTab === 'base'
  const isAssembly = state.activeTab === 'assembly'
  const isBody = state.activeTab === 'body'
  const isAndroid = state.activeTab === 'android'
  const isExploration = state.activeTab === 'exploration'
  const isCodex = state.activeTab === 'codex'
  const isDog = state.activeTab === 'dog'
  const explorationActive = state.exploration.mode === 'active'
  const assemblyUnlocked = state.buildings.workbench >= 1
  const codexUnlocked = state.collapseEventDismissed
  const dogUnlocked = state.isGuideRobotRecovered

  baseTab.classList.toggle('active', isBase)
  assTab.classList.toggle('active', isAssembly)
  bodyTab.classList.toggle('active', isBody)
  androidTab?.classList.toggle('active', isAndroid)
  explorationTab.classList.toggle('active', isExploration)
  codexTab.classList.toggle('active', isCodex)
  dogTab?.classList.toggle('active', isDog)

  baseTab.setAttribute('aria-selected', String(isBase))
  assTab.setAttribute('aria-selected', String(isAssembly))
  assTab.textContent = assemblyUnlocked ? '무기 조립' : '무기 조립(잠김)'
  bodyTab.setAttribute('aria-selected', String(isBody))
  bodyTab.textContent = '신체 프레임'
  if (androidTab) {
    androidTab.setAttribute('aria-selected', String(isAndroid))
    androidTab.textContent = '제비 프레임'
  }
  explorationTab.setAttribute('aria-selected', String(isExploration))
  explorationTab.textContent = state.relapseEventDismissed ? '탐험' : '탐험(잠김)'
  codexTab.setAttribute('aria-selected', String(isCodex))
  codexTab.textContent = codexUnlocked ? '일기' : '일기(잠김)'
  if (dogTab) {
    dogTab.setAttribute('aria-selected', String(isDog))
    dogTab.textContent = `${getCompanionName(state)} 프레임`
  }

  baseTab.disabled = explorationActive
  assTab.disabled = explorationActive || !assemblyUnlocked
  bodyTab.disabled = explorationActive
  if (androidTab) androidTab.disabled = explorationActive
  explorationTab.disabled = !state.relapseEventDismissed && !explorationActive
  codexTab.disabled = explorationActive || !codexUnlocked
  if (dogTab) dogTab.disabled = explorationActive || !dogUnlocked

  panelBase.classList.toggle('hidden', !isBase)
  panelAssembly.classList.toggle('hidden', !isAssembly)
  panelBody.classList.toggle('hidden', !isBody)
  panelAndroid?.classList.toggle('hidden', !isAndroid)
  panelExploration.classList.toggle('hidden', !isExploration)
  panelCodex.classList.toggle('hidden', !isCodex)
  panelDog?.classList.toggle('hidden', !isDog)
}

function patchMessages(app: ParentNode, state: GameState): void {
  const logLists = app.querySelectorAll<HTMLUListElement>('#log-list')
  if (logLists.length <= 0) return
  const signature = `${state.messages.length}:${state.messages[0] ?? ''}:${state.messages[state.messages.length - 1] ?? ''}`
  const html = [...state.messages].reverse().map((line) => `<li>${line}</li>`).join('')

  logLists.forEach((logList) => {
    if (logList.dataset.signature === signature) return
    logList.innerHTML = html
    logList.dataset.signature = signature
  })
}


export function patchAnimatedUI(state: GameState, actionUI: ActionUI, now = Date.now()): void {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  patchTabs(app, state)

  patchActionGauge(app, 'go-to-work', actionUI.goToWork)
  patchActionGauge(app, 'gather-wood', actionUI.gatherWood)
  patchActionGauge(app, 'gather-scrap', actionUI.gatherScrap)
  patchActionGauge(app, 'recover-guide-robot', actionUI.recoverGuideRobot)
  patchActionGauge(app, 'take-android', actionUI.takeAndroid)
  patchActionGauge(app, 'contact-family', actionUI.contactFamily)
  patchActionGauge(app, 'go-for-walk', actionUI.goForWalk)
  patchActionGauge(app, 'cryo-sleep-confirm', actionUI.cryoSleep)

  setText(app, '#resource-storage-cap-label', `자원 (최대 ${getResourceStorageCap(state)})`)
  setText(app, '#res-cash', formatResourceValue('cash', state.resources.cash))
  setHidden(app, '[data-resource-id="cash"]', state.resources.cash <= 0)
  setText(app, '#res-wood', formatResourceValue('wood', state.resources.wood))
  setHidden(app, '[data-resource-id="wood"]', state.resources.wood <= 0)
  setText(app, '#res-scrap', formatResourceValue('scrap', state.resources.scrap))
  setHidden(app, '[data-resource-id="scrap"]', state.resources.scrap <= 0)
  setText(app, '#res-iron', formatResourceValue('iron', state.resources.iron))
  setHidden(app, '[data-resource-id="iron"]', state.resources.iron <= 0)
  setText(app, '#res-chromium', formatResourceValue('chromium', state.resources.chromium))
  setHidden(app, '[data-resource-id="chromium"]', state.resources.chromium <= 0)
  setText(app, '#res-molybdenum', formatResourceValue('molybdenum', state.resources.molybdenum))
  setHidden(app, '[data-resource-id="molybdenum"]', state.resources.molybdenum <= 0)
  setText(app, '#res-cobalt', formatResourceValue('cobalt', state.resources.cobalt))
  setHidden(app, '[data-resource-id="cobalt"]', state.resources.cobalt <= 0)
  setText(app, '#res-shovel', `${formatResourceValue('shovel', state.resources.shovel)}/${SHOVEL_MAX_STACK}`)
  setHidden(app, '[data-resource-id="shovel"]', state.resources.shovel <= 0)
  setText(app, '#res-scavenger-drone', formatResourceValue('scavengerDrone', state.resources.scavengerDrone))
  setHidden(app, '[data-resource-id="scavengerDrone"]', state.resources.scavengerDrone <= 0)
  setText(app, '#res-synthetic-food', formatResourceValue('syntheticFood', state.resources.syntheticFood))
  setHidden(app, '[data-resource-id="syntheticFood"]', state.resources.syntheticFood <= 0)
  setText(app, '#res-small-heal-potion', formatResourceValue('smallHealPotion', state.resources.smallHealPotion))
  setHidden(app, '[data-resource-id="smallHealPotion"]', state.resources.smallHealPotion <= 0)
  setText(app, '#res-silicon-mass', formatResourceValue('siliconMass', state.resources.siliconMass))
  setHidden(app, '[data-resource-id="siliconMass"]', state.resources.siliconMass <= 0)
  setText(app, '#res-carbon', formatResourceValue('carbon', state.resources.carbon))
  setHidden(app, '[data-resource-id="carbon"]', state.resources.carbon <= 0)
  setText(app, '#res-silicon-ingot', formatResourceValue('siliconIngot', state.resources.siliconIngot))
  setHidden(app, '[data-resource-id="siliconIngot"]', state.resources.siliconIngot <= 0)
  setText(app, '#res-nickel', formatResourceValue('nickel', state.resources.nickel))
  setHidden(app, '[data-resource-id="nickel"]', state.resources.nickel <= 0)
  setText(app, '#res-low-alloy-steel', formatResourceValue('lowAlloySteel', state.resources.lowAlloySteel))
  setHidden(app, '[data-resource-id="lowAlloySteel"]', state.resources.lowAlloySteel <= 0)
  setText(app, '#res-high-alloy-steel', formatResourceValue('highAlloySteel', state.resources.highAlloySteel))
  setHidden(app, '[data-resource-id="highAlloySteel"]', state.resources.highAlloySteel <= 0)

  const dogStrong = app.querySelector<HTMLElement>('#dog-equipment-row strong')
  if (dogStrong) dogStrong.textContent = `(산책 ${state.walkCount}회)`

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
  patchBuildingGauge(app, 'lumber-progress', lumberGauge)
  patchBuildingGauge(app, 'scavenger-progress', scavengerGauge)

  setText(app, '#lumber-progress .gauge-title', `벌목기 가동 x${state.buildings.lumberMill}`)
  setText(app, '#scavenger-progress .gauge-title', `스캐빈저 가동 x${state.resources.scavengerDrone}`)

  patchMinerPanel(app, state, now)
  patchSmeltingPanel(app, state, now)

  setHidden(app, '#upgrades-panel', state.buildings.lab <= 0 && state.upgrades.visitHospital && state.collapseEventDismissed)
  RESEARCH_PANEL_UPGRADE_KEYS.filter((key) => {
    if (key === 'visitHospital') return state.collapseEventDismissed
    if (key === 'comfortRobot') return state.timePassedEventDismissed
    return true
  }).forEach((key) => {
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
  patchExplorationBody(app, state)
  patchExplorationCombatOverlay(app, state, now)
  patchCodexPanel(app, state)
  patchBodyPanel(app, state)
  patchAndroidPanel(app, state)
  patchDogPanel(app, state)

  setText(app, '#exploration-hp', `${state.exploration.hp}/${state.exploration.maxHp}`)
  setText(app, '#exploration-pos', `(${state.exploration.position.x}, ${state.exploration.position.y})`)
  setText(app, '#exploration-map', renderExplorationMap(state))

  patchMessages(app, state)
}

let _bindController: AbortController | null = null

export function renderApp(state: GameState, handlers: Handlers, actionUI: ActionUI, now = Date.now()): void {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  const focusedId = (document.activeElement as HTMLElement | null)?.id ?? null
  const assemblyUnlocked = state.buildings.workbench >= 1
  const codexUnlocked = state.collapseEventDismissed

  app.innerHTML = `<main class="layout"><div class="top-controls"><button id="cheat-accelerate-base-time" class="cheat-btn" type="button">치트 - 시간 가속(10분)</button><button id="cheat-codex-reveal" class="cheat-btn${state.codexRevealAll ? ' active' : ''}" type="button">치트 - 일기 전체${state.codexRevealAll ? ' ON' : ' OFF'}</button><button id="delete-data" class="cheat-btn danger" type="button">데이터 삭제</button></div><h1>Morning</h1><section class="tabs" role="tablist" aria-label="메인 탭"><div class="tab-row" role="presentation"><button id="tab-base" class="tab-btn ${state.activeTab === 'base' ? 'active' : ''}" role="tab" aria-selected="${state.activeTab === 'base'}" aria-controls="panel-base" ${state.exploration.mode === 'active' ? 'disabled' : ''}>거점</button><button id="tab-assembly" class="tab-btn ${state.activeTab === 'assembly' ? 'active' : ''}" role="tab" aria-selected="${state.activeTab === 'assembly'}" aria-controls="panel-assembly" ${state.exploration.mode === 'active' || !assemblyUnlocked ? 'disabled' : ''}>${assemblyUnlocked ? '무기 조립' : '무기 조립(잠김)'}</button><button id="tab-exploration" class="tab-btn ${state.activeTab === 'exploration' ? 'active' : ''}" role="tab" aria-selected="${state.activeTab === 'exploration'}" aria-controls="panel-exploration" ${!state.relapseEventDismissed && state.exploration.mode !== 'active' ? 'disabled' : ''}>${state.relapseEventDismissed ? '탐험' : '탐험(잠김)'}</button><button id="tab-codex" class="tab-btn ${state.activeTab === 'codex' ? 'active' : ''}" role="tab" aria-selected="${state.activeTab === 'codex'}" aria-controls="panel-codex" ${state.exploration.mode === 'active' || !codexUnlocked ? 'disabled' : ''}>${codexUnlocked ? '일기' : '일기(잠김)'}</button></div><div class="tab-row" role="presentation"><button id="tab-body" class="tab-btn ${state.activeTab === 'body' ? 'active' : ''}" role="tab" aria-selected="${state.activeTab === 'body'}" aria-controls="panel-body" ${state.exploration.mode === 'active' ? 'disabled' : ''}>신체 프레임</button>${state.isGuideRobotRecovered ? `<button id="tab-dog" class="tab-btn ${state.activeTab === 'dog' ? 'active' : ''}" role="tab" aria-selected="${state.activeTab === 'dog'}" aria-controls="panel-dog" ${state.exploration.mode === 'active' ? 'disabled' : ''}>${getCompanionName(state)} 프레임</button>` : ''}${state.isAndroidRecovered ? `<button id="tab-android" class="tab-btn ${state.activeTab === 'android' ? 'active' : ''}" role="tab" aria-selected="${state.activeTab === 'android'}" aria-controls="panel-android" ${state.exploration.mode === 'active' ? 'disabled' : ''}>제비 프레임</button>` : ''}</div></section><div class="content-layout"><div class="content-panels">${renderBasePanel(state, actionUI, now)}${renderAssemblyPanel(state)}${renderBodyPanel(state)}${renderAndroidPanel(state)}${renderExplorationPanel(state, now)}${renderCodexPanel(state)}${renderDogPanel(state)}</div></div></main>${renderRobotNamingModal(state)}${renderDogNamingModal(state)}${renderCollapseEventModal(state)}${renderTerminalIllnessModal(state, actionUI.cryoSleep)}${renderTimePassedModal(state)}${renderRelapseModal(state, actionUI.cryoSleep)}${renderLookAroundModal(state, actionUI.recoverGuideRobot)}${renderOwnerlessThingModal(state, actionUI.takeAndroid)}`

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
