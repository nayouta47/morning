import { ACTION_DURATION_MS, UPGRADE_DEFS, getUpgradeCost } from '../../data/balance.ts'
import { COMPANION_DEPART_MESSAGES, getCompanionName } from '../companion.ts'
import { ENEMY_IDS } from '../../data/enemies.ts'
import { getBuildingCost, getBuildingLabel, type BuildingId } from '../../data/buildings.ts'
import type { GameState, MinerProcessKey, OrganType, SmeltingProcessKey, TabKey } from '../state.ts'
import { evaluateUnlocks } from '../unlocks.ts'
import { canAfford, payCost } from './costs.ts'
import { narrate } from './logging.ts'
import { getGatherScrapDurationMs } from '../rewards.ts'

type UpgradeKey = keyof typeof UPGRADE_DEFS

function applyUnlocks(state: GameState): void {
  const messages = evaluateUnlocks(state)
  messages.forEach((line) => narrate(state, line))
}

export { getBuildingCost }

export function goToWork(state: GameState): void {
  if (state.actionProgress.goToWork > 0) {
    narrate(state, '이미 일하러 나간 중입니다.')
    return
  }
  state.actionProgress.goToWork = ACTION_DURATION_MS.goToWork
  const goToWorkLogs = [
    '생명을 돈으로 치환하는 절차를 수행한다.',
    '걱정을 멈추고 노동을 사랑하는 법을 배웠다. 아직 배우는 중이다.',
    '면도를 마치고 벽을 쳐다보자 형상이 보였다. 그에게 잘 다녀오겠다 인사하였다. 그는 답하지 않았다.',
  ]
  narrate(state, goToWorkLogs[Math.floor(Math.random() * goToWorkLogs.length)])
}

export function gatherWood(state: GameState): void {
  if (state.actionProgress.gatherWood > 0) {
    narrate(state, '이미 뗄감을 줍는 중입니다.')
    return
  }

  state.actionProgress.gatherWood = ACTION_DURATION_MS.gatherWood
  narrate(state, '근처를 돌아다니며 불에 탈만한 것들을 긁어모은다.')
}

export function gatherScrap(state: GameState): void {
  if (!state.unlocks.scrapAction) {
    narrate(state, '아직 🗑️ 고물을 주울 방법이 없다.')
    return
  }

  if (state.actionProgress.gatherScrap > 0) {
    narrate(state, '이미 고물을 줍는 중입니다.')
    return
  }

  const durationMs = getGatherScrapDurationMs(state)
  state.actionProgress.gatherScrap = durationMs
  state.companionIsAutoGathering = false

  if (state.buildings.laikaRepair > 0) {
    state.companionIdleRemainingMs = 0
    const name = getCompanionName(state)
    narrate(state, name + COMPANION_DEPART_MESSAGES[Math.floor(Math.random() * COMPANION_DEPART_MESSAGES.length)])
  } else {
    narrate(state, '어딜 파도 용도를 모를 고철 쓰레기들이 끝없이 나온다.')
  }
}

export function toggleBuildingRun(state: GameState, key: 'lumberMill' | 'scavenger'): void {
  if (key !== 'scavenger' && state.buildings[key] <= 0) {
    narrate(state, '설치된 건물이 없다.')
    return
  }

  if (key === 'scavenger' && (state.buildings.droneController <= 0 || state.resources.scavengerDrone <= 0)) {
    narrate(state, '스캐빈저 가동 조건이 부족합니다.')
    return
  }

  state.productionRunning[key] = !state.productionRunning[key]
  const targetLabel = key === 'lumberMill' ? '벌목기' : '스캐빈저'
  narrate(state, state.productionRunning[key] ? `${targetLabel}이(가) 다시 돌아가기 시작한다.` : `${targetLabel}을(를) 멈췄다.`)
}

function clampMinerAllocationToOwned(state: GameState): void {
  const owned = Math.max(0, Math.floor(state.buildings.miner))
  const total = state.minerAllocation.crushScrap + state.minerAllocation.crushSiliconMass
  if (total <= owned) return

  let overflow = total - owned
  const cutSilicon = Math.min(state.minerAllocation.crushSiliconMass, overflow)
  state.minerAllocation.crushSiliconMass -= cutSilicon
  overflow -= cutSilicon
  if (overflow > 0) state.minerAllocation.crushScrap = Math.max(0, state.minerAllocation.crushScrap - overflow)
}

export function buyBuilding(state: GameState, key: BuildingId): void {
  if (key === 'miner' && !state.unlocks.miner) return
  if (
    (key === 'lumberMill' ||
      key === 'workbench' ||
      key === 'lab' ||
      key === 'laikaRepair') &&
    !state.unlocks.lumberMill
  )
    return

  if ((key === 'droneController' || key === 'electricFurnace') && state.buildings.lab <= 0) return

  if (key === 'laikaRepair' && !state.isGuideRobotRecovered) {
    narrate(state, '먼저 파괴된 안내견을 주워 와야 한다.')
    return
  }

  const singletonBuildings: BuildingId[] = ['lab', 'laikaRepair', 'workbench', 'droneController']
  if (singletonBuildings.includes(key) && state.buildings[key] >= 1) return

  const cost = getBuildingCost(state, key)
  if (!canAfford(state.resources, cost)) {
    narrate(state, '자원이 부족하다.')
    return
  }

  payCost(state.resources, cost)
  state.buildings[key] += 1

  if (key === 'miner') {
    const totalAllocated = state.minerAllocation.crushScrap + state.minerAllocation.crushSiliconMass
    if (totalAllocated < state.buildings.miner) state.minerAllocation.crushScrap += 1
    clampMinerAllocationToOwned(state)
  }

  narrate(state, `${getBuildingLabel(key)}을(를) 세웠다.`)
  if (key === 'laikaRepair') {
    state.needsRobotNaming = true
    narrate(state, '안내견 로봇 이름을 정해 주세요.')
  }
  applyUnlocks(state)
}


