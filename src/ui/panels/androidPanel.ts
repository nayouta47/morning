import type { GameState } from '../../core/state.ts'
import {
  ANDROID_PART_DEFS,
  ANDROID_PART_SLOT_LABELS,
  ANDROID_PART_SLOT_ORDER,
  ANDROID_PART_SLOT_POSITIONS,
} from '../../data/androidParts.ts'

function renderAndroidSilhouette(state: GameState): string {
  const slots = ANDROID_PART_SLOT_ORDER.map((slot) => {
    const partId = state.equippedAndroidParts[slot]
    const def = partId ? ANDROID_PART_DEFS[partId] : null
    const [left, top] = ANDROID_PART_SLOT_POSITIONS[slot]
    const isSelected = state.selectedAndroidPartSlot === slot
    const label = ANDROID_PART_SLOT_LABELS[slot]
    return `<button
      class="organ-slot${isSelected ? ' selected' : ''}${!def ? ' empty' : ''}"
      data-android-part-slot="${slot}"
      aria-label="${label}: ${def ? def.name : '비어 있음'}"
      aria-pressed="${isSelected}"
      style="left:${left}%;top:${top}%"
    >${def ? def.emoji : '⬜'}</button>`
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

function renderAndroidPartDetail(state: GameState): string {
  const slot = state.selectedAndroidPartSlot
  if (!slot) {
    return `<div class="organ-detail-empty"><p class="hint">클릭해서 확인</p></div>`
  }
  const partId = state.equippedAndroidParts[slot]
  if (!partId) {
    return `<div class="organ-detail-empty"><p class="hint">${ANDROID_PART_SLOT_LABELS[slot]} 슬롯 — 비어 있음</p></div>`
  }
  const def = ANDROID_PART_DEFS[partId]
  if (!def) {
    return `<div class="organ-detail-empty"><p class="hint">알 수 없는 파츠</p></div>`
  }
  return `<div class="organ-detail">
    <div class="organ-detail-head">
      <span class="organ-detail-emoji" aria-hidden="true">${def.emoji}</span>
      <div>
        <h3>${def.name}</h3>
        <p class="hint organ-detail-slot-label">${ANDROID_PART_SLOT_LABELS[slot]} 파츠</p>
      </div>
    </div>
    <p class="hint organ-detail-flavor">${def.flavorText}</p>
  </div>`
}

export function renderAndroidPanel(state: GameState): string {
  return `<section id="panel-android" class="panel-stack body ${state.activeTab === 'android' ? '' : 'hidden'}">
    <div class="body-panel-inner">
      ${renderAndroidSilhouette(state)}
      <div class="body-detail-col">
        <h2>제비 프레임</h2>
        <div id="android-part-detail-panel">${renderAndroidPartDetail(state)}</div>
      </div>
    </div>
  </section>`
}

export function patchAndroidPanel(app: ParentNode, state: GameState): void {
  if (state.activeTab !== 'android') return

  ANDROID_PART_SLOT_ORDER.forEach((slot) => {
    const btn = app.querySelector<HTMLButtonElement>(`[data-android-part-slot="${slot}"]`)
    if (!btn) return
    const isSelected = state.selectedAndroidPartSlot === slot
    btn.classList.toggle('selected', isSelected)
    btn.setAttribute('aria-pressed', String(isSelected))
  })

  const detail = app.querySelector<HTMLElement>('#android-part-detail-panel')
  if (detail) detail.innerHTML = renderAndroidPartDetail(state)
}
