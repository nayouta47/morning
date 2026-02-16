import {
  BUILDING_BASE_COST,
  COST_SCALE,
  MODULE_CRAFT_COST,
  SHOVEL_CRAFT_COST,
  UPGRADE_DEFS,
  WEAPON_CRAFT_COST,
  WEAPON_CRAFT_DURATION_MS,
  getUpgradeCost,
} from '../data/balance.ts'
import type { GameState, ModuleType, Resources, TabKey, WeaponType } from './state.ts'
import { evaluateUnlocks } from './unlocks.ts'
import { isCraftRecipeUnlocked } from '../data/crafting.ts'

type BuildingKey = keyof typeof BUILDING_BASE_COST
type UpgradeKey = keyof typeof UPGRADE_DEFS
type CostLike = Partial<Record<keyof Resources, number>>

function pushLog(state: GameState, text: string): void {
  state.log.push(text)
  if (state.log.length > 30) {
    state.log.splice(0, state.log.length - 30)
  }
}

function canAfford(resources: Resources, cost: CostLike): boolean {
  return Object.entries(cost).every(([key, value]) => {
    if (!value || value <= 0) return true
    return resources[key as keyof Resources] >= value
  })
}

function payCost(resources: Resources, cost: CostLike): void {
  Object.entries(cost).forEach(([key, value]) => {
    if (!value || value <= 0) return
    resources[key as keyof Resources] -= value
  })
}

function moduleName(type: ModuleType): string {
  return type === 'damage' ? '공격력 모듈(+1)' : '쿨다운 모듈(-1초)'
}

function getBuildingName(key: BuildingKey): string {
  if (key === 'lumberMill') return '벌목기'
  if (key === 'miner') return '분쇄기'
  if (key === 'workbench') return '제작대'
  return '실험실'
}

export function getBuildingCost(state: GameState, key: BuildingKey): CostLike {
  const count = state.buildings[key]
  const base = BUILDING_BASE_COST[key]
  return {
    wood: Math.ceil(base.wood * COST_SCALE ** count),
    scrap: Math.ceil(base.scrap * COST_SCALE ** count),
    iron: Math.ceil(base.iron * COST_SCALE ** count),
  }
}

function applyUnlocks(state: GameState): void {
  const logs = evaluateUnlocks(state)
  logs.forEach((line) => pushLog(state, line))
}

export function gatherWood(state: GameState): void {
  const amount = 6 + (state.upgrades.betterAxe ? 1 : 0)
  state.resources.wood += amount
  pushLog(state, `🪵 나무 +${amount}`)
  applyUnlocks(state)
}

export function gatherScrap(state: GameState): void {
  if (!state.unlocks.scrapAction) {
    pushLog(state, '아직 🧰 고물을 주울 방법이 없다.')
    return
  }

  const amount = 7 + (state.upgrades.sortingWork ? 1 : 0)
  state.resources.scrap += amount
  pushLog(state, `🧰 고물 +${amount}`)
  applyUnlocks(state)
}

export function buyBuilding(state: GameState, key: BuildingKey): void {
  const unlocked = key === 'lumberMill' || key === 'workbench' || key === 'lab' ? state.unlocks.lumberMill : state.unlocks.miner
  if (!unlocked) return

  const cost = getBuildingCost(state, key)
  if (!canAfford(state.resources, cost)) {
    pushLog(state, '자원이 부족합니다.')
    return
  }

  payCost(state.resources, cost)
  state.buildings[key] += 1
  pushLog(state, `${getBuildingName(key)} 설치 (${state.buildings[key]})`)
  applyUnlocks(state)
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
  pushLog(state, `업그레이드 완료: ${def.name}`)
}

export function setActiveTab(state: GameState, tab: TabKey): void {
  state.activeTab = tab
}

export function selectWeapon(state: GameState, weaponId: string | null): void {
  state.selectedWeaponId = weaponId
}

