import type { GameState, MinerProcessKey, SmeltingProcessKey } from '../../core/state.ts'
import { getBuildingCost } from '../../core/actions.ts'
import { SHOVEL_MAX_STACK, getGatherScrapRewardPreview, getGatherWoodReward, getShovelCount } from '../../core/rewards.ts'
import { BUILDING_CYCLE_MS, SMELTING_CYCLE_MS, UPGRADE_DEFS, getUpgradeCost } from '../../data/balance.ts'
import { CRAFT_RECIPE_DEFS, getCraftRecipeCost, getCraftRecipeDuration, getCraftRecipeMissingRequirement, type CraftRecipeKey } from '../../data/crafting.ts'
import { getBuildingLabel } from '../../data/buildings.ts'
import { formatCost, formatResourceAmount, formatResourceValue, getResourceDisplay } from '../../data/resources.ts'
import type { ActionGaugeView, ActionUI } from '../types.ts'
import { clamp01, formatActionTime } from '../view.ts'

export type ProductionBuildingKey = 'lumberMill' | 'scavenger'

export type BuildingGaugeView = {
  progress: number
  percentText: string
  timeText: string
  phase: 'running' | 'paused' | 'idle'
}

function formatBuildingTime(progress: number, isActive: boolean): string {
  const totalSec = BUILDING_CYCLE_MS / 1000
  if (!isActive) return `- / ${totalSec.toFixed(1)}s`
  const remainingSec = (1 - clamp01(progress)) * totalSec
  return `${remainingSec.toFixed(1)}s / ${totalSec.toFixed(1)}s`
}

export function getBuildingGaugeView(state: GameState, key: ProductionBuildingKey, now = Date.now()): BuildingGaugeView {
  const isInstalled = key === 'scavenger' ? state.buildings.droneController > 0 : state.buildings[key] > 0
  if (!isInstalled) {
    return {
      progress: 0,
      percentText: key === 'scavenger' ? '잠김' : '대기',
      timeText: key === 'scavenger' ? '드론 컨트롤러 필요' : formatBuildingTime(0, false),
      phase: 'idle',
    }
  }

  if (key === 'scavenger' && state.resources.scavengerDrone < 1) {
    return { progress: 0, percentText: '잠김', timeText: '스캐빈저 드론 필요', phase: 'idle' }
  }

  const isRunning = state.productionRunning[key]
  const baseProgressMs = state.productionProgress[key]
  const elapsedSinceUpdate = isRunning ? Math.max(0, now - state.lastUpdate) : 0
  const smoothedProgressMs = (baseProgressMs + elapsedSinceUpdate) % BUILDING_CYCLE_MS
  const progress = clamp01(smoothedProgressMs / BUILDING_CYCLE_MS)

  return {
    progress,
    percentText: isRunning ? `${Math.round(progress * 100)}%` : '중지됨',
    timeText: isRunning ? formatBuildingTime(progress, true) : '일시정지',
    phase: isRunning ? 'running' : 'paused',
  }
}

export function renderGaugeButton(id: string, text: string, ariaLabel: string, action: ActionGaugeView): string {
  const progress = Math.round(clamp01(action.progress) * 100)
  return `
    <button id="${id}" class="gauge-action gauge-${action.phase}" aria-label="${ariaLabel}" ${action.disabled ? 'disabled' : ''}>
      <span class="gauge-fill" style="width:${progress}%"></span>
      <span class="gauge-content gauge-text-stack">
        <span class="gauge-title gauge-text-title">${text}</span>
        <span class="gauge-meta gauge-text-meta">
          <span class="gauge-state gauge-text-state">${action.label}</span>
          <span class="gauge-time gauge-text-time">${action.timeText}</span>
        </span>
      </span>
    </button>
  `
}

