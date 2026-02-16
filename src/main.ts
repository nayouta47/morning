import './style.css'
import { buyBuilding, buyUpgrade, gatherMetal, gatherWood } from './core/actions.ts'
import { loadGame, saveGame, startAutosave } from './core/save.ts'
import { initialState, type GameState } from './core/state.ts'
import { runTick, startTicker } from './core/tick.ts'
import { renderApp } from './ui/render.ts'

let state: GameState = loadGame() ?? structuredClone(initialState)

type ActionTiming = {
  castingUntil: number
  cooldownUntil: number
}

type ActionKey = 'gatherWood' | 'gatherMetal'

const CAST_MS = 220
const COOLDOWN_MS = 900

const actionTiming: Record<ActionKey, ActionTiming> = {
  gatherWood: { castingUntil: 0, cooldownUntil: 0 },
  gatherMetal: { castingUntil: 0, cooldownUntil: 0 },
}

let uiTimer: ReturnType<typeof setInterval> | null = null

function hasActiveActionAnimation(now = Date.now()): boolean {
  return Object.values(actionTiming).some((timing) => now < timing.cooldownUntil)
}

function ensureUiAnimationLoop(): void {
  if (uiTimer || !hasActiveActionAnimation()) return
  uiTimer = setInterval(() => {
    redraw()
    if (!hasActiveActionAnimation()) {
      clearInterval(uiTimer!)
      uiTimer = null
    }
  }, 60)
}

function toActionView(key: ActionKey, locked: boolean) {
  if (locked) {
    return {
      phase: 'locked' as const,
      progress: 0,
      disabled: true,
      label: '잠김',
    }
  }

  const now = Date.now()
  const timing = actionTiming[key]

  if (now < timing.castingUntil) {
    const elapsed = 1 - (timing.castingUntil - now) / CAST_MS
    return {
      phase: 'casting' as const,
      progress: elapsed,
      disabled: true,
      label: '진행 중',
    }
  }

  if (now < timing.cooldownUntil) {
    const elapsed = 1 - (timing.cooldownUntil - now) / COOLDOWN_MS
    return {
      phase: 'cooldown' as const,
      progress: elapsed,
      disabled: true,
      label: '재정비',
    }
  }

  return {
    phase: 'ready' as const,
    progress: 1,
    disabled: false,
    label: '준비됨',
  }
}

function triggerActionFeedback(key: ActionKey): void {
  const now = Date.now()
  actionTiming[key].castingUntil = now + CAST_MS
  actionTiming[key].cooldownUntil = now + CAST_MS + COOLDOWN_MS
  ensureUiAnimationLoop()
}

function redraw(): void {
  renderApp(
    state,
    {
      onGatherWood: () => {
        const view = toActionView('gatherWood', false)
        if (view.disabled) return
        gatherWood(state)
        triggerActionFeedback('gatherWood')
        redraw()
      },
      onGatherMetal: () => {
        const view = toActionView('gatherMetal', !state.unlocks.metalAction)
        if (view.disabled) return
        gatherMetal(state)
        triggerActionFeedback('gatherMetal')
        redraw()
      },
      onBuyLumberMill: () => {
        buyBuilding(state, 'lumberMill')
        redraw()
      },
      onBuyMiner: () => {
        buyBuilding(state, 'miner')
        redraw()
      },
      onBuyUpgrade: (key) => {
        buyUpgrade(state, key)
        redraw()
      },
    },
    {
      gatherWood: toActionView('gatherWood', false),
      gatherMetal: toActionView('gatherMetal', !state.unlocks.metalAction),
    },
  )
}

redraw()

startTicker(() => {
  runTick(state)
  redraw()
})

startAutosave(() => state)

window.addEventListener('beforeunload', () => {
  saveGame(state)
})
