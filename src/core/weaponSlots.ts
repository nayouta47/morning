import type { WeaponType } from './state.ts'

const BASE_ACTIVE_SLOT_INDEXES_BY_WEAPON_TYPE: Record<WeaponType, number[]> = {
  pistol: [23, 24, 33],
  rifle: [13, 16, 23, 24, 25, 26, 33, 36],
}

const LEFT_UNLOCKABLE_SLOT_INDEXES_BY_WEAPON_TYPE: Record<WeaponType, number[]> = {
  pistol: [22, 32],
  rifle: [22, 32],
}

export function getBaseActiveWeaponSlots(type: WeaponType): Set<number> {
  return new Set(BASE_ACTIVE_SLOT_INDEXES_BY_WEAPON_TYPE[type])
}

export function getLeftUnlockableWeaponSlots(type: WeaponType): Set<number> {
  return new Set(LEFT_UNLOCKABLE_SLOT_INDEXES_BY_WEAPON_TYPE[type])
}

export function getActiveWeaponSlots(type: WeaponType, unlockLeftSlots = false): Set<number> {
  if (!unlockLeftSlots) return getBaseActiveWeaponSlots(type)
  return new Set([...BASE_ACTIVE_SLOT_INDEXES_BY_WEAPON_TYPE[type], ...LEFT_UNLOCKABLE_SLOT_INDEXES_BY_WEAPON_TYPE[type]])
}

export function isActiveWeaponSlot(type: WeaponType, slotIndex: number, unlockLeftSlots = false): boolean {
  return getActiveWeaponSlots(type, unlockLeftSlots).has(slotIndex)
}