export function renderBuildingGauge(
  id: string,
  title: string,
  progress: number,
  stateText: string,
  timeText: string,
  phase: BuildingGaugeView['phase'],
): string {
  const width = Math.round(clamp01(progress) * 100)
  return `
    <button class="building-gauge gauge-${phase}" aria-label="${title} 가동 토글" id="${id}" ${phase === 'idle' ? 'disabled' : ''}>
      <span class="gauge-fill" style="width:${width}%"></span>
      <span class="gauge-content gauge-text-stack">
        <span class="gauge-title gauge-text-title">${title}</span>
        <span class="gauge-meta gauge-text-meta">
          <span class="gauge-state gauge-text-state">${stateText}</span>
          <span class="gauge-time gauge-text-time">${timeText}</span>
        </span>
      </span>
    </button>
  `
}

export function getSmeltingGaugeMeta(state: GameState, key: SmeltingProcessKey, now = Date.now()): BuildingGaugeView {
  const allocated = state.smeltingAllocation[key]
  if (allocated <= 0) {
    return { progress: 0, percentText: '배정 없음', timeText: `- / ${(SMELTING_CYCLE_MS / 1000).toFixed(0)}s`, phase: 'idle' }
  }
  const elapsedSinceUpdate = Math.max(0, now - state.lastUpdate)
  const progressMs = (state.smeltingProgress[key] + elapsedSinceUpdate) % SMELTING_CYCLE_MS
  const progress = clamp01(progressMs / SMELTING_CYCLE_MS)
  const remainingSec = ((1 - progress) * SMELTING_CYCLE_MS) / 1000
  return {
    progress,
    percentText: `배정 x${allocated}`,
    timeText: `${remainingSec.toFixed(1)}s / ${(SMELTING_CYCLE_MS / 1000).toFixed(0)}s`,
    phase: 'running',
  }
}

export function getMinerGaugeMeta(state: GameState, key: MinerProcessKey, now = Date.now()): BuildingGaugeView {
  const allocated = state.minerAllocation[key]
  if (allocated <= 0) {
    return { progress: 0, percentText: '배정 없음', timeText: `- / ${(BUILDING_CYCLE_MS / 1000).toFixed(1)}s`, phase: 'idle' }
  }

  if (state.buildings.miner <= 0) {
    return { progress: 0, percentText: '잠김', timeText: '분쇄기 필요', phase: 'idle' }
  }

  const elapsedSinceUpdate = state.minerProcessRunning[key] ? Math.max(0, now - state.lastUpdate) : 0
  const progressMs = (state.minerProgress[key] + elapsedSinceUpdate) % BUILDING_CYCLE_MS
  const progress = clamp01(progressMs / BUILDING_CYCLE_MS)
  const remainingSec = ((1 - progress) * BUILDING_CYCLE_MS) / 1000

  return {
    progress,
    percentText: `배정 x${allocated}${state.minerProcessRunning[key] ? '' : ' · 중지됨'}`,
    timeText: state.minerProcessRunning[key] ? `${remainingSec.toFixed(1)}s / ${(BUILDING_CYCLE_MS / 1000).toFixed(1)}s` : '일시정지',
    phase: state.minerProcessRunning[key] ? 'running' : 'paused',
  }
}

