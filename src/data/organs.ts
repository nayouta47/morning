export type OrganType = 'brain' | 'eyes' | 'heart' | 'arms'

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
    name: '인간의 팔',
    emoji: '💪',
    organType: 'arms',
    flavorText: '두 개의 평범한 팔. 무언가를 잡으려 할 때만 가치가 있다.',
  },
}

export const DEFAULT_ORGANS: Record<OrganType, string> = {
  brain: 'humanBrain',
  eyes: 'humanEyes',
  heart: 'humanHeart',
  arms: 'humanArms',
}

export const ORGAN_SLOT_LABELS: Record<OrganType, string> = {
  brain: '뇌',
  eyes: '눈',
  heart: '심장',
  arms: '팔',
}

/** [left%, top%] center position of each organ slot relative to silhouette container */
export const ORGAN_SLOT_POSITIONS: Record<OrganType, [number, number]> = {
  brain: [50, 11.7],
  eyes: [50, 16.7],
  heart: [36, 35],
  arms: [50, 43.3],
}

export const ORGAN_ORDER: OrganType[] = ['brain', 'eyes', 'heart', 'arms']
