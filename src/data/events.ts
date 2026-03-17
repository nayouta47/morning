import type { GameState } from '../core/state.ts'
import { getCompanionName } from '../core/companion.ts'

export const EVENT_NAMES = {
  collapse: '발작',
  terminalIllness: '불치병',
  timePassed: '얼마나 흐른거지?',
  relapse: '재발작',
  lookAround: '주위를 바라보다',
  ownerlessThing: '주인 없는 것',
  tailorEnd: '재봉사의 끝',
  ruby: 'R.U.B.Y',
  labUnlock: '데이터 단말기',
  workbenchUnlock: '정밀 부품',
} as const

export type SimpleEventDef = {
  id: string
  name: string
  ariaLabel: string
  visible: (state: GameState) => boolean
  bodyHtml: (state: GameState) => string
  buttonLabel: string
  onConfirm: (state: GameState) => void
}

export const SIMPLE_EVENT_DEFS: SimpleEventDef[] = [
  {
    id: 'collapse',
    name: EVENT_NAMES.collapse,
    ariaLabel: '발작 이벤트',
    visible: (s) => s.walkCount >= 3 && !s.collapseEventDismissed,
    bodyHtml: () => '시야에 어둠이 내려앉는다.<br>가까이 짖는 소리가 들린다.',
    buttonLabel: '의식을 잃는다',
    onConfirm: (s) => { s.collapseEventDismissed = true },
  },
  {
    id: 'timePassed',
    name: EVENT_NAMES.timePassed,
    ariaLabel: '시간 경과 이벤트',
    visible: (s) => s.terminalIllnessEventDismissed && !s.timePassedEventDismissed,
    bodyHtml: () => '눈을 떴다. 천장이 낯설다.<br>아주 잠깐 낮잠을 잔 것 같다.<br>화면에는 숫자가 하나 떠 있었다. 72.',
    buttonLabel: '현재를 받아들인다',
    onConfirm: (s) => { s.timePassedEventDismissed = true },
  },
  {
    id: 'tailorEnd',
    name: EVENT_NAMES.tailorEnd,
    ariaLabel: '재봉사의 끝 이벤트',
    visible: (s) => s.tailorEndTriggered && !s.tailorEndDismissed,
    bodyHtml: (s) => {
      const name = getCompanionName(s)
      return `재봉사를 ${name}이 물고 놓지 않는다.<br>연결된 실이 모두 끊어지고 마지막 한 겹이 천천히 내려앉는다.<br><br>${name}의 외장이 곳곳에 찢기고, 관절이 꺾여 있다.<br>구동부에서 기름이 흐른다.<br>가까이 다가가자 턱으로 바닥을 밀며 온다.<br><br>"이곳에는 충분한 시설이 있어. 재료는 부족하지만"`
    },
    buttonLabel: '팔을 포기한다',
    onConfirm: (s) => { s.tailorEndDismissed = true },
  },
  {
    id: 'ruby',
    name: EVENT_NAMES.ruby,
    ariaLabel: 'R.U.B.Y 이벤트',
    visible: (s) => s.tailorEndDismissed && !s.rubyEquipped,
    bodyHtml: () => '당신에게 온다.<br>쓰다듬자, 체명악기가 튕기는 소리만 느낄 수 있다.<br>괘념치 않고 한참을 코를 대고 있다.',
    buttonLabel: 'Robotic Universal Brachial Yoke 장착',
    onConfirm: (s) => { s.rubyEquipped = true; s.equippedOrgans.arms = 'rubyArm' },
  },
  {
    id: 'labUnlock',
    name: EVENT_NAMES.labUnlock,
    ariaLabel: '데이터 단말기 이벤트',
    visible: (s) => s.unlocks.lab && !s.labEventDismissed,
    bodyHtml: (s) => `${getCompanionName(s)}이 가져온 부품 더미 속에 정보 처리 장치가 섞여 있다.<br>고장 나 있지만, 수리하면 쓸 수 있을 것 같다.<br>지자 컴퓨터를 만들 수 있겠다.`,
    buttonLabel: '확인',
    onConfirm: (s) => { s.labEventDismissed = true },
  },
  {
    id: 'workbenchUnlock',
    name: EVENT_NAMES.workbenchUnlock,
    ariaLabel: '정밀 부품 이벤트',
    visible: (s) => s.unlocks.workbench && !s.workbenchEventDismissed,
    bodyHtml: (s) => `${getCompanionName(s)}이 이번에는 정밀 가공 부품을 물어왔다.<br>절삭 공구, 피드 스크류, 베어링 세트.<br>금속 프린터를 만들 수 있겠다.`,
    buttonLabel: '확인',
    onConfirm: (s) => { s.workbenchEventDismissed = true },
  },
]
