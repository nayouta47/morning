import type { GameState } from '../../core/state.ts'
import { ENEMY_IDS, getEnemyDef } from '../../data/enemies.ts'
import { getBiomesForEnemy } from '../../data/maps/index.ts'
import { MODULE_CODEX_ENTRIES, MODULE_METADATA } from '../../data/modules.ts'
import { getResourceDisplay } from '../../data/resources.ts'
import { renderInfluenceMiniGrid } from './assembly/influenceView.ts'
import { EVENT_NAMES } from '../../data/events.ts'

type CodexSubTab = 'enemy' | 'chip' | 'event'

type EventCodexEntry = {
  key: string
  name: string
  description: string
  isUnlocked: (state: GameState) => boolean
}

const EVENT_CODEX_ENTRIES: EventCodexEntry[] = [
  {
    key: 'collapse',
    name: EVENT_NAMES.collapse,
    description: '산책 도중 시야에 어둠이 내려앉았다. 바닥이 기울어졌다. 가까이서 짖는 소리가 들렸다.',
    isUnlocked: (state) => state.collapseEventDismissed,
  },
  {
    key: 'terminalIllness',
    name: EVENT_NAMES.terminalIllness,
    description: '담당의는 종이를 내려놓았다. 이름도 어려운 퇴행성 질환. 진행을 늦출 수 없다고 했다. 냉동 수면 프로그램에 들어갔다.',
    isUnlocked: (state) => state.terminalIllnessEventDismissed,
  },
  {
    key: 'timePassed',
    name: EVENT_NAMES.timePassed,
    description: '눈을 떴다. 천장이 낯설었다. 화면에는 숫자가 하나 떠 있었다. 72.',
    isUnlocked: (state) => state.timePassedEventDismissed,
  },
  {
    key: 'relapse',
    name: EVENT_NAMES.relapse,
    description: '시야가 흐려졌다. 바닥이 기울어졌다. 다시.',
    isUnlocked: (state) => state.relapseEventDismissed,
  },
]

const CHIP_CODEX_ENTRIES = MODULE_CODEX_ENTRIES

let selectedCodexSubTab: CodexSubTab = 'enemy'

export function setCodexSubTab(tab: CodexSubTab): void {
  selectedCodexSubTab = tab
}

function formatEncounterText(timestamp: number | null): string {
  if (timestamp == null) return '아니오'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return '예'
  return `${date.toLocaleDateString('ko-KR')} ${date.toLocaleTimeString('ko-KR', { hour12: false })}`
}

function renderDropCandidates(enemyId: (typeof ENEMY_IDS)[number]): string {
  const enemy = getEnemyDef(enemyId)
  return enemy.drops
    .map((drop) => {
      const amountText = drop.minAmount === drop.maxAmount ? `${drop.minAmount}` : `${drop.minAmount}~${drop.maxAmount}`
      const chance = `${Math.round(drop.chance * 100)}%`
      return `<li>${getResourceDisplay(drop.resource)} x${amountText} (${chance})</li>`
    })
    .join('')
}

function getEncounteredEnemyIds(state: GameState): (typeof ENEMY_IDS)[number][] {
  if (state.codexRevealAll) return [...ENEMY_IDS]
  return ENEMY_IDS.filter((enemyId) => state.enemyCodex[enemyId]?.encountered)
}

function renderEnemyBiomes(enemyId: (typeof ENEMY_IDS)[number]): string {
  const biomes = getBiomesForEnemy(enemyId)
  if (biomes.length === 0) return '없음'
  return biomes.map((biome) => `${biome.emoji} ${biome.name}`).join(', ')
}

