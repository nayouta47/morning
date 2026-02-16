import './style.css'
import { buyBuilding, buyUpgrade, gatherMetal, gatherWood } from './core/actions.ts'
import { loadGame, saveGame, startAutosave } from './core/save.ts'
import { initialState, type GameState } from './core/state.ts'
import { runTick, startTicker } from './core/tick.ts'
import { renderApp } from './ui/render.ts'

let state: GameState = loadGame() ?? structuredClone(initialState)

function redraw(): void {
  renderApp(state, {
    onGatherWood: () => {
      gatherWood(state)
      redraw()
    },
    onGatherMetal: () => {
      gatherMetal(state)
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
  })
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