function toggleProcessRun<Key extends string>(
  state: GameState,
  ownedCount: number,
  allocation: Record<Key, number>,
  running: Record<Key, boolean>,
  key: Key,
  targetLabel: string,
): void {
  if (ownedCount <= 0) {
    narrate(state, '설치된 건물이 없다.')
    return
  }

  if (allocation[key] <= 0) {
    narrate(state, '배정된 라인이 없다.')
    return
  }

  running[key] = !running[key]
  narrate(state, running[key] ? `${targetLabel}이(가) 다시 돌아가기 시작한다.` : `${targetLabel}을(를) 멈췄다.`)
}

export function toggleSmeltingProcessRun(state: GameState, key: SmeltingProcessKey): void {
  const targetLabelMap: Record<SmeltingProcessKey, string> = {
    burnWood: '땔감 태우기',
    meltScrap: '고물 녹이기',
    meltIron: '철 녹이기',
    meltSiliconMass: '규소 덩어리 녹이기',
  }

  toggleProcessRun(
    state,
    state.buildings.electricFurnace,
    state.smeltingAllocation,
    state.smeltingProcessRunning,
    key,
    targetLabelMap[key],
  )
}

export function toggleMinerProcessRun(state: GameState, key: MinerProcessKey): void {
  const targetLabelMap: Record<MinerProcessKey, string> = {
    crushScrap: '고물 분쇄',
    crushSiliconMass: '규소 덩어리 분쇄',
  }

  toggleProcessRun(
    state,
    state.buildings.miner,
    state.minerAllocation,
    state.minerProcessRunning,
    key,
    targetLabelMap[key],
  )
}

function setProcessAllocation<Key extends string>(
  allocation: Record<Key, number>,
  key: Key,
  requestedValue: number,
  owned: number,
): void {
  const nextValue = Math.max(0, Math.floor(requestedValue))
  const usedByOthers = (Object.keys(allocation) as Key[])
    .filter((processKey) => processKey !== key)
    .reduce((sum, processKey) => sum + allocation[processKey], 0)

  allocation[key] = Math.min(nextValue, Math.max(0, Math.floor(owned) - usedByOthers))
}

export function setSmeltingAllocation(state: GameState, key: SmeltingProcessKey, requestedValue: number): void {
  setProcessAllocation(state.smeltingAllocation, key, requestedValue, state.buildings.electricFurnace)
}

export function setMinerAllocation(state: GameState, key: MinerProcessKey, requestedValue: number): void {
  setProcessAllocation(state.minerAllocation, key, requestedValue, state.buildings.miner)
}

const NO_LAB_UPGRADE_KEYS: ReadonlySet<UpgradeKey> = new Set(['visitHospital'])

export function buyUpgrade(state: GameState, key: UpgradeKey): void {
  if (state.buildings.lab <= 0 && !NO_LAB_UPGRADE_KEYS.has(key)) return
  if (state.upgrades[key]) return

  const def = UPGRADE_DEFS[key]
  const cost = getUpgradeCost(key)
  if (!canAfford(state.resources, cost)) {
    narrate(state, '자원이 부족하다.')
    return
  }

  payCost(state.resources, cost)
  state.upgrades[key] = true
  narrate(state, `${def.name} 연구가 끝났다.`)
}

export function unlockAllEnemyCodex(state: GameState): void {
  let changed = !state.codexRevealAll
  state.codexRevealAll = true
  const now = Date.now()

  ENEMY_IDS.forEach((enemyId) => {
    const entry = state.enemyCodex[enemyId]
    if (!entry) return
    if (!entry.encountered) {
      entry.encountered = true
      changed = true
    }
    if (entry.firstEncounteredAt == null) entry.firstEncounteredAt = now
  })

  if (changed) {
    narrate(state, '적에 대한 정보가 모두 열렸다.')
  }
}

export function setActiveTab(state: GameState, tab: TabKey): void {
  if (tab === 'assembly' && state.buildings.workbench <= 0) {
    narrate(state, '금속 프린터를 설치해야 조립 탭을 사용할 수 있다.')
    return
  }
  if (tab === 'codex' && state.buildings.lab <= 0) {
    narrate(state, '지자 컴퓨터를 설치해야 도감 탭을 사용할 수 있다.')
    return
  }
  if (state.exploration.mode === 'active' && tab !== 'exploration') {
    narrate(state, '탐험 중에는 다른 탭으로 이동할 수 없다.')
    return
  }
  state.activeTab = tab
}

export function selectOrganSlot(state: GameState, slot: OrganType | null): void {
  state.selectedOrganSlot = slot
}

export function selectWeapon(state: GameState, weaponId: string | null): void {
  if (state.exploration.mode === 'active') {
    narrate(state, '탐험 중에는 무기를 변경할 수 없다.')
    return
  }
  state.selectedWeaponId = weaponId
}
