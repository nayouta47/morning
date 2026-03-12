import type { GameState, ModuleType } from '../../core/state.ts'
import { getWeaponPowerStatus } from '../../core/moduleEffects.ts'
import { ENEMY_IDS, getEnemyDef } from '../../data/enemies.ts'
import { getBiomesForEnemy } from '../../data/maps/index.ts'
import { MODULE_CODEX_ENTRIES, MODULE_EMOJI, MODULE_METADATA, MODULE_NAME_KR, MODULE_POWER_COST } from '../../data/modules.ts'
import { getResourceDisplay } from '../../data/resources.ts'
import { renderInfluenceMiniGrid } from './assembly/influenceView.ts'

type CodexSubTab = 'enemy' | 'chip' | 'power'

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

function renderPowerTab(state: GameState): string {
  if (state.weapons.length === 0) {
    return '<p class="codex-empty">보유 무기가 없습니다.</p>'
  }
  const entries = state.weapons.map((weapon) => {
    const { usage, capacity, overloaded } = getWeaponPowerStatus(weapon)
    const weaponName = weapon.type === 'pistol' ? '권총' : '소총'
    const barPct = Math.min(100, capacity > 0 ? Math.round((usage / capacity) * 100) : 0)
    const badgeClass = overloaded ? 'codex-power-badge overloaded' : 'codex-power-badge'
    const badgeText = overloaded ? '과부하' : '정상'
    const barClass = overloaded ? 'codex-power-bar overloaded' : 'codex-power-bar'
    const entryClass = overloaded ? 'codex-power-entry overloaded' : 'codex-power-entry'

    const moduleCounts = new Map<ModuleType, number>()
    for (const slot of weapon.slots) {
      if (slot != null) moduleCounts.set(slot, (moduleCounts.get(slot) ?? 0) + 1)
    }
    const moduleItems = [...moduleCounts.entries()]
      .map(([type, count]) => `<li>${MODULE_EMOJI[type]} ${MODULE_NAME_KR[type]} ×${count} — ⚡${MODULE_POWER_COST[type] * count}</li>`)
      .join('')

    return `<div class="${entryClass}">
      <div class="codex-power-head">
        <span>${weaponName} <span class="hint">#${weapon.id.slice(-4)}</span></span>
        <span>⚡ ${usage} / ${capacity}</span>
        <span class="${badgeClass}">${badgeText}</span>
      </div>
      <div class="codex-power-bar-wrap"><div class="${barClass}" style="width:${barPct}%"></div></div>
      ${moduleItems ? `<ul class="codex-power-modules">${moduleItems}</ul>` : ''}
    </div>`
  }).join('')
  return `<div class="codex-power-list">${entries}</div>`
}

function renderChipRows(state: GameState): string {
  return CHIP_CODEX_ENTRIES
    .map((chip) => {
      const owned = state.modules[chip.type]
      const isOwned = owned > 0
      const detail = MODULE_METADATA[chip.type]
      const miniGrid = renderInfluenceMiniGrid(chip.type)
      const effectCards = `<article class="module-effect-card module-effect-base" aria-label="기본효과"><h4>기본효과</h4><p class="hint">${detail.baseDescription}</p></article><article class="module-effect-card module-effect-amp" aria-label="증폭효과"><h4>증폭효과</h4><p class="hint">${detail.amplifiedDescription}</p></article>`
      const body = `<div class="module-effect-cards">${effectCards}</div>${miniGrid ?? ''}`
      return `<article class="codex-card codex-chip-card ${isOwned ? '' : 'codex-chip-locked'}" data-codex-chip-type="${chip.type}" aria-label="${chip.name} 도감 항목 ${isOwned ? '보유' : '미보유'}"><div class="codex-chip-head"><div class="codex-chip-name-wrap"><span class="codex-chip-icon" aria-hidden="true">${chip.icon}</span><span class="codex-card-title">${chip.name}</span>${isOwned ? '' : '<span class="codex-chip-lock">잠김</span>'}</div><span class="codex-card-summary">보유 ${owned}개</span></div>${body}<p class="codex-chip-power">⚡${chip.powerCost} · ⚖️${chip.weight}</p></article>`
    })
    .join('')
}


function codexSignature(state: GameState): string {
  const enemySig = ENEMY_IDS.map((enemyId) => {
    const codex = state.enemyCodex[enemyId]
    return `${enemyId}:${codex?.encountered ? 1 : 0}:${codex?.firstEncounteredAt ?? 0}:${codex?.defeatCount ?? 0}`
  }).join('|')

  const chipSig = CHIP_CODEX_ENTRIES.map((chip) => `${chip.type}:${state.modules[chip.type]}`).join('|')
  const powerSig = state.weapons.map((w) => `${w.id}:${w.slots.join('|')}`).join('|')
  return `${selectedCodexSubTab}|${state.codexRevealAll ? 1 : 0}|${enemySig}|${chipSig}|${powerSig}`
}

function renderCodexBody(state: GameState): string {
  if (selectedCodexSubTab === 'chip') return `<div class="codex-list" id="codex-chip-list">${renderChipRows(state)}</div>`
  if (selectedCodexSubTab === 'power') return `<div class="codex-list" id="codex-power-list">${renderPowerTab(state)}</div>`
  return `<div class="codex-list" id="codex-list">${renderEnemyRows(state)}</div>`
}

function renderCodexHint(): string {
  if (selectedCodexSubTab === 'chip') return '모든 칩을 표시합니다. 미보유 칩도 잠김 상태로 확인할 수 있습니다.'
  if (selectedCodexSubTab === 'power') return '무기별 전력 소모 현황을 표시합니다.'
  return '조우한 적만 카드로 표시됩니다. 카드를 눌러 상세 정보를 확인하세요.'
}

function renderSubTabs(): string {
  return `<div class="codex-subtabs" role="tablist" aria-label="도감 분류"><button class="codex-subtab ${selectedCodexSubTab === 'enemy' ? 'active' : ''}" type="button" role="tab" aria-selected="${selectedCodexSubTab === 'enemy'}" data-codex-subtab="enemy">적</button><button class="codex-subtab ${selectedCodexSubTab === 'chip' ? 'active' : ''}" type="button" role="tab" aria-selected="${selectedCodexSubTab === 'chip'}" data-codex-subtab="chip">칩</button><button class="codex-subtab ${selectedCodexSubTab === 'power' ? 'active' : ''}" type="button" role="tab" aria-selected="${selectedCodexSubTab === 'power'}" data-codex-subtab="power">전력</button></div>`
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
  const powerTab = app.querySelector<HTMLButtonElement>('[data-codex-subtab="power"]')
  if (enemyTab) {
    enemyTab.classList.toggle('active', selectedCodexSubTab === 'enemy')
    enemyTab.setAttribute('aria-selected', String(selectedCodexSubTab === 'enemy'))
  }
  if (chipTab) {
    chipTab.classList.toggle('active', selectedCodexSubTab === 'chip')
    chipTab.setAttribute('aria-selected', String(selectedCodexSubTab === 'chip'))
  }
  if (powerTab) {
    powerTab.classList.toggle('active', selectedCodexSubTab === 'power')
    powerTab.setAttribute('aria-selected', String(selectedCodexSubTab === 'power'))
  }
}
