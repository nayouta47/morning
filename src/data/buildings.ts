import { COST_SCALE } from './balance.ts'
import type { ResourceCost } from './resources.ts'
import type { GameState } from '../core/state.ts'
import type { Requirement } from '../core/requirements.ts'

export const BUILDING_DEFS = {
  lumberMill: {
    id: 'lumberMill',
    label: '벌목기',
    unlockRequirements: [] as Requirement[],
    baseCost: { wood: 0, scrap: 10, iron: 0 } as ResourceCost,
    effectsText: '10초마다 뗄감 +설치 수량',
  },
  miner: {
    id: 'miner',
    label: '분쇄기',
    unlockRequirements: [] as Requirement[],
    baseCost: { wood: 200, scrap: 15, iron: 0 } as ResourceCost,
    effectsText: '10초마다 고물 처리 → 철 변환',
  },
  workbench: {
    id: 'workbench',
    label: '제작대',
    unlockRequirements: [] as Requirement[],
    baseCost: { wood: 220, scrap: 50, iron: 30 } as ResourceCost,
    effectsText: '권총/소총/모듈 제작 가능',
  },
  lab: {
    id: 'lab',
    label: '연구대',
    unlockRequirements: [] as Requirement[],
    baseCost: { wood: 120, scrap: 20, iron: 0 } as ResourceCost,
    effectsText: '연구 가능',
  },
} as const

export type BuildingId = keyof typeof BUILDING_DEFS

export function getBuildingLabel(buildingId: BuildingId): string {
  return BUILDING_DEFS[buildingId].label
}

export function getBuildingCost(state: GameState, buildingId: BuildingId): ResourceCost {
  const count = state.buildings[buildingId]
  const base = BUILDING_DEFS[buildingId].baseCost
  return {
    wood: Math.ceil((base.wood ?? 0) * COST_SCALE ** count),
    scrap: Math.ceil((base.scrap ?? 0) * COST_SCALE ** count),
    iron: Math.ceil((base.iron ?? 0) * COST_SCALE ** count),
  }
}
