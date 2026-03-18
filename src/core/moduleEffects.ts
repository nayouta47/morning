import { WEAPON_BASE_STATS } from '../data/balance.ts'
import { MODULE_POWER_COST as SHARED_MODULE_POWER_COST, isKnownModuleType } from '../data/modules.ts'
import type { ModuleType, WeaponInstance, WeaponType } from './state.ts'
import { getBaseActiveWeaponSlots } from './weaponSlots.ts'

const MIN_COOLDOWN_SEC = 0.5
const SLOT_COLUMNS = 10
const HASTE_PER_COOLDOWN_MODULE = 10

const WEAPON_POWER_CAPACITY: Record<WeaponType, number> = {
  pistol: 12,
  rifle: 30,
}

type Direction = 'left' | 'right' | 'up' | 'down'

export const SLOT_PENALTY_MINOR = 5
export const SLOT_PENALTY_MAJOR = 10

export const MODULE_POWER_COST: Record<ModuleType, number> = SHARED_MODULE_POWER_COST

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
  totalPenalty: number[]
  heatPenalty: number[]
  blockPenalty: number[]
  slotPenaltyDisabled: boolean[]
  slotDisabled: boolean[]
  unlockerActivatedSlots: Set<number>
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

function getOppositeDirection(direction: Direction): Direction {
  if (direction === 'left') return 'right'
  if (direction === 'right') return 'left'
  if (direction === 'up') return 'down'
  return 'up'
}

type PenaltyField = {
  heat: number[]
  block: number[]
  total: number[]
}

type PenaltyFieldTargetScope = 'activeOnly' | 'all'

