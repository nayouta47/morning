import type { ResourceId } from '../data/resources.ts'
import type { BuildingId } from '../data/buildings.ts'
import { ENEMY_IDS, type EnemyId } from '../data/enemies.ts'
import { EXPLORATION_MAP } from '../data/maps/index.ts'

export type Resources = Record<ResourceId, number>

export type Buildings = Record<BuildingId, number>

export type Upgrades = {
  betterAxe: boolean
  sortingWork: boolean
  sharpSaw: boolean
  drillBoost: boolean
}

export type Unlocks = {
  scrapAction: boolean
  lumberMill: boolean
  miner: boolean
}

export type ProductionProgress = {
  lumberMill: number
  miner: number
  scavenger: number
}

export type ProductionRunning = {
  lumberMill: boolean
  miner: boolean
  scavenger: boolean
}

export type SmeltingProcessKey = 'burnWood' | 'meltScrap' | 'meltIron' | 'meltSiliconMass'

export type SmeltingAllocation = Record<SmeltingProcessKey, number>
export type SmeltingProgress = Record<SmeltingProcessKey, number>

export type ActionProgress = {
  gatherWood: number
  gatherScrap: number
}

export type TabKey = 'base' | 'assembly' | 'exploration' | 'codex'

export type ExplorationMode = 'loadout' | 'active'
export type ExplorationPhase = 'moving' | 'combat' | 'loot'

export type Position = {
  x: number
  y: number
}

export type LootEntry = {
  resource: ResourceId
  amount: number
}

export type CombatState = {
  enemyId: EnemyId
  enemyName: string
  enemyHp: number
  enemyMaxHp: number
  enemyDamage: number
  enemyAttackCooldownMs: number
  enemyAttackElapsedMs: number
  playerAttackElapsedMs: number
  fleeGaugeDurationMs: number
  fleeGaugeElapsedMs: number
  fleeGaugeRunning: boolean
}

export type EnemyCodexEntry = {
  encountered: boolean
  firstEncounteredAt: number | null
  defeatCount: number
}

export type ExplorationState = {
  mode: ExplorationMode
  phase: ExplorationPhase
  mapSize: number
  hp: number
  maxHp: number
  start: Position
  position: Position
  steps: number
  visited: string[]
  movesSinceEncounter: number
  backpackCapacity: number
  backpack: LootEntry[]
  pendingLoot: LootEntry[]
  carriedWeaponId: string | null
  combat: CombatState | null
}

export type WeaponType = 'pistol' | 'rifle'
export type ModuleType = 'damage' | 'cooldown'

export type WeaponInstance = {
  id: string
  type: WeaponType
  slots: Array<ModuleType | null>
}

export type ModuleStacks = Record<ModuleType, number>

export type CraftProgress = {
  pistol: number
  rifle: number
  module: number
  shovel: number
  scavengerDrone: number
}

export type GameState = {
  resources: Resources
  buildings: Buildings
  upgrades: Upgrades
  unlocks: Unlocks
  productionProgress: ProductionProgress
  productionRunning: ProductionRunning
  smeltingAllocation: SmeltingAllocation
  smeltingProgress: SmeltingProgress
  actionProgress: ActionProgress
  lastUpdate: number
  log: string[]
  activeTab: TabKey
  selectedWeaponId: string | null
  weapons: WeaponInstance[]
  modules: ModuleStacks
  craftProgress: CraftProgress
  nextWeaponId: number
  exploration: ExplorationState
  enemyCodex: Record<EnemyId, EnemyCodexEntry>
}

export const initialState: GameState = {
  resources: {
    wood: 0,
    scrap: 0,
    iron: 0,
    chromium: 0,
    molybdenum: 0,
    cobalt: 0,
    shovel: 0,
    scavengerDrone: 0,
    siliconMass: 0,
    carbon: 0,
    siliconIngot: 0,
    nickel: 0,
    lowAlloySteel: 0,
    highAlloySteel: 0,
  },
  buildings: {
    lumberMill: 0,
    miner: 0,
    workbench: 0,
    lab: 0,
    droneController: 0,
    electricFurnace: 0,
  },
  upgrades: {
    betterAxe: false,
    sortingWork: false,
    sharpSaw: false,
    drillBoost: false,
  },
  unlocks: {
    scrapAction: false,
    lumberMill: true,
    miner: true,
  },
  productionProgress: {
    lumberMill: 0,
    miner: 0,
    scavenger: 0,
  },
  productionRunning: {
    lumberMill: true,
    miner: true,
    scavenger: true,
  },
  smeltingAllocation: {
    burnWood: 0,
    meltScrap: 0,
    meltIron: 0,
    meltSiliconMass: 0,
  },
  smeltingProgress: {
    burnWood: 0,
    meltScrap: 0,
    meltIron: 0,
    meltSiliconMass: 0,
  },
  actionProgress: {
    gatherWood: 0,
    gatherScrap: 0,
  },
  lastUpdate: Date.now(),
  log: ['게임 시작. 🪵 뗄감을 모아보자.'],
  activeTab: 'base',
  selectedWeaponId: null,
  weapons: [],
  modules: {
    damage: 0,
    cooldown: 0,
  },
  craftProgress: {
    pistol: 0,
    rifle: 0,
    module: 0,
    shovel: 0,
    scavengerDrone: 0,
  },
  nextWeaponId: 1,
  exploration: {
    mode: 'loadout',
    phase: 'moving',
    mapSize: EXPLORATION_MAP.size,
    hp: 10,
    maxHp: 10,
    start: { x: EXPLORATION_MAP.start.x, y: EXPLORATION_MAP.start.y },
    position: { x: EXPLORATION_MAP.start.x, y: EXPLORATION_MAP.start.y },
    steps: 0,
    visited: [`${EXPLORATION_MAP.start.x},${EXPLORATION_MAP.start.y}`],
    movesSinceEncounter: 0,
    backpackCapacity: 10,
    backpack: [],
    pendingLoot: [],
    carriedWeaponId: null,
    combat: null,
  },
  enemyCodex: Object.fromEntries(
    ENEMY_IDS.map((enemyId) => [enemyId, { encountered: false, firstEncounteredAt: null, defeatCount: 0 }]),
  ) as Record<EnemyId, EnemyCodexEntry>,
}