function renderEnemyRows(state: GameState): string {
  const encounteredEnemyIds = getEncounteredEnemyIds(state)
  if (encounteredEnemyIds.length === 0) {
    return '<p class="codex-empty">아직 마주친 것이 없습니다. 탐험에서 적을 만나면 기록됩니다.</p>'
  }

  return encounteredEnemyIds.map((enemyId) => {
    const enemy = getEnemyDef(enemyId)
    const codex = state.enemyCodex[enemyId]
    const defeated = codex && codex.defeatCount > 0 ? '예' : '아니오'
    const detailsId = `codex-card-body-${enemyId}`
    return `<article class="codex-card" aria-label="${enemy.name} 조우 기록"><button class="codex-card-toggle" type="button" data-codex-toggle="${enemyId}" aria-expanded="false" aria-controls="${detailsId}"><span class="codex-card-title">${enemy.name}</span><span class="codex-card-summary">처치 ${codex?.defeatCount ?? 0}회</span></button><div class="codex-card-body hidden" id="${detailsId}"><ul><li>조우 여부: 예</li><li>처치 여부: ${defeated}</li><li>개념 티어: ${enemy.tier}</li><li>HP: ${enemy.hp}</li><li>피해량: ${enemy.damage}</li><li>공격 쿨다운: ${(enemy.attackCooldownMs / 1000).toFixed(1)}초</li><li>출현 지형: ${renderEnemyBiomes(enemyId)}</li><li>첫 조우 시각: ${formatEncounterText(codex?.firstEncounteredAt ?? null)}</li><li>처치 수: ${codex?.defeatCount ?? 0}</li><li>드롭 후보:<ul>${renderDropCandidates(enemyId)}</ul></li></ul></div></article>`
  }).join('')
}


function renderEventRows(state: GameState): string {
  const unlocked = EVENT_CODEX_ENTRIES.filter((entry) => entry.isUnlocked(state))
  if (unlocked.length === 0) {
    return '<p class="codex-empty">아직 기록된 사건이 없습니다.</p>'
  }
  return unlocked.map((entry) =>
    `<article class="codex-card" aria-label="${entry.name} 사건 기록"><div class="codex-event-head"><span class="codex-card-title">${entry.name}</span></div><p class="codex-event-desc">${entry.description}</p></article>`
  ).join('')
}

function renderChipRows(state: GameState): string {
  return CHIP_CODEX_ENTRIES
    .map((chip) => {
      const owned = state.modules[chip.type]
      const isOwned = owned > 0
      const detail = MODULE_METADATA[chip.type]
      const miniGrid = renderInfluenceMiniGrid(chip.type)
      const effectCards = `<article class="module-effect-card module-effect-base" aria-label="기본효과"><h4>기본효과</h4><p class="hint">${detail.baseDescription}</p></article><article class="module-effect-card module-effect-amp" aria-label="증폭효과"><h4>증폭효과</h4><p class="hint">${detail.amplifiedDescription}</p></article><article class="module-effect-card module-effect-specs" aria-label="규격"><h4>규격</h4><p class="hint">⚡ ${chip.powerCost} · ⚖️ ${chip.weight}</p></article>`
      const body = `<div class="module-effect-cards">${effectCards}</div>${miniGrid ?? ''}`
      return `<article class="codex-card codex-chip-card ${isOwned ? '' : 'codex-chip-locked'}" data-codex-chip-type="${chip.type}" aria-label="${chip.name} 장비 기록 ${isOwned ? '보유' : '미보유'}"><div class="codex-chip-head"><div class="codex-chip-name-wrap"><span class="codex-chip-icon" aria-hidden="true">${chip.icon}</span><span class="codex-card-title">${chip.name}</span>${isOwned ? '' : '<span class="codex-chip-lock">잠김</span>'}</div><span class="codex-card-summary">보유 ${owned}개</span></div>${body}</article>`
    })
    .join('')
}


