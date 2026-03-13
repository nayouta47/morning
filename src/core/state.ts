import type { ResourceId } from '../data/resources.ts'
import type { BuildingId } from '../data/buildings.ts'
import { ENEMY_IDS, type EnemyId } from '../data/enemies.ts'
import { DEFAULT_ORGANS, type OrganType } from '../data/organs.ts'
import { ANDROID_DEFAULT_PARTS, type AndroidPartSlot } from '../data/androidParts.ts'
export type { OrganType } from '../data/organs.ts'
export type { AndroidPartSlot } from '../data/androidParts.ts'
import { DOG_DEFAULT_ORGANS } from '../data/dogOrgans.ts'
import { EXPLORATION_MAP } from '../data/maps/index.ts'
import { EXPLORATION_BACKPACK_MAX_WEIGHT } from './explorationBackpack.ts'

export type Resources = Record<ResourceId, number>

export type Buildings = Record<BuildingId, number>

export type Upgrades = {
  adoptDog: boolean
  visitHospital: boolean
  comfortRobot: boolean
  betterAxe: boolean
  sortingWork: boolean
  sharpSaw: boolean
  drillBoost: boolean
  organicFilament: boolean
  moduleCraftingII: boolean
  moduleCraftingIII: boolean
  cannedMetalTech: boolean
}

export type Unlocks = {
  scrapAction: boolean
  lumberMill: boolean
  miner: boolean
  electricFurnace: boolean
  droneController: boolean
  lab: boolean
  workbench: boolean
}

export type ProductionProgress = {
  lumberMill: number
  scavenger: number
}

export type ProductionRunning = {
  lumberMill: boolean
  scavenger: boolean
}

export type SmeltingProcessKey = 'burnWood' | 'meltScrap' | 'meltIron' | 'meltSiliconMass'
export type MinerProcessKey = 'crushScrap' | 'crushSiliconMass'

export type SmeltingAllocation = Record<SmeltingProcessKey, number>
export type SmeltingProgress = Record<SmeltingProcessKey, number>
export type SmeltingProcessRunning = Record<SmeltingProcessKey, boolean>
export type MinerAllocation = Record<MinerProcessKey, number>
export type MinerProgress = Record<MinerProcessKey, number>
export type MinerProcessRunning = Record<MinerProcessKey, boolean>

export type ActionProgress = {
  goToWork: number
  gatherWood: number
  gatherScrap: number
  recoverGuideRobot: number
  takeAndroid: number
  goForWalk: number
  contactFamily: number
  cryoSleep: number
}

export type TabKey = 'base' | 'assembly' | 'body' | 'android' | 'exploration' | 'codex' | 'dog'

export type ExplorationMode = 'loadout' | 'active'
export type ExplorationPhase = 'moving' | 'combat' | 'loot' | 'dungeon-entry' | 'floor-entry'

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
  smallHealPotionCooldownRemainingMs: number
}

export type EnemyCodexEntry = {
  encountered: boolean
  firstEncounteredAt: number | null
  defeatCount: number
}

export type ExplorationState = {
  mode: ExplorationMode
  phase: ExplorationPhase
  mapWidth: number
  mapHeight: number
  hp: number
  maxHp: number
  start: Position
  position: Position
  steps: number
  visited: string[]
  movesSinceEncounter: number
  backpackMaxWeight: number
  backpack: LootEntry[]
  pendingLoot: LootEntry[]
  carriedWeaponId: string | null
  combat: CombatState | null
  activeDungeon: { id: string; currentFloor: number } | null
  clearedDungeonIds: string[]
  equippedArmor: ArmorType | null
}

export type ArmorType = 'junkArmor' | 'ironArmor'

export type WeaponType = 'pistol' | 'rifle'
export type ModuleType = 'damage' | 'cooldown' | 'blockAmplifierUp' | 'blockAmplifierDown' | 'preheater' | 'heatAmplifierLeft' | 'heatAmplifierRight' | 'slotUnlocker'
export type ModuleCraftTier = 1 | 2 | 3

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
  syntheticFood: number
  smallHealPotion: number
  junkArmor: number
  ironArmor: number
}

export type GameState = {
  codexRevealAll: boolean
  resources: Resources
  buildings: Buildings
  upgrades: Upgrades
  unlocks: Unlocks
  productionProgress: ProductionProgress
  productionRunning: ProductionRunning
  smeltingAllocation: SmeltingAllocation
  smeltingProgress: SmeltingProgress
  smeltingProcessRunning: SmeltingProcessRunning
  minerAllocation: MinerAllocation
  minerProgress: MinerProgress
  minerProcessRunning: MinerProcessRunning
  actionProgress: ActionProgress
  lastUpdate: number
  messages: string[]
  activeTab: TabKey
  selectedWeaponId: string | null
  weapons: WeaponInstance[]
  modules: ModuleStacks
  craftProgress: CraftProgress
  nextWeaponId: number
  gatherScrapRewardRemainderSevenths: number
  exploration: ExplorationState
  enemyCodex: Record<EnemyId, EnemyCodexEntry>
  selectedModuleCraftTier: ModuleCraftTier
  moduleCraftTierInProgress: ModuleCraftTier | null
  selectedArmorCraftType: ArmorType
  dogName: string | null
  needsDogNaming: boolean
  walkCount: number
  collapseEventDismissed: boolean
  terminalIllnessEventDismissed: boolean
  timePassedEventDismissed: boolean
  goToWorkPostEventCount: number
  relapseEventDismissed: boolean
  robotName: string | null
  needsRobotNaming: boolean
  isGuideRobotRecovered: boolean
  ownerlessThingTriggered: boolean
  isAndroidRecovered: boolean
  tailorEndTriggered: boolean
  tailorEndDismissed: boolean
  rubyEquipped: boolean
  companionScrapGatherCount: number
  companionIdleRemainingMs: number
  companionIsAutoGathering: boolean
  equippedOrgans: Record<OrganType, string>
  selectedOrganSlot: OrganType | null
  equippedDogOrgans: Record<OrganType, string>
  selectedDogOrganSlot: OrganType | null
  equippedAndroidParts: Record<AndroidPartSlot, string | null>
  selectedAndroidPartSlot: AndroidPartSlot | null
}

