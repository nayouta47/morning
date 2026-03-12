import type { GameState } from '../../core/state.ts'
import { ORGAN_DEFS, ORGAN_ORDER, ORGAN_SLOT_LABELS, ORGAN_SLOT_POSITIONS } from '../../data/organs.ts'

function renderSilhouette(state: GameState): string {
  const slots = ORGAN_ORDER.map((organType) => {
    const organId = state.equippedOrgans[organType]
    const def = ORGAN_DEFS[organId]
    const [left, top] = ORGAN_SLOT_POSITIONS[organType]
    const isSelected = state.selectedOrganSlot === organType
    return `<button
      class="organ-slot${isSelected ? ' selected' : ''}"
      data-organ-slot="${organType}"
      aria-label="${ORGAN_SLOT_LABELS[organType]}: ${def.name}"
      aria-pressed="${isSelected}"
      style="left:${left}%;top:${top}%"
    >${def.emoji}</button>`
  }).join('')

  return `<div class="body-silhouette">
    <svg class="body-svg" viewBox="0 0 160 280" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="80" cy="28" r="20" fill="#1a1a1a" stroke="#3a3a3a" stroke-width="1.5"/>
      <rect x="74" y="46" width="12" height="12" fill="#1a1a1a"/>
      <rect x="48" y="58" width="64" height="90" rx="6" fill="#1a1a1a" stroke="#3a3a3a" stroke-width="1.5"/>
      <rect x="16" y="58" width="22" height="82" rx="6" fill="#1a1a1a" stroke="#3a3a3a" stroke-width="1.5"/>
      <rect x="122" y="58" width="22" height="82" rx="6" fill="#1a1a1a" stroke="#3a3a3a" stroke-width="1.5"/>
      <rect x="48" y="148" width="28" height="124" rx="6" fill="#1a1a1a" stroke="#3a3a3a" stroke-width="1.5"/>
      <rect x="84" y="148" width="28" height="124" rx="6" fill="#1a1a1a" stroke="#3a3a3a" stroke-width="1.5"/>
    </svg>
    ${slots}
  </div>`
}

function renderOrganDetail(state: GameState): string {
  const slot = state.selectedOrganSlot
  if (!slot) {
    return `<div class="organ-detail-empty"><p class="hint">장기 슬롯을 선택하세요.</p></div>`
  }
  const organId = state.equippedOrgans[slot]
  const def = ORGAN_DEFS[organId]
  return `<div class="organ-detail">
    <div class="organ-detail-head">
      <span class="organ-detail-emoji" aria-hidden="true">${def.emoji}</span>
      <div>
        <h3>${def.name}</h3>
        <p class="hint organ-detail-slot-label">${ORGAN_SLOT_LABELS[slot]} 슬롯</p>
      </div>
    </div>
    <p class="hint organ-detail-flavor">${def.flavorText}</p>
  </div>`
}

export function renderBodyPanel(state: GameState): string {
  return `<section id="panel-body" class="panel-stack body ${state.activeTab === 'body' ? '' : 'hidden'}">
    <div class="body-panel-inner">
      ${renderSilhouette(state)}
      <div class="body-detail-col">
        <h2>신체</h2>
        <div id="organ-detail-panel">${renderOrganDetail(state)}</div>
      </div>
    </div>
  </section>`
}

export function patchBodyPanel(app: ParentNode, state: GameState): void {
  if (state.activeTab !== 'body') return

  ORGAN_ORDER.forEach((organType) => {
    const btn = app.querySelector<HTMLButtonElement>(`[data-organ-slot="${organType}"]`)
    if (!btn) return
    const isSelected = state.selectedOrganSlot === organType
    btn.classList.toggle('selected', isSelected)
    btn.setAttribute('aria-pressed', String(isSelected))
  })

  const detail = app.querySelector<HTMLElement>('#organ-detail-panel')
  if (detail) detail.innerHTML = renderOrganDetail(state)
}
