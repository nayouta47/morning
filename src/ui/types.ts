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
  onGoToWork: () => void
  onGatherWood: () => void
  onGatherScrap: () => void
  onBuyLumberMill: () => void
  onBuyMiner: () => void
  onBuyWorkbench: () => void
  onBuyLab: () => void
  onBuyLaikaRepair: () => void
  onBuyDroneController: () => void
  onBuyElectricFurnace: () => void
  onSetSmeltingAllocation: (key: SmeltingProcessKey, value: number) => void
  onSetMinerAllocation: (key: MinerProcessKey, value: number) => void
  onToggleLumberMillRun: () => void
  onToggleSmeltingProcessRun: (key: SmeltingProcessKey) => void
  onToggleMinerProcessRun: (key: MinerProcessKey) => void
  onToggleScavengerRun: () => void
  onBuyUpgrade: (key: UpgradeKey) => void
  onSelectTab: (tab: import('../core/state.ts').TabKey) => void
  onStartRecoverGuideRobot: () => void
  onStartExploration: () => void
  onMoveExploration: (dx: number, dy: number) => void
  onFleeExplorationCombat: () => void
  onUseSyntheticFood: () => void
  onUseSmallHealPotion: () => void
  onTakeLoot: (resourceId: ResourceId) => void
  onContinueAfterLoot: () => void
  onEnterDungeon: () => void
  onCancelDungeonEntry: () => void
  onLoadoutAddItem: (resourceId: ResourceId) => void
  onLoadoutRemoveItem: (resourceId: ResourceId) => void
  onLoadoutFillItem: (resourceId: ResourceId) => void
  onLoadoutClearItem: (resourceId: ResourceId) => void
  onSelectOrganSlot: (slot: import('../core/state.ts').OrganType | null) => void
  onCraftPistol: () => void
  onCraftRifle: () => void
  onCraftModule: () => void
  onModuleCraftTierPrev: () => void
  onModuleCraftTierNext: () => void
  onCraftShovel: () => void
  onCraftScavengerDrone: () => void
  onCraftSyntheticFood: () => void
  onCraftSmallHealPotion: () => void
  onSelectWeapon: (weaponId: string) => void
  onReorderWeapons: (sourceWeaponId: string, targetWeaponId: string | null) => void
  onEquipModule: (moduleType: ModuleType, slotIndex: number) => void
  onMoveEquippedModule: (fromSlotIndex: number, toSlotIndex: number) => void
  onUnequipModule: (slotIndex: number) => void
  onCheatAccelerateBaseTime: () => void
  onDeleteData: () => void
  onClearLog: () => void
  onCheatGrantCodexChip: (moduleType: ModuleType) => void
  onCheatGrantResource: (resourceId: ResourceId) => void
  onConfirmRobotName: (name: string) => void
  onGoForWalk: () => void
  onContactFamily: () => void
  onConfirmDogName: (name: string) => void
  onDismissCollapseEvent: () => void
}

export type ActionUI = {
  goToWork: ActionGaugeView
  gatherWood: ActionGaugeView
  gatherScrap: ActionGaugeView
  recoverGuideRobot: ActionGaugeView
  goForWalk: ActionGaugeView
  contactFamily: ActionGaugeView
}

export type InteractionIntent =
  | { type: 'weapon/select'; weaponId: string }
  | { type: 'weapon/reorder'; sourceWeaponId: string; targetWeaponId: string | null }
  | { type: 'module/equip'; moduleType: ModuleType; slotIndex: number }
  | { type: 'module/move'; fromSlotIndex: number; toSlotIndex: number }
  | { type: 'module/unequip'; slotIndex: number }