export const initialState: GameState = {
  codexRevealAll: false,
  resources: {
    cash: 0,
    wood: 0,
    scrap: 0,
    iron: 0,
    chromium: 0,
    molybdenum: 0,
    cobalt: 0,
    shovel: 0,
    scavengerDrone: 0,
    syntheticFood: 0,
    smallHealPotion: 0,
    siliconMass: 0,
    carbon: 0,
    siliconIngot: 0,
    nickel: 0,
    lowAlloySteel: 0,
    highAlloySteel: 0,
    junkArmor: 0,
    ironArmor: 0,
  },
  buildings: {
    lumberMill: 0,
    miner: 0,
    workbench: 0,
    lab: 0,
    laikaRepair: 0,
    droneController: 0,
    electricFurnace: 0,
  },
  upgrades: {
    adoptDog: false,
    visitHospital: false,
    comfortRobot: false,
    betterAxe: false,
    sortingWork: false,
    sharpSaw: false,
    drillBoost: false,
    organicFilament: false,
    moduleCraftingII: false,
    moduleCraftingIII: false,
    cannedMetalTech: false,
  },
  unlocks: {
    scrapAction: false,
    lumberMill: true,
    miner: true,
    electricFurnace: false,
    droneController: false,
    lab: false,
    workbench: false,
  },
  productionProgress: {
    lumberMill: 0,
    scavenger: 0,
  },
  productionRunning: {
    lumberMill: true,
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
  smeltingProcessRunning: {
    burnWood: true,
    meltScrap: true,
    meltIron: true,
    meltSiliconMass: true,
  },
  minerAllocation: {
    crushScrap: 0,
    crushSiliconMass: 0,
  },
  minerProgress: {
    crushScrap: 0,
    crushSiliconMass: 0,
  },
  minerProcessRunning: {
    crushScrap: true,
    crushSiliconMass: true,
  },
  actionProgress: {
    goToWork: 0,
    gatherWood: 0,
    gatherScrap: 0,
    recoverGuideRobot: 0,
    takeAndroid: 0,
    goForWalk: 0,
    contactFamily: 0,
    cryoSleep: 0,
  },
  lastUpdate: Date.now(),
  messages: ['게임 시작. 직장에 가자.'],
  activeTab: 'base',
  selectedWeaponId: null,
  weapons: [],
  modules: {
    damage: 0,
    cooldown: 0,
    blockAmplifierUp: 0,
    blockAmplifierDown: 0,
    preheater: 0,
    heatAmplifierLeft: 0,
    heatAmplifierRight: 0,
    slotUnlocker: 0,
  },
  craftProgress: {
    pistol: 0,
    rifle: 0,
    module: 0,
    shovel: 0,
    scavengerDrone: 0,
    syntheticFood: 0,
    smallHealPotion: 0,
    junkArmor: 0,
    ironArmor: 0,
  },
  nextWeaponId: 1,
  gatherScrapRewardRemainderSevenths: 0,
  exploration: {
    mode: 'loadout',
    phase: 'moving',
    mapWidth: EXPLORATION_MAP.width,
    mapHeight: EXPLORATION_MAP.height,
    hp: 10,
    maxHp: 10,
    start: { x: EXPLORATION_MAP.start.x, y: EXPLORATION_MAP.start.y },
    position: { x: EXPLORATION_MAP.start.x, y: EXPLORATION_MAP.start.y },
    steps: 0,
    visited: [`${EXPLORATION_MAP.start.x},${EXPLORATION_MAP.start.y}`],
    movesSinceEncounter: 0,
    backpackMaxWeight: EXPLORATION_BACKPACK_MAX_WEIGHT,
    backpack: [],
    pendingLoot: [],
    carriedWeaponId: null,
    combat: null,
    activeDungeon: null,
    clearedDungeonIds: [],
    equippedArmor: null,
  },
  enemyCodex: Object.fromEntries(
    ENEMY_IDS.map((enemyId) => [enemyId, { encountered: false, firstEncounteredAt: null, defeatCount: 0 }]),
  ) as Record<EnemyId, EnemyCodexEntry>,
  selectedModuleCraftTier: 1,
  moduleCraftTierInProgress: null,
  selectedArmorCraftType: 'junkArmor',
  dogName: null,
  needsDogNaming: false,
  walkCount: 0,
  collapseEventDismissed: false,
  terminalIllnessEventDismissed: false,
  timePassedEventDismissed: false,
  goToWorkPostEventCount: 0,
  relapseEventDismissed: false,
  robotName: null,
  needsRobotNaming: false,
  isGuideRobotRecovered: false,
  ownerlessThingTriggered: false,
  isAndroidRecovered: false,
  tailorEndTriggered: false,
  tailorEndDismissed: false,
  rubyEquipped: false,
  companionScrapGatherCount: 0,
  companionIdleRemainingMs: 0,
  companionIsAutoGathering: false,
  equippedOrgans: { ...DEFAULT_ORGANS },
  selectedOrganSlot: null,
  equippedDogOrgans: { ...DOG_DEFAULT_ORGANS },
  selectedDogOrganSlot: null,
  equippedAndroidParts: { ...ANDROID_DEFAULT_PARTS },
  selectedAndroidPartSlot: null,
}
