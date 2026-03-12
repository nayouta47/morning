import { MODULE_METADATA } from '../../../data/modules.ts'
import type { ModuleType } from '../../../core/state.ts'
import { renderInfluenceMiniGrid } from './influenceView.ts'

export function renderModuleDetail(moduleType: ModuleType | null): string {
  if (!moduleType) return '<p id="module-detail-effect" class="module-effect hint">모듈을 선택하세요.</p>'
  const miniGrid = renderInfluenceMiniGrid(moduleType)
  const detail = MODULE_METADATA[moduleType]

  return `<div id="module-detail-effect" class="module-effect-cards" aria-label="모듈 효과 상세">
    <article class="module-effect-card module-effect-base" aria-label="기본효과">
      <h4>기본효과</h4>
      <p class="hint">${detail.baseDescription}</p>
    </article>
    <article class="module-effect-card module-effect-amp" aria-label="증폭효과">
      <h4>증폭효과</h4>
      <p class="hint">${detail.amplifiedDescription}</p>
    </article>
    <article class="module-effect-card module-effect-power" aria-label="전력">
      <h4>전력</h4>
      <p class="hint">⚡ ${detail.powerCost}</p>
    </article>
    <article class="module-effect-card module-effect-weight" aria-label="무게">
      <h4>무게</h4>
      <p class="hint">⚖️ ${detail.weight}</p>
    </article>
  </div>${miniGrid}`
}
