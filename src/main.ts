import './style.css'
import {
  narrate,
  buyBuilding,
  buyUpgrade,
  equipModuleToSlot,
  gatherScrap,
  gatherWood,
  goToWork,
  contactFamily,
  goForWalk,
  moveEquippedModuleBetweenSlots,
  continueExplorationAfterLoot,
  enterDungeon,
  cancelDungeonEntry,
  addLoadoutResource,
  removeLoadoutResource,
  fillLoadoutResource,
  clearLoadoutResource,
  moveExplorationStep,
  reorderWeapons,
  selectWeapon,
  setActiveTab,
  selectOrganSlot,
  setSmeltingAllocation,
  setMinerAllocation,
  startCraft,
  cycleModuleCraftTier,
  startExploration,
  startRecoverGuideRobot,
  startExplorationFlee,
  takeExplorationLoot,
  toggleBuildingRun,
  toggleSmeltingProcessRun,
  toggleMinerProcessRun,
  unequipModuleFromSlot,
  useSmallHealPotion,
  useSyntheticFood,
  unlockAllEnemyCodex,
} from './core/actions.ts'
import { clearGameSave, loadGame, saveGame, startAutosave } from './core/save.ts'
import { initialState, type GameState } from './core/state.ts'
import { getCompanionName, validateCompanionName } from './core/companion.ts'
import { addResourceWithCap, getResourceStorageCap } from './core/resourceCaps.ts'
import { advanceBaseOnlyStateByElapsed, advanceState } from './core/tick.ts'
import { patchAnimatedUI, renderApp } from './ui/render.ts'
import { ACTION_DURATION_MS } from './data/balance.ts'
import { getGatherScrapDurationMs } from './core/rewards.ts'

let state: GameState = loadGame() ?? structuredClone(initialState)

const SIMULATION_INTERVAL_MS = 250
const HIDDEN_SIMULATION_INTERVAL_MS = 1000
const BASE_CHEAT_ACCELERATION_MS = 10 * 60 * 1000

type ActionKey = 'goToWork' | 'gatherWood' | 'gatherScrap' | 'recoverGuideRobot' | 'goForWalk' | 'contactFamily' | 'cryoSleep'

let animationFrameId: number | null = null
let hiddenSimulationTimer: ReturnType<typeof setInterval> | null = null
let autosaveTimer: number | null = null
let simulationLastTickAt = Date.now()
let appMounted = false
let isHardResetting = false
let lastStructureSignature = ''

function toActionView(key: ActionKey, locked: boolean, now = Date.now()) {
  const duration = key === 'gatherScrap' ? getGatherScrapDurationMs(state) : ACTION_DURATION_MS[key as keyof typeof ACTION_DURATION_MS]
  const totalSecText = `${(duration / 1000).toFixed(1)}s`

  if (locked) {
    return {
      phase: 'locked' as const,
      progress: 0,
      disabled: true,
      label: '잠김',
      timeText: `- / ${totalSecText}`,
    }
  }

  const remaining = state.actionProgress[key]
  if (remaining > 0) {
    const elapsedSinceUpdate = Math.max(0, now - state.lastUpdate)
    const smoothedRemaining = Math.max(0, remaining - elapsedSinceUpdate)
    const cycleDuration = Math.max(duration, remaining)
    const progress = (cycleDuration - smoothedRemaining) / cycleDuration
    const remainingSec = smoothedRemaining / 1000
    return {
      phase: 'cooldown' as const,
      progress,
      disabled: true,
      label: key === 'gatherScrap' && state.companionIsAutoGathering
        ? `🐕 ${getCompanionName(state)} 채집 중`
        : '진행 중',
      timeText: `${remainingSec.toFixed(1)}s / ${(cycleDuration / 1000).toFixed(1)}s`,
    }
  }

  return {
    phase: 'ready' as const,
    progress: 1,
    disabled: false,
    label: '준비됨',
    timeText: `- / ${totalSecText}`,
  }
}

function syncState(now = Date.now()): void {
  advanceState(state, now)
}

function runSimulation(now = Date.now()): void {
  if (now - simulationLastTickAt < SIMULATION_INTERVAL_MS) return
  syncState(now)
  simulationLastTickAt = now
}