function codexSignature(state: GameState): string {
  const enemySig = ENEMY_IDS.map((enemyId) => {
    const codex = state.enemyCodex[enemyId]
    return `${enemyId}:${codex?.encountered ? 1 : 0}:${codex?.firstEncounteredAt ?? 0}:${codex?.defeatCount ?? 0}`
  }).join('|')

  const chipSig = CHIP_CODEX_ENTRIES.map((chip) => `${chip.type}:${state.modules[chip.type]}`).join('|')
  const eventSig = EVENT_CODEX_ENTRIES.map((e) => `${e.key}:${e.isUnlocked(state) ? 1 : 0}`).join('|')
  return `${selectedCodexSubTab}|${state.codexRevealAll ? 1 : 0}|${enemySig}|${chipSig}|${eventSig}`
}

function renderCodexBody(state: GameState): string {
  if (selectedCodexSubTab === 'chip') return `<div class="codex-list" id="codex-chip-list">${renderChipRows(state)}</div>`
  if (selectedCodexSubTab === 'event') return `<div class="codex-list" id="codex-event-list">${renderEventRows(state)}</div>`
  return `<div class="codex-list" id="codex-list">${renderEnemyRows(state)}</div>`
}

function renderCodexHint(): string {
  if (selectedCodexSubTab === 'chip') return '모든 칩을 표시합니다. 미보유 칩도 잠김 상태로 확인할 수 있습니다.'
  if (selectedCodexSubTab === 'event') return '경험한 사건이 순서대로 기록됩니다.'
  return '마주친 것들만 기록됩니다. 눌러서 상세 정보 확인.'
}

function renderSubTabs(): string {
  return `<div class="codex-subtabs" role="tablist" aria-label="일기 분류"><button class="codex-subtab ${selectedCodexSubTab === 'enemy' ? 'active' : ''}" type="button" role="tab" aria-selected="${selectedCodexSubTab === 'enemy'}" data-codex-subtab="enemy">조우</button><button class="codex-subtab ${selectedCodexSubTab === 'chip' ? 'active' : ''}" type="button" role="tab" aria-selected="${selectedCodexSubTab === 'chip'}" data-codex-subtab="chip">장비</button><button class="codex-subtab ${selectedCodexSubTab === 'event' ? 'active' : ''}" type="button" role="tab" aria-selected="${selectedCodexSubTab === 'event'}" data-codex-subtab="event">사건</button></div>`
}

export function renderCodexPanel(state: GameState): string {
  return `<section class="panel codex ${state.activeTab === 'codex' ? '' : 'hidden'}" id="panel-codex"><h2>일기</h2>${renderSubTabs()}<p class="hint" id="codex-hint">${renderCodexHint()}</p><div id="codex-content" data-signature="${codexSignature(state)}">${renderCodexBody(state)}</div></section>`
}

export function patchCodexPanel(app: ParentNode, state: GameState): void {
  const content = app.querySelector<HTMLElement>('#codex-content')
  if (!content) return

  const signature = codexSignature(state)
  if (content.dataset.signature === signature) return

  content.dataset.signature = signature
  content.innerHTML = renderCodexBody(state)

  const hint = app.querySelector<HTMLElement>('#codex-hint')
  if (hint) hint.textContent = renderCodexHint()

  const enemyTab = app.querySelector<HTMLButtonElement>('[data-codex-subtab="enemy"]')
  const chipTab = app.querySelector<HTMLButtonElement>('[data-codex-subtab="chip"]')
  const eventTab = app.querySelector<HTMLButtonElement>('[data-codex-subtab="event"]')
  if (enemyTab) {
    enemyTab.classList.toggle('active', selectedCodexSubTab === 'enemy')
    enemyTab.setAttribute('aria-selected', String(selectedCodexSubTab === 'enemy'))
  }
  if (chipTab) {
    chipTab.classList.toggle('active', selectedCodexSubTab === 'chip')
    chipTab.setAttribute('aria-selected', String(selectedCodexSubTab === 'chip'))
  }
  if (eventTab) {
    eventTab.classList.toggle('active', selectedCodexSubTab === 'event')
    eventTab.setAttribute('aria-selected', String(selectedCodexSubTab === 'event'))
  }
}
