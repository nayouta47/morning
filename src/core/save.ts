import type { GameState, ModuleType, TabKey, WeaponType } from './state.ts'
import { initialState } from './state.ts'
import { SHOVEL_MAX_STACK } from './rewards.ts'
import { DEFAULT_ENEMY_ID } from './combat.ts'
import { ENEMY_IDS, type EnemyId } from '../data/enemies.ts'
import { EXPLORATION_MAP } from '../data/maps/index.ts'

const SAVE_KEY = 'morning-save-v4'
const AUTOSAVE_MS = 5000

function clampProgress(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return Math.min(999_999, Math.max(0, value))
}

function toWeaponType(value: unknown): WeaponType {
  return value === 'rifle' ? 'rifle' : 'pistol'
}

function inferModuleType(value: unknown): ModuleType {
  if (value === 'damage' || value === 'cooldown' || value === 'amplifier') return value
  if (typeof value === 'string') {
    if (value.startsWith('DMG-')) return 'damage'
    if (value.startsWith('CDN-')) return 'cooldown'
    if (value.startsWith('AMP-')) return 'amplifier'
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
    smeltingAllocation?: Partial<GameState['smeltingAllocation']>
    smeltingProgress?: Partial<GameState['smeltingProgress']>
    smeltingProcessRunning?: Partial<GameState['smeltingProcessRunning']>
    minerAllocation?: Partial<GameState['minerAllocation']>
    minerProgress?: Partial<GameState['minerProgress']>
    minerProcessRunning?: Partial<GameState['minerProcessRunning']>
    craftProgress?: Partial<GameState['craftProgress']>
    modules?: unknown
    exploration?: unknown
    enemyCodex?: unknown
    gatherScrapRewardRemainderSevenths?: unknown
  }

  if (loaded.resources) {
    base.resources.wood = Number(loaded.resources.wood ?? base.resources.wood)
    base.resources.scrap = Number(loaded.resources.scrap ?? base.resources.scrap)
    base.resources.iron = Number(loaded.resources.iron ?? base.resources.iron)
    base.resources.chromium = Number(loaded.resources.chromium ?? base.resources.chromium)
    base.resources.molybdenum = Number(loaded.resources.molybdenum ?? base.resources.molybdenum)
    base.resources.cobalt = Number(loaded.resources.cobalt ?? base.resources.cobalt)
    base.resources.shovel = Math.min(SHOVEL_MAX_STACK, Math.max(0, Number(loaded.resources.shovel ?? base.resources.shovel) || 0))
    base.resources.scavengerDrone = Math.max(0, Number(loaded.resources.scavengerDrone ?? base.resources.scavengerDrone) || 0)
    base.resources.smallHealPotion = Math.max(0, Number(loaded.resources.smallHealPotion ?? base.resources.smallHealPotion) || 0)
    base.resources.siliconMass = Math.max(0, Number(loaded.resources.siliconMass ?? base.resources.siliconMass) || 0)
    base.resources.carbon = Math.max(0, Number(loaded.resources.carbon ?? base.resources.carbon) || 0)
    base.resources.siliconIngot = Math.max(0, Number(loaded.resources.siliconIngot ?? base.resources.siliconIngot) || 0)
    base.resources.nickel = Math.max(0, Number(loaded.resources.nickel ?? base.resources.nickel) || 0)
    base.resources.lowAlloySteel = Math.max(0, Number(loaded.resources.lowAlloySteel ?? base.resources.lowAlloySteel) || 0)
    base.resources.highAlloySteel = Math.max(0, Number(loaded.resources.highAlloySteel ?? base.resources.highAlloySteel) || 0)
  }
  if (loaded.buildings) {
    const legacyBuildings = loaded.buildings as Partial<Record<string, unknown>>
    const legacyVehicleRepair = Number(legacyBuildings.vehicleRepair ?? 0)

    base.buildings.lumberMill = Number(loaded.buildings.lumberMill ?? base.buildings.lumberMill)
    base.buildings.miner = Number(loaded.buildings.miner ?? base.buildings.miner)
    base.buildings.workbench = Number(loaded.buildings.workbench ?? base.buildings.workbench)
    base.buildings.lab = Number(loaded.buildings.lab ?? base.buildings.lab)
    base.buildings.laikaRepair = Math.max(
      Number(loaded.buildings.laikaRepair ?? base.buildings.laikaRepair),
      Number.isFinite(legacyVehicleRepair) ? legacyVehicleRepair : 0,
    )
    base.buildings.droneController = Number(loaded.buildings.droneController ?? base.buildings.droneController)
    base.buildings.electricFurnace = Number(loaded.buildings.electricFurnace ?? base.buildings.electricFurnace)
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
  base.productionProgress.scavenger = clampProgress(loaded.productionProgress?.scavenger)

  base.productionRunning.lumberMill =
    typeof loaded.productionRunning?.lumberMill === 'boolean'
      ? loaded.productionRunning.lumberMill
      : base.productionRunning.lumberMill
  base.productionRunning.scavenger =
    typeof loaded.productionRunning?.scavenger === 'boolean' ? loaded.productionRunning.scavenger : base.productionRunning.scavenger


  const legacyMinerRunningRaw = (loaded as { productionRunning?: { miner?: unknown } }).productionRunning?.miner
  const legacyMinerRunning = typeof legacyMinerRunningRaw === 'boolean' ? legacyMinerRunningRaw : null
  base.minerProcessRunning.crushScrap =
    typeof loaded.minerProcessRunning?.crushScrap === 'boolean'
      ? loaded.minerProcessRunning.crushScrap
      : (legacyMinerRunning ?? base.minerProcessRunning.crushScrap)
  base.minerProcessRunning.crushSiliconMass =
    typeof loaded.minerProcessRunning?.crushSiliconMass === 'boolean'
      ? loaded.minerProcessRunning.crushSiliconMass
      : (legacyMinerRunning ?? base.minerProcessRunning.crushSiliconMass)

  base.actionProgress.gatherWood = clampProgress(loaded.actionProgress?.gatherWood)
  base.actionProgress.gatherScrap = clampProgress(loaded.actionProgress?.gatherScrap)

  base.smeltingAllocation.burnWood = Math.max(0, Math.floor(Number(loaded.smeltingAllocation?.burnWood) || 0))
  base.smeltingAllocation.meltScrap = Math.max(0, Math.floor(Number(loaded.smeltingAllocation?.meltScrap) || 0))
  base.smeltingAllocation.meltIron = Math.max(0, Math.floor(Number(loaded.smeltingAllocation?.meltIron) || 0))
  base.smeltingAllocation.meltSiliconMass = Math.max(0, Math.floor(Number(loaded.smeltingAllocation?.meltSiliconMass) || 0))

  const furnaceCount = Math.max(0, Math.floor(base.buildings.electricFurnace))
  const totalAllocation =
    base.smeltingAllocation.burnWood +
    base.smeltingAllocation.meltScrap +
    base.smeltingAllocation.meltIron +
    base.smeltingAllocation.meltSiliconMass
  if (totalAllocation > furnaceCount) {
    let overflow = totalAllocation - furnaceCount
    ;(['meltSiliconMass', 'meltIron', 'meltScrap', 'burnWood'] as const).forEach((key) => {
      if (overflow <= 0) return
      const cut = Math.min(base.smeltingAllocation[key], overflow)
      base.smeltingAllocation[key] -= cut
      overflow -= cut
    })
  }

  base.smeltingProgress.burnWood = clampProgress(loaded.smeltingProgress?.burnWood)
  base.smeltingProgress.meltScrap = clampProgress(loaded.smeltingProgress?.meltScrap)
  base.smeltingProgress.meltIron = clampProgress(loaded.smeltingProgress?.meltIron)
  base.smeltingProgress.meltSiliconMass = clampProgress(loaded.smeltingProgress?.meltSiliconMass)

  base.smeltingProcessRunning.burnWood =
    typeof loaded.smeltingProcessRunning?.burnWood === 'boolean'
      ? loaded.smeltingProcessRunning.burnWood
      : base.smeltingProcessRunning.burnWood
  base.smeltingProcessRunning.meltScrap =
    typeof loaded.smeltingProcessRunning?.meltScrap === 'boolean'
      ? loaded.smeltingProcessRunning.meltScrap
      : base.smeltingProcessRunning.meltScrap
  base.smeltingProcessRunning.meltIron =
    typeof loaded.smeltingProcessRunning?.meltIron === 'boolean'
      ? loaded.smeltingProcessRunning.meltIron
      : base.smeltingProcessRunning.meltIron
  base.smeltingProcessRunning.meltSiliconMass =
    typeof loaded.smeltingProcessRunning?.meltSiliconMass === 'boolean'
      ? loaded.smeltingProcessRunning.meltSiliconMass
      : base.smeltingProcessRunning.meltSiliconMass

  base.minerAllocation.crushScrap = Math.max(0, Math.floor(Number(loaded.minerAllocation?.crushScrap) || 0))
  base.minerAllocation.crushSiliconMass = Math.max(0, Math.floor(Number(loaded.minerAllocation?.crushSiliconMass) || 0))


  base.minerProgress.crushScrap = clampProgress(loaded.minerProgress?.crushScrap)
  base.minerProgress.crushSiliconMass = clampProgress(loaded.minerProgress?.crushSiliconMass)

  const minerCount = Math.max(0, Math.floor(base.buildings.miner))
  const minerTotalAllocation = base.minerAllocation.crushScrap + base.minerAllocation.crushSiliconMass
  if (minerTotalAllocation <= 0 && minerCount > 0) {
    base.minerAllocation.crushScrap = minerCount
  } else if (minerTotalAllocation > minerCount) {
    let overflow = minerTotalAllocation - minerCount
    const cutSilicon = Math.min(base.minerAllocation.crushSiliconMass, overflow)
    base.minerAllocation.crushSiliconMass -= cutSilicon
    overflow -= cutSilicon
    if (overflow > 0) base.minerAllocation.crushScrap = Math.max(0, base.minerAllocation.crushScrap - overflow)
  }

  base.craftProgress.pistol = clampProgress(loaded.craftProgress?.pistol)
  base.craftProgress.rifle = clampProgress(loaded.craftProgress?.rifle)
  base.craftProgress.module = clampProgress(loaded.craftProgress?.module)
  base.craftProgress.shovel = clampProgress(loaded.craftProgress?.shovel)
  base.craftProgress.scavengerDrone = clampProgress(loaded.craftProgress?.scavengerDrone)
  base.craftProgress.smallHealPotion = clampProgress(loaded.craftProgress?.smallHealPotion)

  const loadedLastUpdate = Number(loaded.lastUpdate)
  base.lastUpdate = Number.isFinite(loadedLastUpdate) && loadedLastUpdate > 0 ? loadedLastUpdate : Date.now()

  if (Array.isArray(loaded.log)) {
    base.log = loaded.log.filter((line): line is string => typeof line === 'string').slice(-30)
    if (base.log.length === 0) base.log = [...initialState.log]
  }

  const activeTab = loaded.activeTab as TabKey
  base.activeTab = activeTab === 'assembly' || activeTab === 'exploration' || activeTab === 'codex' ? activeTab : 'base'

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
    base.modules.amplifier = Math.max(0, Number(modules.amplifier ?? 0) || 0)
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

  base.gatherScrapRewardRemainderSevenths = Math.max(
    0,
    Math.min(6, Math.floor(Number(loaded.gatherScrapRewardRemainderSevenths ?? 0) || 0)),
  )

  ENEMY_IDS.forEach((enemyId) => {
    const rawEntry = (loaded.enemyCodex as Partial<Record<EnemyId, unknown>> | undefined)?.[enemyId]
    if (!rawEntry || typeof rawEntry !== 'object') return
    const entry = rawEntry as Partial<GameState['enemyCodex'][EnemyId]>
    base.enemyCodex[enemyId] = {
      encountered: Boolean(entry.encountered),
      firstEncounteredAt:
        typeof entry.firstEncounteredAt === 'number' && Number.isFinite(entry.firstEncounteredAt)
          ? entry.firstEncounteredAt
          : null,
      defeatCount: Math.max(0, Math.floor(Number(entry.defeatCount) || 0)),
    }
  })

  if (loaded.exploration && typeof loaded.exploration === 'object') {
    const exploration = loaded.exploration as Partial<GameState['exploration']>
    base.exploration.mode = exploration.mode === 'active' ? 'active' : 'loadout'
    base.exploration.phase = exploration.phase === 'combat' || exploration.phase === 'loot' ? exploration.phase : 'moving'
    base.exploration.mapSize = Number.isFinite(Number(exploration.mapSize))
      ? Math.max(8, Number(exploration.mapSize))
      : EXPLORATION_MAP.size
    base.exploration.maxHp = Math.max(1, Number(exploration.maxHp) || 10)
    base.exploration.hp = Math.min(base.exploration.maxHp, Math.max(0, Number(exploration.hp) || base.exploration.maxHp))
    base.exploration.movesSinceEncounter = Math.max(0, Math.floor(Number(exploration.movesSinceEncounter) || 0))
    base.exploration.backpackCapacity = 10
    if (Array.isArray(exploration.backpack)) {
      base.exploration.backpack = exploration.backpack
        .filter((entry): entry is { resource: keyof GameState['resources']; amount: number } =>
          Boolean(entry && typeof entry.resource === 'string' && typeof entry.amount === 'number' && entry.amount > 0),
        )
        .map((entry) => ({ resource: entry.resource, amount: Math.floor(entry.amount) }))
    }
    if (Array.isArray(exploration.pendingLoot)) {
      base.exploration.pendingLoot = exploration.pendingLoot
        .filter((entry): entry is { resource: keyof GameState['resources']; amount: number } =>
          Boolean(entry && typeof entry.resource === 'string' && typeof entry.amount === 'number' && entry.amount > 0),
        )
        .map((entry) => ({ resource: entry.resource, amount: Math.floor(entry.amount) }))
    }
    base.exploration.carriedWeaponId = typeof exploration.carriedWeaponId === 'string' ? exploration.carriedWeaponId : null

    const clampPos = (value: unknown, fallback: number) =>
      Math.max(0, Math.min(base.exploration.mapSize - 1, Number(value) || fallback))
    base.exploration.start = {
      x: clampPos(exploration.start?.x, EXPLORATION_MAP.start.x),
      y: clampPos(exploration.start?.y, EXPLORATION_MAP.start.y),
    }
    base.exploration.position = {
      x: clampPos(exploration.position?.x, base.exploration.start.x),
      y: clampPos(exploration.position?.y, base.exploration.start.y),
    }
    base.exploration.steps = Math.max(0, Math.floor(Number(exploration.steps) || 0))

    if (Array.isArray(exploration.visited)) {
      base.exploration.visited = exploration.visited
        .filter((value): value is string => typeof value === 'string' && value.includes(','))
        .slice(-4096)
    }

    if (exploration.combat && typeof exploration.combat === 'object') {
      base.exploration.combat = {
        enemyId: ENEMY_IDS.includes(exploration.combat.enemyId as EnemyId)
          ? (exploration.combat.enemyId as EnemyId)
          : DEFAULT_ENEMY_ID,
        enemyName: typeof exploration.combat.enemyName === 'string' ? exploration.combat.enemyName : '벌벌떠는 기인',
        enemyHp: Math.max(0, Number(exploration.combat.enemyHp) || 0),
        enemyMaxHp: Math.max(1, Number(exploration.combat.enemyMaxHp) || 20),
        enemyDamage: Math.max(1, Number(exploration.combat.enemyDamage) || 2),
        enemyAttackCooldownMs: Math.max(500, Number(exploration.combat.enemyAttackCooldownMs) || 3000),
        enemyAttackElapsedMs: Math.max(0, Number(exploration.combat.enemyAttackElapsedMs) || 0),
        playerAttackElapsedMs: Math.max(0, Number(exploration.combat.playerAttackElapsedMs) || 0),
        fleeGaugeDurationMs: Math.max(500, Number(exploration.combat.fleeGaugeDurationMs) || 2500),
        fleeGaugeElapsedMs: Math.max(0, Number(exploration.combat.fleeGaugeElapsedMs) || 0),
        fleeGaugeRunning: Boolean(exploration.combat.fleeGaugeRunning),
        smallHealPotionCooldownRemainingMs: Math.max(0, Number(exploration.combat.smallHealPotionCooldownRemainingMs) || 0),
      }
    }

    const startKey = `${base.exploration.start.x},${base.exploration.start.y}`
    if (!base.exploration.visited.includes(startKey)) base.exploration.visited.push(startKey)
  }

  if (base.buildings.workbench <= 0 && base.activeTab === 'assembly') {
    base.activeTab = 'base'
  }

  if (base.buildings.lab <= 0 && base.activeTab === 'codex') {
    base.activeTab = 'base'
  }

  if (base.buildings.laikaRepair <= 0) {
    if (base.activeTab === 'exploration') base.activeTab = 'base'
    if (base.exploration.mode === 'active') {
      base.exploration.mode = 'loadout'
      base.exploration.phase = 'moving'
      base.exploration.pendingLoot = []
      base.exploration.backpack = []
      base.exploration.combat = null
      base.exploration.carriedWeaponId = null
    }
  } else if (base.exploration.mode === 'active') {
    base.activeTab = 'exploration'
  }

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
