import { WEAPON_BASE_STATS } from '../data/balance.ts'
import type { GameState, LootEntry, WeaponInstance } from './state.ts'

export const ENCOUNTER_FIGHT_DELAY = 3
export const ENCOUNTER_FIGHT_CHANCE = 0.2

export const ENEMY_TEMPLATE = {
  name: '규소생물',
  hp: 20,
  damage: 2,
  attackCooldownMs: 3000,
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

export function createEnemyLootTable(): LootEntry[] {
  const rows: LootEntry[] = [{ resource: 'siliconMass', amount: 1 }]
  if (Math.random() < 0.65) rows.push({ resource: 'scrap', amount: 1 + Math.floor(Math.random() * 2) })
  if (Math.random() < 0.25) rows.push({ resource: 'iron', amount: 1 })
  return rows
}
