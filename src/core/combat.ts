import { ENEMY_IDS, getEnemyDef, type EnemyId } from '../data/enemies.ts'
import { BIOME_DEFS, type BiomeId } from '../data/maps/index.ts'
import type { FieldCombatState, FieldDirection, FieldEnemy, FieldTile, GameState, LootEntry, WeaponInstance } from './state.ts'
import { getWeaponModuleLayerStats } from './moduleEffects.ts'

export const ENCOUNTER_FIGHT_DELAY = 3
export const ENCOUNTER_FIGHT_CHANCE = 0.2

export const DEFAULT_ENEMY_ID: EnemyId = 'siliconLifeform'
export const FLEE_GAUGE_DURATION_MS = 2500
export const FLEE_SUCCESS_CHANCE = 0.3
export const ENEMY_LOOT_AMOUNT_MULTIPLIER = 10

export const FIELD_WIDTH = 15
export const FIELD_HEIGHT = 9
export const ENEMY_MOVE_INTERVAL_MS = 600

export function selectEncounterEnemyId(biomeId?: BiomeId): EnemyId {
  const pool = biomeId ? BIOME_DEFS[biomeId]?.encounterPool ?? [] : []
  const totalWeight = pool.reduce((sum, row) => sum + row.weight, 0)

  if (totalWeight > 0) {
    let roll = Math.random() * totalWeight
    for (const row of pool) {
      roll -= row.weight
      if (roll <= 0) return row.enemyId
    }
    return pool[pool.length - 1]?.enemyId ?? DEFAULT_ENEMY_ID
  }

  const index = Math.floor(Math.random() * ENEMY_IDS.length)
  return ENEMY_IDS[index] ?? DEFAULT_ENEMY_ID
}

function getEnemySpawnY(index: number, total: number): number {
  return Math.floor((FIELD_HEIGHT - 1) * (index + 1) / (total + 1))
}

export function createFieldCombatState(enemyIds: EnemyId[], playerAttackElapsedMs = 0): FieldCombatState {
  const field: FieldTile[][] = Array.from({ length: FIELD_HEIGHT }, () =>
    Array.from({ length: FIELD_WIDTH }, () => 'floor' as FieldTile),
  )

  const forbiddenKeys = new Set<string>(['1,4'])
  const spawnYs = enemyIds.map((_, i) => getEnemySpawnY(i, enemyIds.length))
  spawnYs.forEach((y) => forbiddenKeys.add(`13,${y}`))

  const numCovers = 3 + Math.floor(Math.random() * 3)
  let placed = 0
  let attempts = 0
  while (placed < numCovers && attempts < 100) {
    attempts += 1
    const cx = 3 + Math.floor(Math.random() * 9)
    const cy = 1 + Math.floor(Math.random() * 7)
    const key = `${cx},${cy}`
    if (forbiddenKeys.has(key)) continue
    field[cy]![cx] = 'cover'
    forbiddenKeys.add(key)
    placed += 1
  }

  const enemies: FieldEnemy[] = enemyIds.map((enemyId, i) => {
    const def = getEnemyDef(enemyId)
    return {
      instanceId: `enemy-${i}`,
      enemyId,
      name: def.name,
      hp: def.hp,
      maxHp: def.hp,
      damage: def.damage,
      attackCooldownMs: def.attackCooldownMs,
      attackElapsedMs: 0,
      moveElapsedMs: 0,
      pos: { x: 13, y: spawnYs[i] ?? 4 },
      facing: 'left' as FieldDirection,
    }
  })

  return {
    field,
    playerPos: { x: 1, y: 4 },
    playerFacing: 'right',
    playerAttackElapsedMs,
    enemies,
    fleeGaugeDurationMs: FLEE_GAUGE_DURATION_MS,
    fleeGaugeElapsedMs: 0,
    fleeGaugeRunning: false,
    smallHealPotionCooldownRemainingMs: 0,
  }
}

export function getSelectedWeapon(state: GameState): WeaponInstance | null {
  if (!state.selectedWeaponId) return null
  return state.weapons.find((weapon) => weapon.id === state.selectedWeaponId) ?? null
}

export function getWeaponCombatStats(weapon: WeaponInstance | null): { damage: number; cooldownMs: number; startsPreloaded: boolean } {
  if (!weapon) return { damage: 1, cooldownMs: 2500, startsPreloaded: false }

  const stats = getWeaponModuleLayerStats(weapon)
  return {
    damage: stats.finalDamage,
    cooldownMs: stats.finalCooldownSec * 1000,
    startsPreloaded: stats.hasPreheater,
  }
}

export function createEnemyLootTable(enemyId: EnemyId, multiplier = 1): LootEntry[] {
  const enemy = getEnemyDef(enemyId)
  const rows: LootEntry[] = []

  enemy.drops.forEach((drop) => {
    if (Math.random() > drop.chance) return
    const baseAmount = drop.minAmount + Math.floor(Math.random() * (drop.maxAmount - drop.minAmount + 1))
    const amount = Math.floor(baseAmount * ENEMY_LOOT_AMOUNT_MULTIPLIER * multiplier)
    if (amount > 0) rows.push({ resource: drop.resource, amount })
  })

  return rows
}
