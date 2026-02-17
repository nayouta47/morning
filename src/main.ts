import './style.css'
import {
  buyBuilding,
  buyUpgrade,
  equipModuleToSlot,
  gatherScrap,
  gatherWood,
  moveEquippedModuleBetweenSlots,
  continueExplorationAfterLoot,
  moveExplorationStep,
  reorderWeapons,
  selectWeapon,
  setActiveTab,
  setSmeltingAllocation,
  startCraft,
  startExploration,
  startExplorationFlee,
  takeExplorationLoot,
  toggleBuildingRun,
  unequipModuleFromSlot,
} from './core/actions.ts'
import { loadGame, saveGame, startAutosave } from './core/save.ts'
import { initialState, type GameState } from './core/state.ts'
import { advanceState } from './core/tick.ts'
import { patchAnimatedUI, renderApp } from './ui/render.ts'
import { ACTION_DURATION_MS } from './data/balance.ts'

let state: GameState = loadGame() ?? structuredClone(initialState)

const SIMULATION_INTERVAL_MS = 250
const HIDDEN_SIMULATION_INTERVAL_MS = 1000

type ActionKey = 'gatherWood' | 'gatherScrap'

let animationFrameId: number | null = null
let hiddenSimulationTimer: ReturnType<typeof setInterval> | null = null
let simulationLastTickAt = Date.now()
let appMounted = false

function toActionView(key: ActionKey, locked: boolean, now = Date.now()) {
  const duration = ACTION_DURATION_MS[key]
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
    const progress = (duration - smoothedRemaining) / duration
    const remainingSec = smoothedRemaining / 1000
    return {
      phase: 'cooldown' as const,
      progress,
      disabled: true,
      label: '진행 중',
      timeText: `${remainingSec.toFixed(1)}s / ${totalSecText}`,
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
        onBuyVehicleRepair: () => {
          syncState()
          buyBuilding(state, 'vehicleRepair')
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
        onToggleLumberMillRun: () => {
          syncState()
          toggleBuildingRun(state, 'lumberMill')
          redraw()
        },
        onToggleMinerRun: () => {
          syncState()
          toggleBuildingRun(state, 'miner')
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
        onStartExploration: () => {
          syncState()
          if (!state.selectedWeaponId) {
            const proceed = window.confirm('무기를 선택하지 않았습니다. 그대로 출발할까요?')
            if (!proceed) return
            startExploration(state, true)
          } else {
            startExploration(state, false)
          }
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

startAutosave(() => state)

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

document.addEventListener('keydown', (event) => {
  if (event.repeat || state.exploration.mode !== 'active') return
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
  syncState()
  saveGame(state)
})
