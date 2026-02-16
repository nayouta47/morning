export type Resources = {
  wood: number
  scrap: number
  iron: number
  chromium: number
  molybdenum: number
}

export type Buildings = {
  lumberMill: number
  miner: number
}

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
}

export type GameState = {
  resources: Resources
  buildings: Buildings
  upgrades: Upgrades
  unlocks: Unlocks
  productionProgress: ProductionProgress
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
  },
  buildings: {
    lumberMill: 0,
    miner: 0,
  },
  upgrades: {
    betterAxe: false,
    sortingWork: false,
    sharpSaw: false,
    drillBoost: false,
  },
  unlocks: {
    scrapAction: false,
    lumberMill: false,
    miner: false,
  },
  productionProgress: {
    lumberMill: 0,
    miner: 0,
  },
  lastUpdate: Date.now(),
  log: ['게임 시작. 나무를 모아보자.'],
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
  },
  nextWeaponId: 1,
}
