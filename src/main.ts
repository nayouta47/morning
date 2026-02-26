import './style.css'
import {
  appendLog,
  buyBuilding,
  buyUpgrade,
  equipModuleToSlot,
  gatherScrap,
  gatherWood,
  moveEquippedModuleBetweenSlots,
  continueExplorationAfterLoot,
  addLoadoutResource,
  removeLoadoutResource,
  moveExplorationStep,
  reorderWeapons,
  selectWeapon,
  setActiveTab,
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
import { validateCompanionName } from './core/companion.ts'
import { advanceBaseOnlyStateByElapsed, advanceState } from './core/tick.ts'
import { patchAnimatedUI, renderApp } from './ui/render.ts'
import { ACTION_DURATION_MS } from './data/balance.ts'
import { getGatherScrapDurationMs } from './core/rewards.ts'

let state: GameState = loadGame() ?? structuredClone(initialState)

const SIMULATION_INTERVAL_MS = 250
const HIDDEN_SIMULATION_INTERVAL_MS = 1000
const BASE_CHEAT_ACCELERATION_MS = 10 * 60 * 1000

type ActionKey = 'gatherWood' | 'gatherScrap' | 'recoverGuideRobot'

let animationFrameId: number | null = null
let hiddenSimulationTimer: ReturnType<typeof setInterval> | null = null
let autosaveTimer: number | null = null
let simulationLastTickAt = Date.now()
let appMounted = false
let isHardResetting = false

function toActionView(key: ActionKey, locked: boolean, now = Date.now()) {
  const duration = key === 'gatherScrap' ? getGatherScrapDurationMs(state) : ACTION_DURATION_MS[key]
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
      label: '진행 중',
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

function redraw(nowOverride?: number): void {
  const now = nowOverride ?? Date.now()

  const actionUI = {
    gatherWood: toActionView('gatherWood', false, now),
    gatherScrap: toActionView('gatherScrap', !state.unlocks.scrapAction, now),
    recoverGuideRobot: toActionView('recoverGuideRobot', state.isGuideRobotRecovered, now),
  }

  if (!appMounted) {
    renderApp(
      state,
      {
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
        onCheatAccelerateBaseTime: () => {
          syncState()
          advanceBaseOnlyStateByElapsed(state, BASE_CHEAT_ACCELERATION_MS)
          const accelerationMin = BASE_CHEAT_ACCELERATION_MS / (60 * 1000)
          if (state.exploration.mode === 'active') {
            appendLog(state, `치트 사용: 거점 시간 +${accelerationMin}분 (탐험 전투 시간 제외)`)
          } else {
            appendLog(state, `치트 사용: 거점 시간 +${accelerationMin}분`)
          }
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
          state.log = []
          redraw()
        },
        onCheatGrantCodexChip: (moduleType) => {
          syncState()
          state.modules[moduleType] += 1
          redraw()
        },
        onConfirmRobotName: (name) => {
          const result = validateCompanionName(name)
          if (!result.valid) {
            appendLog(state, '이름은 1~12자이며 공백만 입력할 수 없다.')
            redraw()
            return
          }
          state.robotName = result.normalized
          state.needsRobotNaming = false
          appendLog(state, `안내견 로봇의 이름이 ${result.normalized}(으)로 정해졌다.`)
          appMounted = false
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
          moveEquippedModuleBetweenSlots(state, state.selectedWeaponId, fromSlotIndex, toSlotIndex)
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
    return
  }

  patchAnimatedUI(state, actionUI, now)
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
  if (state.needsRobotNaming) return

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
