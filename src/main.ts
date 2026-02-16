import './style.css'
import { buyBuilding, buyUpgrade, gatherMetal, gatherWood } from './core/actions.ts'
import { loadGame, saveGame, startAutosave } from './core/save.ts'
import { initialState, type GameState } from './core/state.ts'
import { advanceState } from './core/tick.ts'
import { patchAnimatedUI, renderApp } from './ui/render.ts'
import { ACTION_DURATION_MS } from './data/balance.ts'

let state: GameState = loadGame() ?? structuredClone(initialState)

const SIMULATION_INTERVAL_MS = 250
const RENDER_INTERVAL_MS = 250

type ActionTiming = {
  cooldownStartedAt: number
  cooldownUntil: number
}

type ActionKey = 'gatherWood' | 'gatherMetal'

const actionTiming: Record<ActionKey, ActionTiming> = {
  gatherWood: { cooldownStartedAt: 0, cooldownUntil: 0 },
  gatherMetal: { cooldownStartedAt: 0, cooldownUntil: 0 },
}

let uiTimer: ReturnType<typeof setInterval> | null = null

function hasActiveActionAnimation(now = Date.now()): boolean {
  return Object.values(actionTiming).some((timing) => now < timing.cooldownUntil)
}

function ensureUiAnimationLoop(): void {
  if (uiTimer || !hasActiveActionAnimation()) return
  uiTimer = setInterval(() => {
    redraw(Date.now(), true)
    if (!hasActiveActionAnimation()) {
      clearInterval(uiTimer!)
      uiTimer = null
    }
  }, 60)
}

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
  ensureUiAnimationLoop()
  return now
}

function syncState(now = Date.now()): void {
  advanceState(state, now)
}

function redraw(nowOverride?: number, animationOnly = false): void {
  const now = nowOverride ?? Date.now()

  const actionUI = {
    gatherWood: toActionView('gatherWood', false, now),
    gatherMetal: toActionView('gatherMetal', !state.unlocks.metalAction, now),
  }

  if (animationOnly) {
    patchAnimatedUI(state, actionUI)
    return
  }

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
    },
    actionUI,
  )
}

syncState()
redraw()

setInterval(() => {
  syncState()
}, SIMULATION_INTERVAL_MS)

setInterval(() => {
  redraw()
}, RENDER_INTERVAL_MS)

startAutosave(() => state)

window.addEventListener('beforeunload', () => {
  syncState()
  saveGame(state)
})
