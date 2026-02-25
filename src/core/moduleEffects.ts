import { WEAPON_BASE_STATS } from '../data/balance.ts'
import type { ModuleType, WeaponInstance, WeaponType } from './state.ts'
import { getActiveWeaponSlots } from './weaponSlots.ts'

const MIN_COOLDOWN_SEC = 0.5
const SLOT_COLUMNS = 10
const HASTE_PER_COOLDOWN_MODULE = 10

const WEAPON_POWER_CAPACITY: Record<WeaponType, number> = {
  pistol: 12,
  rifle: 20,
}

const MODULE_POWER_COST: Record<ModuleType, number> = {
  damage: 5,
  cooldown: 5,
  amplifier: 2,
  preheater: 7,
}

function applyHasteToCooldown(baseCooldownSec: number, totalHaste: number): number {
  return baseCooldownSec * (100 / (100 + Math.max(0, totalHaste)))
}

export type WeaponPowerStatus = {
  usage: number
  capacity: number
  overloaded: boolean
}

export type ModuleLayerStats = {
  baseDamage: number
  baseCooldownSec: number
  damageBase: number
  damageAmplified: number
  cooldownBase: number
  cooldownAmplified: number
  totalHaste: number
  finalDamage: number
  finalCooldownSec: number
  slotAmplification: number[]
  hasPreheater: boolean
  power: WeaponPowerStatus
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

export function getWeaponPowerStatus(weapon: WeaponInstance): WeaponPowerStatus {
  const activeSlots = getActiveWeaponSlots(weapon.type)
  const usage = weapon.slots.reduce((sum, moduleType, index) => {
    if (!moduleType || !activeSlots.has(index)) return sum
    return sum + MODULE_POWER_COST[moduleType]
  }, 0)
  const capacity = WEAPON_POWER_CAPACITY[weapon.type]

  return {
    usage,
    capacity,
    overloaded: usage > capacity,
  }
}

export function getWeaponModuleLayerStats(weapon: WeaponInstance): ModuleLayerStats {
  const base = WEAPON_BASE_STATS[weapon.type]
  const activeSlots = getActiveWeaponSlots(weapon.type)
  const power = getWeaponPowerStatus(weapon)

  if (power.overloaded) {
    return {
      baseDamage: base.damage,
      baseCooldownSec: base.cooldown,
      damageBase: 0,
      damageAmplified: 0,
      cooldownBase: 0,
      cooldownAmplified: 0,
      totalHaste: 0,
      finalDamage: base.damage,
      finalCooldownSec: base.cooldown,
      slotAmplification: Array.from({ length: weapon.slots.length }, () => 0),
      hasPreheater: false,
      power,
    }
  }

  const amplifierPower = getAmplifierPowerBySlot(weapon, activeSlots)
  const slotAmplification = weapon.slots.map((_, index) =>
    getAmplificationCountForSlot(index, weapon, activeSlots, amplifierPower),
  )

  let damageBase = 0
  let damageAmplified = 0
  let cooldownBase = 0
  let cooldownAmplified = 0
  let hasPreheater = false

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
      return
    }

    if (moduleType === 'preheater') {
      hasPreheater = true
    }
  })

  const finalDamage = base.damage + damageBase + damageAmplified
  const cooldownApplications = cooldownBase + cooldownAmplified
  const totalHaste = cooldownApplications * HASTE_PER_COOLDOWN_MODULE
  const finalCooldownSec = Math.max(MIN_COOLDOWN_SEC, applyHasteToCooldown(base.cooldown, totalHaste))

  return {
    baseDamage: base.damage,
    baseCooldownSec: base.cooldown,
    damageBase,
    damageAmplified,
    cooldownBase,
    cooldownAmplified,
    totalHaste,
    finalDamage,
    finalCooldownSec,
    slotAmplification,
    hasPreheater,
    power,
  }
}

export function isModuleType(value: string | null | undefined): value is ModuleType {
  return value === 'damage' || value === 'cooldown' || value === 'amplifier' || value === 'preheater'
}