function renderMinerRow(state: GameState, key: MinerProcessKey, title: string, now = Date.now()): string {
  const gauge = getMinerGaugeMeta(state, key, now)
  const width = Math.round(clamp01(gauge.progress) * 100)
  const allocated = state.minerAllocation[key]
  const used = state.minerAllocation.crushScrap + state.minerAllocation.crushSiliconMass
  const remaining = Math.max(0, state.buildings.miner - used)
  const canIncrement = remaining > 0
  const canDecrement = allocated > 0

  return `<div class="smelting-row"><button class="building-gauge gauge-${gauge.phase}" aria-label="${title} 가동 토글" id="miner-gauge-${key}" ${state.buildings.miner > 0 && allocated > 0 ? '' : 'disabled'}><span class="gauge-fill" style="width:${width}%"></span><span class="gauge-content gauge-text-stack"><span class="gauge-title gauge-text-title">${title}</span><span class="gauge-meta gauge-text-meta"><span class="gauge-state gauge-text-state" id="miner-state-${key}">${gauge.percentText}</span><span class="gauge-time gauge-text-time" id="miner-time-${key}">${gauge.timeText}</span></span></span></button><div class="smelting-alloc-stepper" aria-label="${title} 분쇄기 배정"><button type="button" class="smelting-step-btn" data-miner-allocation-step="up" data-miner-allocation-key="${key}" id="miner-allocation-inc-${key}" aria-label="${title} 배정 증가 (현재 ${allocated}, 남은 배정 ${remaining})" ${canIncrement ? '' : 'disabled'}>▲</button><button type="button" class="smelting-step-btn" data-miner-allocation-step="down" data-miner-allocation-key="${key}" id="miner-allocation-dec-${key}" aria-label="${title} 배정 감소 (현재 ${allocated})" ${canDecrement ? '' : 'disabled'}>▼</button></div></div>`
}

function renderSmeltingRow(state: GameState, key: SmeltingProcessKey, title: string, now = Date.now()): string {
  const gauge = getSmeltingGaugeMeta(state, key, now)
  const width = Math.round(clamp01(gauge.progress) * 100)
  const allocated = state.smeltingAllocation[key]
  const smeltingUsed = Object.values(state.smeltingAllocation).reduce((sum, value) => sum + value, 0)
  const smeltingRemaining = Math.max(0, state.buildings.electricFurnace - smeltingUsed)
  const canIncrement = smeltingRemaining > 0
  const canDecrement = allocated > 0

  return `<div class="smelting-row"><div class="building-gauge gauge-${gauge.phase}" role="group" aria-label="${title} 진행" id="smelting-gauge-${key}"><span class="gauge-fill" style="width:${width}%"></span><span class="gauge-content gauge-text-stack"><span class="gauge-title gauge-text-title">${title}</span><span class="gauge-meta gauge-text-meta"><span class="gauge-state gauge-text-state" id="smelting-state-${key}">${gauge.percentText}</span><span class="gauge-time gauge-text-time" id="smelting-time-${key}">${gauge.timeText}</span></span></span></div><div class="smelting-alloc-stepper" aria-label="${title} 전기로 배정"><button type="button" class="smelting-step-btn" data-smelting-allocation-step="up" data-smelting-allocation-key="${key}" id="smelting-allocation-inc-${key}" aria-label="${title} 배정 증가 (현재 ${allocated}, 남은 배정 ${smeltingRemaining})" ${canIncrement ? '' : 'disabled'}>▲</button><button type="button" class="smelting-step-btn" data-smelting-allocation-step="down" data-smelting-allocation-key="${key}" id="smelting-allocation-dec-${key}" aria-label="${title} 배정 감소 (현재 ${allocated})" ${canDecrement ? '' : 'disabled'}>▼</button></div></div>`
}

function craftView(remainingMs: number, durationMs: number, lockedReason: string | null = null): ActionGaugeView {
  if (lockedReason) return { phase: 'locked', progress: 0, disabled: true, label: '잠김', timeText: lockedReason }
  if (remainingMs <= 0) {
    return { phase: 'ready', progress: 1, disabled: false, label: '준비됨', timeText: formatActionTime(0, durationMs, false) }
  }
  const progress = (durationMs - remainingMs) / durationMs
  return { phase: 'cooldown', progress, disabled: true, label: '진행 중', timeText: formatActionTime(progress, durationMs, true) }
}

function craftViewByRecipe(state: GameState, recipeKey: CraftRecipeKey): ActionGaugeView {
  return craftView(state.craftProgress[recipeKey], getCraftRecipeDuration(state, recipeKey), getCraftRecipeMissingRequirement(state, recipeKey))
}

