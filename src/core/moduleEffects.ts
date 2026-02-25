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

const HEAT_AMPLIFIER_HIGH_HEAT_OFFSETS = [
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 1, y: -1 },
] as const

const HEAT_AMPLIFIER_WARM_HEAT_OFFSETS = [
  { x: 2, y: 0 },
  { x: 2, y: 1 },
  { x: 2, y: -1 },
] as const

export const MODULE_POWER_COST: Record<ModuleType, number> = {
  damage: 5,
  cooldown: 5,
  blockAmplifierLeft: 2,
  blockAmplifierRight: 2,
  blockAmplifierUp: 2,
  blockAmplifierDown: 2,
  preheater: 7,
  heatAmplifier: 4,
}

type Direction = 'left' | 'right' | 'up' | 'down'

const AMPLIFIER_DIRECTION: Partial<Record<ModuleType, Direction>> = {
  blockAmplifierLeft: 'left',
  blockAmplifierRight: 'right',
  blockAmplifierUp: 'up',
  blockAmplifierDown: 'down',
}

function isAmplifierModule(type: ModuleType | null | undefined): type is keyof typeof AMPLIFIER_DIRECTION {
  return type === 'blockAmplifierLeft' || type === 'blockAmplifierRight' || type === 'blockAmplifierUp' || type === 'blockAmplifierDown'
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
  slotAmplificationReduction: number[]
  slotHeat: number[]
  slotHeatHigh: number[]
  slotHeatWarm: number[]
  slotPenaltyDisabled: boolean[]
  slotDisabled: boolean[]
  hasPreheater: boolean
  power: WeaponPowerStatus
}

function isSameRowAdjacent(leftIndex: number, rightIndex: number): boolean {
  return rightIndex - leftIndex === 1 && Math.floor(leftIndex / SLOT_COLUMNS) === Math.floor(rightIndex / SLOT_COLUMNS)
}

function getNeighborIndex(index: number, direction: Direction, maxSlots: number): number | null {
  if (direction === 'left') {
    const left = index - 1
    return left >= 0 && isSameRowAdjacent(left, index) ? left : null
  }
  if (direction === 'right') {
    const right = index + 1
    return isSameRowAdjacent(index, right) ? right : null
  }
  if (direction === 'up') {
    const up = index - SLOT_COLUMNS
    return up >= 0 ? up : null
  }
  const down = index + SLOT_COLUMNS
  return down < maxSlots ? down : null
}

function getPenaltyDirections(direction: Direction): Direction[] {
  if (direction === 'left' || direction === 'right') return ['up', 'down']
  return ['left', 'right']
}

function toGridPosition(index: number): { x: number; y: number } {
  return { x: index % SLOT_COLUMNS, y: Math.floor(index / SLOT_COLUMNS) }
}

function toGridIndex(x: number, y: number, maxSlots: number): number | null {
  if (x < 0 || x >= SLOT_COLUMNS || y < 0) return null
  const index = y * SLOT_COLUMNS + x
  if (index < 0 || index >= maxSlots) return null
  return index
}

function getHeatFieldByAmplifier(weapon: WeaponInstance, activeSlots: Set<number>): { high: number[]; warm: number[]; total: number[] } {
  const high = Array.from({ length: weapon.slots.length }, () => 0)
  const warm = Array.from({ length: weapon.slots.length }, () => 0)

  weapon.slots.forEach((moduleType, index) => {
    if (moduleType !== 'heatAmplifier' || !activeSlots.has(index)) return

    const origin = toGridPosition(index)

    HEAT_AMPLIFIER_HIGH_HEAT_OFFSETS.forEach((offset) => {
      const target = toGridIndex(origin.x + offset.x, origin.y + offset.y, weapon.slots.length)
      if (target == null || !activeSlots.has(target)) return
      high[target] += 1
    })

    HEAT_AMPLIFIER_WARM_HEAT_OFFSETS.forEach((offset) => {
      const target = toGridIndex(origin.x + offset.x, origin.y + offset.y, weapon.slots.length)
      if (target == null || !activeSlots.has(target)) return
      warm[target] += 0.5
    })
  })

  const total = high.map((value, index) => value + warm[index])
  return { high, warm, total }
}

