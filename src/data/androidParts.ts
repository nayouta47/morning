export type AndroidPartSlot = 'cpu' | 'core' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg'

export type AndroidPartDef = {
  id: string
  name: string
  emoji: string
  slotType: AndroidPartSlot
  flavorText: string
}

export const ANDROID_PART_DEFS: Record<string, AndroidPartDef> = {
  baseCpu: {
    id: 'baseCpu',
    name: '기본 CPU',
    emoji: '💾',
    slotType: 'cpu',
    flavorText: '제비의 주 연산 장치. 구식이지만 여전히 작동한다.',
  },
  baseCore: {
    id: 'baseCore',
    name: '기본 코어',
    emoji: '⚡',
    slotType: 'core',
    flavorText: '동력 공급 장치. 이게 멈추면 모든 게 멈춘다.',
  },
}

export const ANDROID_DEFAULT_PARTS: Record<AndroidPartSlot, string | null> = {
  cpu: 'baseCpu',
  core: 'baseCore',
  leftArm: null,
  rightArm: null,
  leftLeg: null,
  rightLeg: null,
}

export const ANDROID_PART_SLOT_LABELS: Record<AndroidPartSlot, string> = {
  cpu: 'CPU',
  core: '코어',
  leftArm: '왼팔',
  rightArm: '오른팔',
  leftLeg: '왼다리',
  rightLeg: '오른다리',
}

// [left%, top%] relative to silhouette container, SVG viewBox="0 0 160 280"
export const ANDROID_PART_SLOT_POSITIONS: Record<AndroidPartSlot, [number, number]> = {
  cpu: [50, 5],
  core: [50, 30],
  leftArm: [14, 35],
  rightArm: [83, 35],
  leftLeg: [38, 72],
  rightLeg: [61, 72],
}

export const ANDROID_PART_SLOT_ORDER: AndroidPartSlot[] = ['cpu', 'core', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg']
