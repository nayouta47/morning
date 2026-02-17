import { getWeaponCombatStats } from '../../core/combat.ts'
import type { GameState, WeaponInstance } from '../../core/state.ts'
import { clamp01, setText } from '../view.ts'

function getSelectedWeapon(state: GameState): WeaponInstance | null {
  if (!state.selectedWeaponId) return null
  return state.weapons.find((w) => w.id === state.selectedWeaponId) ?? null
}

function getExplorationCarriedWeapon(state: GameState): WeaponInstance | null {
  if (!state.exploration.carriedWeaponId) return null
  return state.weapons.find((weapon) => weapon.id === state.exploration.carriedWeaponId) ?? null
}

function getSmoothedProgress(elapsedMs: number, durationMs: number, now: number, lastUpdate: number): number {
  if (durationMs <= 0) return 1
  const elapsedSinceUpdate = Math.max(0, now - lastUpdate)
  return clamp01((elapsedMs + elapsedSinceUpdate) / durationMs)
}

function getCombatGaugeView(state: GameState, now = Date.now()): { cooldownPercent: number; fleePercent: number } {
  const combat = state.exploration.combat
  if (!combat) return { cooldownPercent: 0, fleePercent: 0 }

  const weaponStats = getWeaponCombatStats(getExplorationCarriedWeapon(state) ?? getSelectedWeapon(state))
  const cooldownProgress = getSmoothedProgress(combat.playerAttackElapsedMs, weaponStats.cooldownMs, now, state.lastUpdate)
  const fleeProgress = combat.fleeGaugeRunning
    ? getSmoothedProgress(combat.fleeGaugeElapsedMs, combat.fleeGaugeDurationMs, now, state.lastUpdate)
    : 0

  return {
    cooldownPercent: Math.round(cooldownProgress * 100),
    fleePercent: Math.round(fleeProgress * 100),
  }
}

export function renderExplorationCombatOverlay(state: GameState, now = Date.now()): string {
  const combat = state.exploration.combat
  if (!combat) return ''

  const { cooldownPercent, fleePercent } = getCombatGaugeView(state, now)

  return `<div class="exploration-combat-overlay" role="dialog" aria-modal="false" aria-label="전투 현황 오버레이"><div class="exploration-combat-overlay-upper"><div class="combat-entity combat-entity-player" aria-label="플레이어 체력 ${state.exploration.hp}/${state.exploration.maxHp}"><p class="combat-hp">HP ${state.exploration.hp}/${state.exploration.maxHp}</p><p class="combat-emoji" aria-hidden="true">🧍</p></div><div class="combat-versus" aria-hidden="true">vs</div><div class="combat-entity combat-entity-enemy" aria-label="적 체력 ${combat.enemyHp}/${combat.enemyMaxHp}"><p class="combat-hp">HP ${combat.enemyHp}/${combat.enemyMaxHp}</p><p class="combat-emoji" aria-hidden="true">👾</p></div></div><div class="exploration-combat-overlay-lower"><div class="combat-row" aria-label="무기 재사용 대기시간"><p class="combat-cooldown-label">무기 쿨다운</p><div class="combat-cooldown-gauge" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${cooldownPercent}" aria-label="무기 쿨다운 진행률 ${cooldownPercent}%"><span class="combat-cooldown-fill" style="width:${cooldownPercent}%"></span></div><p class="combat-cooldown-text">${cooldownPercent}%</p></div><div class="combat-row" aria-label="도주 게이지"><p class="combat-cooldown-label">도주 게이지</p><div class="combat-cooldown-gauge" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${fleePercent}" aria-label="도주 진행률 ${fleePercent}%"><span class="combat-cooldown-fill combat-flee-fill" style="width:${fleePercent}%"></span></div><button id="exploration-flee" class="combat-flee-button" type="button" aria-label="도주 시도" ${combat.fleeGaugeRunning ? 'disabled' : ''}>도주</button></div></div></div>`
}

export function patchExplorationCombatOverlay(app: ParentNode, state: GameState, now = Date.now()): void {
  const combat = state.exploration.combat
  if (!combat || state.exploration.phase !== 'combat') return

  const { cooldownPercent, fleePercent } = getCombatGaugeView(state, now)

  setText(app, '.combat-entity-player .combat-hp', `HP ${state.exploration.hp}/${state.exploration.maxHp}`)
  setText(app, '.combat-entity-enemy .combat-hp', `HP ${combat.enemyHp}/${combat.enemyMaxHp}`)
  setText(app, '.combat-cooldown-text', `${cooldownPercent}%`)

  const cooldownMeter = app.querySelector<HTMLElement>('.combat-row:first-child .combat-cooldown-gauge')
  if (cooldownMeter) {
    cooldownMeter.setAttribute('aria-valuenow', String(cooldownPercent))
    cooldownMeter.setAttribute('aria-label', `무기 쿨다운 진행률 ${cooldownPercent}%`)
  }

  const cooldownFill = app.querySelector<HTMLElement>('.combat-row:first-child .combat-cooldown-fill')
  if (cooldownFill) cooldownFill.style.width = `${cooldownPercent}%`

  const fleeMeter = app.querySelector<HTMLElement>('.combat-row:last-child .combat-cooldown-gauge')
  if (fleeMeter) {
    fleeMeter.setAttribute('aria-valuenow', String(fleePercent))
    fleeMeter.setAttribute('aria-label', `도주 진행률 ${fleePercent}%`)
  }

  const fleeFill = app.querySelector<HTMLElement>('.combat-flee-fill')
  if (fleeFill) fleeFill.style.width = `${fleePercent}%`

  const fleeButton = app.querySelector<HTMLButtonElement>('#exploration-flee')
  if (fleeButton) fleeButton.disabled = combat.fleeGaugeRunning
}
