import type { GameState, MinerProcessKey, SmeltingProcessKey } from '../../core/state.ts'
import { getBuildingCost } from '../../core/actions.ts'
import { SHOVEL_MAX_STACK, getGatherScrapRewardPreview, getGatherWoodReward, getShovelCount } from '../../core/rewards.ts'
import { BUILDING_CYCLE_MS, RESEARCH_PANEL_GROUPS, SMELTING_CYCLE_MS, UPGRADE_DEFS, getUpgradeCost } from '../../data/balance.ts'
import {
  ARMOR_HP,
  CRAFT_RECIPE_DEFS,
  getCraftRecipeCost,
  getCraftRecipeDuration,
  getActiveModuleCraftTier,
  getCraftRecipeMissingRequirement,
  getModuleCraftTierLabel,
  getSelectedArmorCraftType,
  getSelectedModuleCraftTier,
  isCraftRecipeUnlocked,
  type CraftRecipeKey,
} from '../../data/crafting.ts'
import { getBuildingLabel } from '../../data/buildings.ts'
import { formatCost, formatResourceAmount, formatResourceValue, getResourceDisplay } from '../../data/resources.ts'
import { getResourceStorageCap } from '../../core/resourceCaps.ts'
import { getCompanionName } from '../../core/companion.ts'
import type { ActionGaugeView, ActionUI } from '../types.ts'
import { clamp01, formatActionTime } from '../view.ts'
import { renderCompactLogPanel } from './logPanel.ts'

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

export function renderBuildingGauge(id: string, title: string, gauge: BuildingGaugeView): string {
  const width = Math.round(clamp01(gauge.progress) * 100)
  return `
    <button class="building-gauge gauge-${gauge.phase}" aria-label="${title} 가동 토글" id="${id}" ${gauge.phase === 'idle' ? 'disabled' : ''}>
      <span class="gauge-fill" style="width:${width}%"></span>
      <span class="gauge-content gauge-text-stack">
        <span class="gauge-title gauge-text-title">${title}</span>
        <span class="gauge-meta gauge-text-meta">
          <span class="gauge-state gauge-text-state">${gauge.percentText}</span>
          <span class="gauge-time gauge-text-time">${gauge.timeText}</span>
        </span>
      </span>
    </button>
  `
}

function getProcessGaugeMeta<Key extends string>(
  params: {
    allocation: Record<Key, number>
    progress: Record<Key, number>
    running: Record<Key, boolean>
    key: Key
    owned: number
    cycleMs: number
    lockLabel: string
    lastUpdate: number
    now?: number
  },
): BuildingGaugeView {
  const { allocation, progress, running, key, owned, cycleMs, lockLabel, lastUpdate, now = Date.now() } = params
  const allocated = allocation[key]
  if (allocated <= 0) {
    return { progress: 0, percentText: '배정 없음', timeText: `- / ${(cycleMs / 1000).toFixed(1)}s`, phase: 'idle' }
  }

  if (owned <= 0) {
    return { progress: 0, percentText: '잠김', timeText: lockLabel, phase: 'idle' }
  }

  const elapsedSinceUpdate = running[key] ? Math.max(0, now - lastUpdate) : 0
  const progressMs = (progress[key] + elapsedSinceUpdate) % cycleMs
  const normalized = clamp01(progressMs / cycleMs)
  const remainingSec = ((1 - normalized) * cycleMs) / 1000

  return {
    progress: normalized,
    percentText: `배정 x${allocated}${running[key] ? '' : ' · 중지됨'}`,
    timeText: running[key] ? `${remainingSec.toFixed(1)}s / ${(cycleMs / 1000).toFixed(1)}s` : '일시정지',
    phase: running[key] ? 'running' : 'paused',
  }
}

