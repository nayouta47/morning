import { COST_SCALE } from './balance.ts'
import { RESOURCE_IDS, type ResourceCost } from './resources.ts'
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
    label: '금속 프린터',
    unlockRequirements: [] as Requirement[],
    baseCost: { wood: 220, scrap: 50, iron: 30 } as ResourceCost,
    effectsText: '권총/소총/모듈 제작 가능',
  },
  lab: {
    id: 'lab',
    label: '지자 컴퓨터',
    unlockRequirements: [] as Requirement[],
    baseCost: { wood: 120, scrap: 20, iron: 0 } as ResourceCost,
    effectsText: '연구 가능',
  },
  vehicleRepair: {
    id: 'vehicleRepair',
    label: '차량 수리',
    unlockRequirements: [] as Requirement[],
    baseCost: { wood: 500, iron: 10, molybdenum: 1 } as ResourceCost,
    effectsText: '탐험 탭 해금',
  },

  droneController: {
    id: 'droneController',
    label: '드론 컨트롤러',
    unlockRequirements: [] as Requirement[],
    baseCost: { wood: 260, scrap: 90, iron: 45 } as ResourceCost,
    effectsText: '스캐빈저 가동 조건 충족',
  },
  electricFurnace: {
    id: 'electricFurnace',
    label: '전기로',
    unlockRequirements: [] as Requirement[],
    baseCost: { wood: 180, scrap: 120, iron: 80 } as ResourceCost,
    effectsText: '녹이기 공정 배정 가능',
  },
} as const

export type BuildingId = keyof typeof BUILDING_DEFS

export function getBuildingLabel(buildingId: BuildingId): string {
  return BUILDING_DEFS[buildingId].label
}

export function getBuildingCost(state: GameState, buildingId: BuildingId): ResourceCost {
  const count = state.buildings[buildingId]
  const base = BUILDING_DEFS[buildingId].baseCost

  return Object.fromEntries(
    RESOURCE_IDS.map((resourceId) => [resourceId, Math.ceil((base[resourceId] ?? 0) * COST_SCALE ** count)]),
  ) as ResourceCost
}
