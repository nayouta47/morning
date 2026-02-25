import { SLOT_PENALTY_MAJOR, SLOT_PENALTY_MINOR } from '../../../core/moduleEffects.ts'

export function renderSlotPenaltyOverlay(penaltyHeat: number, penaltyBlock: number): string {
  const heat = Math.max(0, penaltyHeat)
  const block = Math.max(0, penaltyBlock)
  const total = heat + block
  if (total <= 0) return ''

  const occupiedRatio = total > SLOT_PENALTY_MAJOR ? 1 : total / SLOT_PENALTY_MAJOR
  const compositionBase = total > SLOT_PENALTY_MAJOR ? total : Math.max(total, 1)
  const heatShare = heat / compositionBase
  const blockShare = block / compositionBase

  const heatWidth = occupiedRatio * heatShare
  const blockWidth = occupiedRatio * blockShare

  const heatPenaltyClass = heat >= SLOT_PENALTY_MAJOR ? 'major' : heat >= SLOT_PENALTY_MINOR ? 'minor' : ''
  const blockPenaltyClass = block >= SLOT_PENALTY_MAJOR ? 'major' : ''

  let cursor = 0
  const segments: string[] = []
  if (heatWidth > 0) {
    segments.push(`<span class="slot-penalty-segment heat ${heatPenaltyClass}" style="--slot-penalty-segment-left:${cursor};--slot-penalty-segment-width:${heatWidth}" aria-hidden="true"></span>`)
    cursor += heatWidth
  }

  if (blockWidth > 0) {
    segments.push(`<span class="slot-penalty-segment block ${blockPenaltyClass}" style="--slot-penalty-segment-left:${cursor};--slot-penalty-segment-width:${blockWidth}" aria-hidden="true"></span>`)
  }

  return `<span class="slot-penalty-composite" aria-hidden="true">${segments.join('')}</span>`
}
