export type OrganType = 'brain' | 'eyes' | 'heart' | 'arms' | 'intestines'

export type OrganDef = {
  id: string
  name: string
  emoji: string
  organType: OrganType
  flavorText: string
}

export const ORGAN_DEFS: Record<string, OrganDef> = {
  humanBrain: {
    id: 'humanBrain',
    name: '인간의 뇌',
    emoji: '🧠',
    organType: 'brain',
    flavorText: '기본적인 인간의 뇌. 딱히 특별한 건 없지만, 없으면 곤란하다.',
  },
  humanEyes: {
    id: 'humanEyes',
    name: '인간의 눈',
    emoji: '👁️',
    organType: 'eyes',
    flavorText: '한 쌍의 인간 눈동자. 온갖 것을 보고 싶어하는 욕망이 담겨 있다.',
  },
  humanHeart: {
    id: 'humanHeart',
    name: '인간의 심장',
    emoji: '❤️',
    organType: 'heart',
    flavorText: '꾸준히 뛰고 있는 심장. 감정이 실릴 때마다 조금씩 빨라진다.',
  },
  humanArms: {
    id: 'humanArms',
    name: '인간의 오른팔',
    emoji: '💪',
    organType: 'arms',
    flavorText: '평범한 오른팔 하나. 들고, 치고, 잡는다. 그게 전부다.',
  },
  humanIntestines: {
    id: 'humanIntestines',
    name: '인간의 내장',
    emoji: '🫁',
    organType: 'intestines',
    flavorText: '순환계통. 피가 어디선가 돌고 있다.',
  },
  rubyArm: {
    id: 'rubyArm',
    name: 'R.U.B.Y 보조 팔',
    emoji: '🦾',
    organType: 'arms',
    flavorText: 'R.U.B.Y가 물어다 준 것이다. 무겁고 차갑지만, 움직인다. 어디서 구했는지는 묻지 않기로 했다.',
  },
}

export const DEFAULT_ORGANS: Record<OrganType, string> = {
  brain: 'humanBrain',
  eyes: 'humanEyes',
  heart: 'humanHeart',
  arms: 'humanArms',
  intestines: 'humanIntestines',
}

export const ORGAN_SLOT_LABELS: Record<OrganType, string> = {
  brain: '뇌',
  eyes: '눈',
  heart: '심장',
  arms: '오른팔',
  intestines: '내장',
}

/**
 * [left%, top%] center position of each organ slot relative to silhouette container (160×280)
 * SVG body layout: head cy=28 r=20, torso x=48 y=58 w=64 h=90,
 * left arm x=16 y=58 w=22 h=82, right arm x=122 y=58 w=22 h=82,
 * legs x=48/84 y=148 w=28 h=124
 */
export const ORGAN_SLOT_POSITIONS: Record<OrganType, [number, number]> = {
  brain: [35, 10],      // 머리 좌측 (cx≈56, cy=28)
  eyes: [65, 10],       // 머리 우측 (cx≈104, cy=28)
  heart: [38, 29],      // 좌상 흉부 (cx≈61, cy≈81)
  intestines: [50, 44], // 하복부 (cy≈123)
  arms: [83, 36],       // 오른팔 중앙 (cx≈133, cy≈101)
}

export const ORGAN_ORDER: OrganType[] = ['brain', 'eyes', 'heart', 'intestines', 'arms']
