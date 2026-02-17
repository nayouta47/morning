import type { GameState, ModuleType, WeaponInstance } from '../../core/state.ts'
import { WEAPON_BASE_STATS } from '../../data/balance.ts'

const MODULE_EMOJI: Record<ModuleType, string> = { damage: '💥', cooldown: '⏱️' }
const MODULE_LABEL: Record<ModuleType, string> = { damage: '공격력 +1', cooldown: '쿨다운 -1s' }

let selectedModuleType: ModuleType | null = null

function getActiveSlots(weapon: WeaponInstance): Set<number> {
  return weapon.type === 'pistol' ? new Set([22, 23, 24, 25, 26, 27]) : new Set([13, 14, 15, 16, 23, 24, 25, 26])
}

function getSelectedWeapon(state: GameState): WeaponInstance | null {
  if (!state.selectedWeaponId) return null
  return state.weapons.find((w) => w.id === state.selectedWeaponId) ?? null
}

function getWeaponStats(weapon: WeaponInstance): { baseDamage: number; baseCooldown: number; finalDamage: number; finalCooldown: number } {
  const base = WEAPON_BASE_STATS[weapon.type]
  let damageBonus = 0
  let cooldownBonus = 0
  weapon.slots.forEach((moduleType) => {
    if (!moduleType) return
    if (moduleType === 'damage') damageBonus += 1
    if (moduleType === 'cooldown') cooldownBonus += 1
  })
  return {
    baseDamage: base.damage,
    baseCooldown: base.cooldown,
    finalDamage: base.damage + damageBonus,
    finalCooldown: Math.max(0.5, base.cooldown - cooldownBonus),
  }
}

function syncSelectedModuleType(state: GameState): void {
  if (selectedModuleType && state.modules[selectedModuleType] > 0) return
  selectedModuleType = (Object.keys(state.modules) as ModuleType[]).find((type) => state.modules[type] > 0) ?? null
}

export function setSelectedModuleType(moduleType: ModuleType): void {
  selectedModuleType = moduleType
}

export function renderAssemblyPanel(state: GameState): string {
  syncSelectedModuleType(state)
  const selected = getSelectedWeapon(state)
  const stats = selected ? getWeaponStats(selected) : null
  const active = selected ? getActiveSlots(selected) : new Set<number>()

  return `<section class="panel assembly ${state.activeTab === 'assembly' ? '' : 'hidden'}" id="panel-assembly">
      <h2>무기 조립</h2>
      <div class="assembly-grid">
        <aside class="weapon-list" aria-label="무기 인벤토리"><h3>무기 인벤토리</h3><div id="weapon-list-items" data-signature=""></div></aside>
        <div class="weapon-board-wrap"><h3>선택 무기 슬롯 (5x10)</h3><div id="weapon-board" class="weapon-board" role="grid" aria-label="무기 슬롯 보드"></div><p class="hint" id="weapon-stat-text">${stats ? `<span class="base-stat">기본 공격력 ${stats.baseDamage} / 기본 쿨다운 ${stats.baseCooldown.toFixed(1)}s</span> | <span class="final-stat">최종 공격력 ${stats.finalDamage} / 최종 쿨다운 ${stats.finalCooldown.toFixed(1)}s</span>` : '무기를 선택하세요.'}</p><p class="hint">장착: 모듈을 드래그 후 활성 슬롯에 드롭 / 해제: 우클릭(대체: 휠 클릭)</p><div id="active-signature" data-sig="${[...active].join(',')}" hidden></div></div>
      </div>
      <div class="module-grid"><section class="module-detail" aria-label="모듈 상세 정보"><h3>모듈 상세</h3><p id="module-detail-effect" class="module-effect hint">${selectedModuleType ? MODULE_LABEL[selectedModuleType] : '모듈을 선택하세요.'}</p></section><section class="module-inventory" aria-label="모듈 인벤토리"><h3>보유 모듈</h3><div id="module-list-items" class="module-list" data-signature=""></div></section></div>
    </section>`
}