function shovelCraftView(state: GameState): ActionGaugeView {
  const runningView = craftViewByRecipe(state, 'shovel')
  if (state.craftProgress.shovel > 0) return runningView
  if (getShovelCount(state) >= SHOVEL_MAX_STACK) {
    return { phase: 'locked', progress: 1, disabled: true, label: '최대치', timeText: `최대 ${SHOVEL_MAX_STACK}개` }
  }
  return runningView
}

function renderResourceRow(resource: keyof GameState['resources'], id: string, value: string): string {
  return `<p>${getResourceDisplay(resource)} <strong id="${id}">${value}</strong></p>`
}

export function renderCraftActions(state: GameState): string {
  const pistolView = craftViewByRecipe(state, 'pistol')
  const rifleView = craftViewByRecipe(state, 'rifle')
  const moduleView = craftViewByRecipe(state, 'module')
  const shovelView = shovelCraftView(state)
  const scavengerDroneView = craftViewByRecipe(state, 'scavengerDrone')
  const smallHealPotionView = craftViewByRecipe(state, 'smallHealPotion')

  return `<div class="craft-actions" role="group" aria-label="제작 행동">
      ${renderGaugeButton('craft-shovel', `${getResourceDisplay('shovel')} 제작 (${formatCost(getCraftRecipeCost(state, 'shovel'))})`, '🪏 삽 제작', shovelView)}
      ${renderGaugeButton('craft-pistol', `${CRAFT_RECIPE_DEFS.pistol.label} 제작 (${formatCost(getCraftRecipeCost(state, 'pistol'))})`, '권총 제작', pistolView)}
      ${renderGaugeButton('craft-rifle', `${CRAFT_RECIPE_DEFS.rifle.label} 제작 (${formatCost(getCraftRecipeCost(state, 'rifle'))})`, '소총 제작', rifleView)}
      ${renderGaugeButton('craft-module', `${CRAFT_RECIPE_DEFS.module.label} 제작 (${formatCost(getCraftRecipeCost(state, 'module'))})`, '모듈 제작', moduleView)}
      ${renderGaugeButton('craft-scavenger-drone', `${getResourceDisplay('scavengerDrone')} 제작 (${formatCost(getCraftRecipeCost(state, 'scavengerDrone'))})`, '🛸 스캐빈저 드론 제작', scavengerDroneView)}
      ${renderGaugeButton('craft-small-heal-potion', `${getResourceDisplay('smallHealPotion')} 제작 (${formatCost(getCraftRecipeCost(state, 'smallHealPotion'))})`, '회복약(소) 제작', smallHealPotionView)}
    </div>`
}

