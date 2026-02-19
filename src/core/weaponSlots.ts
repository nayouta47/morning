import type { WeaponType } from './state.ts'

const ACTIVE_SLOT_INDEXES_BY_WEAPON_TYPE: Record<WeaponType, number[]> = {
  pistol: [23, 24, 25],
  rifle: [13, 14, 15, 16, 23, 24, 25, 26],
}

export function getActiveWeaponSlots(type: WeaponType): Set<number> {
  return new Set(ACTIVE_SLOT_INDEXES_BY_WEAPON_TYPE[type])
}

export function isActiveWeaponSlot(type: WeaponType, slotIndex: number): boolean {
  return ACTIVE_SLOT_INDEXES_BY_WEAPON_TYPE[type].includes(slotIndex)
}
