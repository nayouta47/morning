import { WEAPON_BASE_STATS } from '../data/balance.ts'
import { ENEMY_IDS, getEnemyDef, type EnemyId } from '../data/enemies.ts'
import { BIOME_DEFS, type BiomeId } from '../data/maps/index.ts'
import type { CombatState, GameState, LootEntry, WeaponInstance } from './state.ts'

export const ENCOUNTER_FIGHT_DELAY = 3
export const ENCOUNTER_FIGHT_CHANCE = 0.2

export const DEFAULT_ENEMY_ID: EnemyId = 'siliconLifeform'
export const FLEE_GAUGE_DURATION_MS = 2500
export const FLEE_SUCCESS_CHANCE = 0.3

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

export function createEnemyCombatState(enemyId: EnemyId): CombatState {
  const enemy = getEnemyDef(enemyId)
  return {
    enemyId,
    enemyName: enemy.name,
    enemyHp: enemy.hp,
    enemyMaxHp: enemy.hp,
    enemyDamage: enemy.damage,
    enemyAttackCooldownMs: enemy.attackCooldownMs,
    enemyAttackElapsedMs: 0,
    playerAttackElapsedMs: 0,
    fleeGaugeDurationMs: FLEE_GAUGE_DURATION_MS,
    fleeGaugeElapsedMs: 0,
    fleeGaugeRunning: false,
  }
}

export function getSelectedWeapon(state: GameState): WeaponInstance | null {
  if (!state.selectedWeaponId) return null
  return state.weapons.find((weapon) => weapon.id === state.selectedWeaponId) ?? null
}

export function getWeaponCombatStats(weapon: WeaponInstance | null): { damage: number; cooldownMs: number } {
  if (!weapon) return { damage: 1, cooldownMs: 2500 }

  const base = WEAPON_BASE_STATS[weapon.type]
  let damage: number = base.damage
  let cooldownSec: number = base.cooldown

  weapon.slots.forEach((moduleType) => {
    if (moduleType === 'damage') damage += 1
    if (moduleType === 'cooldown') cooldownSec = Math.max(0.5, cooldownSec - 1)
  })

  return {
    damage,
    cooldownMs: cooldownSec * 1000,
  }
}

export function createEnemyLootTable(enemyId: EnemyId): LootEntry[] {
  const enemy = getEnemyDef(enemyId)
  const rows: LootEntry[] = []

  enemy.drops.forEach((drop) => {
    if (Math.random() > drop.chance) return
    const amount = drop.minAmount + Math.floor(Math.random() * (drop.maxAmount - drop.minAmount + 1))
    if (amount > 0) rows.push({ resource: drop.resource, amount })
  })

  return rows
}
