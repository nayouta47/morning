import { createEnemyCombatState, DEFAULT_ENEMY_ID, ENCOUNTER_FIGHT_CHANCE, ENCOUNTER_FIGHT_DELAY } from '../combat.ts'
import type { GameState } from '../state.ts'
import { getResourceDisplay, type ResourceId } from '../../data/resources.ts'
import { pushLog } from './logging.ts'

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
    state.resources[entry.resource] += entry.amount
  })
  state.exploration.backpack = []
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

    const enemyId = DEFAULT_ENEMY_ID
    const combatState = createEnemyCombatState(enemyId)
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
