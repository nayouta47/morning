import { ENEMY_IDS, getEnemyDef, type EnemyId } from '../data/enemies.ts'
import { BIOME_DEFS, type BiomeId } from '../data/maps/index.ts'
import type { CombatEnemy, FieldCombatState, GameState, LootEntry, WeaponInstance } from './state.ts'
import { getWeaponModuleLayerStats } from './moduleEffects.ts'

export const ENCOUNTER_FIGHT_DELAY = 3
export const ENCOUNTER_FIGHT_CHANCE = 0.2

export const DEFAULT_ENEMY_ID: EnemyId = 'siliconLifeform'
export const FLEE_GAUGE_DURATION_MS = 2500
export const FLEE_SUCCESS_CHANCE = 0.3
export const ENEMY_LOOT_AMOUNT_MULTIPLIER = 10

export const WORLD_WIDTH = 800
export const WORLD_HEIGHT = 600

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

function getEnemyDisplayEmoji(name: string): string {
  const [leadingToken] = name.trim().split(/\s+/, 1)
  return leadingToken || '\u{1F47E}'
}

export function createFieldCombatState(enemyIds: EnemyId[], weaponStats: { damage: number; cooldownMs: number; startsPreloaded: boolean }): FieldCombatState {
  const enemies: CombatEnemy[] = enemyIds.map((enemyId, i) => {
    const def = getEnemyDef(enemyId)
    const spawnX = 600 + Math.random() * 150
    const spawnY = (WORLD_HEIGHT / (enemyIds.length + 1)) * (i + 1)
    return {
      instanceId: `enemy-${i}`,
      enemyId,
      name: def.name,
      emoji: getEnemyDisplayEmoji(def.name),
      x: spawnX,
      y: spawnY,
      hp: def.hp,
      maxHp: def.hp,
      damage: def.damage,
      radius: 14,
      speed: def.speed,
      attackCooldownMs: def.attackCooldownMs,
      attackElapsedMs: 0,
    }
  })

  return {
    worldWidth: WORLD_WIDTH,
    worldHeight: WORLD_HEIGHT,
    playerX: 100,
    playerY: 300,
    playerRadius: 12,
    playerSpeed: 150,
    playerAngle: 0,
    playerAttackCooldownMs: weaponStats.cooldownMs,
    playerAttackElapsedMs: weaponStats.startsPreloaded ? weaponStats.cooldownMs : 0,
    playerDamage: weaponStats.damage,
    enemies,
    bullets: [],
    bulletSpeed: 500,
    bulletRadius: 3,
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
