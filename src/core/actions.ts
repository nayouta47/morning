import { ACTION_DURATION_MS, UPGRADE_DEFS, getUpgradeCost } from '../data/balance.ts'
import { CRAFT_RECIPE_DEFS, isCraftRecipeUnlocked, type CraftRecipeKey } from '../data/crafting.ts'
import { getBuildingCost, getBuildingLabel, type BuildingId } from '../data/buildings.ts'
import type { GameState, ModuleType, Resources, TabKey } from './state.ts'
import { evaluateUnlocks } from './unlocks.ts'
import type { ResourceCost, ResourceId } from '../data/resources.ts'
import { getResourceDisplay } from '../data/resources.ts'
import { SHOVEL_MAX_STACK, getShovelCount } from './rewards.ts'
import { ENCOUNTER_FIGHT_CHANCE, ENCOUNTER_FIGHT_DELAY, ENEMY_TEMPLATE } from './combat.ts'

type UpgradeKey = keyof typeof UPGRADE_DEFS

function pushLog(state: GameState, text: string): void {
  state.log.push(text)
  if (state.log.length > 30) {
    state.log.splice(0, state.log.length - 30)
  }
}

function canAfford(resources: Resources, cost: ResourceCost): boolean {
  return Object.entries(cost).every(([key, value]) => {
    if (!value || value <= 0) return true
    return resources[key as ResourceId] >= value
  })
}

function payCost(resources: Resources, cost: ResourceCost): void {
  Object.entries(cost).forEach(([key, value]) => {
    if (!value || value <= 0) return
    resources[key as ResourceId] -= value
  })
}

function moduleName(type: ModuleType): string {
  return type === 'damage' ? '공격력 모듈(+1)' : '쿨다운 모듈(-1초)'
}

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
  if ((key === 'lumberMill' || key === 'workbench' || key === 'lab' || key === 'droneController') && !state.unlocks.lumberMill) return

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
  if (state.exploration.mode === 'active' && tab !== 'exploration') {
    pushLog(state, '탐험 중에는 다른 탭으로 이동할 수 없다.')
    return
  }
  state.activeTab = tab
}

export function selectWeapon(state: GameState, weaponId: string | null): void {
  state.selectedWeaponId = weaponId
}

