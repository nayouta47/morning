import { BUILDING_CYCLE_MS, WEAPON_CRAFT_DURATION_MS } from '../data/balance.ts'
import type { GameState, ModuleType, WeaponType } from './state.ts'
import { appendLog } from './actions.ts'
import { evaluateUnlocks } from './unlocks.ts'

const MAX_ELAPSED_MS = 24 * 60 * 60 * 1000
const CHROMIUM_CHANCE_PER_SCRAP = 0.008
const MOLYBDENUM_CHANCE_PER_SCRAP = 0.0015

type BuildingKey = 'lumberMill' | 'miner'

type CraftKey = 'pistol' | 'rifle' | 'module' | 'shovel'

function processBuildingElapsed(state: GameState, key: BuildingKey, elapsedMs: number): void {
  const count = state.buildings[key]
  if (count <= 0) {
    state.productionProgress[key] = 0
    return
  }

  state.productionProgress[key] += elapsedMs
  const cycles = Math.floor(state.productionProgress[key] / BUILDING_CYCLE_MS)
  if (cycles <= 0) return

  state.productionProgress[key] -= cycles * BUILDING_CYCLE_MS
  const capacity = cycles * count

  if (key === 'lumberMill') {
    state.resources.wood += capacity
    appendLog(state, `벌목기 생산: 🪵 나무 +${capacity}`)
    return
  }

  const processed = Math.min(capacity, Math.floor(state.resources.scrap))
  if (processed <= 0) return

  state.resources.scrap -= processed
  state.resources.iron += processed

  let chromium = 0
  let molybdenum = 0
  for (let i = 0; i < processed; i += 1) {
    if (Math.random() < CHROMIUM_CHANCE_PER_SCRAP) chromium += 1
    if (Math.random() < MOLYBDENUM_CHANCE_PER_SCRAP) molybdenum += 1
  }

  if (chromium > 0) state.resources.chromium += chromium
  if (molybdenum > 0) state.resources.molybdenum += molybdenum

  const bonusParts: string[] = []
  if (chromium > 0) bonusParts.push(`🧪 크롬 +${chromium}`)
  if (molybdenum > 0) bonusParts.push(`⚙️ 몰리브덴 +${molybdenum}`)

  const bonusText = bonusParts.length > 0 ? ` (${bonusParts.join(', ')})` : ''
  appendLog(state, `분쇄기 처리: 🧰 고물 -${processed}, ⛓️ 철 +${processed}${bonusText}`)
}

function makeWeapon(state: GameState, type: WeaponType): void {
  const prefix = type === 'pistol' ? 'PST' : 'RFL'
  const id = `${prefix}-${String(state.nextWeaponId).padStart(4, '0')}`
  state.nextWeaponId += 1
  state.weapons.push({ id, type, slots: Array.from({ length: 50 }, () => null) })
  if (!state.selectedWeaponId) state.selectedWeaponId = id
  appendLog(state, `${type === 'pistol' ? '권총' : '소총'} 제작 완료: ${id}`)
}

function makeModule(state: GameState, type: ModuleType): void {
  state.modules[type] += 1
  appendLog(state, `모듈 제작 완료: ${type === 'damage' ? '💥 공격력(+1)' : '⏱️ 쿨다운(-1초)'}`)
}

function makeShovel(state: GameState): void {
  state.resources.shovel += 1
  appendLog(state, '🪏 삽 제작 완료: 🪏 삽 +1')
}

function processCraftElapsed(state: GameState, key: CraftKey, elapsedMs: number): void {
  const current = state.craftProgress[key]
  if (current <= 0) return

  state.craftProgress[key] = Math.max(0, current - elapsedMs)
  if (state.craftProgress[key] > 0) return

  if (key === 'module') {
    const type: ModuleType = Math.random() < 0.5 ? 'damage' : 'cooldown'
    makeModule(state, type)
    return
  }

  if (key === 'shovel') {
    makeShovel(state)
    return
  }

  makeWeapon(state, key)
}

export function advanceState(state: GameState, now = Date.now()): void {
  const prev = Number.isFinite(state.lastUpdate) ? state.lastUpdate : now
  const elapsed = Math.max(0, Math.min(MAX_ELAPSED_MS, now - prev))
  state.lastUpdate = now

  if (elapsed <= 0) return

  processBuildingElapsed(state, 'lumberMill', elapsed)
  processBuildingElapsed(state, 'miner', elapsed)

  processCraftElapsed(state, 'pistol', elapsed)
  processCraftElapsed(state, 'rifle', elapsed)
  processCraftElapsed(state, 'module', elapsed)
  processCraftElapsed(state, 'shovel', elapsed)

  const unlockLogs = evaluateUnlocks(state)
  unlockLogs.forEach((line) => appendLog(state, line))
}

export function getCraftRatio(remainingMs: number): number {
  return Math.min(1, Math.max(0, (WEAPON_CRAFT_DURATION_MS - remainingMs) / WEAPON_CRAFT_DURATION_MS))
}