function getStructureSignature(): string {
  const unlockSig = [
    state.unlocks.scrapAction,
    state.unlocks.lumberMill,
    state.unlocks.miner,
    state.unlocks.droneController,
    state.unlocks.electricFurnace,
  ].map((value) => (value ? '1' : '0')).join('')

  const buildingSig = [
    state.buildings.lumberMill,
    state.buildings.miner,
    state.buildings.lab,
    state.buildings.droneController,
    state.buildings.electricFurnace,
    state.buildings.laikaRepair,
  ].join(':')

  return `${state.activeTab}|${unlockSig}|${buildingSig}|${state.isGuideRobotRecovered ? 1 : 0}|${state.needsRobotNaming ? 1 : 0}|${state.upgrades.visitHospital ? 1 : 0}|${state.upgrades.adoptDog ? 1 : 0}|${state.needsDogNaming ? 1 : 0}|${state.collapseEventDismissed ? 1 : 0}|${state.walkCount >= 3 ? 1 : 0}|${state.terminalIllnessEventDismissed ? 1 : 0}|${state.timePassedEventDismissed ? 1 : 0}`
}

function redraw(nowOverride?: number): void {
  const now = nowOverride ?? Date.now()
  const structureSignature = getStructureSignature()

  if (appMounted && structureSignature !== lastStructureSignature) {
    appMounted = false
  }

  const actionUI = {
    goToWork: toActionView('goToWork', state.collapseEventDismissed && !state.timePassedEventDismissed, now),
    gatherWood: toActionView('gatherWood', false, now),
    gatherScrap: toActionView('gatherScrap', !state.unlocks.scrapAction, now),
    recoverGuideRobot: toActionView('recoverGuideRobot', state.isGuideRobotRecovered, now),
    contactFamily: toActionView('contactFamily', false, now),
    goForWalk: toActionView('goForWalk', !state.upgrades.adoptDog || state.collapseEventDismissed, now),
    cryoSleep: toActionView('cryoSleep', false, now),
  }

  if (!appMounted) {
    renderApp(
      state,
      {
        onGoToWork: () => {
          syncState()
          const view = toActionView('goToWork', false)
          if (view.disabled) return
          goToWork(state)
          redraw()
        },
        onGatherWood: () => {
          syncState()
          const view = toActionView('gatherWood', false)
          if (view.disabled) return
          gatherWood(state)
          redraw()
        },
        onGatherScrap: () => {
          syncState()
          const view = toActionView('gatherScrap', !state.unlocks.scrapAction)
          if (view.disabled) return
          gatherScrap(state)
          redraw()
        },
        onBuyLumberMill: () => {
          syncState()
          buyBuilding(state, 'lumberMill')
          redraw()
        },
        onBuyMiner: () => {
          syncState()
          buyBuilding(state, 'miner')
          redraw()
        },
        onBuyWorkbench: () => {
          syncState()
          buyBuilding(state, 'workbench')
          redraw()
        },
        onBuyLab: () => {
          syncState()
          buyBuilding(state, 'lab')
          redraw()
        },
        onBuyLaikaRepair: () => {
          syncState()
          buyBuilding(state, 'laikaRepair')
          redraw()
        },
        onBuyDroneController: () => {
          syncState()
          buyBuilding(state, 'droneController')
          redraw()
        },
        onBuyElectricFurnace: () => {
          syncState()
          buyBuilding(state, 'electricFurnace')
          redraw()
        },
        onSetSmeltingAllocation: (key, value) => {
          syncState()
          setSmeltingAllocation(state, key, value)
          redraw()
        },
        onSetMinerAllocation: (key, value) => {
          syncState()
          setMinerAllocation(state, key, value)
          redraw()
        },
        onToggleLumberMillRun: () => {
          syncState()
          toggleBuildingRun(state, 'lumberMill')
          redraw()
        },
        onToggleSmeltingProcessRun: (key) => {
          syncState()
          toggleSmeltingProcessRun(state, key)
          redraw()
        },
        onToggleMinerProcessRun: (key) => {
          syncState()
          toggleMinerProcessRun(state, key)
          redraw()
        },
        onToggleScavengerRun: () => {
          syncState()
          toggleBuildingRun(state, 'scavenger')
          redraw()
        },
        onBuyUpgrade: (key) => {
          syncState()
          buyUpgrade(state, key)
          redraw()
        },
        onSelectTab: (tab) => {
          setActiveTab(state, tab)
          redraw()
        },
        onSelectOrganSlot: (slot) => {
          selectOrganSlot(state, slot)
          redraw()
        },
        onCheatAccelerateBaseTime: () => {
          syncState()
          advanceBaseOnlyStateByElapsed(state, BASE_CHEAT_ACCELERATION_MS)
          narrate(state, '시간이 흘렀다.')
          simulationLastTickAt = Date.now()
          redraw()
        },
        onDeleteData: () => {
          const confirmed = window.confirm('저장된 게임 데이터를 삭제하고 초기 상태로 되돌릴까요?')
          if (!confirmed) return

          isHardResetting = true
          if (autosaveTimer != null) {
            window.clearInterval(autosaveTimer)
            autosaveTimer = null
          }

          clearGameSave()
          try {
            window.location.replace(window.location.href)
          } catch {
            window.location.reload()
          }
        },
        onClearLog: () => {
          state.messages = []
          redraw()
        },
        onCheatGrantCodexChip: (moduleType) => {
          syncState()
          state.modules[moduleType] += 1
          redraw()
        },
        onCheatGrantResource: (resourceId) => {
          syncState()
          addResourceWithCap(state.resources, resourceId, 100, getResourceStorageCap(state))
          redraw()
        },
        onConfirmRobotName: (name) => {
          const result = validateCompanionName(name)
          if (!result.valid) {
            narrate(state, '이름은 1~12자이며 공백만 입력할 수 없다.')
            redraw()
            return
          }
          state.robotName = result.normalized
          state.needsRobotNaming = false
          narrate(state, `안내견 로봇의 이름이 ${result.normalized}(으)로 정해졌다.`)
          appMounted = false
          redraw()
        },
        onGoForWalk: () => {
          syncState()
          const view = toActionView('goForWalk', !state.upgrades.adoptDog)
          if (view.disabled) return
          goForWalk(state)
          redraw()
        },
        onContactFamily: () => {
          syncState()
          const view = toActionView('contactFamily', false)
          if (view.disabled) return
          contactFamily(state)
          redraw()
        },
        onConfirmDogName: (name) => {
          const trimmed = name.trim()
          if (trimmed.length === 0 || trimmed.length > 12) {
            narrate(state, '이름은 1~12자이며 공백만 입력할 수 없다.')
            redraw()
            return
          }
          state.dogName = trimmed
          state.needsDogNaming = false
          narrate(state, `강아지 이름이 ${trimmed}(으)로 정해졌다.`)
          appMounted = false
          redraw()
        },
        onDismissCollapseEvent: () => {
          state.collapseEventDismissed = true
          narrate(state, '사건 — 발작')
          appMounted = false
          redraw()
        },
        onDismissTimePassedEvent: () => {
          state.timePassedEventDismissed = true
          narrate(state, '사건 — 얼마나 흐른거지?')
          appMounted = false
          redraw()
        },
        onStartCryoSleep: () => {
          syncState()
          const view = toActionView('cryoSleep', false)
          if (view.disabled) return
          state.actionProgress.cryoSleep = ACTION_DURATION_MS.cryoSleep
          redraw()
        },
        onStartRecoverGuideRobot: () => {
          syncState()
          const view = toActionView('recoverGuideRobot', state.isGuideRobotRecovered)
          if (view.disabled) return
          startRecoverGuideRobot(state)
          redraw()
        },
        onStartExploration: () => {
          syncState()
          startExploration(state, false)
          redraw()
        },
        onMoveExploration: (dx, dy) => {
          syncState()
          moveExplorationStep(state, dx, dy)
          redraw()
        },
        onFleeExplorationCombat: () => {
          syncState()
          startExplorationFlee(state)
          redraw()
        },
        onUseSyntheticFood: () => {
          syncState()
          useSyntheticFood(state)
          redraw()
        },
        onUseSmallHealPotion: () => {
          syncState()
          useSmallHealPotion(state)
          redraw()
        },
        onTakeLoot: (resourceId) => {
          syncState()
          takeExplorationLoot(state, resourceId)
          redraw()
        },
        onContinueAfterLoot: () => {
          syncState()
          continueExplorationAfterLoot(state)
          redraw()
        },
        onEnterDungeon: () => {
          syncState()
          enterDungeon(state)
          redraw()
        },
        onCancelDungeonEntry: () => {
          syncState()
          cancelDungeonEntry(state)
          redraw()
        },
        onLoadoutAddItem: (resourceId) => {
          syncState()
          addLoadoutResource(state, resourceId)
          redraw()
        },
        onLoadoutRemoveItem: (resourceId) => {
          syncState()
          removeLoadoutResource(state, resourceId)
          redraw()
        },
        onLoadoutFillItem: (resourceId) => {
          syncState()
          fillLoadoutResource(state, resourceId)
          redraw()
        },
        onLoadoutClearItem: (resourceId) => {
          syncState()
          clearLoadoutResource(state, resourceId)
          redraw()
        },
        onCraftPistol: () => {
          syncState()
          startCraft(state, 'pistol')
          redraw()
        },
        onCraftRifle: () => {
          syncState()
          startCraft(state, 'rifle')
          redraw()
        },
        onCraftModule: () => {
          syncState()
          startCraft(state, 'module')
          redraw()
        },
        onModuleCraftTierPrev: () => {
          syncState()
          cycleModuleCraftTier(state, -1)
          redraw()
        },
        onModuleCraftTierNext: () => {
          syncState()
          cycleModuleCraftTier(state, 1)
          redraw()
        },
        onCraftShovel: () => {
          syncState()
          startCraft(state, 'shovel')
          redraw()
        },
        onCraftScavengerDrone: () => {
          syncState()
          startCraft(state, 'scavengerDrone')
          redraw()
        },
        onCraftSyntheticFood: () => {
          syncState()
          startCraft(state, 'syntheticFood')
          redraw()
        },
        onCraftSmallHealPotion: () => {
          syncState()
          startCraft(state, 'smallHealPotion')
          redraw()
        },
        onSelectWeapon: (weaponId) => {
          selectWeapon(state, weaponId)
          redraw()
        },
        onReorderWeapons: (sourceWeaponId, targetWeaponId) => {
          reorderWeapons(state, sourceWeaponId, targetWeaponId)
          redraw()
        },
        onEquipModule: (moduleType, slotIndex) => {
          if (!state.selectedWeaponId) return
          syncState()
          equipModuleToSlot(state, state.selectedWeaponId, moduleType, slotIndex)
          redraw()
        },
        onMoveEquippedModule: (fromSlotIndex, toSlotIndex) => {
          if (!state.selectedWeaponId) return
          syncState()
          const moved = moveEquippedModuleBetweenSlots(state, state.selectedWeaponId, fromSlotIndex, toSlotIndex)
          if (!moved) narrate(state, `⚠️ 이동 불가: 해당 슬롯은 이동 후 비활성화됩니다.`)
          redraw()
        },
        onUnequipModule: (slotIndex) => {
          if (!state.selectedWeaponId) return
          syncState()
          unequipModuleFromSlot(state, state.selectedWeaponId, slotIndex)
          redraw()
        },
      },
      actionUI,
      now,
    )
    appMounted = true
    lastStructureSignature = structureSignature
    return
  }

  patchAnimatedUI(state, actionUI, now)
  lastStructureSignature = structureSignature
}