export function startWeaponCraft(state: GameState, type: WeaponType): void {
  if (!isCraftRecipeUnlocked(state, type)) {
    pushLog(state, '제작대가 필요합니다.')
    return
  }

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
  if (!isCraftRecipeUnlocked(state, 'module')) {
    pushLog(state, '제작대가 필요합니다.')
    return
  }

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

export function startShovelCraft(state: GameState): void {
  if (!isCraftRecipeUnlocked(state, 'shovel')) return

  if (state.craftProgress.shovel > 0) {
    pushLog(state, '이미 제작 중입니다.')
    return
  }

  if (!canAfford(state.resources, SHOVEL_CRAFT_COST)) {
    pushLog(state, '자원이 부족합니다.')
    return
  }

  payCost(state.resources, SHOVEL_CRAFT_COST)
  state.craftProgress.shovel = WEAPON_CRAFT_DURATION_MS
  pushLog(state, '🪏 삽 제작 시작 (30초)')
}

export function equipModuleToSlot(state: GameState, weaponId: string, moduleType: ModuleType, slotIndex: number): boolean {
  const weapon = state.weapons.find((w) => w.id === weaponId)
  if (!weapon) return false
  if (slotIndex < 0 || slotIndex >= weapon.slots.length) return false
  if (weapon.slots[slotIndex]) return false
  if (state.modules[moduleType] <= 0) return false

  weapon.slots[slotIndex] = moduleType
  state.modules[moduleType] -= 1
  pushLog(state, `장착: ${moduleName(moduleType)} -> ${weapon.id} [${slotIndex + 1}]`)
  return true
}

export function unequipModuleFromSlot(state: GameState, weaponId: string, slotIndex: number): boolean {
  const weapon = state.weapons.find((w) => w.id === weaponId)
  if (!weapon) return false
  if (slotIndex < 0 || slotIndex >= weapon.slots.length) return false

  const moduleType = weapon.slots[slotIndex]
  if (!moduleType) return false

  weapon.slots[slotIndex] = null
  state.modules[moduleType] += 1
  pushLog(state, `해제: ${weapon.id} [${slotIndex + 1}] -> ${moduleName(moduleType)}`)
  return true
}

export function moveEquippedModuleBetweenSlots(
  state: GameState,
  weaponId: string,
  fromSlotIndex: number,
  toSlotIndex: number,
): boolean {
  const weapon = state.weapons.find((w) => w.id === weaponId)
  if (!weapon) return false
  if (fromSlotIndex < 0 || fromSlotIndex >= weapon.slots.length) return false
  if (toSlotIndex < 0 || toSlotIndex >= weapon.slots.length) return false
  if (fromSlotIndex === toSlotIndex) return false

  const sourceModuleType = weapon.slots[fromSlotIndex]
  if (!sourceModuleType) return false

  const targetModuleType = weapon.slots[toSlotIndex]

  weapon.slots[fromSlotIndex] = null
  weapon.slots[toSlotIndex] = sourceModuleType

  if (targetModuleType) {
    state.modules[targetModuleType] += 1
    pushLog(
      state,
      `이동: ${weapon.id} [${fromSlotIndex + 1}] -> [${toSlotIndex + 1}] (${moduleName(targetModuleType)} 자동 해제)`,
    )
    return true
  }

  pushLog(state, `이동: ${weapon.id} [${fromSlotIndex + 1}] -> [${toSlotIndex + 1}]`)
  return true
}

export function reorderWeapons(state: GameState, sourceWeaponId: string, targetWeaponId: string | null): boolean {
  const sourceIndex = state.weapons.findIndex((weapon) => weapon.id === sourceWeaponId)
  if (sourceIndex < 0) return false

  if (targetWeaponId === sourceWeaponId) return false

  const [sourceWeapon] = state.weapons.splice(sourceIndex, 1)
  if (!sourceWeapon) return false

  if (targetWeaponId == null) {
    state.weapons.push(sourceWeapon)
    return true
  }

  const targetIndex = state.weapons.findIndex((weapon) => weapon.id === targetWeaponId)
  if (targetIndex < 0) {
    state.weapons.splice(sourceIndex, 0, sourceWeapon)
    return false
  }

  state.weapons.splice(targetIndex, 0, sourceWeapon)
  return true
}

export function appendLog(state: GameState, text: string): void {
  pushLog(state, text)
}
