import type { GameState, ModuleType, TabKey, WeaponType } from './state.ts'
import { initialState } from './state.ts'

const SAVE_KEY = 'morning-save-v1'
const AUTOSAVE_MS = 5000

function clampProgress(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return Math.min(999_999, Math.max(0, value))
}

function toWeaponType(value: unknown): WeaponType {
  return value === 'rifle' ? 'rifle' : 'pistol'
}

function inferModuleType(id: string): ModuleType {
  return id.startsWith('DMG-') ? 'damage' : 'cooldown'
}

function normalizeState(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null

  const base = structuredClone(initialState)
  const loaded = raw as Partial<GameState> & {
    productionProgress?: Partial<GameState['productionProgress']>
    craftProgress?: Partial<GameState['craftProgress']>
  }

  if (loaded.resources) {
    base.resources.wood = Number(loaded.resources.wood ?? base.resources.wood)
    base.resources.metal = Number(loaded.resources.metal ?? base.resources.metal)
  }
  if (loaded.buildings) {
    base.buildings.lumberMill = Number(loaded.buildings.lumberMill ?? base.buildings.lumberMill)
    base.buildings.miner = Number(loaded.buildings.miner ?? base.buildings.miner)
  }
  if (loaded.upgrades) {
    base.upgrades.betterAxe = Boolean(loaded.upgrades.betterAxe)
    base.upgrades.sortingWork = Boolean(loaded.upgrades.sortingWork)
    base.upgrades.sharpSaw = Boolean(loaded.upgrades.sharpSaw)
    base.upgrades.drillBoost = Boolean(loaded.upgrades.drillBoost)
  }
  if (loaded.unlocks) {
    base.unlocks.metalAction = Boolean(loaded.unlocks.metalAction)
    base.unlocks.lumberMill = Boolean(loaded.unlocks.lumberMill)
    base.unlocks.miner = Boolean(loaded.unlocks.miner)
  }

  base.productionProgress.lumberMill = clampProgress(loaded.productionProgress?.lumberMill)
  base.productionProgress.miner = clampProgress(loaded.productionProgress?.miner)

  base.craftProgress.pistol = clampProgress(loaded.craftProgress?.pistol)
  base.craftProgress.rifle = clampProgress(loaded.craftProgress?.rifle)
  base.craftProgress.module = clampProgress(loaded.craftProgress?.module)

  const loadedLastUpdate = Number(loaded.lastUpdate)
  base.lastUpdate = Number.isFinite(loadedLastUpdate) && loadedLastUpdate > 0 ? loadedLastUpdate : Date.now()

  if (Array.isArray(loaded.log)) {
    base.log = loaded.log.filter((line): line is string => typeof line === 'string').slice(-30)
    if (base.log.length === 0) base.log = [...initialState.log]
  }

  const activeTab = loaded.activeTab as TabKey
  base.activeTab = activeTab === 'assembly' ? 'assembly' : 'base'

  if (Array.isArray(loaded.weapons)) {
    base.weapons = loaded.weapons
      .filter((w): w is GameState['weapons'][number] => Boolean(w && typeof w.id === 'string'))
      .map((w) => ({
        id: w.id,
        type: toWeaponType(w.type),
        slots: Array.from({ length: 50 }, (_, index) => {
          const value = Array.isArray(w.slots) ? w.slots[index] : null
          return typeof value === 'string' ? value : null
        }),
      }))
  }

  if (Array.isArray(loaded.modules)) {
    base.modules = loaded.modules
      .filter((m): m is GameState['modules'][number] => Boolean(m && typeof m.id === 'string'))
      .map((m) => ({
        id: m.id,
        type: m.type === 'damage' || m.type === 'cooldown' ? m.type : inferModuleType(m.id),
      }))
  }

  base.selectedWeaponId =
    typeof loaded.selectedWeaponId === 'string' && base.weapons.some((w) => w.id === loaded.selectedWeaponId)
      ? loaded.selectedWeaponId
      : base.weapons[0]?.id ?? null

  base.nextWeaponId = Math.max(
    Number(loaded.nextWeaponId) || 1,
    ...base.weapons.map((w) => Number(w.id.split('-')[1]) + 1).filter((n) => Number.isFinite(n)),
    1,
  )
  base.nextModuleId = Math.max(
    Number(loaded.nextModuleId) || 1,
    ...base.modules.map((m) => Number(m.id.split('-')[1]) + 1).filter((n) => Number.isFinite(n)),
    1,
  )

  return base
}

export function saveGame(state: GameState): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state))
}

export function loadGame(): GameState | null {
  const raw = localStorage.getItem(SAVE_KEY)
  if (!raw) return null

  try {
    return normalizeState(JSON.parse(raw))
  } catch {
    return null
  }
}

export function startAutosave(getState: () => GameState): number {
  return window.setInterval(() => {
    saveGame(getState())
  }, AUTOSAVE_MS)
}