export function getSmeltingGaugeMeta(state: GameState, key: SmeltingProcessKey, now = Date.now()): BuildingGaugeView {
  return getProcessGaugeMeta({
    allocation: state.smeltingAllocation,
    progress: state.smeltingProgress,
    running: state.smeltingProcessRunning,
    key,
    owned: state.buildings.electricFurnace,
    cycleMs: SMELTING_CYCLE_MS,
    lockLabel: '전기로 필요',
    lastUpdate: state.lastUpdate,
    now,
  })
}

export function getMinerGaugeMeta(state: GameState, key: MinerProcessKey, now = Date.now()): BuildingGaugeView {
  return getProcessGaugeMeta({
    allocation: state.minerAllocation,
    progress: state.minerProgress,
    running: state.minerProcessRunning,
    key,
    owned: state.buildings.miner,
    cycleMs: BUILDING_CYCLE_MS,
    lockLabel: '분쇄기 필요',
    lastUpdate: state.lastUpdate,
    now,
  })
}

function renderProcessRow<Key extends string>(params: {
  kind: 'smelting' | 'miner'
  key: Key
  title: string
  gauge: BuildingGaugeView
  allocated: number
  remaining: number
  canToggle: boolean
}): string {
  const { kind, key, title, gauge, allocated, remaining, canToggle } = params
  const width = Math.round(clamp01(gauge.progress) * 100)
  const gaugeId = `${kind}-gauge-${key}`
  const incDataAttr = kind === 'smelting' ? `data-smelting-allocation-step="up" data-smelting-allocation-key="${key}"` : `data-miner-allocation-step="up" data-miner-allocation-key="${key}"`
  const decDataAttr = kind === 'smelting' ? `data-smelting-allocation-step="down" data-smelting-allocation-key="${key}"` : `data-miner-allocation-step="down" data-miner-allocation-key="${key}"`
  const allocLabel = `${title} ${kind === 'smelting' ? '전기로' : '분쇄기'} 배정`

  return `<div class="smelting-row"><button class="building-gauge gauge-${gauge.phase}" aria-label="${title} 가동 토글" id="${gaugeId}" ${canToggle ? '' : 'disabled'}><span class="gauge-fill" style="width:${width}%"></span><span class="gauge-content gauge-text-stack"><span class="gauge-title gauge-text-title">${title}</span><span class="gauge-meta gauge-text-meta"><span class="gauge-state gauge-text-state" id="${kind}-state-${key}">${gauge.percentText}</span><span class="gauge-time gauge-text-time" id="${kind}-time-${key}">${gauge.timeText}</span></span></span></button><div class="smelting-alloc-stepper" aria-label="${allocLabel}"><button type="button" class="smelting-step-btn" ${incDataAttr} id="${kind}-allocation-inc-${key}" aria-label="${title} 배정 증가 (현재 ${allocated}, 남은 배정 ${remaining})" ${remaining > 0 ? '' : 'disabled'}>▲</button><button type="button" class="smelting-step-btn" ${decDataAttr} id="${kind}-allocation-dec-${key}" aria-label="${title} 배정 감소 (현재 ${allocated})" ${allocated > 0 ? '' : 'disabled'}>▼</button></div></div>`
}

function renderMinerRow(state: GameState, key: MinerProcessKey, title: string, now = Date.now()): string {
  const gauge = getMinerGaugeMeta(state, key, now)
  const allocated = state.minerAllocation[key]
  const used = state.minerAllocation.crushScrap + state.minerAllocation.crushSiliconMass
  const remaining = Math.max(0, state.buildings.miner - used)
  return renderProcessRow({ kind: 'miner', key, title, gauge, allocated, remaining, canToggle: state.buildings.miner > 0 && allocated > 0 })
}

