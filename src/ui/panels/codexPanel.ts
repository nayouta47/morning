import type { GameState } from '../../core/state.ts'
import { ENEMY_IDS, getEnemyDef } from '../../data/enemies.ts'
import { getResourceDisplay } from '../../data/resources.ts'

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

function renderCodexRows(state: GameState): string {
  return ENEMY_IDS.map((enemyId) => {
    const enemy = getEnemyDef(enemyId)
    const codex = state.enemyCodex[enemyId]
    const encountered = codex?.encountered ? '예' : '아니오'
    const defeated = codex && codex.defeatCount > 0 ? '예' : '아니오'
    return `<article class="codex-entry" aria-label="${enemy.name} 도감 항목"><h3>${enemy.name}</h3><ul><li>조우 여부: ${encountered}</li><li>처치 여부: ${defeated}</li><li>HP: ${enemy.hp}</li><li>피해량: ${enemy.damage}</li><li>공격 쿨다운: ${(enemy.attackCooldownMs / 1000).toFixed(1)}초</li><li>첫 조우 시각: ${formatEncounterText(codex?.firstEncounteredAt ?? null)}</li><li>처치 수: ${codex?.defeatCount ?? 0}</li><li>드롭 후보:<ul>${renderDropCandidates(enemyId)}</ul></li></ul></article>`
  }).join('')
}

function codexSignature(state: GameState): string {
  return ENEMY_IDS.map((enemyId) => {
    const codex = state.enemyCodex[enemyId]
    return `${enemyId}:${codex?.encountered ? 1 : 0}:${codex?.firstEncounteredAt ?? 0}:${codex?.defeatCount ?? 0}`
  }).join('|')
}

export function renderCodexPanel(state: GameState): string {
  return `<section class="panel codex ${state.activeTab === 'codex' ? '' : 'hidden'}" id="panel-codex"><h2>도감</h2><p class="hint">현재 데이터에 존재하는 적만 표시됩니다.</p><div class="codex-list" id="codex-list" data-signature="${codexSignature(state)}">${renderCodexRows(state)}</div></section>`
}

export function patchCodexPanel(app: ParentNode, state: GameState): void {
  const list = app.querySelector<HTMLElement>('#codex-list')
  if (!list) return
  const signature = codexSignature(state)
  if (list.dataset.signature === signature) return
  list.dataset.signature = signature
  list.innerHTML = renderCodexRows(state)
}
