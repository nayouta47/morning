import { narrate } from '../../core/actions.ts'
import { getWeaponPowerStatus, isModuleType } from '../../core/moduleEffects.ts'
import type { GameState, ModuleType } from '../../core/state.ts'
import type { Handlers, InteractionIntent } from '../types.ts'
import { getEventTargetElement } from '../view.ts'
import { patchModuleDetail, patchModuleInventory, patchWeaponBoard, setAssemblyPowerPreview, setSelectedModuleType } from '../panels/assemblyPanel.ts'
import { copyTextToClipboard, getWeaponSlotDebugText } from './assemblyDebug.ts'

type ModuleDragState = {
  kind: 'inventory' | 'slot'
  moduleType: ModuleType
  sourceSlotIndex?: number
  sourceWeaponId?: string
}

export function bindAssemblyInteractions(
  app: HTMLDivElement,
  state: GameState,
  _handlers: Handlers,
  dispatchIntent: (intent: InteractionIntent) => void,
  signal?: AbortSignal,
): void {
  let activeModuleDrag: ModuleDragState | null = null

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
  }, { signal })

  app.addEventListener('click', (event) => {
    const target = getEventTargetElement(event.target)
    if (!target) return

    const copySlotStateButton = target.closest<HTMLButtonElement>('#copy-selected-weapon-slot-state')
    if (copySlotStateButton) {
      const text = getWeaponSlotDebugText(state)
      if (!text) {
        narrate(state, '복사 실패: 선택된 무기가 없습니다.')
        return
      }

      void copyTextToClipboard(text).then((copied) => {
        narrate(state, copied ? '선택 무기 슬롯 상태를 클립보드에 복사했습니다.' : '복사 실패: 클립보드 접근이 차단되었습니다.')
      })
      return
    }

    const button = target.closest<HTMLElement>('[data-weapon-id]')
    const id = button?.getAttribute('data-weapon-id')
    if (id) dispatchIntent({ type: 'weapon/select', weaponId: id === state.selectedWeaponId ? null : id })
  }, { signal })

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
  }, { signal })

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
  }, { signal })

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
      dispatchIntent({ type: 'weapon/reorder', sourceWeaponId, targetWeaponId })
      return
    }

    const dragKind = activeModuleDrag?.kind ?? event.dataTransfer.getData('text/module-drag-kind')

    if (target.closest<HTMLElement>('.module-inventory') && dragKind === 'slot') {
      const sourceSlotCandidate = activeModuleDrag?.sourceSlotIndex ?? Number(event.dataTransfer.getData('text/module-slot-index'))
      const sourceWeaponId = activeModuleDrag?.sourceWeaponId ?? event.dataTransfer.getData('text/module-weapon-id')
      if (!Number.isFinite(sourceSlotCandidate) || !state.selectedWeaponId || sourceWeaponId !== state.selectedWeaponId) return
      event.preventDefault()
      dispatchIntent({ type: 'module/unequip', slotIndex: sourceSlotCandidate })
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
      dispatchIntent({ type: 'module/equip', moduleType, slotIndex })
      return
    }

    if (dragKind === 'slot') {
      const sourceSlotCandidate = activeModuleDrag?.sourceSlotIndex ?? Number(event.dataTransfer.getData('text/module-slot-index'))
      const sourceWeaponId = activeModuleDrag?.sourceWeaponId ?? event.dataTransfer.getData('text/module-weapon-id')
      if (!Number.isFinite(sourceSlotCandidate) || !state.selectedWeaponId || sourceWeaponId !== state.selectedWeaponId) return
      event.preventDefault()
      dispatchIntent({ type: 'module/move', fromSlotIndex: sourceSlotCandidate, toSlotIndex: slotIndex })
    }

    activeModuleDrag = null
  }, { signal })

  app.addEventListener('dragleave', (event) => {
    if (!activeModuleDrag) return
    const nextTarget = event.relatedTarget
    if (nextTarget instanceof Node && app.contains(nextTarget)) return
    clearAssemblyPreview()
  }, { signal })

  app.addEventListener('dragend', () => {
    resetModuleDragState()
  }, { signal })

  app.addEventListener('contextmenu', (event) => {
    event.preventDefault()

    const slot = getEventTargetElement(event.target)?.closest<HTMLElement>('[data-slot-index]')
    if (!slot || !slot.classList.contains('filled')) return

    const slotIndex = Number(slot.getAttribute('data-slot-index'))
    if (Number.isFinite(slotIndex)) dispatchIntent({ type: 'module/unequip', slotIndex })
  }, { signal })

  app.addEventListener('auxclick', (event) => {
    if (event.button !== 1) return

    const target = getEventTargetElement(event.target)
    if (!target) return

    const slot = target.closest<HTMLElement>('[data-slot-index]')
    if (!slot || !slot.classList.contains('filled')) return
    event.preventDefault()
    const slotIndex = Number(slot.getAttribute('data-slot-index'))
    if (Number.isFinite(slotIndex)) dispatchIntent({ type: 'module/unequip', slotIndex })
  }, { signal })
}
