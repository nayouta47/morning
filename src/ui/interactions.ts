import type { GameState } from '../core/state.ts'
import type { Handlers, InteractionIntent } from './types.ts'
import { bindAssemblyInteractions } from './interactions/assemblyBinder.ts'
import { bindBaseInteractions } from './interactions/baseBinder.ts'
import { bindCodexInteractions } from './interactions/codexBinder.ts'
import { bindExplorationInteractions } from './interactions/explorationBinder.ts'

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
  bindBaseInteractions(app, state, handlers)
  bindAssemblyInteractions(app, state, handlers, (intent) => dispatchInteractionIntent(handlers, intent))
  bindExplorationInteractions(app, state, handlers)
  bindCodexInteractions(app, state, handlers)

  const nameInput = app.querySelector<HTMLInputElement>('#robot-name-input')
  const confirmButton = app.querySelector<HTMLButtonElement>('#robot-name-confirm')
  const submit = () => {
    if (!nameInput) return
    handlers.onConfirmRobotName(nameInput.value)
  }
  confirmButton?.addEventListener('click', submit)
  nameInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      submit()
    }
  })
}
