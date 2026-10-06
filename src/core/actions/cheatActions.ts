import { MODULE_TYPES } from '../../data/modules.ts'
import type { ArmorType, GameState, WeaponType } from '../state.ts'
import { setActiveTab } from './baseActions.ts'
import { addWeapon } from './equipmentActions.ts'
import { narrate } from './logging.ts'

const ASSEMBLY_TEST_WEAPON_TYPES: WeaponType[] = ['pistol', 'rifle']
const ASSEMBLY_TEST_ARMOR_TYPES: ArmorType[] = ['junkArmor', 'ironArmor']
const ASSEMBLY_TEST_MODULE_STOCK = 20

export function grantAssemblyTestKit(state: GameState): void {
  if (state.buildings.workbench < 1) state.buildings.workbench = 1

  ASSEMBLY_TEST_WEAPON_TYPES.forEach((type) => {
    if (!state.weapons.some((weapon) => weapon.type === type)) addWeapon(state, type)
  })

  ASSEMBLY_TEST_ARMOR_TYPES.forEach((type) => {
    if (state.resources[type] < 1) state.resources[type] = 1
  })

  MODULE_TYPES.forEach((type) => {
    if (state.modules[type] < ASSEMBLY_TEST_MODULE_STOCK) state.modules[type] = ASSEMBLY_TEST_MODULE_STOCK
  })

  narrate(state, '치트: 조립 테스트 세트를 채웠다.')
  if (state.exploration.mode !== 'active') setActiveTab(state, 'assembly')
}
