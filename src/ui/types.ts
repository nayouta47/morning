import type { MinerProcessKey, ModuleType, SmeltingProcessKey } from '../core/state.ts'
import type { ResourceId } from '../data/resources.ts'

type UpgradeKey = keyof typeof import('../data/balance.ts').UPGRADE_DEFS

export type ActionPhase = 'ready' | 'cooldown' | 'locked'

export type ActionGaugeView = {
  phase: ActionPhase
  progress: number
  disabled: boolean
  label: string
  timeText: string
}

export type Handlers = {
  onGatherWood: () => void
  onGatherScrap: () => void
  onBuyLumberMill: () => void
  onBuyMiner: () => void
  onBuyWorkbench: () => void
  onBuyLab: () => void
  onBuyVehicleRepair: () => void
  onBuyDroneController: () => void
  onBuyElectricFurnace: () => void
  onSetSmeltingAllocation: (key: SmeltingProcessKey, value: number) => void
  onSetMinerAllocation: (key: MinerProcessKey, value: number) => void
  onToggleLumberMillRun: () => void
  onToggleMinerRun: () => void
  onToggleScavengerRun: () => void
  onBuyUpgrade: (key: UpgradeKey) => void
  onSelectTab: (tab: 'base' | 'assembly' | 'exploration' | 'codex') => void
  onStartExploration: () => void
  onMoveExploration: (dx: number, dy: number) => void
  onFleeExplorationCombat: () => void
  onTakeLoot: (resourceId: ResourceId) => void
  onContinueAfterLoot: () => void
  onCraftPistol: () => void
  onCraftRifle: () => void
  onCraftModule: () => void
  onCraftShovel: () => void
  onCraftScavengerDrone: () => void
  onSelectWeapon: (weaponId: string) => void
  onReorderWeapons: (sourceWeaponId: string, targetWeaponId: string | null) => void
  onEquipModule: (moduleType: ModuleType, slotIndex: number) => void
  onMoveEquippedModule: (fromSlotIndex: number, toSlotIndex: number) => void
  onUnequipModule: (slotIndex: number) => void
}

export type ActionUI = {
  gatherWood: ActionGaugeView
  gatherScrap: ActionGaugeView
}

export type InteractionIntent =
  | { type: 'weapon/select'; weaponId: string }
  | { type: 'weapon/reorder'; sourceWeaponId: string; targetWeaponId: string | null }
  | { type: 'module/equip'; moduleType: ModuleType; slotIndex: number }
  | { type: 'module/move'; fromSlotIndex: number; toSlotIndex: number }
  | { type: 'module/unequip'; slotIndex: number }
