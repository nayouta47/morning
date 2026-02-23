import {
  createEnemyCombatState,
  ENCOUNTER_FIGHT_CHANCE,
  ENCOUNTER_FIGHT_DELAY,
  getSelectedWeapon,
  getWeaponCombatStats,
  selectEncounterEnemyId,
} from '../combat.ts'
import type { GameState } from '../state.ts'
import { getResourceDisplay, type ResourceId } from '../../data/resources.ts'
import { pushLog } from './logging.ts'
import { EXPLORATION_MAP, getBiomeAt } from '../../data/maps/index.ts'
import { SMALL_HEAL_POTION_COOLDOWN_MS, SMALL_HEAL_POTION_HEAL } from '../../data/balance.ts'
import { addResourceWithCap } from '../resourceCaps.ts'

const BACKPACK_STACK_MAX = 16
const BACKPACK_HEALING_STACK_MAX = 1
const BACKPACK_SINGLE_STACK_RESOURCES = new Set<ResourceId>(['smallHealPotion', 'syntheticFood'])

function getBackpackStackMax(resourceId: ResourceId): number {
  return BACKPACK_SINGLE_STACK_RESOURCES.has(resourceId) ? BACKPACK_HEALING_STACK_MAX : BACKPACK_STACK_MAX
}

function getBackpackUsedSlots(state: GameState): number {
  return state.exploration.backpack.length
}

function addLootToBackpack(state: GameState, resourceId: ResourceId, amount: number): number {
  let remaining = Math.max(0, Math.floor(amount))
  if (remaining <= 0) return 0

  const stackMax = getBackpackStackMax(resourceId)

  state.exploration.backpack.forEach((entry) => {
    if (entry.resource !== resourceId || remaining <= 0) return
    const space = Math.max(0, stackMax - entry.amount)
    if (space <= 0) return
    const add = Math.min(space, remaining)
    entry.amount += add
    remaining -= add
  })

  while (remaining > 0 && getBackpackUsedSlots(state) < state.exploration.backpackCapacity) {
    const add = Math.min(stackMax, remaining)
    state.exploration.backpack.push({ resource: resourceId, amount: add })
    remaining -= add
  }

  return remaining
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
    const gain = addResourceWithCap(state.resources, entry.resource, entry.amount)
    if (gain.discarded > 0) {
      pushLog(state, `${getResourceDisplay(entry.resource)} 저장 한도 도달: +${gain.discarded} 손실`)
    }
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

export function startExploration(state: GameState, proceedWithoutWeapon = false): boolean {
  if (state.buildings.laikaRepair <= 0) {
    pushLog(state, '🐶 라이카 수리를 완료해야 탐험을 시작할 수 있다.')
    return false
  }

  if (state.exploration.mode === 'active') {
    pushLog(state, '이미 탐험 중이다.')
    return false
  }

  if (!state.selectedWeaponId && !proceedWithoutWeapon) {
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
    endExplorationToLoadout(state)
    state.activeTab = 'exploration'
    pushLog(state, `귀환 완료. 총 이동 ${state.exploration.steps}보.`)
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

    pushLog(state, `어둠 사이에서 ${combatState.enemyName}이(가) 튀어나왔다.`)
    return true
  }

  pushLog(state, `탐험 이동: (${nextX}, ${nextY}) · ${state.exploration.steps}보`)
  return true
}



export function useSyntheticFood(state: GameState): boolean {
  if (state.exploration.mode !== 'active' || state.exploration.phase === 'combat') return false

  if (state.resources.syntheticFood <= 0) {
    pushLog(state, '인조식량이 없다.')
    return false
  }

  state.resources.syntheticFood -= 1
  const prevHp = state.exploration.hp
  state.exploration.hp = Math.min(state.exploration.maxHp, state.exploration.hp + 5)
  const healed = state.exploration.hp - prevHp
  pushLog(state, `인조식량 사용. HP +${healed}`)
  return true
}

export function useSmallHealPotion(state: GameState): boolean {
  if (state.exploration.mode !== 'active' || state.exploration.phase !== 'combat') return false
  const combat = state.exploration.combat
  if (!combat) return false

  if (state.resources.smallHealPotion <= 0) {
    pushLog(state, '회복약(소)이 없다.')
    return false
  }

  if (combat.smallHealPotionCooldownRemainingMs > 0) {
    pushLog(state, '회복약(소) 재사용 대기 중.')
    return false
  }

  state.resources.smallHealPotion -= 1
  const prevHp = state.exploration.hp
  state.exploration.hp = Math.min(state.exploration.maxHp, state.exploration.hp + SMALL_HEAL_POTION_HEAL)
  const healed = state.exploration.hp - prevHp
  combat.smallHealPotionCooldownRemainingMs = SMALL_HEAL_POTION_COOLDOWN_MS
  pushLog(state, `회복약(소) 사용. HP +${healed}`)
  return true
}

export function startExplorationFlee(state: GameState): boolean {
  if (state.exploration.mode !== 'active' || state.exploration.phase !== 'combat') return false
  const combat = state.exploration.combat
  if (!combat || combat.fleeGaugeRunning) return false

  combat.fleeGaugeElapsedMs = 0
  combat.fleeGaugeRunning = true
  pushLog(state, '도주를 시도한다...')
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
    pushLog(state, '배낭에 빈 칸이 없다.')
    return false
  }

  if (remaining > 0) {
    loot.amount = remaining
    pushLog(state, `전리품 일부 확보: ${getResourceDisplay(resourceId)} +${collected} (남음 ${remaining})`)
    return true
  }

  state.exploration.pendingLoot.splice(lootIndex, 1)
  pushLog(state, `전리품 확보: ${getResourceDisplay(resourceId)} +${collected}`)
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

  endExplorationToLoadout(state)
  state.exploration.backpack = []
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
  endExplorationToLoadout(state)
  state.activeTab = 'exploration'
  pushLog(state, `귀환 완료. 총 이동 ${state.exploration.steps}보.`)
  return true
}
