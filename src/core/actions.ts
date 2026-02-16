import {
  BUILDING_BASE_COST,
  COST_SCALE,
  MODULE_CRAFT_COST,
  UPGRADE_DEFS,
  WEAPON_CRAFT_COST,
  WEAPON_CRAFT_DURATION_MS,
  getUpgradeCost,
} from '../data/balance.ts'
import type { GameState, ModuleType, Resources, TabKey, WeaponType } from './state.ts'
import { evaluateUnlocks } from './unlocks.ts'

type BuildingKey = keyof typeof BUILDING_BASE_COST
type UpgradeKey = keyof typeof UPGRADE_DEFS

function pushLog(state: GameState, text: string): void {
  state.log.push(text)
  if (state.log.length > 30) {
    state.log.splice(0, state.log.length - 30)
  }
}

function canAfford(resources: Resources, cost: Resources): boolean {
  return resources.wood >= cost.wood && resources.metal >= cost.metal
}

function payCost(resources: Resources, cost: Resources): void {
  resources.wood -= cost.wood
  resources.metal -= cost.metal
}

export function getBuildingCost(state: GameState, key: BuildingKey): Resources {
  const count = state.buildings[key]
  const base = BUILDING_BASE_COST[key]
  return {
    wood: Math.ceil(base.wood * COST_SCALE ** count),
    metal: Math.ceil(base.metal * COST_SCALE ** count),
  }
}

function applyUnlocks(state: GameState): void {
  const logs = evaluateUnlocks(state)
  logs.forEach((line) => pushLog(state, line))
}

export function gatherWood(state: GameState): void {
  const amount = 1 + (state.upgrades.betterAxe ? 1 : 0)
  state.resources.wood += amount
  pushLog(state, `나무 +${amount}`)
  applyUnlocks(state)
}

export function gatherMetal(state: GameState): void {
  if (!state.unlocks.metalAction) {
    pushLog(state, '아직 금속을 찾을 방법이 없다.')
    return
  }

  const amount = 1 + (state.upgrades.sortingWork ? 1 : 0)
  state.resources.metal += amount
  pushLog(state, `금속 +${amount}`)
  applyUnlocks(state)
}

export function buyBuilding(state: GameState, key: BuildingKey): void {
  const unlocked = key === 'lumberMill' ? state.unlocks.lumberMill : state.unlocks.miner
  if (!unlocked) return

  const cost = getBuildingCost(state, key)
  if (!canAfford(state.resources, cost)) {
    pushLog(state, '자원이 부족합니다.')
    return
  }

  payCost(state.resources, cost)
  state.buildings[key] += 1
  const name = key === 'lumberMill' ? '벌목소' : '채굴기'
  pushLog(state, `${name} 건설 (${state.buildings[key]})`)
  applyUnlocks(state)
}

export function buyUpgrade(state: GameState, key: UpgradeKey): void {
  if (state.upgrades[key]) return

  const def = UPGRADE_DEFS[key]
  const cost = getUpgradeCost(key)
  if (!canAfford(state.resources, cost)) {
    pushLog(state, '자원이 부족합니다.')
    return
  }

  payCost(state.resources, cost)
  state.upgrades[key] = true
  pushLog(state, `업그레이드 완료: ${def.name}`)
}

export function setActiveTab(state: GameState, tab: TabKey): void {
  state.activeTab = tab
}

export function selectWeapon(state: GameState, weaponId: string | null): void {
  state.selectedWeaponId = weaponId
}

export function startWeaponCraft(state: GameState, type: WeaponType): void {
  if (state.craftProgress[type] > 0) {
    pushLog(state, '이미 제작 중입니다.')
    return
  }

  const cost = WEAPON_CRAFT_COST[type]
  if (!canAfford(state.resources, cost)) {
    pushLog(state, '자원이 부족합니다.')
    return
  }

  payCost(state.resources, cost)
  state.craftProgress[type] = WEAPON_CRAFT_DURATION_MS
  pushLog(state, `${type === 'pistol' ? '권총' : '소총'} 제작 시작 (30초)`)
}

export function startModuleCraft(state: GameState): void {
  if (state.craftProgress.module > 0) {
    pushLog(state, '이미 제작 중입니다.')
    return
  }

  if (!canAfford(state.resources, MODULE_CRAFT_COST)) {
    pushLog(state, '자원이 부족합니다.')
    return
  }

  payCost(state.resources, MODULE_CRAFT_COST)
  state.craftProgress.module = WEAPON_CRAFT_DURATION_MS
  pushLog(state, '모듈 제작 시작 (30초)')
}

export function equipModuleToSlot(state: GameState, weaponId: string, moduleId: string, slotIndex: number): boolean {
  const weapon = state.weapons.find((w) => w.id === weaponId)
  if (!weapon) return false
  const moduleIndex = state.modules.findIndex((m) => m.id === moduleId)
  if (moduleIndex < 0) return false
  if (slotIndex < 0 || slotIndex >= weapon.slots.length) return false
  if (weapon.slots[slotIndex]) return false

  weapon.slots[slotIndex] = moduleId
  const [mod] = state.modules.splice(moduleIndex, 1)
  pushLog(state, `장착: ${mod.type === 'damage' ? '공격력 모듈(+1)' : '쿨다운 모듈(-1초)'} -> ${weapon.id} [${slotIndex + 1}]`)
  return true
}

export function unequipModuleFromSlot(state: GameState, weaponId: string, slotIndex: number): boolean {
  const weapon = state.weapons.find((w) => w.id === weaponId)
  if (!weapon) return false
  if (slotIndex < 0 || slotIndex >= weapon.slots.length) return false

  const moduleId = weapon.slots[slotIndex]
  if (!moduleId) return false

  weapon.slots[slotIndex] = null
  const type: ModuleType = moduleId.startsWith('DMG-') ? 'damage' : 'cooldown'
  state.modules.push({ id: moduleId, type })
  pushLog(state, `해제: ${weapon.id} [${slotIndex + 1}] -> 모듈 인벤토리`)
  return true
}

export function appendLog(state: GameState, text: string): void {
  pushLog(state, text)
}
