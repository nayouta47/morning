import type { GameState, MinerProcessKey, OrganType, SmeltingProcessKey } from '../../core/state.ts'
import type { ResourceId } from '../../data/resources.ts'
import type { Handlers } from '../types.ts'

export function bindBaseInteractions(app: HTMLDivElement, state: GameState, handlers: Handlers, signal?: AbortSignal): void {
  app.querySelector<HTMLButtonElement>('#tab-base')?.addEventListener('click', () => handlers.onSelectTab('base'))
  app.querySelector<HTMLButtonElement>('#tab-assembly')?.addEventListener('click', () => handlers.onSelectTab('assembly'))
  app.querySelector<HTMLButtonElement>('#tab-body')?.addEventListener('click', () => handlers.onSelectTab('body'))
  app.querySelector<HTMLButtonElement>('#tab-exploration')?.addEventListener('click', () => handlers.onSelectTab('exploration'))
  app.querySelector<HTMLButtonElement>('#tab-codex')?.addEventListener('click', () => handlers.onSelectTab('codex'))

  app.querySelectorAll<HTMLButtonElement>('button[data-organ-slot]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const slot = btn.dataset.organSlot as OrganType | undefined
      if (!slot) return
      const isCurrent = state.selectedOrganSlot === slot
      handlers.onSelectOrganSlot(isCurrent ? null : slot)
    })
  })
  app.querySelector<HTMLButtonElement>('#cheat-accelerate-base-time')?.addEventListener('click', handlers.onCheatAccelerateBaseTime)
  app.querySelector<HTMLButtonElement>('#delete-data')?.addEventListener('click', handlers.onDeleteData)

  app.querySelectorAll<HTMLButtonElement>('button[data-clear-log]').forEach((button) => {
    button.addEventListener('click', handlers.onClearLog)
  })

  app.addEventListener('mousedown', (event) => {
    if (event.button !== 1) return
    const target = event.target
    if (!(target instanceof Element)) return
    const resourceRow = target.closest<HTMLElement>('#panel-base .warehouse-column[aria-label="자원"] [data-resource-row][data-resource-id]')
    if (!resourceRow) return
    event.preventDefault()
  }, { signal })

  app.addEventListener('auxclick', (event) => {
    if (event.button !== 1) return
    const target = event.target
    if (!(target instanceof Element)) return
    const resourceRow = target.closest<HTMLElement>('#panel-base .warehouse-column[aria-label="자원"] [data-resource-row][data-resource-id]')
    if (!resourceRow) return

    event.preventDefault()
    const resourceId = resourceRow.getAttribute('data-resource-id') as ResourceId | null
    if (!resourceId || !(resourceId in state.resources)) return
    handlers.onCheatGrantResource(resourceId)
  }, { signal })

  app.querySelector<HTMLButtonElement>('#go-to-work')?.addEventListener('click', handlers.onGoToWork)
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
      const key = button.dataset.upgrade as keyof typeof import('../../data/balance.ts').UPGRADE_DEFS
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
}
