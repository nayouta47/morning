import {
  createEnemyCombatState,
  ENCOUNTER_FIGHT_CHANCE,
  ENCOUNTER_FIGHT_DELAY,
  getSelectedWeapon,
  getWeaponCombatStats,
  selectEncounterEnemyId,
} from '../combat.ts'

import type { GameState } from '../state.ts'
import { type ResourceId, getResourceDisplay } from '../../data/resources.ts'
import { narrate } from './logging.ts'
import { EXPLORATION_MAP, getBiomeAt, getDungeonDef, getTileAt } from '../../data/maps/index.ts'
import { ACTION_DURATION_MS, SMALL_HEAL_POTION_COOLDOWN_MS, SMALL_HEAL_POTION_HEAL } from '../../data/balance.ts'
import { addResourceWithCap, getResourceStorageCap } from '../resourceCaps.ts'
import { getCompanionName } from '../companion.ts'
import {
  addResourceToBackpack,
  getBackpackResourceAmount,
  removeResourceFromBackpack,
} from '../explorationBackpack.ts'

const LOADOUT_ALLOWED_RESOURCES = new Set<ResourceId>(['syntheticFood', 'smallHealPotion'])

function addLootToBackpack(state: GameState, resourceId: ResourceId, amount: number): number {
  const result = addResourceToBackpack(state.exploration.backpack, resourceId, amount, state.exploration.backpackMaxWeight)
  return result.remaining
}

