import type { GameState, ModuleType, TabKey, WeaponType } from './state.ts'
import { initialState } from './state.ts'

const SAVE_KEY = 'morning-save-v3'
const AUTOSAVE_MS = 5000

function clampProgress(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return Math.min(999_999, Math.max(0, value))
}

function toWeaponType(value: unknown): WeaponType {
  return value === 'rifle' ? 'rifle' : 'pistol'
}

function inferModuleType(value: unknown): ModuleType {
  if (value === 'damage' || value === 'cooldown') return value
  if (typeof value === 'string') {
    if (value.startsWith('DMG-')) return 'damage'
    if (value.startsWith('CDN-')) return 'cooldown'
  }
  return 'cooldown'
}

function normalizeState(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null

  const base = structuredClone(initialState)
  const loaded = raw as Partial<GameState> & {
    productionProgress?: Partial<GameState['productionProgress']>
    productionRunning?: Partial<GameState['productionRunning']>
    actionProgress?: Partial<GameState['actionProgress']>
    craftProgress?: Partial<GameState['craftProgress']>
    modules?: unknown
  }

  if (loaded.resources) {
    base.resources.wood = Number(loaded.resources.wood ?? base.resources.wood)
    base.resources.scrap = Number(loaded.resources.scrap ?? base.resources.scrap)
    base.resources.iron = Number(loaded.resources.iron ?? base.resources.iron)
    base.resources.chromium = Number(loaded.resources.chromium ?? base.resources.chromium)
    base.resources.molybdenum = Number(loaded.resources.molybdenum ?? base.resources.molybdenum)
    base.resources.shovel = Math.max(0, Number(loaded.resources.shovel ?? base.resources.shovel) || 0)
  }
  if (loaded.buildings) {
    base.buildings.lumberMill = Number(loaded.buildings.lumberMill ?? base.buildings.lumberMill)
    base.buildings.miner = Number(loaded.buildings.miner ?? base.buildings.miner)
    base.buildings.workbench = Number(loaded.buildings.workbench ?? base.buildings.workbench)
    base.buildings.lab = Number(loaded.buildings.lab ?? base.buildings.lab)
  }
  if (loaded.upgrades) {
    base.upgrades.betterAxe = Boolean(loaded.upgrades.betterAxe)
    base.upgrades.sortingWork = Boolean(loaded.upgrades.sortingWork)
    base.upgrades.sharpSaw = Boolean(loaded.upgrades.sharpSaw)
    base.upgrades.drillBoost = Boolean(loaded.upgrades.drillBoost)
  }
  if (loaded.unlocks) {
    base.unlocks.scrapAction = Boolean(loaded.unlocks.scrapAction)
    base.unlocks.lumberMill = Boolean(loaded.unlocks.lumberMill)
    base.unlocks.miner = Boolean(loaded.unlocks.miner)
  }

  base.productionProgress.lumberMill = clampProgress(loaded.productionProgress?.lumberMill)
  base.productionProgress.miner = clampProgress(loaded.productionProgress?.miner)

  base.productionRunning.lumberMill =
    typeof loaded.productionRunning?.lumberMill === 'boolean'
      ? loaded.productionRunning.lumberMill
      : base.productionRunning.lumberMill
  base.productionRunning.miner =
    typeof loaded.productionRunning?.miner === 'boolean' ? loaded.productionRunning.miner : base.productionRunning.miner

  base.actionProgress.gatherWood = clampProgress(loaded.actionProgress?.gatherWood)
  base.actionProgress.gatherScrap = clampProgress(loaded.actionProgress?.gatherScrap)

  base.craftProgress.pistol = clampProgress(loaded.craftProgress?.pistol)
  base.craftProgress.rifle = clampProgress(loaded.craftProgress?.rifle)
  base.craftProgress.module = clampProgress(loaded.craftProgress?.module)
  base.craftProgress.shovel = clampProgress(loaded.craftProgress?.shovel)

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
          if (value == null) return null
          return inferModuleType(value)
        }),
      }))
  }

  if (loaded.modules && typeof loaded.modules === 'object' && !Array.isArray(loaded.modules)) {
    const modules = loaded.modules as Partial<Record<ModuleType, unknown>>
    base.modules.damage = Math.max(0, Number(modules.damage ?? 0) || 0)
    base.modules.cooldown = Math.max(0, Number(modules.cooldown ?? 0) || 0)
  }

  if (Array.isArray(loaded.modules)) {
    loaded.modules.forEach((moduleLike) => {
      const type = inferModuleType((moduleLike as { type?: unknown; id?: unknown })?.type ?? (moduleLike as { id?: unknown })?.id)
      base.modules[type] += 1
    })
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
