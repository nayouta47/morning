import type { OrganType, OrganDef } from './organs.ts'

export const DOG_ORGAN_DEFS: Record<string, OrganDef> = {
  dogBrain: {
    id: 'dogBrain',
    name: '연산 코어',
    emoji: '💾',
    organType: 'brain',
    flavorText: '구식 알고리즘이지만 판단은 정확하다. 쓸모있는 것과 쓸모없는 것을 분류하는 회로가 내장되어 있다.',
  },
  dogEyes: {
    id: 'dogEyes',
    name: '광학 센서 모듈',
    emoji: '📡',
    organType: 'eyes',
    flavorText: '어둠 속에서도 열상과 광학 두 채널을 동시에 처리한다. 길을 잃는 건 항상 센서 옆에 있는 인간 쪽이다.',
  },
  dogHeart: {
    id: 'dogHeart',
    name: '구동 전지 팩',
    emoji: '🔋',
    organType: 'heart',
    flavorText: '한 번도 방전되지 않고 돌아왔다. 정비만 해주면 앞으로도 그럴 것이다.',
  },
  dogPaws: {
    id: 'dogPaws',
    name: '보행 관절 모듈',
    emoji: '💪',
    organType: 'arms',
    flavorText: '베어링 자리 일부에 생체 부품을 박아 넣었다. 발소리가 달라졌고, 관절이 전보다 따뜻하다.',
  },
  dogGut: {
    id: 'dogGut',
    name: '보조 저장 장치',
    emoji: '💿',
    organType: 'intestines',
    flavorText: '어디서든 데이터를 쌓는다. 어디서든 꺼내 쓴다. 부럽다.',
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
  brain: 'CPU',
  eyes: '광학',
  heart: '동력',
  arms: '관절',
  intestines: '저장',
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
