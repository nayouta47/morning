import { ACTION_DURATION_MS, UPGRADE_DEFS, getUpgradeCost } from '../../data/balance.ts'
import { getBuildingCost, getBuildingLabel, type BuildingId } from '../../data/buildings.ts'
import type { GameState, SmeltingProcessKey, TabKey } from '../state.ts'
import { evaluateUnlocks } from '../unlocks.ts'
import { canAfford, payCost } from './costs.ts'
import { pushLog } from './logging.ts'

type UpgradeKey = keyof typeof UPGRADE_DEFS

function applyUnlocks(state: GameState): void {
  const logs = evaluateUnlocks(state)
  logs.forEach((line) => pushLog(state, line))
}

export { getBuildingCost }

export function gatherWood(state: GameState): void {
  if (state.actionProgress.gatherWood > 0) {
    pushLog(state, '이미 뗄감을 줍는 중입니다.')
    return
  }

  state.actionProgress.gatherWood = ACTION_DURATION_MS.gatherWood
  pushLog(state, `🪵 뗄감 줍기 시작 (${Math.round(ACTION_DURATION_MS.gatherWood / 1000)}초)`)
}

export function gatherScrap(state: GameState): void {
  if (!state.unlocks.scrapAction) {
    pushLog(state, '아직 🗑️ 고물을 주울 방법이 없다.')
    return
  }

  if (state.actionProgress.gatherScrap > 0) {
    pushLog(state, '이미 고물을 줍는 중입니다.')
    return
  }

  state.actionProgress.gatherScrap = ACTION_DURATION_MS.gatherScrap
  pushLog(state, `🗑️ 고물 줍기 시작 (${Math.round(ACTION_DURATION_MS.gatherScrap / 1000)}초)`)
}

export function toggleBuildingRun(state: GameState, key: 'lumberMill' | 'miner' | 'scavenger'): void {
  if (key !== 'scavenger' && state.buildings[key] <= 0) {
    pushLog(state, '설치된 건물이 없습니다.')
    return
  }

  if (key === 'scavenger' && (state.buildings.droneController <= 0 || state.resources.scavengerDrone <= 0)) {
    pushLog(state, '스캐빈저 가동 조건이 부족합니다.')
    return
  }

  state.productionRunning[key] = !state.productionRunning[key]
  const targetLabel = key === 'lumberMill' ? '벌목기' : key === 'miner' ? '분쇄기' : '스캐빈저'
  pushLog(state, `${targetLabel} ${state.productionRunning[key] ? '가동 재개' : '가동 중지'}`)
}

export function buyBuilding(state: GameState, key: BuildingId): void {
  if (key === 'miner' && !state.unlocks.miner) return
  if (
    (key === 'lumberMill' ||
      key === 'workbench' ||
      key === 'lab' ||
      key === 'vehicleRepair' ||
      key === 'droneController' ||
      key === 'electricFurnace') &&
    !state.unlocks.lumberMill
  )
    return

  const singletonBuildings: BuildingId[] = ['lab', 'vehicleRepair', 'workbench', 'droneController']
  if (singletonBuildings.includes(key) && state.buildings[key] >= 1) return

  const cost = getBuildingCost(state, key)
  if (!canAfford(state.resources, cost)) {
    pushLog(state, '자원이 부족합니다.')
    return
  }

  payCost(state.resources, cost)
  state.buildings[key] += 1
  pushLog(state, `${getBuildingLabel(key)} 설치 (${state.buildings[key]})`)
  applyUnlocks(state)
}

export function setSmeltingAllocation(state: GameState, key: SmeltingProcessKey, requestedValue: number): void {
  const nextValue = Math.max(0, Math.floor(requestedValue))
  const owned = Math.max(0, Math.floor(state.buildings.electricFurnace))
  const usedByOthers = (Object.keys(state.smeltingAllocation) as SmeltingProcessKey[])
    .filter((processKey) => processKey !== key)
    .reduce((sum, processKey) => sum + state.smeltingAllocation[processKey], 0)

  state.smeltingAllocation[key] = Math.min(nextValue, Math.max(0, owned - usedByOthers))
}

export function buyUpgrade(state: GameState, key: UpgradeKey): void {
  if (state.buildings.lab <= 0) return
  if (state.upgrades[key]) return

  const def = UPGRADE_DEFS[key]
  const cost = getUpgradeCost(key)
  if (!canAfford(state.resources, cost)) {
    pushLog(state, '자원이 부족합니다.')
    return
  }

  payCost(state.resources, cost)
  state.upgrades[key] = true
  pushLog(state, `연구 완료: ${def.name}`)
}

export function setActiveTab(state: GameState, tab: TabKey): void {
  if (tab === 'exploration' && state.buildings.vehicleRepair <= 0) {
    pushLog(state, '차량 수리를 완료해야 탐험 탭을 사용할 수 있다.')
    return
  }
  if (state.exploration.mode === 'active' && tab !== 'exploration') {
    pushLog(state, '탐험 중에는 다른 탭으로 이동할 수 없다.')
    return
  }
  state.activeTab = tab
}

export function selectWeapon(state: GameState, weaponId: string | null): void {
  state.selectedWeaponId = weaponId
}