function getPenaltyDisabledByAmplifier(weapon: WeaponInstance, activeSlots: Set<number>): boolean[] {
  const disabled = Array.from({ length: weapon.slots.length }, () => false)

  weapon.slots.forEach((moduleType, index) => {
    if (!isAmplifierModule(moduleType) || !activeSlots.has(index)) return
    const direction = AMPLIFIER_DIRECTION[moduleType]
    if (!direction) return

    getPenaltyDirections(direction).forEach((penaltyDirection) => {
      const penaltyIndex = getNeighborIndex(index, penaltyDirection, weapon.slots.length)
      if (penaltyIndex != null && activeSlots.has(penaltyIndex)) disabled[penaltyIndex] = true
    })
  })

  const heatField = getHeatFieldByAmplifier(weapon, activeSlots)
  heatField.total.forEach((heat, slotIndex) => {
    const reduction = Math.floor(heat)
    if (reduction > 0 && activeSlots.has(slotIndex)) disabled[slotIndex] = true
  })

  return disabled
}

function getAmplificationCountForSlot(index: number, weapon: WeaponInstance, enabledSlots: Set<number>): number {
  if (!enabledSlots.has(index) || !weapon.slots[index]) return 0

  return weapon.slots.reduce((count, moduleType, ampIndex) => {
    if (!enabledSlots.has(ampIndex)) return count

    if (moduleType === 'heatAmplifier') {
      const targetIndex = getNeighborIndex(ampIndex, 'left', weapon.slots.length)
      if (targetIndex === index && enabledSlots.has(targetIndex)) return count + 2
      return count
    }

    if (!isAmplifierModule(moduleType)) return count

    const direction = AMPLIFIER_DIRECTION[moduleType]
    if (!direction) return count

    const targetIndex = getNeighborIndex(ampIndex, direction, weapon.slots.length)
    if (targetIndex === index && enabledSlots.has(targetIndex)) return count + 1
    return count
  }, 0)
}

export function getWeaponPowerStatus(weapon: WeaponInstance): WeaponPowerStatus {
  const activeSlots = getActiveWeaponSlots(weapon.type)
  const slotPenaltyDisabled = getPenaltyDisabledByAmplifier(weapon, activeSlots)
  const usage = weapon.slots.reduce((sum, moduleType, index) => {
    if (!moduleType || !activeSlots.has(index) || slotPenaltyDisabled[index]) return sum
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
  const heatField = getHeatFieldByAmplifier(weapon, activeSlots)
  const slotAmplificationReduction = heatField.total.map((heat) => Math.floor(heat))
  const slotPenaltyDisabled = getPenaltyDisabledByAmplifier(weapon, activeSlots)
  const slotDisabled = Array.from({ length: weapon.slots.length }, (_, index) => !activeSlots.has(index) || slotPenaltyDisabled[index])
  const enabledSlots = new Set(Array.from(activeSlots).filter((index) => !slotPenaltyDisabled[index]))
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
      slotAmplificationReduction,
      slotHeat: heatField.total,
      slotHeatHigh: heatField.high,
      slotHeatWarm: heatField.warm,
      slotPenaltyDisabled,
      slotDisabled,
      hasPreheater: false,
      power,
    }
  }

  const slotAmplification = weapon.slots.map((_, index) => {
    const raw = getAmplificationCountForSlot(index, weapon, enabledSlots)
    const reduced = raw - (slotAmplificationReduction[index] ?? 0)
    return Math.max(0, reduced)
  })

  let damageBase = 0
  let damageAmplified = 0
  let cooldownBase = 0
  let cooldownAmplified = 0
  let hasPreheater = false

  weapon.slots.forEach((moduleType, index) => {
    if (!moduleType || !enabledSlots.has(index)) return
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
    slotAmplificationReduction,
    slotHeat: heatField.total,
    slotHeatHigh: heatField.high,
    slotHeatWarm: heatField.warm,
    slotPenaltyDisabled,
    slotDisabled,
    hasPreheater,
    power,
  }
}

export function isModuleType(value: string | null | undefined): value is ModuleType {
  return value === 'damage'
    || value === 'cooldown'
    || value === 'blockAmplifierLeft'
    || value === 'blockAmplifierRight'
    || value === 'blockAmplifierUp'
    || value === 'blockAmplifierDown'
    || value === 'preheater'
    || value === 'heatAmplifier'
}
