import './style.css'
import {
  buyBuilding,
  buyUpgrade,
  equipModuleToSlot,
  gatherMetal,
  gatherWood,
  selectWeapon,
  setActiveTab,
  startModuleCraft,
  startWeaponCraft,
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

type ActionTiming = {
  cooldownStartedAt: number
  cooldownUntil: number
}

type ActionKey = 'gatherWood' | 'gatherMetal'

const actionTiming: Record<ActionKey, ActionTiming> = {
  gatherWood: { cooldownStartedAt: 0, cooldownUntil: 0 },
  gatherMetal: { cooldownStartedAt: 0, cooldownUntil: 0 },
}

let animationFrameId: number | null = null
let hiddenSimulationTimer: ReturnType<typeof setInterval> | null = null
let simulationLastTickAt = Date.now()
let appMounted = false

function toActionView(key: ActionKey, locked: boolean, now = Date.now()) {
  if (locked) {
    return {
      phase: 'locked' as const,
      progress: 0,
      disabled: true,
      label: '잠김',
    }
  }

  const timing = actionTiming[key]
  if (now < timing.cooldownUntil) {
    const duration = ACTION_DURATION_MS[key]
    const elapsed = (now - timing.cooldownStartedAt) / duration
    return {
      phase: 'cooldown' as const,
      progress: elapsed,
      disabled: true,
      label: '진행 중',
    }
  }

  return {
    phase: 'ready' as const,
    progress: 1,
    disabled: false,
    label: '준비됨',
  }
}

function triggerActionFeedback(key: ActionKey): number {
  const now = Date.now()
  const duration = ACTION_DURATION_MS[key]
  actionTiming[key].cooldownStartedAt = now
  actionTiming[key].cooldownUntil = now + duration
  return now
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
    gatherMetal: toActionView('gatherMetal', !state.unlocks.metalAction, now),
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
          const actionStartAt = triggerActionFeedback('gatherWood')
          redraw(actionStartAt)
        },
        onGatherMetal: () => {
          syncState()
          const view = toActionView('gatherMetal', !state.unlocks.metalAction)
          if (view.disabled) return
          gatherMetal(state)
          const actionStartAt = triggerActionFeedback('gatherMetal')
          redraw(actionStartAt)
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
        onBuyUpgrade: (key) => {
          syncState()
          buyUpgrade(state, key)
          redraw()
        },
        onSelectTab: (tab) => {
          setActiveTab(state, tab)
          redraw()
        },
        onCraftPistol: () => {
          syncState()
          startWeaponCraft(state, 'pistol')
          redraw()
        },
        onCraftRifle: () => {
          syncState()
          startWeaponCraft(state, 'rifle')
          redraw()
        },
        onCraftModule: () => {
          syncState()
          startModuleCraft(state)
          redraw()
        },
        onSelectWeapon: (weaponId) => {
          selectWeapon(state, weaponId)
          redraw()
        },
        onEquipModule: (moduleType, slotIndex) => {
          if (!state.selectedWeaponId) return
          syncState()
          equipModuleToSlot(state, state.selectedWeaponId, moduleType, slotIndex)
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
    )
    appMounted = true
    return
  }

  patchAnimatedUI(state, actionUI)
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
