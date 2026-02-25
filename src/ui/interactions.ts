import { getWeaponPowerStatus, isModuleType } from '../core/moduleEffects.ts'
import type { GameState, MinerProcessKey, ModuleType, SmeltingProcessKey } from '../core/state.ts'
import type { ResourceId } from '../data/resources.ts'
import type { Handlers, InteractionIntent } from './types.ts'
import { getEventTargetElement } from './view.ts'
import { patchModuleDetail, patchModuleInventory, patchWeaponBoard, setAssemblyPowerPreview, setSelectedModuleType } from './panels/assemblyPanel.ts'
import { patchCodexPanel, setCodexSubTab } from './panels/codexPanel.ts'

export function dispatchInteractionIntent(handlers: Handlers, intent: InteractionIntent): void {
  switch (intent.type) {
    case 'weapon/select':
      handlers.onSelectWeapon(intent.weaponId)
      return
    case 'weapon/reorder':
      handlers.onReorderWeapons(intent.sourceWeaponId, intent.targetWeaponId)
      return
    case 'module/equip':
      handlers.onEquipModule(intent.moduleType, intent.slotIndex)
      return
    case 'module/move':
      handlers.onMoveEquippedModule(intent.fromSlotIndex, intent.toSlotIndex)
      return
    case 'module/unequip':
      handlers.onUnequipModule(intent.slotIndex)
  }
}

