import type { GameState, ModuleType } from '../../core/state.ts'
import { ENEMY_IDS, getEnemyDef } from '../../data/enemies.ts'
import { getResourceDisplay } from '../../data/resources.ts'
import { getBiomesForEnemy } from '../../data/maps/index.ts'

type CodexSubTab = 'enemy' | 'chip'

type ChipCodexEntry = {
  type: ModuleType
  name: string
  icon: string
  effect: string
  powerCost: number
}

const CHIP_CODEX_ENTRIES: ChipCodexEntry[] = [
  { type: 'damage', name: '공격력 칩', icon: '💥', effect: '기본효과: 공격력 +1 / 증폭효과: 공격력 +1', powerCost: 5 },
  { type: 'cooldown', name: '가속 칩', icon: '⏱️', effect: '기본효과: 가속 +10 / 증폭효과: 가속 +10', powerCost: 5 },
  { type: 'blockAmplifierUp', name: '차단 증폭기(상)', icon: '📡▲', effect: '기본효과: 위쪽 1칸 증폭(중첩) + 좌우 슬롯 차단 / 증폭효과: 해당 없음', powerCost: 2 },
  { type: 'blockAmplifierDown', name: '차단 증폭기(하)', icon: '📡▼', effect: '기본효과: 아래쪽 1칸 증폭(중첩) + 좌우 슬롯 차단 / 증폭효과: 해당 없음', powerCost: 2 },
  { type: 'preheater', name: '예열기 칩', icon: '🔥', effect: '기본효과: 전투 시작 즉시 발사 준비 / 증폭효과: 해당 없음', powerCost: 7 },
  { type: 'heatAmplifierLeft', name: '열 증폭기(좌)', icon: '♨️◀', effect: '기본효과: 즉시 왼쪽 1칸 증폭 +2 / 열장 페널티: 증폭 방향 1칸 고열 10 + 나머지 인접 3칸 고열 5(증폭기 칩 장착 칸 제외), ⌊열⌋만큼 증폭 감소 및 슬롯 정지', powerCost: 4 },
  { type: 'heatAmplifierRight', name: '열 증폭기(우)', icon: '♨️▶', effect: '기본효과: 즉시 오른쪽 1칸 증폭 +2 / 열장 페널티: 증폭 방향 1칸 고열 10 + 나머지 인접 3칸 고열 5(증폭기 칩 장착 칸 제외), ⌊열⌋만큼 증폭 감소 및 슬롯 정지', powerCost: 4 },
]

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
    return '<p class="codex-empty">아직 조우한 적이 없습니다. 탐험에서 적을 만나면 도감에 기록됩니다.</p>'
  }

  return encounteredEnemyIds.map((enemyId) => {
    const enemy = getEnemyDef(enemyId)
    const codex = state.enemyCodex[enemyId]
    const defeated = codex && codex.defeatCount > 0 ? '예' : '아니오'
    const detailsId = `codex-card-body-${enemyId}`
    return `<article class="codex-card" aria-label="${enemy.name} 도감 항목"><button class="codex-card-toggle" type="button" data-codex-toggle="${enemyId}" aria-expanded="false" aria-controls="${detailsId}"><span class="codex-card-title">${enemy.name}</span><span class="codex-card-summary">처치 ${codex?.defeatCount ?? 0}회</span></button><div class="codex-card-body hidden" id="${detailsId}"><ul><li>조우 여부: 예</li><li>처치 여부: ${defeated}</li><li>개념 티어: ${enemy.tier}</li><li>HP: ${enemy.hp}</li><li>피해량: ${enemy.damage}</li><li>공격 쿨다운: ${(enemy.attackCooldownMs / 1000).toFixed(1)}초</li><li>출현 지형: ${renderEnemyBiomes(enemyId)}</li><li>첫 조우 시각: ${formatEncounterText(codex?.firstEncounteredAt ?? null)}</li><li>처치 수: ${codex?.defeatCount ?? 0}</li><li>드롭 후보:<ul>${renderDropCandidates(enemyId)}</ul></li></ul></div></article>`
  }).join('')
}

function renderChipRows(state: GameState): string {
  return CHIP_CODEX_ENTRIES
    .map((chip) => {
      const owned = state.modules[chip.type]
      const isOwned = owned > 0
      return `<article class="codex-card codex-chip-card ${isOwned ? '' : 'codex-chip-locked'}" data-codex-chip-type="${chip.type}" aria-label="${chip.name} 도감 항목 ${isOwned ? '보유' : '미보유'}"><div class="codex-chip-head"><div class="codex-chip-name-wrap"><span class="codex-chip-icon" aria-hidden="true">${chip.icon}</span><span class="codex-card-title">${chip.name}</span>${isOwned ? '' : '<span class="codex-chip-lock">잠김</span>'}</div><span class="codex-card-summary">보유 ${owned}개</span></div><p class="codex-chip-effect">${chip.effect}</p><p class="codex-chip-power">전력 소모 ⚡${chip.powerCost}</p></article>`
    })
    .join('')
}

function codexSignature(state: GameState): string {
  const enemySig = ENEMY_IDS.map((enemyId) => {
    const codex = state.enemyCodex[enemyId]
    return `${enemyId}:${codex?.encountered ? 1 : 0}:${codex?.firstEncounteredAt ?? 0}:${codex?.defeatCount ?? 0}`
  }).join('|')

  const chipSig = CHIP_CODEX_ENTRIES.map((chip) => `${chip.type}:${state.modules[chip.type]}`).join('|')
  return `${selectedCodexSubTab}|${state.codexRevealAll ? 1 : 0}|${enemySig}|${chipSig}`
}

function renderCodexBody(state: GameState): string {
  if (selectedCodexSubTab === 'chip') return `<div class="codex-list" id="codex-chip-list">${renderChipRows(state)}</div>`
  return `<div class="codex-list" id="codex-list">${renderEnemyRows(state)}</div>`
}

function renderCodexHint(): string {
  if (selectedCodexSubTab === 'chip') return '모든 칩을 표시합니다. 미보유 칩도 잠김 상태로 확인할 수 있습니다.'
  return '조우한 적만 카드로 표시됩니다. 카드를 눌러 상세 정보를 확인하세요.'
}

function renderSubTabs(): string {
  return `<div class="codex-subtabs" role="tablist" aria-label="도감 분류"><button class="codex-subtab ${selectedCodexSubTab === 'enemy' ? 'active' : ''}" type="button" role="tab" aria-selected="${selectedCodexSubTab === 'enemy'}" data-codex-subtab="enemy">적</button><button class="codex-subtab ${selectedCodexSubTab === 'chip' ? 'active' : ''}" type="button" role="tab" aria-selected="${selectedCodexSubTab === 'chip'}" data-codex-subtab="chip">칩</button></div>`
}

export function renderCodexPanel(state: GameState): string {
  return `<section class="panel codex ${state.activeTab === 'codex' ? '' : 'hidden'}" id="panel-codex"><h2>도감</h2>${renderSubTabs()}<p class="hint" id="codex-hint">${renderCodexHint()}</p><div id="codex-content" data-signature="${codexSignature(state)}">${renderCodexBody(state)}</div></section>`
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
  if (enemyTab) {
    enemyTab.classList.toggle('active', selectedCodexSubTab === 'enemy')
    enemyTab.setAttribute('aria-selected', String(selectedCodexSubTab === 'enemy'))
  }
  if (chipTab) {
    chipTab.classList.toggle('active', selectedCodexSubTab === 'chip')
    chipTab.setAttribute('aria-selected', String(selectedCodexSubTab === 'chip'))
  }
}