export function renderBasePanel(state: GameState, actionUI: ActionUI, now = Date.now()): string {
  const lumberCost = getBuildingCost(state, 'lumberMill')
  const minerCost = getBuildingCost(state, 'miner')
  const workbenchCost = getBuildingCost(state, 'workbench')
  const labCost = getBuildingCost(state, 'lab')
  const laikaRepairCost = getBuildingCost(state, 'laikaRepair')
  const droneControllerCost = getBuildingCost(state, 'droneController')
  const electricFurnaceCost = getBuildingCost(state, 'electricFurnace')

  const lumberGauge = getBuildingGaugeView(state, 'lumberMill', now)
  const scavengerGauge = getBuildingGaugeView(state, 'scavenger', now)

  const singletonInstalled = {
    lab: state.buildings.lab >= 1,
    laikaRepair: state.buildings.laikaRepair >= 1,
    workbench: state.buildings.workbench >= 1,
    droneController: state.buildings.droneController >= 1,
  }

  const smeltingUsed = Object.values(state.smeltingAllocation).reduce((sum, value) => sum + value, 0)
  const smeltingRemaining = Math.max(0, state.buildings.electricFurnace - smeltingUsed)

  return `<section id="panel-base" class="panel-stack ${state.activeTab === 'base' ? '' : 'hidden'}">
      <section class="panel resources"><h2>자원</h2><section class="resources-owned" aria-label="보유 자원"><div class="resource-group resource-group--major">${renderResourceRow('wood', 'res-wood', formatResourceValue('wood', state.resources.wood))}${renderResourceRow('scrap', 'res-scrap', formatResourceValue('scrap', state.resources.scrap))}${renderResourceRow('siliconMass', 'res-silicon-mass', formatResourceValue('siliconMass', state.resources.siliconMass))}</div><div class="resource-group resource-group--major">${renderResourceRow('iron', 'res-iron', formatResourceValue('iron', state.resources.iron))}${renderResourceRow('lowAlloySteel', 'res-low-alloy-steel', formatResourceValue('lowAlloySteel', state.resources.lowAlloySteel))}${renderResourceRow('highAlloySteel', 'res-high-alloy-steel', formatResourceValue('highAlloySteel', state.resources.highAlloySteel))}</div><div class="resource-group resource-group--major">${renderResourceRow('chromium', 'res-chromium', formatResourceValue('chromium', state.resources.chromium))}${renderResourceRow('molybdenum', 'res-molybdenum', formatResourceValue('molybdenum', state.resources.molybdenum))}${renderResourceRow('cobalt', 'res-cobalt', formatResourceValue('cobalt', state.resources.cobalt))}${renderResourceRow('nickel', 'res-nickel', formatResourceValue('nickel', state.resources.nickel))}</div><div class="resource-group resource-group--major">${renderResourceRow('carbon', 'res-carbon', formatResourceValue('carbon', state.resources.carbon))}${renderResourceRow('siliconIngot', 'res-silicon-ingot', formatResourceValue('siliconIngot', state.resources.siliconIngot))}</div><div class="resource-group equipment-group resource-group--major"><p class="resource-group-label">장비</p>${renderResourceRow('shovel', 'res-shovel', `${formatResourceValue('shovel', state.resources.shovel)}/${SHOVEL_MAX_STACK}`)}${renderResourceRow('scavengerDrone', 'res-scavenger-drone', formatResourceValue('scavengerDrone', state.resources.scavengerDrone))}${renderResourceRow('smallHealPotion', 'res-small-heal-potion', formatResourceValue('smallHealPotion', state.resources.smallHealPotion))}</div></section></section>
      <section class="panel actions"><h2>행동</h2><section class="action-group" aria-label="줍기 행동"><h3 class="subheading">줍기</h3>${renderGaugeButton('gather-wood', `🪵 뗄감 줍기 (+${getGatherWoodReward(state)})`, '🪵 뗄감 줍기 행동', actionUI.gatherWood)}${renderGaugeButton('gather-scrap', `🗑️ 고물 줍기 (+${getGatherScrapRewardPreview(state)})`, state.unlocks.scrapAction ? '🗑️ 고물 줍기 행동' : '잠긴 🗑️ 고물 줍기 행동', actionUI.gatherScrap)}<p class="hint" id="scrap-hint" ${state.unlocks.scrapAction ? 'hidden' : ''}>해금 조건: ${getResourceDisplay('shovel')} 1개 이상</p></section><section class="action-group" aria-label="가동 행동"><h3 class="subheading">가동</h3>${renderBuildingGauge('lumber-progress', `벌목기 가동 x${state.buildings.lumberMill}`, lumberGauge.progress, lumberGauge.percentText, lumberGauge.timeText, lumberGauge.phase)}${renderBuildingGauge('scavenger-progress', `스캐빈저 가동 x${state.resources.scavengerDrone}`, scavengerGauge.progress, scavengerGauge.percentText, scavengerGauge.timeText, scavengerGauge.phase)}</section><section class="action-group" aria-label="분쇄 행동"><h3 class="subheading">분쇄</h3><p class="hint" id="miner-remaining">분쇄기 배정: ${state.minerAllocation.crushScrap + state.minerAllocation.crushSiliconMass}/${state.buildings.miner} (남음 ${Math.max(0, state.buildings.miner - (state.minerAllocation.crushScrap + state.minerAllocation.crushSiliconMass))})</p>${renderMinerRow(state, 'crushScrap', '고물 분쇄 (🗑️1 → ⛓️1 + 🟢/🔵)')}${renderMinerRow(state, 'crushSiliconMass', '규소 덩어리 분쇄 (🧱1 → 🟣1)')}</section><section class="action-group" aria-label="녹이기 행동"><h3 class="subheading">녹이기</h3><p class="hint" id="smelting-remaining">전기로 배정: ${smeltingUsed}/${state.buildings.electricFurnace} (남음 ${smeltingRemaining})</p>${renderSmeltingRow(state, 'burnWood', '땔감 태우기 (🪵1K → ⚫탄소1)')}${renderSmeltingRow(state, 'meltScrap', '고물 녹이기 (🗑️1K+🟢3+🔵1 → 🔗1)')}${renderSmeltingRow(state, 'meltIron', '철 녹이기 (⛓️1K+🟡8 → 🖇️1)')}${renderSmeltingRow(state, 'meltSiliconMass', '규소 덩어리 녹이기 (🧱1 → 🗞️/🟡)')}</section></section>
      <section class="panel production"><h2>생산</h2><section id="crafting-panel" class="production-group" aria-label="제작"><h3 class="subheading">제작</h3>${renderCraftActions(state)}</section><section class="production-group" aria-label="건설"><h3 class="subheading">건설</h3><button id="buy-lumber" aria-label="건물 설치" ${state.unlocks.lumberMill ? '' : 'disabled'}><span id="buy-lumber-label">벌목기 설치 (${formatResourceAmount('scrap', lumberCost.scrap ?? 0)})</span></button><button id="buy-miner" aria-label="건물 설치" ${state.unlocks.miner ? '' : 'disabled'}><span id="buy-miner-label">분쇄기 설치 (${formatResourceAmount('wood', minerCost.wood ?? 0)}, ${formatResourceAmount('scrap', minerCost.scrap ?? 0)})</span></button><button id="buy-lab" aria-label="건물 설치" ${singletonInstalled.lab ? 'disabled' : ''}><span id="buy-lab-label">${singletonInstalled.lab ? `${getBuildingLabel('lab')} (설치 완료)` : `지자 컴퓨터 설치 (${formatCost(labCost)})`}</span></button><button id="buy-workbench" aria-label="건물 설치" ${singletonInstalled.workbench ? 'disabled' : ''}><span id="buy-workbench-label">${singletonInstalled.workbench ? `${getBuildingLabel('workbench')} (설치 완료)` : `금속 프린터 설치 (${formatCost(workbenchCost)})`}</span></button><button id="buy-laika-repair" aria-label="건물 설치" ${singletonInstalled.laikaRepair ? 'disabled' : ''}><span id="buy-laika-repair-label">${singletonInstalled.laikaRepair ? `${getBuildingLabel('laikaRepair')} (설치 완료)` : `${getBuildingLabel('laikaRepair')} (${formatCost(laikaRepairCost)})`}</span></button><button id="buy-drone-controller" aria-label="건물 설치" ${singletonInstalled.droneController ? 'disabled' : ''}><span id="buy-drone-controller-label">${singletonInstalled.droneController ? `${getBuildingLabel('droneController')} (설치 완료)` : `드론 컨트롤러 설치 (${formatCost(droneControllerCost)})`}</span></button><button id="buy-electric-furnace" aria-label="건물 설치"><span id="buy-electric-furnace-label">전기로 설치 (${formatCost(electricFurnaceCost)})</span></button></section></section>
      <section id="upgrades-panel" class="panel upgrades" ${state.buildings.lab > 0 ? '' : 'hidden'}><h2>연구</h2>${Object.entries(UPGRADE_DEFS)
        .map(([key, def]) => {
          const done = state.upgrades[key as keyof typeof state.upgrades]
          const cost = getUpgradeCost(key as keyof typeof UPGRADE_DEFS)
          return `<button data-upgrade="${key}" aria-label="연구 ${def.name}" ${done ? 'disabled' : ''}>${def.name} (${formatResourceAmount('wood', cost.wood)}, ${formatResourceAmount('iron', cost.iron)})</button><p class="hint" id="upgrade-hint-${key}">${def.effectText}${done ? ' (완료)' : ''}</p>`
        })
        .join('')}</section>
    </section>`
}

