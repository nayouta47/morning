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

export function renderExplorationCombatOverlay(state: GameState): string {
  const combat = state.exploration.combat
  if (!combat) return ''

  const weaponStats = getWeaponCombatStats(getExplorationCarriedWeapon(state) ?? getSelectedWeapon(state))
  const cooldownProgress = clamp01(combat.playerAttackElapsedMs / weaponStats.cooldownMs)
  const cooldownPercent = Math.round(cooldownProgress * 100)

  return `<div class="exploration-combat-overlay" role="dialog" aria-modal="false" aria-label="전투 현황 오버레이"><div class="exploration-combat-overlay-upper"><div class="combat-entity combat-entity-player" aria-label="플레이어 체력 ${state.exploration.hp}/${state.exploration.maxHp}"><p class="combat-hp">HP ${state.exploration.hp}/${state.exploration.maxHp}</p><p class="combat-emoji" aria-hidden="true">🧍</p></div><div class="combat-versus" aria-hidden="true">vs</div><div class="combat-entity combat-entity-enemy" aria-label="적 체력 ${combat.enemyHp}/${combat.enemyMaxHp}"><p class="combat-hp">HP ${combat.enemyHp}/${combat.enemyMaxHp}</p><p class="combat-emoji" aria-hidden="true">👾</p></div></div><div class="exploration-combat-overlay-lower" aria-label="무기 재사용 대기시간"><p class="combat-cooldown-label">무기 쿨다운</p><div class="combat-cooldown-gauge" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${cooldownPercent}" aria-label="무기 쿨다운 진행률 ${cooldownPercent}%"><span class="combat-cooldown-fill" style="width:${cooldownPercent}%"></span></div><p class="combat-cooldown-text">${cooldownPercent}%</p></div></div>`
}

export function patchExplorationCombatOverlay(app: ParentNode, state: GameState): void {
  const combat = state.exploration.combat
  if (!combat || state.exploration.phase !== 'combat') return

  const weaponStats = getWeaponCombatStats(getExplorationCarriedWeapon(state) ?? getSelectedWeapon(state))
  const progress = clamp01(combat.playerAttackElapsedMs / weaponStats.cooldownMs)
  const percent = Math.round(progress * 100)

  setText(app, '.combat-entity-player .combat-hp', `HP ${state.exploration.hp}/${state.exploration.maxHp}`)
  setText(app, '.combat-entity-enemy .combat-hp', `HP ${combat.enemyHp}/${combat.enemyMaxHp}`)
  setText(app, '.combat-cooldown-text', `${percent}%`)

  const meter = app.querySelector<HTMLElement>('.combat-cooldown-gauge')
  if (meter) {
    meter.setAttribute('aria-valuenow', String(percent))
    meter.setAttribute('aria-label', `무기 쿨다운 진행률 ${percent}%`)
  }

  const fill = app.querySelector<HTMLElement>('.combat-cooldown-fill')
  if (fill) fill.style.width = `${percent}%`
}
