import { getEffectiveActiveWeaponSlots, getWeaponModuleLayerStats } from '../../core/moduleEffects.ts'
import type { GameState, WeaponInstance } from '../../core/state.ts'

function getSelectedWeapon(state: GameState): WeaponInstance | null {
  if (!state.selectedWeaponId) return null
  return state.weapons.find((weapon) => weapon.id === state.selectedWeaponId) ?? null
}

function summarizeNumberArray(values: number[]): string {
  const nonZero = values
    .map((value, index) => ({ value, index }))
    .filter(({ value }) => value !== 0)
    .map(({ value, index }) => `${index}:${value}`)
  return nonZero.length > 0 ? nonZero.join(', ') : '없음'
}

function summarizeBooleanArray(values: boolean[]): string {
  const trueIndices = values
    .map((value, index) => (value ? String(index) : null))
    .filter((value): value is string => value !== null)
  return trueIndices.length > 0 ? trueIndices.join(', ') : '없음'
}

export function getWeaponSlotDebugText(state: GameState): string | null {
  const selectedWeapon = getSelectedWeapon(state)
  if (!selectedWeapon) return null

  const stats = getWeaponModuleLayerStats(selectedWeapon)
  const activeSlotIndices = Array.from(getEffectiveActiveWeaponSlots(selectedWeapon)).sort((a, b) => a - b)

  const slotLines = Array.from({ length: 50 }, (_, slotIndex) => {
    const moduleType = selectedWeapon.slots[slotIndex] ?? 'empty'
    const isActive = activeSlotIndices.includes(slotIndex)
    const isPenaltyStopped = Boolean(stats.slotPenaltyDisabled[slotIndex])
    const stateLabel = isPenaltyStopped ? 'penalty-stopped' : isActive ? 'active' : 'inactive'
    const heat = stats.heatPenalty[slotIndex] ?? 0
    const block = stats.blockPenalty[slotIndex] ?? 0
    const total = stats.totalPenalty[slotIndex] ?? 0
    return `- [${slotIndex}] module=${moduleType}, state=${stateLabel}, penalty(heat/block/total)=${heat}/${block}/${total}`
  })

  return [
    '[Selected Weapon Slot Debug]',
    `weaponId: ${selectedWeapon.id}`,
    `weaponType: ${selectedWeapon.type}`,
    `activeSlotIndices: ${activeSlotIndices.length > 0 ? activeSlotIndices.join(', ') : '없음'}`,
    `power: usage=${stats.power.usage}, capacity=${stats.power.capacity}, overloaded=${stats.power.overloaded ? 'yes' : 'no'}`,
    `slotAmplification (non-zero): ${summarizeNumberArray(stats.slotAmplification)}`,
    `slotAmplificationReduction (non-zero): ${summarizeNumberArray(stats.slotAmplificationReduction)}`,
    `slotPenaltyDisabled indices: ${summarizeBooleanArray(stats.slotPenaltyDisabled)}`,
    `heatPenalty (non-zero): ${summarizeNumberArray(stats.heatPenalty)}`,
    `blockPenalty (non-zero): ${summarizeNumberArray(stats.blockPenalty)}`,
    `totalPenalty (non-zero): ${summarizeNumberArray(stats.totalPenalty)}`,
    'slots:',
    ...slotLines,
  ].join('\n')
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // fallback below
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange(0, textarea.value.length)

  let copied = false
  try {
    copied = document.execCommand('copy')
  } catch {
    copied = false
  }

  document.body.removeChild(textarea)
  return copied
}
