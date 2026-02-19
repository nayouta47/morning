import { WEAPON_BASE_STATS } from '../data/balance.ts'
import type { ModuleType, WeaponInstance } from './state.ts'
import { getActiveWeaponSlots } from './weaponSlots.ts'

const MIN_COOLDOWN_SEC = 0.5
const SLOT_COLUMNS = 10

export type ModuleLayerStats = {
  baseDamage: number
  baseCooldownSec: number
  damageBase: number
  damageAmplified: number
  cooldownBase: number
  cooldownAmplified: number
  finalDamage: number
  finalCooldownSec: number
  slotAmplification: number[]
}

function isSameRowAdjacentLeft(leftIndex: number, rightIndex: number): boolean {
  return rightIndex - leftIndex === 1 && Math.floor(leftIndex / SLOT_COLUMNS) === Math.floor(rightIndex / SLOT_COLUMNS)
}

function getAmplifierPowerBySlot(weapon: WeaponInstance, activeSlots: Set<number>): number[] {
  const power = Array.from({ length: weapon.slots.length }, () => 0)

  for (let index = weapon.slots.length - 1; index >= 0; index -= 1) {
    if (!activeSlots.has(index) || weapon.slots[index] !== 'amplifier') continue

    const rightIndex = index + 1
    if (
      rightIndex < weapon.slots.length
      && activeSlots.has(rightIndex)
      && weapon.slots[rightIndex] === 'amplifier'
      && isSameRowAdjacentLeft(index, rightIndex)
    ) {
      power[index] = 1 + power[rightIndex]
      continue
    }

    power[index] = 1
  }

  return power
}

function getAmplificationCountForSlot(index: number, weapon: WeaponInstance, activeSlots: Set<number>, amplifierPower: number[]): number {
  if (!activeSlots.has(index) || !weapon.slots[index]) return 0

  const rightIndex = index + 1
  if (
    rightIndex < weapon.slots.length
    && activeSlots.has(rightIndex)
    && weapon.slots[rightIndex] === 'amplifier'
    && isSameRowAdjacentLeft(index, rightIndex)
  ) {
    return amplifierPower[rightIndex] ?? 0
  }

  return 0
}

export function getWeaponModuleLayerStats(weapon: WeaponInstance): ModuleLayerStats {
  const base = WEAPON_BASE_STATS[weapon.type]
  const activeSlots = getActiveWeaponSlots(weapon.type)
  const amplifierPower = getAmplifierPowerBySlot(weapon, activeSlots)
  const slotAmplification = weapon.slots.map((_, index) =>
    getAmplificationCountForSlot(index, weapon, activeSlots, amplifierPower),
  )

  let damageBase = 0
  let damageAmplified = 0
  let cooldownBase = 0
  let cooldownAmplified = 0

  weapon.slots.forEach((moduleType, index) => {
    if (!moduleType || !activeSlots.has(index)) return
    const amplified = slotAmplification[index] ?? 0

    if (moduleType === 'damage') {
      damageBase += 1
      damageAmplified += amplified
      return
    }

    if (moduleType === 'cooldown') {
      cooldownBase += 1
      cooldownAmplified += amplified
    }
  })

  const finalDamage = base.damage + damageBase + damageAmplified
  const cooldownReduction = cooldownBase + cooldownAmplified
  const finalCooldownSec = Math.max(MIN_COOLDOWN_SEC, base.cooldown - cooldownReduction)

  return {
    baseDamage: base.damage,
    baseCooldownSec: base.cooldown,
    damageBase,
    damageAmplified,
    cooldownBase,
    cooldownAmplified,
    finalDamage,
    finalCooldownSec,
    slotAmplification,
  }
}

export function isModuleType(value: string | null | undefined): value is ModuleType {
  return value === 'damage' || value === 'cooldown' || value === 'amplifier'
}
