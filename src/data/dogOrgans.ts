import type { OrganType, OrganDef } from './organs.ts'

export const DOG_ORGAN_DEFS: Record<string, OrganDef> = {
  dogBrain: {
    id: 'dogBrain',
    name: '안내견의 뇌',
    emoji: '🧠',
    organType: 'brain',
    flavorText: '쓸모있는 것과 쓸모없는 것을 구분하는 능력이 내장되어 있다.',
  },
  dogEyes: {
    id: 'dogEyes',
    name: '안내견의 눈',
    emoji: '👁️',
    organType: 'eyes',
    flavorText: '어둠 속에서도 길을 찾는다. 길을 잃은 건 항상 사람 쪽이다.',
  },
  dogHeart: {
    id: 'dogHeart',
    name: '안내견의 심장',
    emoji: '🩷',
    organType: 'heart',
    flavorText: '한 번도 멈추지 않고 뛰어왔다. 앞으로도 그럴 것이다.',
  },
  dogPaws: {
    id: 'dogPaws',
    name: '안내견의 앞발',
    emoji: '🐾',
    organType: 'arms',
    flavorText: '땅을 짚고, 방향을 가리키고, 가끔 무릎 위에 올려진다.',
  },
  dogGut: {
    id: 'dogGut',
    name: '안내견의 내장',
    emoji: '⚙️',
    organType: 'intestines',
    flavorText: '어디서든 잘 먹고, 어디서든 잘 소화한다. 부럽다.',
  },
}

export const DOG_DEFAULT_ORGANS: Record<OrganType, string> = {
  brain: 'dogBrain',
  eyes: 'dogEyes',
  heart: 'dogHeart',
  arms: 'dogPaws',
  intestines: 'dogGut',
}

export const DOG_ORGAN_SLOT_LABELS: Record<OrganType, string> = {
  brain: '뇌',
  eyes: '눈',
  heart: '심장',
  arms: '앞발',
  intestines: '내장',
}

// [left%, top%] — SVG viewBox="0 0 280 180"
export const DOG_ORGAN_SLOT_POSITIONS: Record<OrganType, [number, number]> = {
  brain: [68, 22],
  eyes: [82, 36],
  heart: [52, 38],
  intestines: [36, 50],
  arms: [58, 74],
}

export const DOG_ORGAN_ORDER: OrganType[] = ['brain', 'eyes', 'heart', 'intestines', 'arms']
