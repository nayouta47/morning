import { isModuleType } from '../../core/moduleEffects.ts'
import type { GameState, ModuleType } from '../../core/state.ts'
import type { Handlers } from '../types.ts'
import { getEventTargetElement } from '../view.ts'
import { patchCodexPanel, setCodexSubTab } from '../panels/codexPanel.ts'

export function bindCodexInteractions(app: HTMLDivElement, state: GameState, handlers: Handlers, signal?: AbortSignal): void {
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
    if (!codexToggle) return
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
  }, { signal })

  app.addEventListener('mousedown', (event) => {
    if (event.button !== 1) return
    const codexChipCard = getEventTargetElement(event.target)?.closest<HTMLElement>('#codex-chip-list [data-codex-chip-type]')
    if (codexChipCard) event.preventDefault()
  }, { signal })

  app.addEventListener('auxclick', (event) => {
    if (event.button !== 1) return
    const target = getEventTargetElement(event.target)
    if (!target) return

    const codexChipCard = target.closest<HTMLElement>('#codex-chip-list [data-codex-chip-type]')
    if (!codexChipCard) return

    event.preventDefault()
    const moduleType = codexChipCard.getAttribute('data-codex-chip-type') as ModuleType | null
    if (moduleType && isModuleType(moduleType)) {
      handlers.onCheatGrantCodexChip(moduleType)
    }
  }, { signal })
}
