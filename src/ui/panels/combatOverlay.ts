import { FIELD_HEIGHT, FIELD_WIDTH, getWeaponCombatStats } from '../../core/combat.ts'
import type { FieldCombatState, GameState, WeaponInstance } from '../../core/state.ts'

const FACING_ARROW: Record<string, string> = {
  right: '→',
  left: '←',
  up: '↑',
  down: '↓',
}

function getBackpackResourceAmount(state: GameState, resourceId: 'smallHealPotion'): number {
  return state.exploration.backpack.reduce((sum, entry) => (entry.resource === resourceId ? sum + entry.amount : sum), 0)
}

function getExplorationCarriedWeapon(state: GameState): WeaponInstance | null {
  if (!state.exploration.carriedWeaponId) return null
  return state.weapons.find((w) => w.id === state.exploration.carriedWeaponId) ?? null
}

export function renderFieldGrid(combat: FieldCombatState): string {
  const lines: string[] = []
  for (let y = 0; y < FIELD_HEIGHT; y += 1) {
    let line = ''
    for (let x = 0; x < FIELD_WIDTH; x += 1) {
      if (combat.playerPos.x === x && combat.playerPos.y === y) {
        line += `${FACING_ARROW[combat.playerFacing] ?? '@'} `
        continue
      }
      const enemy = combat.enemies.find((e) => e.hp > 0 && e.pos.x === x && e.pos.y === y)
      if (enemy) {
        line += 'E '
        continue
      }
      const tile = combat.field[y]?.[x] ?? 'floor'
      if (tile === 'cover') line += '▪ '
      else if (tile === 'wall') line += '█ '
      else line += '. '
    }
    lines.push(line.trimEnd())
  }
  return lines.join('\n')
}

export function renderExplorationCombatOverlay(state: GameState, now = Date.now()): string {
  void now
  const combat = state.exploration.combat
  if (!combat) return ''

  const weaponStats = getWeaponCombatStats(getExplorationCarriedWeapon(state))
  const shootReady = combat.playerAttackElapsedMs >= weaponStats.cooldownMs
  const shootPercent = Math.min(100, Math.round((combat.playerAttackElapsedMs / weaponStats.cooldownMs) * 100))
  const potionAmount = getBackpackResourceAmount(state, 'smallHealPotion')
  const potionReady = combat.smallHealPotionCooldownRemainingMs <= 0
  const fleePercent = combat.fleeGaugeRunning
    ? Math.round((combat.fleeGaugeElapsedMs / combat.fleeGaugeDurationMs) * 100)
    : 0

  const gridText = renderFieldGrid(combat)
  const enemyListHtml = combat.enemies
    .filter((e) => e.hp > 0)
    .map((e) => `<span class="field-enemy-entry">${e.name} HP ${e.hp}/${e.maxHp}</span>`)
    .join(' ')

  return `<div class="field-combat-overlay"><pre class="field-grid-pre" id="field-grid-pre" aria-label="전술 전투 필드">${gridText}</pre><div class="field-status"><span class="field-player-hp" id="field-player-hp">HP ${state.exploration.hp}/${state.exploration.maxHp}</span> <span class="field-shoot-status" id="field-shoot-status">[F] 사격 ${shootReady ? '준비됨' : `${shootPercent}%`}</span></div><div class="field-enemy-list" id="field-enemy-list">${enemyListHtml}</div><div class="field-flee-status" id="field-flee-status">${combat.fleeGaugeRunning ? `도주 ${fleePercent}%` : ''}</div><div class="field-controls">[WASD] 이동 [F] 사격 [H] 회복 [Shift] 도주</div><div class="field-buttons"><button id="exploration-use-small-heal-potion" type="button" ${!potionReady || potionAmount <= 0 ? 'disabled' : ''}>회복 H (${potionAmount})</button> <button id="exploration-flee" type="button" ${combat.fleeGaugeRunning ? 'disabled' : ''}>도주 Shift</button></div></div>`
}

export function patchExplorationCombatOverlay(app: ParentNode, state: GameState, now = Date.now()): void {
  void now
  const combat = state.exploration.combat
  if (!combat || state.exploration.phase !== 'combat') return

  const pre = app.querySelector<HTMLElement>('#field-grid-pre')
  if (pre) pre.textContent = renderFieldGrid(combat)

  const hpEl = app.querySelector<HTMLElement>('#field-player-hp')
  if (hpEl) hpEl.textContent = `HP ${state.exploration.hp}/${state.exploration.maxHp}`

  const weaponStats = getWeaponCombatStats(getExplorationCarriedWeapon(state))
  const shootReady = combat.playerAttackElapsedMs >= weaponStats.cooldownMs
  const shootPercent = Math.min(100, Math.round((combat.playerAttackElapsedMs / weaponStats.cooldownMs) * 100))
  const shootEl = app.querySelector<HTMLElement>('#field-shoot-status')
  if (shootEl) shootEl.textContent = `[F] 사격 ${shootReady ? '준비됨' : `${shootPercent}%`}`

  const enemyListEl = app.querySelector<HTMLElement>('#field-enemy-list')
  if (enemyListEl) {
    enemyListEl.innerHTML = combat.enemies
      .filter((e) => e.hp > 0)
      .map((e) => `<span class="field-enemy-entry">${e.name} HP ${e.hp}/${e.maxHp}</span>`)
      .join(' ')
  }

  const fleeStatusEl = app.querySelector<HTMLElement>('#field-flee-status')
  if (fleeStatusEl) {
    const fleePercent = combat.fleeGaugeRunning
      ? Math.round((combat.fleeGaugeElapsedMs / combat.fleeGaugeDurationMs) * 100)
      : 0
    fleeStatusEl.textContent = combat.fleeGaugeRunning ? `도주 ${fleePercent}%` : ''
  }

  const potionAmount = getBackpackResourceAmount(state, 'smallHealPotion')
  const potionReady = combat.smallHealPotionCooldownRemainingMs <= 0
  const potionButton = app.querySelector<HTMLButtonElement>('#exploration-use-small-heal-potion')
  if (potionButton) {
    potionButton.disabled = !potionReady || potionAmount <= 0
    potionButton.textContent = `회복 H (${potionAmount})`
  }

  const fleeButton = app.querySelector<HTMLButtonElement>('#exploration-flee')
  if (fleeButton) fleeButton.disabled = combat.fleeGaugeRunning
}