export function startCraft(state: GameState, recipeKey: CraftRecipeKey): void {
  const recipe = CRAFT_RECIPE_DEFS[recipeKey]

  if (recipeKey === 'shovel' && getShovelCount(state) >= SHOVEL_MAX_STACK) {
    pushLog(state, '삽 보유량이 최대치입니다.')
    return
  }

  if (!isCraftRecipeUnlocked(state, recipeKey)) {
    pushLog(state, '요구 조건이 부족합니다.')
    return
  }

  if (state.craftProgress[recipeKey] > 0) {
    pushLog(state, '이미 제작 중입니다.')
    return
  }

  if (!canAfford(state.resources, recipe.costs)) {
    pushLog(state, '자원이 부족합니다.')
    return
  }

  payCost(state.resources, recipe.costs)
  state.craftProgress[recipeKey] = recipe.durationMs
  pushLog(state, `${recipe.label} 제작 시작 (${Math.round(recipe.durationMs / 1000)}초)`)
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

function positionKey(x: number, y: number): string {
  return `${x},${y}`
}

function revealExplorationTilesInRadius(state: GameState): void {
  const { x, y } = state.exploration.position
  const size = state.exploration.mapSize
  const revealed = new Set(state.exploration.visited)

  for (let yy = y - 2; yy <= y + 2; yy += 1) {
    for (let xx = x - 2; xx <= x + 2; xx += 1) {
      if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue
      const dx = xx - x
      const dy = yy - y
      if (dx * dx + dy * dy <= 2) {
        revealed.add(positionKey(xx, yy))
      }
    }
  }

  state.exploration.visited = [...revealed]
}

export function startExploration(state: GameState, proceedWithoutWeapon = false): boolean {
  if (state.exploration.mode === 'active') {
    pushLog(state, '이미 탐험 중이다.')
    return false
  }

  if (!state.selectedWeaponId && !proceedWithoutWeapon) {
    return false
  }

  const center = Math.floor(state.exploration.mapSize / 2)
  state.exploration.mode = 'active'
  state.exploration.phase = 'moving'
  state.exploration.hp = state.exploration.maxHp
  state.exploration.start = { x: center, y: center }
  state.exploration.position = { x: center, y: center }
  state.exploration.steps = 0
  state.exploration.visited = [positionKey(center, center)]
  state.exploration.movesSinceEncounter = 0
  state.exploration.backpack = []
  state.exploration.pendingLoot = []
  state.exploration.carriedWeaponId = state.selectedWeaponId
  state.exploration.combat = null
  revealExplorationTilesInRadius(state)
  state.activeTab = 'exploration'
  pushLog(state, '탐험 시작. 칠흑 속에서 숨소리만 들린다.')
  return true
}

export function moveExplorationStep(state: GameState, dx: number, dy: number): boolean {
  if (state.exploration.mode !== 'active') return false
  if (state.exploration.phase !== 'moving') return false

  const nextX = Math.max(0, Math.min(state.exploration.mapSize - 1, state.exploration.position.x + dx))
  const nextY = Math.max(0, Math.min(state.exploration.mapSize - 1, state.exploration.position.y + dy))

  if (nextX === state.exploration.position.x && nextY === state.exploration.position.y) {
    pushLog(state, '더 이상 갈 수 없는 경계다.')
    return false
  }

  state.exploration.position = { x: nextX, y: nextY }
  state.exploration.steps += 1
  state.exploration.movesSinceEncounter += 1
  revealExplorationTilesInRadius(state)

  const atStart =
    state.exploration.position.x === state.exploration.start.x && state.exploration.position.y === state.exploration.start.y

  if (atStart) {
    commitExplorationBackpack(state)
    state.exploration.mode = 'loadout'
    state.exploration.phase = 'moving'
    state.exploration.pendingLoot = []
    state.exploration.combat = null
    state.exploration.carriedWeaponId = null
    state.activeTab = 'exploration'
    pushLog(state, `귀환 완료. 총 이동 ${state.exploration.steps}보.`)
    return true
  }

  if (state.exploration.movesSinceEncounter > ENCOUNTER_FIGHT_DELAY && Math.random() < ENCOUNTER_FIGHT_CHANCE) {
    state.exploration.movesSinceEncounter = 0
    state.exploration.phase = 'combat'
    state.exploration.combat = {
      enemyName: ENEMY_TEMPLATE.name,
      enemyHp: ENEMY_TEMPLATE.hp,
      enemyMaxHp: ENEMY_TEMPLATE.hp,
      enemyDamage: ENEMY_TEMPLATE.damage,
      enemyAttackCooldownMs: ENEMY_TEMPLATE.attackCooldownMs,
      enemyAttackElapsedMs: 0,
      playerAttackElapsedMs: 0,
    }
    pushLog(state, `어둠 사이에서 ${ENEMY_TEMPLATE.name}이(가) 튀어나왔다.`)
    return true
  }

  pushLog(state, `탐험 이동: (${nextX}, ${nextY}) · ${state.exploration.steps}보`)
  return true
}

function commitExplorationBackpack(state: GameState): void {
  state.exploration.backpack.forEach((entry) => {
    state.resources[entry.resource] += entry.amount
  })
  state.exploration.backpack = []
}

export function takeExplorationLoot(state: GameState, resourceId: ResourceId): boolean {
  if (state.exploration.mode !== 'active' || state.exploration.phase !== 'loot') return false

  const lootIndex = state.exploration.pendingLoot.findIndex((entry) => entry.resource === resourceId)
  if (lootIndex < 0) return false

  const usedSlots = state.exploration.backpack.reduce((sum, entry) => sum + entry.amount, 0)
  const loot = state.exploration.pendingLoot[lootIndex]
  if (!loot) return false
  if (usedSlots + loot.amount > state.exploration.backpackCapacity) {
    pushLog(state, '배낭이 꽉 찼다.')
    return false
  }

  state.exploration.pendingLoot.splice(lootIndex, 1)
  const backpackEntry = state.exploration.backpack.find((entry) => entry.resource === resourceId)
  if (backpackEntry) backpackEntry.amount += loot.amount
  else state.exploration.backpack.push({ ...loot })

  pushLog(state, `전리품 확보: ${getResourceDisplay(resourceId)} +${loot.amount}`)
  return true
}

export function continueExplorationAfterLoot(state: GameState): boolean {
  if (state.exploration.mode !== 'active' || state.exploration.phase !== 'loot') return false
  state.exploration.pendingLoot = []
  state.exploration.phase = 'moving'
  pushLog(state, '다시 발걸음을 옮긴다.')
  return true
}

export function handleExplorationDeath(state: GameState): void {
  if (state.exploration.mode !== 'active') return

  if (state.exploration.carriedWeaponId) {
    state.weapons = state.weapons.filter((weapon) => weapon.id !== state.exploration.carriedWeaponId)
    if (state.selectedWeaponId === state.exploration.carriedWeaponId) {
      state.selectedWeaponId = state.weapons[0]?.id ?? null
    }
  }

  state.exploration.mode = 'loadout'
  state.exploration.phase = 'moving'
  state.exploration.hp = state.exploration.maxHp
  state.exploration.pendingLoot = []
  state.exploration.backpack = []
  state.exploration.combat = null
  state.exploration.carriedWeaponId = null
  state.activeTab = 'base'

  pushLog(state, '시야가 꺼졌다. 거점에서 정신을 차렸다.')
  pushLog(state, '들고 나간 장비와 배낭의 짐을 전부 잃었다.')
}

export function tryReturnFromExploration(state: GameState): boolean {
  if (state.exploration.mode !== 'active') return false
  const atStart =
    state.exploration.position.x === state.exploration.start.x && state.exploration.position.y === state.exploration.start.y

  if (!atStart) {
    pushLog(state, '출발 지점으로 돌아와야 귀환할 수 있다.')
    return false
  }

  commitExplorationBackpack(state)
  state.exploration.mode = 'loadout'
  state.exploration.phase = 'moving'
  state.exploration.pendingLoot = []
  state.exploration.combat = null
  state.exploration.carriedWeaponId = null
  state.activeTab = 'exploration'
  pushLog(state, `귀환 완료. 총 이동 ${state.exploration.steps}보.`)
  return true
}

export function appendLog(state: GameState, text: string): void {
  pushLog(state, text)
}