export function patchActionGauge(app: ParentNode, id: string, action: ActionGaugeView): void {
  const button = app.querySelector<HTMLButtonElement>(`#${id}`)
  if (!button) return
  const progress = Math.round(clamp01(action.progress) * 100)
  button.classList.remove('gauge-ready', 'gauge-cooldown', 'gauge-locked')
  button.classList.add(`gauge-${action.phase}`)
  button.disabled = action.disabled
  const fill = button.querySelector<HTMLElement>('.gauge-fill')
  if (fill) fill.style.width = `${progress}%`
  const state = button.querySelector<HTMLElement>('.gauge-state')
  if (state) state.textContent = action.label
  const time = button.querySelector<HTMLElement>('.gauge-time')
  if (time) time.textContent = action.timeText
}

export function patchBuildingGauge(app: ParentNode, id: string, progress: number, stateText: string, timeText: string, phase: BuildingGaugeView['phase']): void {
  const gauge = app.querySelector<HTMLElement>(`#${id}`)
  if (!gauge) return
  gauge.classList.remove('gauge-running', 'gauge-paused', 'gauge-idle')
  gauge.classList.add(`gauge-${phase}`)
  if (gauge instanceof HTMLButtonElement) gauge.disabled = phase === 'idle'
  const width = Math.round(clamp01(progress) * 100)
  const fill = gauge.querySelector<HTMLElement>('.gauge-fill')
  if (fill) fill.style.width = `${width}%`
  const state = gauge.querySelector<HTMLElement>('.gauge-state')
  if (state) state.textContent = stateText
  const time = gauge.querySelector<HTMLElement>('.gauge-time')
  if (time) time.textContent = timeText
}