function renderSmeltingRow(state: GameState, key: SmeltingProcessKey, title: string, now = Date.now()): string {
  const gauge = getSmeltingGaugeMeta(state, key, now)
  const allocated = state.smeltingAllocation[key]
  const smeltingUsed = Object.values(state.smeltingAllocation).reduce((sum, value) => sum + value, 0)
  const smeltingRemaining = Math.max(0, state.buildings.electricFurnace - smeltingUsed)
  return renderProcessRow({ kind: 'smelting', key, title, gauge, allocated, remaining: smeltingRemaining, canToggle: state.buildings.electricFurnace > 0 && allocated > 0 })
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

function formatBaseResourceValue(resource: keyof GameState['resources'], amount: number): string {
  return formatResourceValue(resource, amount)
}

function renderResourceRow(resource: keyof GameState['resources'], id: string, value: string, amount: number): string {
  return `<p class="resource-row" data-resource-row="true" data-resource-id="${resource}"${amount <= 0 ? ' hidden' : ''}>${getResourceDisplay(resource)} <strong id="${id}">${value}</strong></p>`
}

function renderArmorCraftControl(state: GameState): string {
  const armorType = getSelectedArmorCraftType(state)
  const armorView = craftViewByRecipe(state, armorType)
  const label = CRAFT_RECIPE_DEFS[armorType].label
  const hp = ARMOR_HP[armorType]
  return `<div class="armor-craft-row"><div class="module-craft-tier-switch" aria-label="방어구 타입 선택"><button id="armor-craft-type-prev" class="craft-tier-btn" aria-label="이전 방어구 타입" ${armorType === 'junkArmor' ? 'disabled' : ''}>◀</button><button id="armor-craft-type-next" class="craft-tier-btn" aria-label="다음 방어구 타입" ${armorType === 'ironArmor' ? 'disabled' : ''}>▶</button></div>${renderGaugeButton(`craft-${armorType === 'junkArmor' ? 'junk-armor' : 'iron-armor'}`, `${label} +${hp}HP (${formatCost(getCraftRecipeCost(state, armorType))})`, `${label} 제작`, armorView)}</div>`
}

function renderModuleCraftControl(state: GameState, moduleView: ActionGaugeView): string {
  const tier = getSelectedModuleCraftTier(state)
  const activeTier = getActiveModuleCraftTier(state)
  const canSelectTierII = state.upgrades.moduleCraftingII
  const canSelectTierIII = state.upgrades.moduleCraftingIII
  const tierLabel = getModuleCraftTierLabel(activeTier)
  const rarityToken = activeTier >= 3 ? 'blue' : activeTier >= 2 ? 'green' : 'white'
  return `<div class="module-craft-row" data-module-rarity="${rarityToken}"><div class="module-craft-tier-switch" aria-label="모듈 제작 티어 선택"><button id="module-craft-tier-prev" class="craft-tier-btn" aria-label="이전 모듈 제작 티어" ${tier <= 1 ? 'disabled' : ''}>◀</button><button id="module-craft-tier-next" class="craft-tier-btn" aria-label="다음 모듈 제작 티어" ${tier >= 3 || (tier >= 2 && !canSelectTierIII) || !canSelectTierII ? 'disabled' : ''}>▶</button></div>${renderGaugeButton('craft-module', `${tierLabel} (${formatCost(getCraftRecipeCost(state, 'module'))})`, '모듈 제작', moduleView)}</div>`
}

export function renderCraftActions(state: GameState): string {
  const shovelView = shovelCraftView(state)
  const moduleView = craftViewByRecipe(state, 'module')

  const isCraftVisible = (recipe: CraftRecipeKey): boolean => {
    if (state.craftProgress[recipe] > 0) return true
    return isCraftRecipeUnlocked(state, recipe)
  }

  const rows: string[] = [
    renderGaugeButton('craft-shovel', `${getResourceDisplay('shovel')} 제작 (${formatCost(getCraftRecipeCost(state, 'shovel'))})`, '🪏 삽 제작', shovelView),
    renderArmorCraftControl(state),
  ]

  if (isCraftVisible('pistol')) {
    rows.push(renderGaugeButton('craft-pistol', `${CRAFT_RECIPE_DEFS.pistol.label} 제작 (${formatCost(getCraftRecipeCost(state, 'pistol'))})`, '권총 제작', craftViewByRecipe(state, 'pistol')))
  }
  if (isCraftVisible('rifle')) {
    rows.push(renderGaugeButton('craft-rifle', `${CRAFT_RECIPE_DEFS.rifle.label} 제작 (${formatCost(getCraftRecipeCost(state, 'rifle'))})`, '소총 제작', craftViewByRecipe(state, 'rifle')))
  }
  if (isCraftVisible('module')) {
    rows.push(renderModuleCraftControl(state, moduleView))
  }
  if (isCraftVisible('scavengerDrone')) {
    rows.push(renderGaugeButton('craft-scavenger-drone', `${getResourceDisplay('scavengerDrone')} 제작 (${formatCost(getCraftRecipeCost(state, 'scavengerDrone'))})`, '🛸 스캐빈저 드론 제작', craftViewByRecipe(state, 'scavengerDrone')))
  }
  if (isCraftVisible('syntheticFood')) {
    rows.push(renderGaugeButton('craft-synthetic-food', `${getResourceDisplay('syntheticFood')} 제작 (${formatCost(getCraftRecipeCost(state, 'syntheticFood'))})`, '무작위맛 통조림 제작', craftViewByRecipe(state, 'syntheticFood')))
  }
  if (isCraftVisible('smallHealPotion')) {
    rows.push(renderGaugeButton('craft-small-heal-potion', `${getResourceDisplay('smallHealPotion')} 제작 (${formatCost(getCraftRecipeCost(state, 'smallHealPotion'))})`, '회복약(소) 제작', craftViewByRecipe(state, 'smallHealPotion')))
  }

  return `<div class="craft-actions" role="group" aria-label="제작 행동">${rows.join('')}</div>`
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

  const electricFurnaceUnlocked = state.unlocks.electricFurnace
  const droneControllerUnlocked = state.unlocks.droneController

  const smeltingUsed = Object.values(state.smeltingAllocation).reduce((sum, value) => sum + value, 0)
  const smeltingRemaining = Math.max(0, state.buildings.electricFurnace - smeltingUsed)

  const storageCap = getResourceStorageCap(state)
  const companionName = getCompanionName(state)

  const dailySection = `<section class="action-group" aria-label="일과 행동"><h3 class="subheading">일과</h3>${renderGaugeButton('go-to-work', `💵 일 나가기 (+${state.timePassedEventDismissed ? 200 : 2})`, '일 나가기 행동', actionUI.goToWork)}${renderGaugeButton('contact-family', '📞 가족에게 연락하기', '가족에게 연락하기 행동', actionUI.contactFamily)}${state.upgrades.adoptDog && !state.timePassedEventDismissed ? renderGaugeButton('go-for-walk', `🐕🚶 ${state.dogName ?? '강아지'}와(과) 산책하기`, '산책하기 행동', actionUI.goForWalk) : ''}</section>`

  const gatherRows: string[] = [renderGaugeButton('gather-wood', `🪵 뗄감 줍기 (+${getGatherWoodReward(state)})`, '🪵 뗄감 줍기 행동', actionUI.gatherWood)]
  if (state.unlocks.scrapAction) {
    gatherRows.push(renderGaugeButton('gather-scrap', `🗑️ 고물 줍기 (+${getGatherScrapRewardPreview(state)})`, '🗑️ 고물 줍기 행동', actionUI.gatherScrap))
  }
  const gatherSection = `<section class="action-group" aria-label="줍기 행동"><h3 class="subheading">줍기</h3>${gatherRows.join('')}</section>`

  const runRows: string[] = []
  if (state.buildings.lumberMill > 0) {
    runRows.push(renderBuildingGauge('lumber-progress', `벌목기 가동 x${state.buildings.lumberMill}`, lumberGauge))
  }
  if (state.buildings.droneController > 0) {
    runRows.push(renderBuildingGauge('scavenger-progress', `스캐빈저 가동 x${state.resources.scavengerDrone}`, scavengerGauge))
  }
  const runSection = runRows.length > 0
    ? `<section class="action-group" aria-label="가동 행동"><h3 class="subheading">가동</h3>${runRows.join('')}</section>`
    : ''

  const minerSection = state.buildings.miner > 0
    ? `<section class="action-group" aria-label="분쇄 행동"><h3 class="subheading">분쇄</h3><p class="hint" id="miner-remaining">분쇄기 배정: ${state.minerAllocation.crushScrap + state.minerAllocation.crushSiliconMass}/${state.buildings.miner} (남음 ${Math.max(0, state.buildings.miner - (state.minerAllocation.crushScrap + state.minerAllocation.crushSiliconMass))})</p>${renderMinerRow(state, 'crushScrap', '고물 분쇄 (🗑️1 → ⛓️1 + 🟢/🔵)')}${renderMinerRow(state, 'crushSiliconMass', '규소 덩어리 분쇄 (🧱1 → 🟣1)')}</section>`
    : ''

  const smeltingSection = state.buildings.electricFurnace > 0
    ? `<section class="action-group" aria-label="녹이기 행동"><h3 class="subheading">녹이기</h3><p class="hint" id="smelting-remaining">전기로 배정: ${smeltingUsed}/${state.buildings.electricFurnace} (남음 ${smeltingRemaining})</p>${renderSmeltingRow(state, 'burnWood', '땔감 태우기 (🪵1K → ⚫탄소1)')}${renderSmeltingRow(state, 'meltScrap', '고물 녹이기 (🗑️100+🟢3+🔵1 → 🔗1)')}${renderSmeltingRow(state, 'meltIron', '철 녹이기 (⛓️100+🟡8 → 🖇️1)')}${renderSmeltingRow(state, 'meltSiliconMass', '규소 덩어리 녹이기 (🧱1 → 🗞️75% / 🟡25%)')}</section>`
    : ''

  const buildingRows: string[] = []
  if (state.unlocks.lumberMill || state.buildings.lumberMill > 0) {
    buildingRows.push(`<button id="buy-lumber" aria-label="건물 설치"><span id="buy-lumber-label">벌목기 설치 (${formatResourceAmount('scrap', lumberCost.scrap ?? 0)})</span></button>`)
  }
  if (state.unlocks.miner || state.buildings.miner > 0) {
    buildingRows.push(`<button id="buy-miner" aria-label="건물 설치"><span id="buy-miner-label">분쇄기 설치 (${formatResourceAmount('wood', minerCost.wood ?? 0)}, ${formatResourceAmount('scrap', minerCost.scrap ?? 0)})</span></button>`)
  }
  if (state.isGuideRobotRecovered || singletonInstalled.laikaRepair) {
    buildingRows.push(`<button id="buy-laika-repair" aria-label="건물 설치" ${singletonInstalled.laikaRepair ? 'disabled' : ''}><span id="buy-laika-repair-label">${singletonInstalled.laikaRepair ? `${companionName} 수리 (설치 완료)` : `${companionName} 수리 (${formatCost(laikaRepairCost)})`}</span></button>`)
  }
  if (state.unlocks.lab || singletonInstalled.lab) {
    buildingRows.push(`<button id="buy-lab" aria-label="건물 설치" ${singletonInstalled.lab ? 'disabled' : ''}><span id="buy-lab-label">${singletonInstalled.lab ? `${getBuildingLabel('lab')} (설치 완료)` : `지자 컴퓨터 설치 (${formatCost(labCost)})`}</span></button>`)
  }
  if (state.unlocks.workbench || singletonInstalled.workbench) {
    buildingRows.push(`<button id="buy-workbench" aria-label="건물 설치" ${singletonInstalled.workbench ? 'disabled' : ''}><span id="buy-workbench-label">${singletonInstalled.workbench ? `${getBuildingLabel('workbench')} (설치 완료)` : `금속 프린터 설치 (${formatCost(workbenchCost)})`}</span></button>`)
  }
  if (electricFurnaceUnlocked || state.buildings.electricFurnace > 0) {
    buildingRows.push(`<button id="buy-electric-furnace" aria-label="건물 설치" ${state.buildings.lab <= 0 ? 'disabled' : ''}><span id="buy-electric-furnace-label">전기로 설치 (${formatCost(electricFurnaceCost)})</span></button>`)
  }
  if (droneControllerUnlocked || singletonInstalled.droneController) {
    buildingRows.push(`<button id="buy-drone-controller" aria-label="건물 설치" ${singletonInstalled.droneController ? 'disabled' : ''}><span id="buy-drone-controller-label">${singletonInstalled.droneController ? `${getBuildingLabel('droneController')} (설치 완료)` : `드론 컨트롤러 설치 (${formatCost(droneControllerCost)})`}</span></button>`)
  }

  return `<section id="panel-base" class="panel-stack ${state.activeTab === 'base' ? '' : 'hidden'}">
      <div class="tab-top-row">${renderCompactLogPanel(state)}<section class="panel resources"><h2>창고</h2><section class="warehouse-grid" aria-label="창고"><div class="warehouse-column" aria-label="자원"><p class="resource-group-label" id="resource-storage-cap-label">자원 (최대 ${storageCap})</p><div class="resource-group resource-group--major">${renderResourceRow('cash', 'res-cash', formatBaseResourceValue('cash', state.resources.cash), state.resources.cash)}${renderResourceRow('wood', 'res-wood', formatBaseResourceValue('wood', state.resources.wood), state.resources.wood)}${renderResourceRow('scrap', 'res-scrap', formatBaseResourceValue('scrap', state.resources.scrap), state.resources.scrap)}${renderResourceRow('siliconMass', 'res-silicon-mass', formatBaseResourceValue('siliconMass', state.resources.siliconMass), state.resources.siliconMass)}</div><div class="resource-group resource-group--major">${renderResourceRow('iron', 'res-iron', formatBaseResourceValue('iron', state.resources.iron), state.resources.iron)}${renderResourceRow('lowAlloySteel', 'res-low-alloy-steel', formatBaseResourceValue('lowAlloySteel', state.resources.lowAlloySteel), state.resources.lowAlloySteel)}${renderResourceRow('highAlloySteel', 'res-high-alloy-steel', formatBaseResourceValue('highAlloySteel', state.resources.highAlloySteel), state.resources.highAlloySteel)}</div><div class="resource-group resource-group--major">${renderResourceRow('chromium', 'res-chromium', formatBaseResourceValue('chromium', state.resources.chromium), state.resources.chromium)}${renderResourceRow('molybdenum', 'res-molybdenum', formatBaseResourceValue('molybdenum', state.resources.molybdenum), state.resources.molybdenum)}${renderResourceRow('cobalt', 'res-cobalt', formatBaseResourceValue('cobalt', state.resources.cobalt), state.resources.cobalt)}${renderResourceRow('nickel', 'res-nickel', formatBaseResourceValue('nickel', state.resources.nickel), state.resources.nickel)}</div><div class="resource-group resource-group--major">${renderResourceRow('carbon', 'res-carbon', formatBaseResourceValue('carbon', state.resources.carbon), state.resources.carbon)}${renderResourceRow('siliconIngot', 'res-silicon-ingot', formatBaseResourceValue('siliconIngot', state.resources.siliconIngot), state.resources.siliconIngot)}</div></div><div class="warehouse-column" aria-label="장비"><p class="resource-group-label">장비</p><div class="resource-group resource-group--major">${renderResourceRow('shovel', 'res-shovel', `${formatResourceValue('shovel', state.resources.shovel)}/${SHOVEL_MAX_STACK}`, state.resources.shovel)}${renderResourceRow('scavengerDrone', 'res-scavenger-drone', formatResourceValue('scavengerDrone', state.resources.scavengerDrone), state.resources.scavengerDrone)}${renderResourceRow('syntheticFood', 'res-synthetic-food', formatResourceValue('syntheticFood', state.resources.syntheticFood), state.resources.syntheticFood)}${renderResourceRow('smallHealPotion', 'res-small-heal-potion', formatResourceValue('smallHealPotion', state.resources.smallHealPotion), state.resources.smallHealPotion)}</div>${state.upgrades.adoptDog && !state.relapseEventDismissed ? `<div class="resource-group resource-group--major"><p class="resource-row" id="dog-equipment-row">${state.timePassedEventDismissed ? `🏺 ${state.dogName ?? '강아지'}의 유골함` : `🐕 ${state.dogName ?? '강아지'} <strong>(산책 ${state.walkCount}회)</strong>`}</p></div>` : ''}</div></section></section></div>
      <div class="base-left-col">
      <section class="panel actions"><h2>행동</h2>${!state.relapseEventDismissed ? dailySection : ''}${state.relapseEventDismissed ? gatherSection : ''}${runSection}${minerSection}${smeltingSection}</section>
      <section id="upgrades-panel" class="panel upgrades" ${(state.relapseEventDismissed ? state.buildings.lab <= 0 : (state.buildings.lab <= 0 && state.upgrades.visitHospital && state.collapseEventDismissed)) ? 'hidden' : ''}><h2>연구</h2>${RESEARCH_PANEL_GROUPS.map((group) => {
        if (group.requiresLab && state.buildings.lab <= 0) return ''
        if (!group.requiresLab && state.relapseEventDismissed) return ''
        const items = (group.keys as readonly string[]).filter((key) => {
          if (key === 'visitHospital') return state.collapseEventDismissed
          if (key === 'comfortRobot') return state.timePassedEventDismissed
          return true
        }).map((key) => {
          const typedKey = key as keyof typeof UPGRADE_DEFS
          const def = UPGRADE_DEFS[typedKey]
          const done = state.upgrades[typedKey]
          const cost = getUpgradeCost(typedKey)
          return `<button data-upgrade="${typedKey}" aria-label="연구 ${def.name}" ${done ? 'disabled' : ''}>${def.name} (${formatCost(cost)})</button><p class="hint" id="upgrade-hint-${typedKey}">${def.effectText}${done ? ' (완료)' : ''}</p>`
        }).join('')
        return items ? `<section class="upgrade-group"><h3 class="subheading">${group.label}</h3>${items}</section>` : ''
      }).join('')}</section>
      </div>
      ${state.relapseEventDismissed ? `<section class="panel production"><h2>생산</h2><section id="crafting-panel" class="production-group" aria-label="제작"><h3 class="subheading">제작</h3>${renderCraftActions(state)}</section><section class="production-group" aria-label="건설"><h3 class="subheading">건설</h3>${buildingRows.join('')}</section></section>` : ''}
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

export function patchBuildingGauge(app: ParentNode, id: string, gaugeView: BuildingGaugeView): void {
  const gauge = app.querySelector<HTMLElement>(`#${id}`)
  if (!gauge) return
  gauge.classList.remove('gauge-running', 'gauge-paused', 'gauge-idle')
  gauge.classList.add(`gauge-${gaugeView.phase}`)
  if (gauge instanceof HTMLButtonElement) gauge.disabled = gaugeView.phase === 'idle'
  const width = Math.round(clamp01(gaugeView.progress) * 100)
  const fill = gauge.querySelector<HTMLElement>('.gauge-fill')
  if (fill) fill.style.width = `${width}%`
  const state = gauge.querySelector<HTMLElement>('.gauge-state')
  if (state) state.textContent = gaugeView.percentText
  const time = gauge.querySelector<HTMLElement>('.gauge-time')
  if (time) time.textContent = gaugeView.timeText
}

export function patchSmeltingPanel(app: ParentNode, state: GameState, now = Date.now()): void {
  const smeltingUsed = Object.values(state.smeltingAllocation).reduce((sum, value) => sum + value, 0)
  const smeltingRemaining = Math.max(0, state.buildings.electricFurnace - smeltingUsed)
  const remainingNode = app.querySelector<HTMLElement>('#smelting-remaining')
  if (remainingNode) remainingNode.textContent = `전기로 배정: ${smeltingUsed}/${state.buildings.electricFurnace} (남음 ${smeltingRemaining})`

  ;(['burnWood', 'meltScrap', 'meltIron', 'meltSiliconMass'] as SmeltingProcessKey[]).forEach((key) => {
    const gauge = getSmeltingGaugeMeta(state, key, now)
    patchBuildingGauge(app, `smelting-gauge-${key}`, gauge)

    const allocated = state.smeltingAllocation[key]
    const title = getSmeltingTitle(key)

    const runButton = app.querySelector<HTMLButtonElement>(`#smelting-gauge-${key}`)
    if (runButton) runButton.disabled = state.buildings.electricFurnace <= 0 || allocated <= 0

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
    patchBuildingGauge(app, `miner-gauge-${key}`, gauge)

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
  patchActionGauge(app, 'craft-synthetic-food', craftViewByRecipe(state, 'syntheticFood'))
  patchActionGauge(app, 'craft-small-heal-potion', craftViewByRecipe(state, 'smallHealPotion'))
  patchActionGauge(app, 'craft-junk-armor', craftViewByRecipe(state, 'junkArmor'))
  patchActionGauge(app, 'craft-iron-armor', craftViewByRecipe(state, 'ironArmor'))

  patchGaugeTitle(app, 'craft-shovel', `${getResourceDisplay('shovel')} 제작 (${formatCost(getCraftRecipeCost(state, 'shovel'))})`)
  patchGaugeTitle(app, 'craft-module', `${getModuleCraftTierLabel(getActiveModuleCraftTier(state))} (${formatCost(getCraftRecipeCost(state, 'module'))})`)
  patchGaugeTitle(app, 'craft-scavenger-drone', `${getResourceDisplay('scavengerDrone')} 제작 (${formatCost(getCraftRecipeCost(state, 'scavengerDrone'))})`)
  patchGaugeTitle(app, 'craft-synthetic-food', `${getResourceDisplay('syntheticFood')} 제작 (${formatCost(getCraftRecipeCost(state, 'syntheticFood'))})`)
  patchGaugeTitle(app, 'craft-small-heal-potion', `${getResourceDisplay('smallHealPotion')} 제작 (${formatCost(getCraftRecipeCost(state, 'smallHealPotion'))})`)

  const tier = getSelectedModuleCraftTier(state)
  const prev = app.querySelector<HTMLButtonElement>('#module-craft-tier-prev')
  if (prev) prev.disabled = tier <= 1
  const next = app.querySelector<HTMLButtonElement>('#module-craft-tier-next')
  if (next) next.disabled = tier >= 3 || (tier >= 2 && !state.upgrades.moduleCraftingIII) || !state.upgrades.moduleCraftingII

  const armorType = getSelectedArmorCraftType(state)
  const armorPrev = app.querySelector<HTMLButtonElement>('#armor-craft-type-prev')
  if (armorPrev) armorPrev.disabled = armorType === 'junkArmor'
  const armorNext = app.querySelector<HTMLButtonElement>('#armor-craft-type-next')
  if (armorNext) armorNext.disabled = armorType === 'ironArmor'
  patchGaugeTitle(app, `craft-${armorType === 'junkArmor' ? 'junk-armor' : 'iron-armor'}`, `${CRAFT_RECIPE_DEFS[armorType].label} +${ARMOR_HP[armorType]}HP (${formatCost(getCraftRecipeCost(state, armorType))})`)

  const moduleCraftRow = app.querySelector<HTMLElement>('.module-craft-row')
  if (moduleCraftRow) {
    const activeTier = getActiveModuleCraftTier(state)
    moduleCraftRow.dataset.moduleRarity = activeTier >= 3 ? 'blue' : activeTier >= 2 ? 'green' : 'white'
  }
}