function frameLoop(): void {
  if (document.hidden) {
    animationFrameId = null
    return
  }

  const now = Date.now()
  runSimulation(now)
  redraw(now)
  animationFrameId = requestAnimationFrame(frameLoop)
}

function startFrameLoop(): void {
  if (animationFrameId !== null) return
  animationFrameId = requestAnimationFrame(frameLoop)
}

function stopFrameLoop(): void {
  if (animationFrameId === null) return
  cancelAnimationFrame(animationFrameId)
  animationFrameId = null
}

function startHiddenSimulation(): void {
  if (hiddenSimulationTimer) return
  hiddenSimulationTimer = setInterval(() => {
    syncState()
    simulationLastTickAt = Date.now()
  }, HIDDEN_SIMULATION_INTERVAL_MS)
}

function stopHiddenSimulation(): void {
  if (!hiddenSimulationTimer) return
  clearInterval(hiddenSimulationTimer)
  hiddenSimulationTimer = null
}

syncState()
simulationLastTickAt = Date.now()
redraw()
startFrameLoop()

autosaveTimer = startAutosave(() => state)

const moveByKey: Record<string, { dx: number; dy: number }> = {
  w: { dx: 0, dy: -1 },
  a: { dx: -1, dy: 0 },
  s: { dx: 0, dy: 1 },
  d: { dx: 1, dy: 0 },
  arrowup: { dx: 0, dy: -1 },
  arrowleft: { dx: -1, dy: 0 },
  arrowdown: { dx: 0, dy: 1 },
  arrowright: { dx: 1, dy: 0 },
  q: { dx: -1, dy: -1 },
  e: { dx: 1, dy: -1 },
  z: { dx: -1, dy: 1 },
  c: { dx: 1, dy: 1 },
  home: { dx: -1, dy: -1 },
  pageup: { dx: 1, dy: -1 },
  end: { dx: -1, dy: 1 },
  pagedown: { dx: 1, dy: 1 },
}

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null
  if (!element) return false
  const tag = element.tagName.toLowerCase()
  return element.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select'
}

document.addEventListener('keydown', (event) => {
  if (event.repeat || isTypingTarget(event.target)) return
  if (state.needsRobotNaming || state.needsDogNaming) return

  const isCodexRevealHotkey = event.key.toLowerCase() === 'p'
  if (isCodexRevealHotkey) {
    event.preventDefault()
    syncState()
    unlockAllEnemyCodex(state)
    redraw()
    return
  }

  if (state.exploration.mode !== 'active') return
  const move = moveByKey[event.key.toLowerCase()]
  if (!move) return
  event.preventDefault()
  syncState()
  moveExplorationStep(state, move.dx, move.dy)
  redraw()
})

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopFrameLoop()
    startHiddenSimulation()
    return
  }

  stopHiddenSimulation()
  const now = Date.now()
  syncState(now)
  simulationLastTickAt = now
  redraw(now)
  startFrameLoop()
})

window.addEventListener('beforeunload', () => {
  if (isHardResetting) return
  syncState()
  saveGame(state)
})