export function patchSmeltingPanel(app: ParentNode, state: GameState, now = Date.now()): void {
  const smeltingUsed = Object.values(state.smeltingAllocation).reduce((sum, value) => sum + value, 0)
  const smeltingRemaining = Math.max(0, state.buildings.electricFurnace - smeltingUsed)
  const remainingNode = app.querySelector<HTMLElement>('#smelting-remaining')
  if (remainingNode) remainingNode.textContent = `전기로 배정: ${smeltingUsed}/${state.buildings.electricFurnace} (남음 ${smeltingRemaining})`

  ;(['burnWood', 'meltScrap', 'meltIron', 'meltSiliconMass'] as SmeltingProcessKey[]).forEach((key) => {
    const gauge = getSmeltingGaugeMeta(state, key, now)
    patchBuildingGauge(app, `smelting-gauge-${key}`, gauge.progress, gauge.percentText, gauge.timeText, gauge.phase)

    const allocated = state.smeltingAllocation[key]
    const title = getSmeltingTitle(key)

    const decrementButton = app.querySelector<HTMLButtonElement>(`#smelting-allocation-dec-${key}`)
    if (decrementButton) decrementButton.disabled = allocated <= 0
    if (decrementButton) decrementButton.setAttribute('aria-label', `${title} 배정 감소 (현재 ${allocated})`)

    const incrementButton = app.querySelector<HTMLButtonElement>(`#smelting-allocation-inc-${key}`)
    if (incrementButton) incrementButton.disabled = smeltingRemaining <= 0
    if (incrementButton) incrementButton.setAttribute('aria-label', `${title} 배정 증가 (현재 ${allocated}, 남은 배정 ${smeltingRemaining})`)
  })
}