export function patchWeaponInventory(app: ParentNode, state: GameState): void {
  const root = app.querySelector<HTMLDivElement>('#weapon-list-items')
  if (!root) return
  const sig = `${state.selectedWeaponId}:${state.weapons.map((w) => `${w.id}:${w.slots.filter((slot) => slot !== null).length}`).join('|')}`
  if (root.dataset.signature === sig) return
  root.innerHTML = state.weapons
    .map((w) => {
      const emoji = w.type === 'pistol' ? '🔫' : '🪖'
      const name = w.type === 'pistol' ? '권총' : '소총'
      const displayId = `#${w.id.split('-')[1] ?? w.id}`
      const equippedCount = w.slots.filter((slot) => slot !== null).length
      return `<button class="weapon-item ${w.id === state.selectedWeaponId ? 'selected' : ''}" data-weapon-id="${w.id}" draggable="true" aria-label="${name} ${displayId}">${emoji} ${name} · ${displayId} · 🧮x${equippedCount}</button>`
    })
    .join('')
  if (state.weapons.length === 0) root.innerHTML = '<p class="hint">제작된 무기가 없습니다.</p>'
  root.dataset.signature = sig
}

export function patchModuleDetail(app: ParentNode, state: GameState): void {
  syncSelectedModuleType(state)
  const detail = app.querySelector<HTMLElement>('#module-detail-effect')
  if (!detail) return
  const text = selectedModuleType ? MODULE_LABEL[selectedModuleType] : '모듈을 선택하세요.'
  if (detail.textContent !== text) detail.textContent = text
}

export function patchModuleInventory(app: ParentNode, state: GameState): void {
  syncSelectedModuleType(state)
  const root = app.querySelector<HTMLDivElement>('#module-list-items')
  if (!root) return
  const sig = `${state.modules.damage}:${state.modules.cooldown}:${selectedModuleType ?? 'none'}`
  if (root.dataset.signature === sig) return

  const entries = (Object.keys(state.modules) as ModuleType[])
    .filter((type) => state.modules[type] > 0)
    .map((type) => `<div class="module-item ${selectedModuleType === type ? 'selected' : ''}" draggable="true" data-module-type="${type}" aria-label="${MODULE_LABEL[type]} 모듈 ${state.modules[type]}개"><span class="module-emoji" aria-hidden="true">${MODULE_EMOJI[type]}</span><span class="module-count">x${state.modules[type]}</span></div>`)

  root.innerHTML = entries.join('')
  if (entries.length === 0) root.innerHTML = '<p class="hint">모듈이 없습니다.</p>'
  root.dataset.signature = sig
}

export function patchWeaponBoard(app: ParentNode, state: GameState): void {
  const board = app.querySelector<HTMLDivElement>('#weapon-board')
  if (!board) return
  const selected = getSelectedWeapon(state)
  if (!selected) {
    board.innerHTML = '<p class="hint">무기를 선택하면 슬롯 보드가 표시됩니다.</p>'
    return
  }

  const active = getActiveSlots(selected)
  const sig = `${selected.id}:${selected.slots.join('|')}:${[...active].join(',')}`
  if (board.dataset.signature === sig) return

  board.innerHTML = Array.from({ length: 50 }, (_, index) => {
    const moduleType = selected.slots[index]
    const isActive = active.has(index)
    const isFilled = Boolean(moduleType)
    const slotState = moduleType ? `${MODULE_LABEL[moduleType]} 장착됨` : '비어 있음'
    return `<div class="slot ${isActive ? 'active' : 'inactive'} ${isFilled ? 'filled' : ''}" role="gridcell" data-slot-index="${index}" data-accepts="${isActive ? 'true' : 'false'}" ${moduleType ? `data-module-type="${moduleType}" draggable="true"` : ''} aria-label="슬롯 ${index + 1} ${isActive ? '활성' : '비활성'} ${slotState}" tabindex="0">${moduleType ? MODULE_EMOJI[moduleType] : ''}</div>`
  }).join('')

  board.dataset.signature = sig
  const stats = getWeaponStats(selected)
  const statText = app.querySelector<HTMLElement>('#weapon-stat-text')
  if (statText) {
    statText.innerHTML = `<span class="base-stat">기본 공격력 ${stats.baseDamage} / 기본 쿨다운 ${stats.baseCooldown.toFixed(1)}s</span> | <span class="final-stat">최종 공격력 ${stats.finalDamage} / 최종 쿨다운 ${stats.finalCooldown.toFixed(1)}s</span>`
  }
}
