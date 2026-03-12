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
    <svg class="body-svg" viewBox="0 0 180 300" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="90" cy="35" r="28" fill="#1a1a1a" stroke="#3a3a3a" stroke-width="1.5"/>
      <rect x="82" y="62" width="16" height="14" fill="#1a1a1a" stroke="none"/>
      <rect x="82" y="62" width="16" height="14" fill="#1a1a1a" stroke="#3a3a3a" stroke-width="1"/>
      <rect x="42" y="76" width="96" height="110" rx="8" fill="#1a1a1a" stroke="#3a3a3a" stroke-width="1.5"/>
      <rect x="10" y="76" width="30" height="105" rx="8" fill="#1a1a1a" stroke="#3a3a3a" stroke-width="1.5"/>
      <rect x="140" y="76" width="30" height="105" rx="8" fill="#1a1a1a" stroke="#3a3a3a" stroke-width="1.5"/>
      <rect x="42" y="186" width="40" height="105" rx="8" fill="#1a1a1a" stroke="#3a3a3a" stroke-width="1.5"/>
      <rect x="98" y="186" width="40" height="105" rx="8" fill="#1a1a1a" stroke="#3a3a3a" stroke-width="1.5"/>
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
        <h2>신체 조립</h2>
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