export function bindUIInteractions(app: HTMLDivElement, state: GameState, handlers: Handlers): void {
  app.querySelector<HTMLButtonElement>('#tab-base')?.addEventListener('click', () => handlers.onSelectTab('base'))
  app.querySelector<HTMLButtonElement>('#tab-assembly')?.addEventListener('click', () => handlers.onSelectTab('assembly'))
  app.querySelector<HTMLButtonElement>('#tab-exploration')?.addEventListener('click', () => handlers.onSelectTab('exploration'))
  app.querySelector<HTMLButtonElement>('#tab-codex')?.addEventListener('click', () => handlers.onSelectTab('codex'))
  app.querySelector<HTMLButtonElement>('#cheat-accelerate-base-time')?.addEventListener('click', handlers.onCheatAccelerateBaseTime)
  app.querySelector<HTMLButtonElement>('#delete-data')?.addEventListener('click', handlers.onDeleteData)

  app.querySelector<HTMLButtonElement>('#gather-wood')?.addEventListener('click', handlers.onGatherWood)
  app.querySelector<HTMLButtonElement>('#gather-scrap')?.addEventListener('click', handlers.onGatherScrap)
  app.querySelector<HTMLButtonElement>('#buy-lumber')?.addEventListener('click', handlers.onBuyLumberMill)
  app.querySelector<HTMLButtonElement>('#buy-miner')?.addEventListener('click', handlers.onBuyMiner)
  app.querySelector<HTMLButtonElement>('#buy-workbench')?.addEventListener('click', handlers.onBuyWorkbench)
  app.querySelector<HTMLButtonElement>('#buy-lab')?.addEventListener('click', handlers.onBuyLab)
  app.querySelector<HTMLButtonElement>('#buy-laika-repair')?.addEventListener('click', handlers.onBuyLaikaRepair)
  app.querySelector<HTMLButtonElement>('#buy-drone-controller')?.addEventListener('click', handlers.onBuyDroneController)
  app.querySelector<HTMLButtonElement>('#buy-electric-furnace')?.addEventListener('click', handlers.onBuyElectricFurnace)
  app.querySelectorAll<HTMLButtonElement>('button[data-smelting-allocation-step][data-smelting-allocation-key]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.smeltingAllocationKey as SmeltingProcessKey | undefined
      const direction = button.dataset.smeltingAllocationStep
      if (!key || (direction !== 'up' && direction !== 'down')) return
      const current = state.smeltingAllocation[key]
      handlers.onSetSmeltingAllocation(key, current + (direction === 'up' ? 1 : -1))
    })
  })
  app.querySelectorAll<HTMLButtonElement>('button[data-miner-allocation-step][data-miner-allocation-key]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.minerAllocationKey as MinerProcessKey | undefined
      const direction = button.dataset.minerAllocationStep
      if (!key || (direction !== 'up' && direction !== 'down')) return
      const current = state.minerAllocation[key]
      handlers.onSetMinerAllocation(key, current + (direction === 'up' ? 1 : -1))
    })
  })
  app.querySelector<HTMLButtonElement>('#lumber-progress')?.addEventListener('click', handlers.onToggleLumberMillRun)
  ;(['burnWood', 'meltScrap', 'meltIron', 'meltSiliconMass'] as SmeltingProcessKey[]).forEach((key) => {
    app.querySelector<HTMLButtonElement>(`#smelting-gauge-${key}`)?.addEventListener('click', () => handlers.onToggleSmeltingProcessRun(key))
  })
  ;(['crushScrap', 'crushSiliconMass'] as MinerProcessKey[]).forEach((key) => {
    app.querySelector<HTMLButtonElement>(`#miner-gauge-${key}`)?.addEventListener('click', () => handlers.onToggleMinerProcessRun(key))
  })
  app.querySelector<HTMLButtonElement>('#scavenger-progress')?.addEventListener('click', handlers.onToggleScavengerRun)

  app.querySelectorAll<HTMLButtonElement>('button[data-upgrade]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.upgrade as keyof typeof import('../data/balance.ts').UPGRADE_DEFS
      handlers.onBuyUpgrade(key)
    })
  })

  app.querySelector<HTMLButtonElement>('#craft-pistol')?.addEventListener('click', handlers.onCraftPistol)
  app.querySelector<HTMLButtonElement>('#craft-rifle')?.addEventListener('click', handlers.onCraftRifle)
  app.querySelector<HTMLButtonElement>('#craft-module')?.addEventListener('click', handlers.onCraftModule)
  app.querySelector<HTMLButtonElement>('#module-craft-tier-prev')?.addEventListener('click', handlers.onModuleCraftTierPrev)
  app.querySelector<HTMLButtonElement>('#module-craft-tier-next')?.addEventListener('click', handlers.onModuleCraftTierNext)
  app.querySelector<HTMLButtonElement>('#craft-shovel')?.addEventListener('click', handlers.onCraftShovel)
  app.querySelector<HTMLButtonElement>('#craft-scavenger-drone')?.addEventListener('click', handlers.onCraftScavengerDrone)
  app.querySelector<HTMLButtonElement>('#craft-synthetic-food')?.addEventListener('click', handlers.onCraftSyntheticFood)
  app.querySelector<HTMLButtonElement>('#craft-small-heal-potion')?.addEventListener('click', handlers.onCraftSmallHealPotion)

  const selectModuleForDetail = (eventTarget: EventTarget | null): void => {
    const target = getEventTargetElement(eventTarget)
    if (!target) return

    const inventoryModuleItem = target.closest<HTMLElement>('#module-list-items [data-module-type]')
    const slotModuleItem = target.closest<HTMLElement>('[data-slot-index].filled[data-module-type]')
    const moduleItem = inventoryModuleItem ?? slotModuleItem
    const moduleType = moduleItem?.getAttribute('data-module-type') as ModuleType | null
    if (!moduleType) return

    setSelectedModuleType(moduleType, inventoryModuleItem ? 'inventory' : 'slot')
    patchModuleInventory(app, state)
    patchModuleDetail(app, state)
  }

  type ModuleDragState = {
    kind: 'inventory' | 'slot'
    moduleType: ModuleType
    sourceSlotIndex?: number
    sourceWeaponId?: string
  }

  let activeModuleDrag: ModuleDragState | null = null

  const clearAssemblyPreview = (): void => {
    setAssemblyPowerPreview(null)
    patchWeaponBoard(app, state)
  }

  const resetModuleDragState = (): void => {
    activeModuleDrag = null
    clearAssemblyPreview()
  }

  const setProjectedPowerPreview = (dragKind: string, moduleType: ModuleType, targetSlotIndex: number, sourceSlotIndex?: number): void => {
    const selectedWeapon = state.selectedWeaponId ? state.weapons.find((weapon) => weapon.id === state.selectedWeaponId) : null
    if (!selectedWeapon) {
      clearAssemblyPreview()
      return
    }

    const slots = [...selectedWeapon.slots]
    if (dragKind === 'inventory') {
      if (slots[targetSlotIndex]) {
        clearAssemblyPreview()
        return
      }
      slots[targetSlotIndex] = moduleType
    } else if (dragKind === 'slot') {
      if (!Number.isFinite(sourceSlotIndex)) {
        clearAssemblyPreview()
        return
      }
      const from = sourceSlotIndex as number
      if (from === targetSlotIndex) {
        clearAssemblyPreview()
        return
      }
      const sourceModule = slots[from]
      if (!sourceModule) {
        clearAssemblyPreview()
        return
      }
      const targetModule = slots[targetSlotIndex]
      slots[from] = null
      slots[targetSlotIndex] = sourceModule
      if (targetModule) slots[from] = targetModule
    } else {
      clearAssemblyPreview()
      return
    }

    const projectedPower = getWeaponPowerStatus({ ...selectedWeapon, slots })
    setAssemblyPowerPreview({
      usage: projectedPower.usage,
      capacity: projectedPower.capacity,
      overloaded: projectedPower.overloaded,
      slotIndex: targetSlotIndex,
    })
    patchWeaponBoard(app, state)
  }

  app.addEventListener('pointerdown', (event) => {
    selectModuleForDetail(event.target)
  })

  app.addEventListener('click', (event) => {
    const target = getEventTargetElement(event.target)
    if (!target) return

    const codexSubTabButton = target.closest<HTMLButtonElement>('[data-codex-subtab]')
    if (codexSubTabButton) {
      const subTab = codexSubTabButton.getAttribute('data-codex-subtab')
      if (subTab === 'enemy' || subTab === 'chip') {
        setCodexSubTab(subTab)
        patchCodexPanel(app, state)
      }
      return
    }

    const codexToggle = target.closest<HTMLButtonElement>('[data-codex-toggle]')
    if (codexToggle) {
      const codexList = app.querySelector<HTMLElement>('#codex-list')
      if (!codexList) return

      const expanded = codexToggle.getAttribute('aria-expanded') === 'true'
      codexList.querySelectorAll<HTMLButtonElement>('[data-codex-toggle]').forEach((button) => {
        button.setAttribute('aria-expanded', 'false')
      })
      codexList.querySelectorAll<HTMLElement>('.codex-card-body').forEach((body) => {
        body.classList.add('hidden')
      })

      if (!expanded) {
        codexToggle.setAttribute('aria-expanded', 'true')
        const detailsId = codexToggle.getAttribute('aria-controls')
        const details = detailsId ? codexList.querySelector<HTMLElement>(`#${detailsId}`) : null
        details?.classList.remove('hidden')
      }
      return
    }

    if (target.closest<HTMLElement>('#exploration-start')) {
      handlers.onStartExploration()
      return
    }

    if (target.closest<HTMLElement>('#exploration-flee')) {
      handlers.onFleeExplorationCombat()
      return
    }

    if (target.closest<HTMLElement>('#exploration-use-synthetic-food')) {
      handlers.onUseSyntheticFood()
      return
    }

    if (target.closest<HTMLElement>('#exploration-use-small-heal-potion')) {
      handlers.onUseSmallHealPotion()
      return
    }

    const lootButton = target.closest<HTMLElement>('[data-loot-resource]')
    if (lootButton) {
      const resourceId = lootButton.getAttribute('data-loot-resource') as ResourceId | null
      if (resourceId) handlers.onTakeLoot(resourceId)
      return
    }

    if (target.closest<HTMLElement>('#exploration-continue')) {
      handlers.onContinueAfterLoot()
      return
    }

    const button = target.closest<HTMLElement>('[data-weapon-id]')
    const id = button?.getAttribute('data-weapon-id')
    if (id) dispatchInteractionIntent(handlers, { type: 'weapon/select', weaponId: id })
  })

  app.addEventListener('dragstart', (event) => {
    resetModuleDragState()
    selectModuleForDetail(event.target)
    const target = getEventTargetElement(event.target)
    if (!target || !event.dataTransfer) return

    const weaponItem = target.closest<HTMLElement>('#weapon-list-items [data-weapon-id]')
    if (weaponItem) {
      const weaponId = weaponItem.getAttribute('data-weapon-id')
      if (!weaponId) return
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/weapon-drag-kind', 'inventory')
      event.dataTransfer.setData('text/weapon-id', weaponId)
      return
    }

    const moduleItem = target.closest<HTMLElement>('#module-list-items [data-module-type]')
    if (moduleItem) {
      const moduleType = moduleItem.getAttribute('data-module-type') as ModuleType | null
      if (!moduleType) return
      activeModuleDrag = { kind: 'inventory', moduleType }
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/module-drag-kind', 'inventory')
      event.dataTransfer.setData('text/module-type', moduleType)
      return
    }

    const slot = target.closest<HTMLElement>('[data-slot-index].filled')
    if (!slot || !state.selectedWeaponId) return
    const moduleType = slot.getAttribute('data-module-type') as ModuleType | null
    if (!moduleType) return
    const slotIndex = Number(slot.getAttribute('data-slot-index'))
    if (!Number.isFinite(slotIndex)) return

    activeModuleDrag = {
      kind: 'slot',
      moduleType,
      sourceSlotIndex: slotIndex,
      sourceWeaponId: state.selectedWeaponId,
    }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/module-drag-kind', 'slot')
    event.dataTransfer.setData('text/module-type', moduleType)
    event.dataTransfer.setData('text/module-slot-index', String(slotIndex))
    event.dataTransfer.setData('text/module-weapon-id', state.selectedWeaponId)
  })

  app.addEventListener('dragover', (event) => {
    if (!event.dataTransfer) return
    const target = getEventTargetElement(event.target)
    if (!target) return

    if (event.dataTransfer.getData('text/weapon-drag-kind') === 'inventory' && target.closest<HTMLElement>('#weapon-list-items')) {
      clearAssemblyPreview()
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      return
    }

    const dataTransferDragKind = event.dataTransfer.getData('text/module-drag-kind')
    const dragKind = (activeModuleDrag?.kind ?? dataTransferDragKind) as string
    const moduleType = activeModuleDrag?.moduleType ?? (event.dataTransfer.getData('text/module-type') as ModuleType)
    const sourceSlotFromState = activeModuleDrag?.sourceSlotIndex
    const sourceSlotFromData = Number(event.dataTransfer.getData('text/module-slot-index'))
    const sourceSlotIndex = Number.isFinite(sourceSlotFromState) ? sourceSlotFromState : sourceSlotFromData

    const slot = target.closest<HTMLElement>('[data-slot-index]')
    if (slot) {
      if (slot.getAttribute('data-accepts') !== 'true') {
        clearAssemblyPreview()
        return
      }
      if (dragKind === 'inventory' && slot.classList.contains('filled')) {
        clearAssemblyPreview()
        return
      }

      const slotIndex = Number(slot.getAttribute('data-slot-index'))
      if (isModuleType(moduleType) && Number.isFinite(slotIndex)) {
        setProjectedPowerPreview(dragKind, moduleType, slotIndex, sourceSlotIndex)
      } else {
        clearAssemblyPreview()
      }

      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      return
    }

    clearAssemblyPreview()
    if (target.closest<HTMLElement>('.module-inventory') && dragKind === 'slot') {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
    }
  })

  app.addEventListener('drop', (event) => {
    clearAssemblyPreview()
    if (!event.dataTransfer) {
      activeModuleDrag = null
      return
    }
    const target = getEventTargetElement(event.target)
    if (!target) {
      activeModuleDrag = null
      return
    }

    if (event.dataTransfer.getData('text/weapon-drag-kind') === 'inventory') {
      const sourceWeaponId = event.dataTransfer.getData('text/weapon-id')
      if (!sourceWeaponId || !target.closest<HTMLElement>('#weapon-list-items')) return
      const targetWeaponId = target.closest<HTMLElement>('[data-weapon-id]')?.getAttribute('data-weapon-id') ?? null
      event.preventDefault()
      dispatchInteractionIntent(handlers, { type: 'weapon/reorder', sourceWeaponId, targetWeaponId })
      return
    }

    const dragKind = activeModuleDrag?.kind ?? event.dataTransfer.getData('text/module-drag-kind')

    if (target.closest<HTMLElement>('.module-inventory') && dragKind === 'slot') {
      const sourceSlotCandidate = activeModuleDrag?.sourceSlotIndex ?? Number(event.dataTransfer.getData('text/module-slot-index'))
      const sourceWeaponId = activeModuleDrag?.sourceWeaponId ?? event.dataTransfer.getData('text/module-weapon-id')
      if (!Number.isFinite(sourceSlotCandidate) || !state.selectedWeaponId || sourceWeaponId !== state.selectedWeaponId) return
      event.preventDefault()
      dispatchInteractionIntent(handlers, { type: 'module/unequip', slotIndex: sourceSlotCandidate })
      return
    }

    const moduleType = activeModuleDrag?.moduleType ?? (event.dataTransfer.getData('text/module-type') as ModuleType)
    if (!isModuleType(moduleType)) return

    const slot = target.closest<HTMLElement>('[data-slot-index]')
    if (!slot) return
    const slotIndex = Number(slot.getAttribute('data-slot-index'))
    if (!Number.isFinite(slotIndex) || slot.getAttribute('data-accepts') !== 'true') return

    if (dragKind === 'inventory') {
      if (slot.classList.contains('filled')) return
      event.preventDefault()
      dispatchInteractionIntent(handlers, { type: 'module/equip', moduleType, slotIndex })
      return
    }

    if (dragKind === 'slot') {
      const sourceSlotCandidate = activeModuleDrag?.sourceSlotIndex ?? Number(event.dataTransfer.getData('text/module-slot-index'))
      const sourceWeaponId = activeModuleDrag?.sourceWeaponId ?? event.dataTransfer.getData('text/module-weapon-id')
      if (!Number.isFinite(sourceSlotCandidate) || !state.selectedWeaponId || sourceWeaponId !== state.selectedWeaponId) return
      event.preventDefault()
      dispatchInteractionIntent(handlers, { type: 'module/move', fromSlotIndex: sourceSlotCandidate, toSlotIndex: slotIndex })
    }

    activeModuleDrag = null
  })

  app.addEventListener('dragleave', (event) => {
    if (!activeModuleDrag) return
    const nextTarget = event.relatedTarget
    if (nextTarget instanceof Node && app.contains(nextTarget)) return
    clearAssemblyPreview()
  })

  app.addEventListener('dragend', () => {
    resetModuleDragState()
  })

  app.addEventListener('contextmenu', (event) => {
    const slot = getEventTargetElement(event.target)?.closest<HTMLElement>('[data-slot-index]')
    if (!slot || !slot.classList.contains('filled')) return
    event.preventDefault()
    const slotIndex = Number(slot.getAttribute('data-slot-index'))
    if (Number.isFinite(slotIndex)) dispatchInteractionIntent(handlers, { type: 'module/unequip', slotIndex })
  })

  app.addEventListener('mousedown', (event) => {
    if (event.button !== 1) return
    const codexChipCard = getEventTargetElement(event.target)?.closest<HTMLElement>('#codex-chip-list [data-codex-chip-type]')
    if (codexChipCard) event.preventDefault()
  })

  app.addEventListener('auxclick', (event) => {
    if (event.button !== 1) return

    const target = getEventTargetElement(event.target)
    if (!target) return

    const codexChipCard = target.closest<HTMLElement>('#codex-chip-list [data-codex-chip-type]')
    if (codexChipCard) {
      event.preventDefault()
      const moduleType = codexChipCard.getAttribute('data-codex-chip-type') as ModuleType | null
      if (moduleType && isModuleType(moduleType)) {
        handlers.onCheatGrantCodexChip(moduleType)
      }
      return
    }

    const slot = target.closest<HTMLElement>('[data-slot-index]')
    if (!slot || !slot.classList.contains('filled')) return
    event.preventDefault()
    const slotIndex = Number(slot.getAttribute('data-slot-index'))
    if (Number.isFinite(slotIndex)) dispatchInteractionIntent(handlers, { type: 'module/unequip', slotIndex })
  })
}