function removeBackpackResource(state: GameState, resourceId: ResourceId, amount: number): boolean {
  const removeAmount = Math.max(0, Math.floor(amount))
  if (removeAmount <= 0) return true
  return removeResourceFromBackpack(state.exploration.backpack, resourceId, removeAmount) === removeAmount
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

function commitExplorationBackpack(state: GameState): void {
  state.exploration.backpack.forEach((entry) => {
    addResourceWithCap(state.resources, entry.resource, entry.amount, getResourceStorageCap(state))
  })
  state.exploration.backpack = []
}

function endExplorationToLoadout(state: GameState): void {
  state.exploration.mode = 'loadout'
  state.exploration.phase = 'moving'
  state.exploration.hp = state.exploration.maxHp
  state.exploration.pendingLoot = []
  state.exploration.combat = null
  state.exploration.carriedWeaponId = null
}


export function startRecoverGuideRobot(state: GameState): boolean {
  if (state.isGuideRobotRecovered) {
    narrate(state, '이미 파괴된 안내견을 확보했다.')
    return false
  }

  if (state.actionProgress.recoverGuideRobot > 0) {
    narrate(state, '이미 파괴된 안내견을 옮기는 중이다.')
    return false
  }

  state.actionProgress.recoverGuideRobot = ACTION_DURATION_MS.recoverGuideRobot
  narrate(state, '네 다리가 달린 고물 로봇을 발견했다.')
  return true
}

export function startExploration(state: GameState, proceedWithoutWeapon = false): boolean {
  if (!state.isGuideRobotRecovered) {
    narrate(state, '먼저 파괴된 안내견을 주워 와야 한다.')
    return false
  }

  if (state.buildings.laikaRepair <= 0) {
    narrate(state, `${getCompanionName(state)} 수리를 완료해야 출발할 수 있다.`)
    return false
  }

  if (state.exploration.mode === 'active') {
    narrate(state, '이미 탐험 중이다.')
    return false
  }

  if (!state.selectedWeaponId) {
    if (proceedWithoutWeapon) narrate(state, '무기 선택 없이 출발할 수 없다.')
    return false
  }

  const start = EXPLORATION_MAP.start
  state.exploration.mapSize = EXPLORATION_MAP.size
  state.exploration.mode = 'active'
  state.exploration.phase = 'moving'
  state.exploration.hp = state.exploration.maxHp
  state.exploration.start = { x: start.x, y: start.y }
  state.exploration.position = { x: start.x, y: start.y }
  state.exploration.steps = 0
  state.exploration.visited = [positionKey(start.x, start.y)]
  state.exploration.movesSinceEncounter = 0
  state.exploration.pendingLoot = []
  state.exploration.carriedWeaponId = state.selectedWeaponId
  state.exploration.combat = null
  state.exploration.activeDungeon = null
  state.exploration.clearedDungeonIds = []
  revealExplorationTilesInRadius(state)
  state.activeTab = 'exploration'
  narrate(state, `${getCompanionName(state)}와 함께 탐험 시작. 칠흑 속에서 숨소리만 들린다.`)
  return true
}

export function moveExplorationStep(state: GameState, dx: number, dy: number): boolean {
  if (state.exploration.mode !== 'active') return false
  if (state.exploration.phase !== 'moving') return false

  const nextX = Math.max(0, Math.min(state.exploration.mapSize - 1, state.exploration.position.x + dx))
  const nextY = Math.max(0, Math.min(state.exploration.mapSize - 1, state.exploration.position.y + dy))

  if (nextX === state.exploration.position.x && nextY === state.exploration.position.y) {
    narrate(state, '더 이상 갈 수 없는 경계다.')
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
    endExplorationToLoadout(state)
    state.activeTab = 'exploration'
    narrate(state, '거점으로 돌아왔다.')
    return true
  }

  const tile = getTileAt(nextX, nextY)
  if (tile?.dungeonId && !state.exploration.clearedDungeonIds.includes(tile.dungeonId)) {
    state.exploration.activeDungeon = { id: tile.dungeonId, currentFloor: 0 }
    state.exploration.phase = 'dungeon-entry'
    const def = getDungeonDef(tile.dungeonId)
    narrate(state, `${def?.emoji ?? '🏚️'} ${def?.name ?? tile.dungeonId}에 접근했다.`)
    return true
  }

  if (state.exploration.movesSinceEncounter > ENCOUNTER_FIGHT_DELAY && Math.random() < ENCOUNTER_FIGHT_CHANCE) {
    state.exploration.movesSinceEncounter = 0
    state.exploration.phase = 'combat'

    const biome = getBiomeAt(state.exploration.position.x, state.exploration.position.y)
    const enemyId = selectEncounterEnemyId(biome.id)
    const weaponStats = getWeaponCombatStats(getSelectedWeapon(state))
    const combatState = createEnemyCombatState(enemyId, weaponStats.startsPreloaded ? weaponStats.cooldownMs : 0)
    state.exploration.combat = combatState

    const codex = state.enemyCodex[enemyId]
    if (codex) {
      codex.encountered = true
      if (codex.firstEncounteredAt == null) codex.firstEncounteredAt = Date.now()
    }

    narrate(state, `어둠 사이에서 ${combatState.enemyName}이(가) 튀어나왔다.`)
    return true
  }

  return true
}

export function useSyntheticFood(state: GameState): boolean {
  if (state.exploration.mode !== 'active' || state.exploration.phase === 'combat') return false

  const backpackAmount = getBackpackResourceAmount(state.exploration.backpack, 'syntheticFood')
  if (backpackAmount <= 0) {
    narrate(state, '무작위맛 통조림이 없다.')
    return false
  }

  removeBackpackResource(state, 'syntheticFood', 1)
  const prevHp = state.exploration.hp
  state.exploration.hp = Math.min(state.exploration.maxHp, state.exploration.hp + 5)
  const healed = state.exploration.hp - prevHp
  narrate(state, `무작위맛 통조림 사용. HP +${healed}`)
  return true
}

export function useSmallHealPotion(state: GameState): boolean {
  if (state.exploration.mode !== 'active' || state.exploration.phase !== 'combat') return false
  const combat = state.exploration.combat
  if (!combat) return false

  const backpackAmount = getBackpackResourceAmount(state.exploration.backpack, 'smallHealPotion')
  if (backpackAmount <= 0) {
    narrate(state, '회복약(소)이 없다.')
    return false
  }

  if (combat.smallHealPotionCooldownRemainingMs > 0) {
    narrate(state, '회복약(소) 재사용 대기 중.')
    return false
  }

  removeBackpackResource(state, 'smallHealPotion', 1)
  const prevHp = state.exploration.hp
  state.exploration.hp = Math.min(state.exploration.maxHp, state.exploration.hp + SMALL_HEAL_POTION_HEAL)
  const healed = state.exploration.hp - prevHp
  combat.smallHealPotionCooldownRemainingMs = SMALL_HEAL_POTION_COOLDOWN_MS
  narrate(state, `회복약(소) 사용. HP +${healed}`)
  return true
}

export function startExplorationFlee(state: GameState): boolean {
  if (state.exploration.mode !== 'active' || state.exploration.phase !== 'combat') return false
  const combat = state.exploration.combat
  if (!combat || combat.fleeGaugeRunning) return false

  combat.fleeGaugeElapsedMs = 0
  combat.fleeGaugeRunning = true
  narrate(state, '도주를 시도한다...')
  return true
}

export function takeExplorationLoot(state: GameState, resourceId: ResourceId): boolean {
  if (state.exploration.mode !== 'active' || state.exploration.phase !== 'loot') return false

  const lootIndex = state.exploration.pendingLoot.findIndex((entry) => entry.resource === resourceId)
  if (lootIndex < 0) return false

  const loot = state.exploration.pendingLoot[lootIndex]
  if (!loot) return false

  const before = loot.amount
  const remaining = addLootToBackpack(state, resourceId, loot.amount)
  const collected = before - remaining

  if (collected <= 0) {
    narrate(state, '가방이 너무 무겁다.')
    return false
  }

  if (remaining > 0) {
    loot.amount = remaining
    narrate(state, `전리품 일부 확보: ${getResourceDisplay(resourceId)} +${collected} (남음 ${remaining})`)
    return true
  }

  state.exploration.pendingLoot.splice(lootIndex, 1)
  narrate(state, `전리품 확보: ${getResourceDisplay(resourceId)} +${collected}`)
  return true
}

export function enterDungeon(state: GameState): boolean {
  if (state.exploration.mode !== 'active' || state.exploration.phase !== 'dungeon-entry') return false
  const { activeDungeon } = state.exploration
  if (!activeDungeon) return false

  const def = getDungeonDef(activeDungeon.id)
  if (!def) {
    state.exploration.activeDungeon = null
    state.exploration.phase = 'moving'
    return false
  }

  const floor = def.floors[activeDungeon.currentFloor]
  if (!floor) return false

  if (floor.dialogText) narrate(state, floor.dialogText)

  const weaponStats = getWeaponCombatStats(getSelectedWeapon(state))
  const combatState = createEnemyCombatState(floor.enemyId, weaponStats.startsPreloaded ? weaponStats.cooldownMs : 0)
  state.exploration.combat = combatState
  state.exploration.phase = 'combat'

  const codex = state.enemyCodex[floor.enemyId]
  if (codex) {
    codex.encountered = true
    if (codex.firstEncounteredAt == null) codex.firstEncounteredAt = Date.now()
  }

  narrate(state, `[${activeDungeon.currentFloor + 1}/${def.floors.length}층] ${combatState.enemyName}이(가) 막아선다.`)
  return true
}

export function cancelDungeonEntry(state: GameState): boolean {
  if (state.exploration.mode !== 'active' || state.exploration.phase !== 'dungeon-entry') return false
  state.exploration.activeDungeon = null
  state.exploration.phase = 'moving'
  narrate(state, '발길을 돌렸다.')
  return true
}

export function continueExplorationAfterLoot(state: GameState): boolean {
  if (state.exploration.mode !== 'active' || state.exploration.phase !== 'loot') return false
  state.exploration.pendingLoot = []

  const { activeDungeon } = state.exploration
  if (activeDungeon) {
    const def = getDungeonDef(activeDungeon.id)
    if (def && activeDungeon.currentFloor + 1 < def.floors.length) {
      activeDungeon.currentFloor += 1
      const nextFloor = def.floors[activeDungeon.currentFloor]
      if (nextFloor) {
        if (nextFloor.dialogText) narrate(state, nextFloor.dialogText)
        const weaponStats = getWeaponCombatStats(getSelectedWeapon(state))
        const combatState = createEnemyCombatState(nextFloor.enemyId, weaponStats.startsPreloaded ? weaponStats.cooldownMs : 0)
        state.exploration.combat = combatState
        state.exploration.phase = 'combat'
        const codex = state.enemyCodex[nextFloor.enemyId]
        if (codex) {
          codex.encountered = true
          if (codex.firstEncounteredAt == null) codex.firstEncounteredAt = Date.now()
        }
        narrate(state, `[${activeDungeon.currentFloor + 1}/${def.floors.length}층] ${combatState.enemyName}이(가) 막아선다.`)
      }
    } else {
      const dungeonName = def?.name ?? activeDungeon.id
      state.exploration.clearedDungeonIds.push(activeDungeon.id)
      state.exploration.activeDungeon = null
      narrate(state, `${dungeonName} 던전을 클리어했다.`)
      state.exploration.phase = 'moving'
    }
    return true
  }

  state.exploration.phase = 'moving'
  narrate(state, '다시 발걸음을 옮긴다.')
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

  state.exploration.activeDungeon = null
  endExplorationToLoadout(state)
  state.exploration.backpack = []
  state.activeTab = 'base'

  narrate(state, '시야가 꺼졌다. 거점에서 정신을 차렸다.')
  narrate(state, '들고 나간 장비와 배낭의 짐을 전부 잃었다.')
}

export function tryReturnFromExploration(state: GameState): boolean {
  if (state.exploration.mode !== 'active') return false
  const atStart =
    state.exploration.position.x === state.exploration.start.x && state.exploration.position.y === state.exploration.start.y

  if (!atStart) {
    narrate(state, '출발 지점으로 돌아와야 귀환할 수 있다.')
    return false
  }

  commitExplorationBackpack(state)
  endExplorationToLoadout(state)
  state.activeTab = 'exploration'
  narrate(state, '거점으로 돌아왔다.')
  return true
}

function isLoadoutResourceAllowed(state: GameState, resourceId: ResourceId): boolean {
  return state.exploration.mode === 'loadout' && LOADOUT_ALLOWED_RESOURCES.has(resourceId)
}

export function addLoadoutResource(state: GameState, resourceId: ResourceId, amount = 1): boolean {
  if (!isLoadoutResourceAllowed(state, resourceId)) return false

  const addAmount = Math.max(1, Math.floor(amount))
  if (state.resources[resourceId] < addAmount) {
    narrate(state, `${getResourceDisplay(resourceId)} 보유량이 부족하다.`)
    return false
  }

  const remaining = addLootToBackpack(state, resourceId, addAmount)
  const loaded = addAmount - remaining
  if (loaded <= 0) {
    narrate(state, '가방이 너무 무겁다.')
    return false
  }

  state.resources[resourceId] -= loaded
  if (remaining > 0) {
    narrate(state, `${getResourceDisplay(resourceId)} +${loaded} 적재 (배낭 가득)`)
  }
  return true
}

export function fillLoadoutResource(state: GameState, resourceId: ResourceId): boolean {
  const owned = state.resources[resourceId]
  if (owned <= 0) return false
  return addLoadoutResource(state, resourceId, owned)
}

export function removeLoadoutResource(state: GameState, resourceId: ResourceId, amount = 1): boolean {
  if (!isLoadoutResourceAllowed(state, resourceId)) return false

  const removeAmount = Math.max(1, Math.floor(amount))
  if (!removeBackpackResource(state, resourceId, removeAmount)) {
    narrate(state, `${getResourceDisplay(resourceId)} 적재 수량이 부족하다.`)
    return false
  }

  state.resources[resourceId] += removeAmount
  return true
}

export function clearLoadoutResource(state: GameState, resourceId: ResourceId): boolean {
  const carried = getBackpackResourceAmount(state.exploration.backpack, resourceId)
  if (carried <= 0) return false
  return removeLoadoutResource(state, resourceId, carried)
}
