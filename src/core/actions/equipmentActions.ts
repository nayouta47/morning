import { MODULE_METADATA } from '../../data/modules.ts'
import type { GameState, ModuleType } from '../state.ts'
import { getEffectiveActiveWeaponSlots } from '../moduleEffects.ts'
import { narrate } from './logging.ts'

function moduleName(type: ModuleType): string {
  return MODULE_METADATA[type].equipmentLogName
}

export function equipModuleToSlot(state: GameState, weaponId: string, moduleType: ModuleType, slotIndex: number): boolean {
  const weapon = state.weapons.find((w) => w.id === weaponId)
  if (!weapon) return false
  if (slotIndex < 0 || slotIndex >= weapon.slots.length) return false
  if (!getEffectiveActiveWeaponSlots(weapon).has(slotIndex)) return false
  if (state.modules[moduleType] <= 0) return false

  const existing = weapon.slots[slotIndex]
  if (existing) {
    // swap: return existing module to inventory, equip new one
    state.modules[existing] += 1
    weapon.slots[slotIndex] = moduleType
    state.modules[moduleType] -= 1
    narrate(state, `교체: ${moduleName(existing)} -> ${moduleName(moduleType)} (${weapon.id} [${slotIndex + 1}])`)
    return true
  }

  weapon.slots[slotIndex] = moduleType
  state.modules[moduleType] -= 1
  narrate(state, `장착: ${moduleName(moduleType)} -> ${weapon.id} [${slotIndex + 1}]`)
  return true
}

export function unequipModuleFromSlot(state: GameState, weaponId: string, slotIndex: number): boolean {
  const weapon = state.weapons.find((w) => w.id === weaponId)
  if (!weapon) return false
  if (slotIndex < 0 || slotIndex >= weapon.slots.length) return false

  const moduleType = weapon.slots[slotIndex]
  if (!moduleType) return false

  weapon.slots[slotIndex] = null
  state.modules[moduleType] += 1
  narrate(state, `해제: ${weapon.id} [${slotIndex + 1}] -> ${moduleName(moduleType)}`)
  return true
}

export function moveEquippedModuleBetweenSlots(
  state: GameState,
  weaponId: string,
  fromSlotIndex: number,
  toSlotIndex: number,
): boolean {
  const weapon = state.weapons.find((w) => w.id === weaponId)
  if (!weapon) return false
  if (fromSlotIndex < 0 || fromSlotIndex >= weapon.slots.length) return false
  if (toSlotIndex < 0 || toSlotIndex >= weapon.slots.length) return false
  if (!getEffectiveActiveWeaponSlots(weapon).has(toSlotIndex)) return false
  if (fromSlotIndex === toSlotIndex) return false

  const sourceModuleType = weapon.slots[fromSlotIndex]
  if (!sourceModuleType) return false

  const targetModuleType = weapon.slots[toSlotIndex]

  weapon.slots[fromSlotIndex] = null
  weapon.slots[toSlotIndex] = sourceModuleType

  if (targetModuleType) {
    state.modules[targetModuleType] += 1
    narrate(
      state,
      `이동: ${weapon.id} [${fromSlotIndex + 1}] -> [${toSlotIndex + 1}] (${moduleName(targetModuleType)} 자동 해제)`,
    )
    return true
  }

  narrate(state, `이동: ${weapon.id} [${fromSlotIndex + 1}] -> [${toSlotIndex + 1}]`)
  return true
}

export function reorderWeapons(state: GameState, sourceWeaponId: string, targetWeaponId: string | null): boolean {
  const sourceIndex = state.weapons.findIndex((weapon) => weapon.id === sourceWeaponId)
  if (sourceIndex < 0) return false

  if (targetWeaponId === sourceWeaponId) return false

  const [sourceWeapon] = state.weapons.splice(sourceIndex, 1)
  if (!sourceWeapon) return false

  if (targetWeaponId == null) {
    state.weapons.push(sourceWeapon)
    return true
  }

  const targetIndex = state.weapons.findIndex((weapon) => weapon.id === targetWeaponId)
  if (targetIndex < 0) {
    state.weapons.splice(sourceIndex, 0, sourceWeapon)
    return false
  }

  state.weapons.splice(targetIndex, 0, sourceWeapon)
  return true
}
