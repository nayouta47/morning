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

type Direction = 'left' | 'right' | 'up' | 'down'

const CARDINAL_DIRECTIONS: Direction[] = ['left', 'right', 'up', 'down']

export const SLOT_PENALTY_MINOR = 5
export const SLOT_PENALTY_MAJOR = 10

export const MODULE_POWER_COST: Record<ModuleType, number> = {
  damage: 5,
  cooldown: 5,
  blockAmplifierUp: 2,
  blockAmplifierDown: 2,
  preheater: 7,
  heatAmplifierLeft: 4,
  heatAmplifierRight: 4,
}

const AMPLIFIER_DIRECTION: Partial<Record<ModuleType, Direction>> = {
  blockAmplifierUp: 'up',
  blockAmplifierDown: 'down',
}

const HEAT_AMPLIFIER_DIRECTION: Partial<Record<ModuleType, Direction>> = {
  heatAmplifierLeft: 'left',
  heatAmplifierRight: 'right',
}

function isAmplifierModule(type: ModuleType | null | undefined): type is 'blockAmplifierUp' | 'blockAmplifierDown' {
  return type === 'blockAmplifierUp' || type === 'blockAmplifierDown'
}

function isHeatAmplifierModule(type: ModuleType | null | undefined): type is 'heatAmplifierLeft' | 'heatAmplifierRight' {
  return type === 'heatAmplifierLeft' || type === 'heatAmplifierRight'
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
  slotPenalty: number[]
  slotPenaltyHeat: number[]
  slotPenaltyBlock: number[]
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

type PenaltyField = {
  heat: number[]
  block: number[]
  total: number[]
}

function getPenaltyFieldByAmplifier(weapon: WeaponInstance, activeSlots: Set<number>): PenaltyField {
  const heat = Array.from({ length: weapon.slots.length }, () => 0)
  const block = Array.from({ length: weapon.slots.length }, () => 0)

  weapon.slots.forEach((moduleType, index) => {
    if (!activeSlots.has(index)) return

    if (isAmplifierModule(moduleType)) {
      const direction = AMPLIFIER_DIRECTION[moduleType]
      if (direction) {
        getPenaltyDirections(direction).forEach((penaltyDirection) => {
          const penaltyIndex = getNeighborIndex(index, penaltyDirection, weapon.slots.length)
          if (penaltyIndex != null && activeSlots.has(penaltyIndex)) {
            block[penaltyIndex] += SLOT_PENALTY_MAJOR
          }
        })
      }
    }

    if (isHeatAmplifierModule(moduleType)) {
      const direction = HEAT_AMPLIFIER_DIRECTION[moduleType]
      if (!direction) return

      const amplifiedTarget = getNeighborIndex(index, direction, weapon.slots.length)
      if (amplifiedTarget != null && activeSlots.has(amplifiedTarget)) {
        heat[amplifiedTarget] += SLOT_PENALTY_MAJOR
      }

      CARDINAL_DIRECTIONS.forEach((penaltyDirection) => {
        const target = getNeighborIndex(index, penaltyDirection, weapon.slots.length)
        if (target == null || !activeSlots.has(target)) return
        if (target === amplifiedTarget) return
        heat[target] += SLOT_PENALTY_MINOR
      })
    }
  })

  const total = heat.map((value, index) => value + block[index])
  return { heat, block, total }
}

function getPenaltyDisabledByAmplifier(weapon: WeaponInstance, activeSlots: Set<number>): boolean[] {
  const penaltyField = getPenaltyFieldByAmplifier(weapon, activeSlots)
  return penaltyField.total.map((penalty, index) => activeSlots.has(index) && penalty >= SLOT_PENALTY_MAJOR)
}

function getAmplificationCountForSlot(index: number, weapon: WeaponInstance, enabledSlots: Set<number>): number {
  if (!enabledSlots.has(index) || !weapon.slots[index]) return 0

  return weapon.slots.reduce((count, moduleType, ampIndex) => {
    if (!enabledSlots.has(ampIndex)) return count

    if (moduleType === 'heatAmplifierLeft' || moduleType === 'heatAmplifierRight') {
      const direction = moduleType === 'heatAmplifierLeft' ? 'left' : 'right'
      const targetIndex = getNeighborIndex(ampIndex, direction, weapon.slots.length)
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
  const penaltyField = getPenaltyFieldByAmplifier(weapon, activeSlots)
  const slotAmplificationReduction = penaltyField.total.map((penalty) => Math.floor(penalty / SLOT_PENALTY_MAJOR))
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
      slotPenalty: penaltyField.total,
      slotPenaltyHeat: penaltyField.heat,
      slotPenaltyBlock: penaltyField.block,
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
    slotPenalty: penaltyField.total,
    slotPenaltyHeat: penaltyField.heat,
    slotPenaltyBlock: penaltyField.block,
    slotPenaltyDisabled,
    slotDisabled,
    hasPreheater,
    power,
  }
}

export function isModuleType(value: string | null | undefined): value is ModuleType {
  return value === 'damage'
    || value === 'cooldown'
    || value === 'blockAmplifierUp'
    || value === 'blockAmplifierDown'
    || value === 'preheater'
    || value === 'heatAmplifierLeft'
    || value === 'heatAmplifierRight'
}