function getPenaltyFieldByAmplifier(
  weapon: WeaponInstance,
  activeSlots: Set<number>,
  targetScope: PenaltyFieldTargetScope = 'activeOnly',
): PenaltyField {
  const heat = Array.from({ length: weapon.slots.length }, () => 0)
  const block = Array.from({ length: weapon.slots.length }, () => 0)

  weapon.slots.forEach((moduleType, index) => {
    if (!activeSlots.has(index)) return

    if (isAmplifierModule(moduleType)) {
      const direction = AMPLIFIER_DIRECTION[moduleType]
      if (direction) {
        getPenaltyDirections(direction).forEach((penaltyDirection) => {
          const penaltyIndex = getNeighborIndex(index, penaltyDirection, weapon.slots.length)
          if (penaltyIndex == null) return
          if (targetScope === 'activeOnly' && !activeSlots.has(penaltyIndex)) return
          block[penaltyIndex] += SLOT_PENALTY_MAJOR
        })
      }
    }

    if (isHeatAmplifierModule(moduleType)) {
      const direction = HEAT_AMPLIFIER_DIRECTION[moduleType]
      if (!direction) return

      const oppositeDirection = getOppositeDirection(direction)
      const majorPenaltyTarget = getNeighborIndex(index, oppositeDirection, weapon.slots.length)
      if (majorPenaltyTarget != null && (targetScope === 'all' || activeSlots.has(majorPenaltyTarget))) {
        heat[majorPenaltyTarget] += SLOT_PENALTY_MAJOR
      }

      getPenaltyDirections(direction).forEach((penaltyDirection) => {
        const target = getNeighborIndex(index, penaltyDirection, weapon.slots.length)
        if (target == null) return
        if (targetScope === 'activeOnly' && !activeSlots.has(target)) return
        heat[target] += SLOT_PENALTY_MINOR
      })
    }

    if (moduleType === 'generator') {
      ;(['up', 'down', 'left', 'right'] as Direction[]).forEach((dir) => {
        const target = getNeighborIndex(index, dir, weapon.slots.length)
        if (target == null) return
        if (targetScope === 'activeOnly' && !activeSlots.has(target)) return
        heat[target] += SLOT_PENALTY_MINOR
      })
    }
  })

  const total = heat.map((value, index) => value + block[index])
  return { heat, block, total }
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

function getPowerUsage(weapon: WeaponInstance, activeSlots: Set<number>, slotPenaltyDisabled: boolean[]): number {
  return weapon.slots.reduce((sum, moduleType, index) => {
    if (!moduleType || !activeSlots.has(index) || slotPenaltyDisabled[index]) return sum
    return sum + MODULE_POWER_COST[moduleType]
  }, 0)
}

function getRelativeLeftTargetIndex(originIndex: number, dx: number, maxSlots: number): number | null {
  const target = originIndex + dx
  if (target < 0 || target >= maxSlots) return null
  if (Math.floor(originIndex / SLOT_COLUMNS) !== Math.floor(target / SLOT_COLUMNS)) return null
  return target
}

function resolveWeaponActiveSlotState(weapon: WeaponInstance): { activeSlots: Set<number>; slotPenaltyDisabled: boolean[]; usage: number; overloaded: boolean } {
  const baseActiveSlots = getBaseActiveWeaponSlots(weapon.type)
  const capacity = WEAPON_POWER_CAPACITY[weapon.type]

  // Rule 3: 배치된 모든 모듈에서 패널티 선계산 (활성화 여부 무관, 불변)
  const allOccupied = new Set(weapon.slots.flatMap((m, i) => (m ? [i] : [])))
  const penaltyTotals = getPenaltyFieldByAmplifier(weapon, allOccupied, 'all').total

  const isModuleDisabled = (idx: number) => penaltyTotals[idx] >= SLOT_PENALTY_MAJOR

  const activeSlots = new Set<number>(baseActiveSlots)

  const isOverloaded = () => {
    const disabled = penaltyTotals.map((p, i) => activeSlots.has(i) && p >= SLOT_PENALTY_MAJOR)
    return getPowerUsage(weapon, activeSlots, disabled) > capacity
  }

  const queue: number[] = []

  const enqueueTargets = (unlockerIdx: number) => {
    if (isModuleDisabled(unlockerIdx)) return
    const l1 = getRelativeLeftTargetIndex(unlockerIdx, -1, weapon.slots.length)
    const l2 = getRelativeLeftTargetIndex(unlockerIdx, -2, weapon.slots.length)
    if (l1 != null && !activeSlots.has(l1)) queue.push(l1)
    if (l2 != null && !activeSlots.has(l2)) queue.push(l2)
  }

  for (const idx of baseActiveSlots) {
    if (weapon.slots[idx] === 'slotUnlocker') enqueueTargets(idx)
  }

  while (queue.length > 0) {
    const candidate = queue.shift()!
    if (activeSlots.has(candidate)) continue
    if (isOverloaded()) continue
    activeSlots.add(candidate)
    if (weapon.slots[candidate] === 'slotUnlocker') enqueueTargets(candidate)
  }

  const slotPenaltyDisabled = penaltyTotals.map((p, i) => activeSlots.has(i) && p >= SLOT_PENALTY_MAJOR)
  const usage = getPowerUsage(weapon, activeSlots, slotPenaltyDisabled)
  return { activeSlots, slotPenaltyDisabled, usage, overloaded: usage > capacity }
}

export function getEffectiveActiveWeaponSlots(weapon: WeaponInstance): Set<number> {
  return resolveWeaponActiveSlotState(weapon).activeSlots
}

export function getWeaponPowerStatus(weapon: WeaponInstance): WeaponPowerStatus {
  const resolved = resolveWeaponActiveSlotState(weapon)
  return {
    usage: resolved.usage,
    capacity: WEAPON_POWER_CAPACITY[weapon.type],
    overloaded: resolved.overloaded,
  }
}

export function getWeaponModuleLayerStats(weapon: WeaponInstance): ModuleLayerStats {
  const base = WEAPON_BASE_STATS[weapon.type]
  const resolved = resolveWeaponActiveSlotState(weapon)
  const activeSlots = resolved.activeSlots
  const gameplayPenaltyField = getPenaltyFieldByAmplifier(weapon, activeSlots, 'activeOnly')
  const allOccupied = new Set(weapon.slots.flatMap((m, i) => (m ? [i] : [])))
  const visualPenaltyField = getPenaltyFieldByAmplifier(weapon, allOccupied, 'all')
  const slotAmplificationReduction = gameplayPenaltyField.total.map((penalty) => Math.floor(penalty / SLOT_PENALTY_MAJOR))
  const slotPenaltyDisabled = resolved.slotPenaltyDisabled
  const slotDisabled = Array.from({ length: weapon.slots.length }, (_, index) => !activeSlots.has(index) || slotPenaltyDisabled[index])
  const enabledSlots = new Set(Array.from(activeSlots).filter((index) => !slotPenaltyDisabled[index]))
  const baseActiveSlots = getBaseActiveWeaponSlots(weapon.type)
  const unlockerActivatedSlots = new Set(Array.from(activeSlots).filter((index) => !baseActiveSlots.has(index)))
  const power: WeaponPowerStatus = {
    usage: resolved.usage,
    capacity: WEAPON_POWER_CAPACITY[weapon.type],
    overloaded: resolved.overloaded,
  }

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
      totalPenalty: visualPenaltyField.total,
      heatPenalty: visualPenaltyField.heat,
      blockPenalty: visualPenaltyField.block,
      slotPenaltyDisabled,
      slotDisabled,
      unlockerActivatedSlots,
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
    totalPenalty: visualPenaltyField.total,
    heatPenalty: visualPenaltyField.heat,
    blockPenalty: visualPenaltyField.block,
    slotPenaltyDisabled,
    slotDisabled,
    unlockerActivatedSlots,
    hasPreheater,
    power,
  }
}

export function isModuleType(value: string | null | undefined): value is ModuleType {
  return isKnownModuleType(value)
}
