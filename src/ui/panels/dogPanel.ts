import { getCompanionName } from '../../core/companion.ts'
import type { GameState } from '../../core/state.ts'

export function renderDogPanel(state: GameState): string {
  const name = getCompanionName(state)
  const repaired = state.buildings.laikaRepair >= 1

  return `<section class="panel dog ${state.activeTab === 'dog' ? '' : 'hidden'}" id="panel-dog">
    <h2>${name}</h2>
    <div class="dog-panel-content">
      <p class="dog-status">${repaired ? `${name}이(가) 수리되어 함께하고 있다.` : `${name}은(는) 아직 수리되지 않았다.`}</p>
    </div>
  </section>`
}

export function patchDogPanel(_app: ParentNode, _state: GameState): void {
  // 추후 동적 콘텐츠가 추가되면 여기에 패치 로직 작성
}