export function patchMinerPanel(app: ParentNode, state: GameState, now = Date.now()): void {
  const used = state.minerAllocation.crushScrap + state.minerAllocation.crushSiliconMass
  const remaining = Math.max(0, state.buildings.miner - used)
  const remainingNode = app.querySelector<HTMLElement>('#miner-remaining')
  if (remainingNode) remainingNode.textContent = `분쇄기 배정: ${used}/${state.buildings.miner} (남음 ${remaining})`


  ;(['crushScrap', 'crushSiliconMass'] as MinerProcessKey[]).forEach((key) => {
    const gauge = getMinerGaugeMeta(state, key, now)
    patchBuildingGauge(app, `miner-gauge-${key}`, gauge.progress, gauge.percentText, gauge.timeText, gauge.phase)

    const allocated = state.minerAllocation[key]
    const title = getMinerTitle(key)

    const runButton = app.querySelector<HTMLButtonElement>(`#miner-gauge-${key}`)
    if (runButton) runButton.disabled = state.buildings.miner <= 0 || allocated <= 0

    const decrementButton = app.querySelector<HTMLButtonElement>(`#miner-allocation-dec-${key}`)
    if (decrementButton) decrementButton.disabled = allocated <= 0
    if (decrementButton) decrementButton.setAttribute('aria-label', `${title} 배정 감소 (현재 ${allocated})`)

    const incrementButton = app.querySelector<HTMLButtonElement>(`#miner-allocation-inc-${key}`)
    if (incrementButton) incrementButton.disabled = remaining <= 0
    if (incrementButton) incrementButton.setAttribute('aria-label', `${title} 배정 증가 (현재 ${allocated}, 남은 배정 ${remaining})`)
  })
}

function getSmeltingTitle(key: SmeltingProcessKey): string {
  switch (key) {
    case 'burnWood':
      return '땔감 태우기'
    case 'meltScrap':
      return '고물 녹이기'
    case 'meltIron':
      return '철 녹이기'
    case 'meltSiliconMass':
      return '규소 덩어리 녹이기'
  }
}

function getMinerTitle(key: MinerProcessKey): string {
  switch (key) {
    case 'crushScrap':
      return '고물 분쇄'
    case 'crushSiliconMass':
      return '규소 덩어리 분쇄'
  }
}

function patchGaugeTitle(app: ParentNode, id: string, text: string): void {
  const title = app.querySelector<HTMLElement>(`#${id} .gauge-title`)
  if (title) title.textContent = text
}

export function patchCraftButtons(app: ParentNode, state: GameState): void {
  patchActionGauge(app, 'craft-pistol', craftViewByRecipe(state, 'pistol'))
  patchActionGauge(app, 'craft-rifle', craftViewByRecipe(state, 'rifle'))
  patchActionGauge(app, 'craft-module', craftViewByRecipe(state, 'module'))
  patchActionGauge(app, 'craft-shovel', shovelCraftView(state))
  patchActionGauge(app, 'craft-scavenger-drone', craftViewByRecipe(state, 'scavengerDrone'))
  patchActionGauge(app, 'craft-small-heal-potion', craftViewByRecipe(state, 'smallHealPotion'))

  patchGaugeTitle(app, 'craft-shovel', `${getResourceDisplay('shovel')} 제작 (${formatCost(getCraftRecipeCost(state, 'shovel'))})`)
  patchGaugeTitle(app, 'craft-scavenger-drone', `${getResourceDisplay('scavengerDrone')} 제작 (${formatCost(getCraftRecipeCost(state, 'scavengerDrone'))})`)
  patchGaugeTitle(app, 'craft-small-heal-potion', `${getResourceDisplay('smallHealPotion')} 제작 (${formatCost(getCraftRecipeCost(state, 'smallHealPotion'))})`)
}
