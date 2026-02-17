import type { GameState, SmeltingProcessKey } from '../../core/state.ts'
import { getBuildingCost } from '../../core/actions.ts'
import { SHOVEL_MAX_STACK, getGatherScrapReward, getGatherWoodReward, getShovelCount } from '../../core/rewards.ts'
import { BUILDING_CYCLE_MS, SMELTING_CYCLE_MS, UPGRADE_DEFS, WEAPON_CRAFT_DURATION_MS, getUpgradeCost } from '../../data/balance.ts'
import { CRAFT_RECIPE_DEFS, getCraftRecipeMissingRequirement } from '../../data/crafting.ts'
import { getBuildingLabel } from '../../data/buildings.ts'
import { formatCost, formatResourceAmount, formatResourceValue, getResourceDisplay } from '../../data/resources.ts'
import type { ActionGaugeView, ActionUI } from '../types.ts'
import { clamp01, formatActionTime } from '../view.ts'

export type ProductionBuildingKey = 'lumberMill' | 'miner' | 'scavenger'

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
      <span class="gauge-content">
        <span class="gauge-title">${text}</span>
        <span class="gauge-meta">
          <span class="gauge-state">${action.label}</span>
          <span class="gauge-time">${action.timeText}</span>
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
      <span class="gauge-content">
        <span class="gauge-title">${title}</span>
        <span class="gauge-meta">
          <span class="gauge-state">${stateText}</span>
          <span class="gauge-time">${timeText}</span>
        </span>
      </span>
    </button>
  `
}

export function getSmeltingGaugeMeta(state: GameState, key: SmeltingProcessKey, now = Date.now()): BuildingGaugeView {
  const allocated = state.smeltingAllocation[key]
  if (allocated <= 0) {
    return { progress: 0, percentText: '미배정', timeText: `- / ${(SMELTING_CYCLE_MS / 1000).toFixed(0)}s`, phase: 'idle' }
  }
  const elapsedSinceUpdate = Math.max(0, now - state.lastUpdate)
  const progressMs = (state.smeltingProgress[key] + elapsedSinceUpdate) % SMELTING_CYCLE_MS
  const progress = clamp01(progressMs / SMELTING_CYCLE_MS)
  const remainingSec = ((1 - progress) * SMELTING_CYCLE_MS) / 1000
  return {
    progress,
    percentText: `${Math.round(progress * 100)}%`,
    timeText: `${remainingSec.toFixed(1)}s / ${(SMELTING_CYCLE_MS / 1000).toFixed(0)}s`,
    phase: 'running',
  }
}

function renderSmeltingRow(state: GameState, key: SmeltingProcessKey, title: string, rightLabel: string, now = Date.now()): string {
  const gauge = getSmeltingGaugeMeta(state, key, now)
  const width = Math.round(clamp01(gauge.progress) * 100)
  return `<div class="smelting-row"><div class="building-gauge gauge-${gauge.phase}" role="group" aria-label="${title} 진행" id="smelting-gauge-${key}"><span class="gauge-fill" style="width:${width}%"></span><span class="gauge-content"><span class="gauge-title">${title}</span><span class="gauge-meta"><span class="gauge-state" id="smelting-state-${key}">${gauge.percentText}</span><span class="gauge-time" id="smelting-time-${key}">${gauge.timeText}</span></span></span></div><label class="smelting-alloc-label">${rightLabel}<input type="number" min="0" step="1" inputmode="numeric" data-smelting-allocation="${key}" id="smelting-allocation-${key}" value="${state.smeltingAllocation[key]}" aria-label="${title} 전기로 배정 수량"></label></div>`
}

function craftView(remainingMs: number, lockedReason: string | null = null): ActionGaugeView {
  if (lockedReason) return { phase: 'locked', progress: 0, disabled: true, label: '잠김', timeText: lockedReason }
  if (remainingMs <= 0) {
    return { phase: 'ready', progress: 1, disabled: false, label: '준비됨', timeText: formatActionTime(0, WEAPON_CRAFT_DURATION_MS, false) }
  }
  const progress = (WEAPON_CRAFT_DURATION_MS - remainingMs) / WEAPON_CRAFT_DURATION_MS
  return { phase: 'cooldown', progress, disabled: true, label: '진행 중', timeText: formatActionTime(progress, WEAPON_CRAFT_DURATION_MS, true) }
}

function shovelCraftView(state: GameState): ActionGaugeView {
  const runningView = craftView(state.craftProgress.shovel, getCraftRecipeMissingRequirement(state, 'shovel'))
  if (state.craftProgress.shovel > 0) return runningView
  if (getShovelCount(state) >= SHOVEL_MAX_STACK) {
    return { phase: 'locked', progress: 1, disabled: true, label: '최대치', timeText: `최대 ${SHOVEL_MAX_STACK}개` }
  }
  return runningView
}

export function renderCraftActions(state: GameState): string {
  const pistolView = craftView(state.craftProgress.pistol, getCraftRecipeMissingRequirement(state, 'pistol'))
  const rifleView = craftView(state.craftProgress.rifle, getCraftRecipeMissingRequirement(state, 'rifle'))
  const moduleView = craftView(state.craftProgress.module, getCraftRecipeMissingRequirement(state, 'module'))
  const shovelView = shovelCraftView(state)
  const scavengerDroneView = craftView(state.craftProgress.scavengerDrone, getCraftRecipeMissingRequirement(state, 'scavengerDrone'))

  return `<div class="craft-actions" role="group" aria-label="제작 행동">
      ${renderGaugeButton('craft-pistol', `${CRAFT_RECIPE_DEFS.pistol.label} 제작 (${formatCost(CRAFT_RECIPE_DEFS.pistol.costs)})`, '권총 제작', pistolView)}
      ${renderGaugeButton('craft-rifle', `${CRAFT_RECIPE_DEFS.rifle.label} 제작 (${formatCost(CRAFT_RECIPE_DEFS.rifle.costs)})`, '소총 제작', rifleView)}
      ${renderGaugeButton('craft-module', `${CRAFT_RECIPE_DEFS.module.label} 제작 (${formatCost(CRAFT_RECIPE_DEFS.module.costs)})`, '모듈 제작', moduleView)}
      ${renderGaugeButton('craft-shovel', `${getResourceDisplay('shovel')} 제작 (${formatCost(CRAFT_RECIPE_DEFS.shovel.costs)})`, '🪏 삽 제작', shovelView)}
      ${renderGaugeButton('craft-scavenger-drone', `${getResourceDisplay('scavengerDrone')} 제작 (${formatCost(CRAFT_RECIPE_DEFS.scavengerDrone.costs)})`, '🛸 스캐빈저 드론 제작', scavengerDroneView)}
    </div>`
}

export function renderBasePanel(state: GameState, actionUI: ActionUI, now = Date.now()): string {
  const lumberCost = getBuildingCost(state, 'lumberMill')
  const minerCost = getBuildingCost(state, 'miner')
  const workbenchCost = getBuildingCost(state, 'workbench')
  const labCost = getBuildingCost(state, 'lab')
  const droneControllerCost = getBuildingCost(state, 'droneController')
  const electricFurnaceCost = getBuildingCost(state, 'electricFurnace')

  const lumberGauge = getBuildingGaugeView(state, 'lumberMill', now)
  const minerGauge = getBuildingGaugeView(state, 'miner', now)
  const scavengerGauge = getBuildingGaugeView(state, 'scavenger', now)

  const singletonInstalled = {
    lab: state.buildings.lab >= 1,
    workbench: state.buildings.workbench >= 1,
    droneController: state.buildings.droneController >= 1,
  }

  const smeltingUsed = Object.values(state.smeltingAllocation).reduce((sum, value) => sum + value, 0)
  const smeltingRemaining = Math.max(0, state.buildings.electricFurnace - smeltingUsed)

  return `<section id="panel-base" class="panel-stack ${state.activeTab === 'base' ? '' : 'hidden'}">
      <section class="panel resources"><h2>자원</h2><section class="resources-owned" aria-label="보유 자원"><p>${getResourceDisplay('wood')} <strong id="res-wood">${formatResourceValue('wood', state.resources.wood)}</strong></p><p>${getResourceDisplay('scrap')} <strong id="res-scrap">${formatResourceValue('scrap', state.resources.scrap)}</strong></p><p>${getResourceDisplay('iron')} <strong id="res-iron">${formatResourceValue('iron', state.resources.iron)}</strong></p><p>${getResourceDisplay('chromium')} <strong id="res-chromium">${formatResourceValue('chromium', state.resources.chromium)}</strong></p><p>${getResourceDisplay('molybdenum')} <strong id="res-molybdenum">${formatResourceValue('molybdenum', state.resources.molybdenum)}</strong></p><p>${getResourceDisplay('cobalt')} <strong id="res-cobalt">${formatResourceValue('cobalt', state.resources.cobalt)}</strong></p><p>${getResourceDisplay('shovel')} <strong id="res-shovel">${formatResourceValue('shovel', state.resources.shovel)}/${SHOVEL_MAX_STACK}</strong></p><p>${getResourceDisplay('scavengerDrone')} <strong id="res-scavenger-drone">${formatResourceValue('scavengerDrone', state.resources.scavengerDrone)}</strong></p><p>${getResourceDisplay('siliconMass')} <strong id="res-silicon-mass">${formatResourceValue('siliconMass', state.resources.siliconMass)}</strong></p><p>${getResourceDisplay('carbon')} <strong id="res-carbon">${formatResourceValue('carbon', state.resources.carbon)}</strong></p><p>${getResourceDisplay('siliconIngot')} <strong id="res-silicon-ingot">${formatResourceValue('siliconIngot', state.resources.siliconIngot)}</strong></p><p>${getResourceDisplay('nickel')} <strong id="res-nickel">${formatResourceValue('nickel', state.resources.nickel)}</strong></p><p>${getResourceDisplay('lowAlloySteel')} <strong id="res-low-alloy-steel">${formatResourceValue('lowAlloySteel', state.resources.lowAlloySteel)}</strong></p><p>${getResourceDisplay('highAlloySteel')} <strong id="res-high-alloy-steel">${formatResourceValue('highAlloySteel', state.resources.highAlloySteel)}</strong></p></section></section>
      <section class="panel actions"><h2>행동</h2><section class="action-group" aria-label="줍기 행동"><h3 class="subheading">줍기</h3>${renderGaugeButton('gather-wood', `🪵 뗄감 줍기 (+${getGatherWoodReward(state)})`, '🪵 뗄감 줍기 행동', actionUI.gatherWood)}${renderGaugeButton('gather-scrap', `🗑️ 고물 줍기 (+${getGatherScrapReward(state)})`, state.unlocks.scrapAction ? '🗑️ 고물 줍기 행동' : '잠긴 🗑️ 고물 줍기 행동', actionUI.gatherScrap)}<p class="hint" id="scrap-hint" ${state.unlocks.scrapAction ? 'hidden' : ''}>해금 조건: ${getResourceDisplay('shovel')} 1개 이상</p></section><section class="action-group" aria-label="가동 행동"><h3 class="subheading">가동</h3>${renderBuildingGauge('lumber-progress', `벌목기 가동 x${state.buildings.lumberMill}`, lumberGauge.progress, lumberGauge.percentText, lumberGauge.timeText, lumberGauge.phase)}${renderBuildingGauge('miner-progress', `분쇄기 가동 x${state.buildings.miner}`, minerGauge.progress, minerGauge.percentText, minerGauge.timeText, minerGauge.phase)}${renderBuildingGauge('scavenger-progress', `스캐빈저 가동 x${state.resources.scavengerDrone}`, scavengerGauge.progress, scavengerGauge.percentText, scavengerGauge.timeText, scavengerGauge.phase)}<section class="smelting-group" aria-label="녹이기 행동"><h4 class="subheading">녹이기</h4><p class="hint" id="smelting-remaining">전기로 배정: ${smeltingUsed}/${state.buildings.electricFurnace} (남음 ${smeltingRemaining})</p>${renderSmeltingRow(state, 'burnWood', '땔감 태우기 (🪵1000 → ⚫탄소1)', '배정')}${renderSmeltingRow(state, 'meltScrap', '고물 녹이기 (🗑️10+🟢3+🔵1 → 🔗1)', '배정')}${renderSmeltingRow(state, 'meltIron', '철 녹이기 (⛓️10+🟡8 → 🖇️1)', '배정')}${renderSmeltingRow(state, 'meltSiliconMass', '규소 덩어리 녹이기 (🧱1 → 🗞️90%/🟡10%)', '배정')}</section></section></section>
      <section class="panel buildings"><h2>건설</h2><button id="buy-lumber" aria-label="건물 설치" ${state.unlocks.lumberMill ? '' : 'disabled'}><span id="buy-lumber-label">벌목기 설치 (${formatResourceAmount('scrap', lumberCost.scrap ?? 0)})</span></button><button id="buy-miner" aria-label="건물 설치" ${state.unlocks.miner ? '' : 'disabled'}><span id="buy-miner-label">분쇄기 설치 (${formatResourceAmount('wood', minerCost.wood ?? 0)}, ${formatResourceAmount('scrap', minerCost.scrap ?? 0)})</span></button><button id="buy-lab" aria-label="건물 설치" ${singletonInstalled.lab ? 'disabled' : ''}><span id="buy-lab-label">${singletonInstalled.lab ? `${getBuildingLabel('lab')} (설치 완료)` : `지자 컴퓨터 설치 (${formatCost(labCost)})`}</span></button><button id="buy-workbench" aria-label="건물 설치" ${singletonInstalled.workbench ? 'disabled' : ''}><span id="buy-workbench-label">${singletonInstalled.workbench ? `${getBuildingLabel('workbench')} (설치 완료)` : `금속 프린터 설치 (${formatCost(workbenchCost)})`}</span></button><button id="buy-drone-controller" aria-label="건물 설치" ${singletonInstalled.droneController ? 'disabled' : ''}><span id="buy-drone-controller-label">${singletonInstalled.droneController ? `${getBuildingLabel('droneController')} (설치 완료)` : `드론 컨트롤러 설치 (${formatCost(droneControllerCost)})`}</span></button><button id="buy-electric-furnace" aria-label="건물 설치"><span id="buy-electric-furnace-label">전기로 설치 (${formatCost(electricFurnaceCost)})</span></button></section>
      <section id="crafting-panel" class="panel crafting"><h2>제작</h2>${renderCraftActions(state)}</section>
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
    const input = app.querySelector<HTMLInputElement>(`#smelting-allocation-${key}`)
    if (input && Number(input.value) !== state.smeltingAllocation[key]) input.value = String(state.smeltingAllocation[key])
    if (input) input.max = String(Math.max(0, state.buildings.electricFurnace))
  })
}

export function patchCraftButtons(app: ParentNode, state: GameState): void {
  patchActionGauge(app, 'craft-pistol', craftView(state.craftProgress.pistol, getCraftRecipeMissingRequirement(state, 'pistol')))
  patchActionGauge(app, 'craft-rifle', craftView(state.craftProgress.rifle, getCraftRecipeMissingRequirement(state, 'rifle')))
  patchActionGauge(app, 'craft-module', craftView(state.craftProgress.module, getCraftRecipeMissingRequirement(state, 'module')))
  patchActionGauge(app, 'craft-shovel', shovelCraftView(state))
  patchActionGauge(app, 'craft-scavenger-drone', craftView(state.craftProgress.scavengerDrone, getCraftRecipeMissingRequirement(state, 'scavengerDrone')))
}
