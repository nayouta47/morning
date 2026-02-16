import type { ResourceId } from '../data/resources.ts'
import type { BuildingId } from '../data/buildings.ts'

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
}

export type ProductionRunning = {
  lumberMill: boolean
  miner: boolean
}

export type ActionProgress = {
  gatherWood: number
  gatherScrap: number
}

export type TabKey = 'base' | 'assembly'

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
}

export type GameState = {
  resources: Resources
  buildings: Buildings
  upgrades: Upgrades
  unlocks: Unlocks
  productionProgress: ProductionProgress
  productionRunning: ProductionRunning
  actionProgress: ActionProgress
  lastUpdate: number
  log: string[]
  activeTab: TabKey
  selectedWeaponId: string | null
  weapons: WeaponInstance[]
  modules: ModuleStacks
  craftProgress: CraftProgress
  nextWeaponId: number
}

export const initialState: GameState = {
  resources: {
    wood: 0,
    scrap: 0,
    iron: 0,
    chromium: 0,
    molybdenum: 0,
    shovel: 0,
  },
  buildings: {
    lumberMill: 0,
    miner: 0,
    workbench: 0,
    lab: 0,
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
  },
  productionRunning: {
    lumberMill: true,
    miner: true,
  },
  actionProgress: {
    gatherWood: 0,
    gatherScrap: 0,
  },
  lastUpdate: Date.now(),
  log: ['게임 시작. 🪵 나무를 모아보자.'],
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
  },
  nextWeaponId: 1,
}
