export type Resources = {
  wood: number
  metal: number
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
  metalAction: boolean
  lumberMill: boolean
  miner: boolean
}

export type ProductionProgress = {
  lumberMill: number
  miner: number
}

export type GameState = {
  resources: Resources
  buildings: Buildings
  upgrades: Upgrades
  unlocks: Unlocks
  productionProgress: ProductionProgress
  log: string[]
}

export const initialState: GameState = {
  resources: {
    wood: 0,
    metal: 0,
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
    metalAction: false,
    lumberMill: false,
    miner: false,
  },
  productionProgress: {
    lumberMill: 0,
    miner: 0,
  },
  log: ['게임 시작. 나무를 모아보자.'],
}
