import type { GameState } from '../../core/state.ts'
import type { ResourceId } from '../../data/resources.ts'
import type { Handlers } from '../types.ts'
import { getEventTargetElement } from '../view.ts'

export function bindExplorationInteractions(app: HTMLDivElement, _state: GameState, handlers: Handlers, signal?: AbortSignal): void {
  app.addEventListener('click', (event) => {
    const target = getEventTargetElement(event.target)
    if (!target) return

    if (target.closest<HTMLElement>('#recover-guide-robot')) {
      handlers.onStartRecoverGuideRobot()
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

    if (target.closest<HTMLElement>('#dungeon-enter')) {
      handlers.onEnterDungeon()
      return
    }

    if (target.closest<HTMLElement>('#dungeon-cancel')) {
      handlers.onCancelDungeonEntry()
      return
    }

    if (target.closest<HTMLElement>('#exploration-continue')) {
      handlers.onContinueAfterLoot()
      return
    }

    const loadoutAddButton = target.closest<HTMLElement>('[data-loadout-add]')
    if (loadoutAddButton) {
      const resourceId = loadoutAddButton.getAttribute('data-loadout-add') as ResourceId | null
      if (resourceId) handlers.onLoadoutAddItem(resourceId)
      return
    }

    const loadoutRemoveButton = target.closest<HTMLElement>('[data-loadout-remove]')
    if (loadoutRemoveButton) {
      const resourceId = loadoutRemoveButton.getAttribute('data-loadout-remove') as ResourceId | null
      if (resourceId) handlers.onLoadoutRemoveItem(resourceId)
      return
    }

    const loadoutFillButton = target.closest<HTMLElement>('[data-loadout-fill]')
    if (loadoutFillButton) {
      const resourceId = loadoutFillButton.getAttribute('data-loadout-fill') as ResourceId | null
      if (resourceId) handlers.onLoadoutFillItem(resourceId)
      return
    }

    const loadoutClearButton = target.closest<HTMLElement>('[data-loadout-clear]')
    if (loadoutClearButton) {
      const resourceId = loadoutClearButton.getAttribute('data-loadout-clear') as ResourceId | null
      if (resourceId) handlers.onLoadoutClearItem(resourceId)
    }
  }, { signal })
}
