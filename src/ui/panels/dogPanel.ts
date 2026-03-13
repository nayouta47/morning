import { getCompanionName } from '../../core/companion.ts'
import type { GameState } from '../../core/state.ts'
import {
  DOG_ORGAN_DEFS,
  DOG_ORGAN_ORDER,
  DOG_ORGAN_SLOT_LABELS,
  DOG_ORGAN_SLOT_POSITIONS,
} from '../../data/dogOrgans.ts'

function renderDogSilhouette(state: GameState): string {
  const slots = DOG_ORGAN_ORDER.map((organType) => {
    const organId = state.equippedDogOrgans[organType]
    const def = DOG_ORGAN_DEFS[organId]
    const [left, top] = DOG_ORGAN_SLOT_POSITIONS[organType]
    const isSelected = state.selectedDogOrganSlot === organType
    return `<button
      class="organ-slot${isSelected ? ' selected' : ''}"
      data-dog-organ-slot="${organType}"
      aria-label="${DOG_ORGAN_SLOT_LABELS[organType]}: ${def.name}"
      aria-pressed="${isSelected}"
      style="left:${left}%;top:${top}%"
    >${def.emoji}</button>`
  }).join('')

  return `<div class="body-silhouette">
    <svg class="body-svg" viewBox="0 0 280 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <!-- 몸통 -->
      <ellipse cx="120" cy="88" rx="72" ry="42" fill="#1a1a1a" stroke="#3a3a3a" stroke-width="1.5"/>
      <!-- 목 -->
      <rect x="178" y="52" width="30" height="44" rx="10" fill="#1a1a1a" stroke="#3a3a3a" stroke-width="1.5"/>
      <!-- 머리 -->
      <circle cx="200" cy="52" r="32" fill="#1a1a1a" stroke="#3a3a3a" stroke-width="1.5"/>
      <!-- 주둥이 -->
      <ellipse cx="228" cy="68" rx="20" ry="13" fill="#1a1a1a" stroke="#3a3a3a" stroke-width="1.5"/>
      <!-- 귀 -->
      <ellipse cx="188" cy="24" rx="12" ry="17" fill="#1a1a1a" stroke="#3a3a3a" stroke-width="1.5"/>
      <!-- 앞다리 왼쪽 -->
      <rect x="148" y="118" width="20" height="52" rx="6" fill="#1a1a1a" stroke="#3a3a3a" stroke-width="1.5"/>
      <!-- 앞다리 오른쪽 -->
      <rect x="172" y="118" width="20" height="52" rx="6" fill="#1a1a1a" stroke="#3a3a3a" stroke-width="1.5"/>
      <!-- 뒷다리 왼쪽 -->
      <rect x="60" y="118" width="20" height="52" rx="6" fill="#1a1a1a" stroke="#3a3a3a" stroke-width="1.5"/>
      <!-- 뒷다리 오른쪽 -->
      <rect x="84" y="118" width="20" height="52" rx="6" fill="#1a1a1a" stroke="#3a3a3a" stroke-width="1.5"/>
      <!-- 꼬리 -->
      <path d="M50 80 Q25 55 20 35" stroke="#3a3a3a" stroke-width="7" fill="none" stroke-linecap="round"/>
    </svg>
    ${slots}
  </div>`
}

function renderDogOrganDetail(state: GameState): string {
  const slot = state.selectedDogOrganSlot
  if (!slot) {
    return `<div class="organ-detail-empty"><p class="hint">클릭해서 확인</p></div>`
  }
  const organId = state.equippedDogOrgans[slot]
  const def = DOG_ORGAN_DEFS[organId]
  return `<div class="organ-detail">
    <div class="organ-detail-head">
      <span class="organ-detail-emoji" aria-hidden="true">${def.emoji}</span>
      <div>
        <h3>${def.name}</h3>
        <p class="hint organ-detail-slot-label">${DOG_ORGAN_SLOT_LABELS[slot]} 파츠</p>
      </div>
    </div>
    <p class="hint organ-detail-flavor">${def.flavorText}</p>
  </div>`
}

export function renderDogPanel(state: GameState): string {
  const name = getCompanionName(state)
  const repaired = state.buildings.laikaRepair >= 1

  return `<section class="panel-stack body dog ${state.activeTab === 'dog' ? '' : 'hidden'}" id="panel-dog">
    <div class="body-panel-inner">
      ${renderDogSilhouette(state)}
      <div class="body-detail-col">
        <h2>${name}</h2>
        <p class="hint">${repaired ? `${name}이(가) 수리되어 함께하고 있다.` : `${name}은(는) 아직 수리되지 않았다.`}</p>
        <div id="dog-organ-detail-panel">${renderDogOrganDetail(state)}</div>
      </div>
    </div>
  </section>`
}

export function patchDogPanel(app: ParentNode, state: GameState): void {
  if (state.activeTab !== 'dog') return

  DOG_ORGAN_ORDER.forEach((organType) => {
    const btn = app.querySelector<HTMLButtonElement>(`[data-dog-organ-slot="${organType}"]`)
    if (!btn) return
    const isSelected = state.selectedDogOrganSlot === organType
    btn.classList.toggle('selected', isSelected)
    btn.setAttribute('aria-pressed', String(isSelected))
  })

  const detail = app.querySelector<HTMLElement>('#dog-organ-detail-panel')
  if (detail) detail.innerHTML = renderDogOrganDetail(state)
}
