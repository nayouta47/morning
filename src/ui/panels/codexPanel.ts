import type { GameState } from '../../core/state.ts'
import { ENEMY_IDS, getEnemyDef } from '../../data/enemies.ts'
import { getResourceDisplay } from '../../data/resources.ts'
import { getBiomesForEnemy } from '../../data/maps/index.ts'

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

function renderCodexRows(state: GameState): string {
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

function codexSignature(state: GameState): string {
  return `${state.codexRevealAll ? 1 : 0}|${ENEMY_IDS.map((enemyId) => {
    const codex = state.enemyCodex[enemyId]
    return `${enemyId}:${codex?.encountered ? 1 : 0}:${codex?.firstEncounteredAt ?? 0}:${codex?.defeatCount ?? 0}`
  }).join('|')}`
}

export function renderCodexPanel(state: GameState): string {
  return `<section class="panel codex ${state.activeTab === 'codex' ? '' : 'hidden'}" id="panel-codex"><div class="codex-head"><h2 class="codex-title" data-codex-title>도감</h2><button class="codex-cheat-btn hidden" id="codex-unlock-all" type="button" aria-hidden="true">도감 전체 해금</button></div><p class="hint">조우한 적만 카드로 표시됩니다. 카드를 눌러 상세 정보를 확인하세요.</p><div class="codex-list" id="codex-list" data-signature="${codexSignature(state)}">${renderCodexRows(state)}</div></section>`
}

export function patchCodexPanel(app: ParentNode, state: GameState): void {
  const list = app.querySelector<HTMLElement>('#codex-list')
  if (!list) return
  const signature = codexSignature(state)
  if (list.dataset.signature === signature) return
  list.dataset.signature = signature
  list.innerHTML = renderCodexRows(state)
}
