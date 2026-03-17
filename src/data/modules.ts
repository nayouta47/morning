import type { ModuleType } from '../core/state.ts'

export const MODULE_TYPES = [
  'damage',
  'cooldown',
  'blockAmplifierUp',
  'blockAmplifierDown',
  'preheater',
  'heatAmplifierLeft',
  'heatAmplifierRight',
  'slotUnlocker',
  'generator',
] as const satisfies readonly ModuleType[]

type ModuleAliasMeta = {
  exact?: string[]
  prefixes?: string[]
}

export type ModuleMetadata = {
  type: ModuleType
  nameKr: string
  emoji: string
  powerCost: number
  weight: number
  shortLabel: string
  baseDescription: string
  amplifiedDescription: string
  equipmentLogName: string
  craftLogLabel: string
  aliases?: ModuleAliasMeta
}

export const MODULE_METADATA: Record<ModuleType, ModuleMetadata> = {
  damage: {
    type: 'damage',
    nameKr: '공격력 칩',
    emoji: '💥',
    powerCost: 5,
    weight: 1,
    shortLabel: '기본 공격력 +1, 증폭 시 추가 +1 · 전력 ⚡5',
    baseDescription: '공격력 +1',
    amplifiedDescription: '공격력 +1',
    equipmentLogName: '공격력 모듈(+1)',
    craftLogLabel: '💥 공격력(+1)',
    aliases: { prefixes: ['DMG-'] },
  },
  cooldown: {
    type: 'cooldown',
    nameKr: '가속 칩',
    emoji: '⏱️',
    powerCost: 5,
    weight: 1,
    shortLabel: '기본 가속 +10, 증폭 시 추가 +10 · 전력 ⚡5',
    baseDescription: '가속 +10',
    amplifiedDescription: '가속 +10',
    equipmentLogName: '쿨다운 모듈(가속 +10)',
    craftLogLabel: '⏱️ 쿨다운 가속(+10)',
    aliases: { prefixes: ['CDN-'] },
  },
  blockAmplifierUp: {
    type: 'blockAmplifierUp',
    nameKr: '전자 증폭기(상)',
    emoji: '📡▲',
    powerCost: 2,
    weight: 1,
    shortLabel: '전력 ⚡2',
    baseDescription: '증폭(중첩) + 전자파 패널티 부여',
    amplifiedDescription: '해당 없음',
    equipmentLogName: '전자 증폭기(상)',
    craftLogLabel: '📡▲ 전자 증폭기(상)',
    aliases: { exact: ['amplifierUp'], prefixes: ['AMP-U-'] },
  },
  blockAmplifierDown: {
    type: 'blockAmplifierDown',
    nameKr: '전자 증폭기(하)',
    emoji: '📡▼',
    powerCost: 2,
    weight: 1,
    shortLabel: '전력 ⚡2',
    baseDescription: '증폭(중첩) + 전자파 패널티 부여',
    amplifiedDescription: '해당 없음',
    equipmentLogName: '전자 증폭기(하)',
    craftLogLabel: '📡▼ 전자 증폭기(하)',
    aliases: { exact: ['amplifierDown'], prefixes: ['AMP-D-'] },
  },
  preheater: {
    type: 'preheater',
    nameKr: '예열기 칩',
    emoji: '🔥',
    powerCost: 7,
    weight: 1,
    shortLabel: '전투 시작 즉시 발사 준비 · 전력 ⚡7',
    baseDescription: '전투 시작 즉시 발사 준비',
    amplifiedDescription: '해당 없음',
    equipmentLogName: '예열기(전투 시작 즉시 발사)',
    craftLogLabel: '🔥 예열기(전투 시작 즉시 발사)',
    aliases: { prefixes: ['PRE-'] },
  },
  heatAmplifierLeft: {
    type: 'heatAmplifierLeft',
    nameKr: '열 증폭기(좌)',
    emoji: '♨️◀',
    powerCost: 4,
    weight: 1,
    shortLabel: '전력 ⚡4',
    baseDescription: '즉시 증폭 +2 + 열기 패널티 부여',
    amplifiedDescription: '해당 없음',
    equipmentLogName: '열 증폭기(좌)',
    craftLogLabel: '♨️◀ 열 증폭기(좌)',
    aliases: { exact: ['heatAmplifier'], prefixes: ['HEAT-L-', 'HEAT-'] },
  },
  heatAmplifierRight: {
    type: 'heatAmplifierRight',
    nameKr: '열 증폭기(우)',
    emoji: '♨️▶',
    powerCost: 4,
    weight: 1,
    shortLabel: '전력 ⚡4',
    baseDescription: '즉시 증폭 +2 + 열기 패널티 부여',
    amplifiedDescription: '해당 없음',
    equipmentLogName: '열 증폭기(우)',
    craftLogLabel: '♨️▶ 열 증폭기(우)',
    aliases: { prefixes: ['HEAT-R-'] },
  },
  slotUnlocker: {
    type: 'slotUnlocker',
    nameKr: '해금기',
    emoji: '🗝️',
    powerCost: 6,
    weight: 1,
    shortLabel: '활성화 시 좌측 비활성 슬롯 2칸 해제 · 전력 ⚡6',
    baseDescription: '작동 중 좌측 슬롯 2칸 임시 해제',
    amplifiedDescription: '해당 없음',
    equipmentLogName: '해금기(좌측 슬롯 해제)',
    craftLogLabel: '🗝️ 해금기(좌측 슬롯 2칸 해제)',
    aliases: { prefixes: ['UNL-'] },
  },
  generator: {
    type: 'generator',
    nameKr: '발전기',
    emoji: '⚡',
    powerCost: -10,
    weight: 2,
    shortLabel: '전체 전력 +10 · 사방 열기 패널티 +5',
    baseDescription: '전체 전력 +10 · 사방 슬롯에 열기 패널티 +5',
    amplifiedDescription: '해당 없음',
    equipmentLogName: '발전기(전력 +10)',
    craftLogLabel: '⚡ 발전기(전력 +10)',
    aliases: { prefixes: ['GEN-'] },
  },
}

export const MODULE_POWER_COST: Record<ModuleType, number> = {
  damage: MODULE_METADATA.damage.powerCost,
  cooldown: MODULE_METADATA.cooldown.powerCost,
  blockAmplifierUp: MODULE_METADATA.blockAmplifierUp.powerCost,
  blockAmplifierDown: MODULE_METADATA.blockAmplifierDown.powerCost,
  preheater: MODULE_METADATA.preheater.powerCost,
  heatAmplifierLeft: MODULE_METADATA.heatAmplifierLeft.powerCost,
  heatAmplifierRight: MODULE_METADATA.heatAmplifierRight.powerCost,
  slotUnlocker: MODULE_METADATA.slotUnlocker.powerCost,
  generator: MODULE_METADATA.generator.powerCost,
}

export const MODULE_NAME_KR: Record<ModuleType, string> = {
  damage: MODULE_METADATA.damage.nameKr,
  cooldown: MODULE_METADATA.cooldown.nameKr,
  blockAmplifierUp: MODULE_METADATA.blockAmplifierUp.nameKr,
  blockAmplifierDown: MODULE_METADATA.blockAmplifierDown.nameKr,
  preheater: MODULE_METADATA.preheater.nameKr,
  heatAmplifierLeft: MODULE_METADATA.heatAmplifierLeft.nameKr,
  heatAmplifierRight: MODULE_METADATA.heatAmplifierRight.nameKr,
  slotUnlocker: MODULE_METADATA.slotUnlocker.nameKr,
  generator: MODULE_METADATA.generator.nameKr,
}

export const MODULE_EMOJI: Record<ModuleType, string> = {
  damage: MODULE_METADATA.damage.emoji,
  cooldown: MODULE_METADATA.cooldown.emoji,
  blockAmplifierUp: MODULE_METADATA.blockAmplifierUp.emoji,
  blockAmplifierDown: MODULE_METADATA.blockAmplifierDown.emoji,
  preheater: MODULE_METADATA.preheater.emoji,
  heatAmplifierLeft: MODULE_METADATA.heatAmplifierLeft.emoji,
  heatAmplifierRight: MODULE_METADATA.heatAmplifierRight.emoji,
  slotUnlocker: MODULE_METADATA.slotUnlocker.emoji,
  generator: MODULE_METADATA.generator.emoji,
}

export const MODULE_WEIGHT: Record<ModuleType, number> = {
  damage: MODULE_METADATA.damage.weight,
  cooldown: MODULE_METADATA.cooldown.weight,
  blockAmplifierUp: MODULE_METADATA.blockAmplifierUp.weight,
  blockAmplifierDown: MODULE_METADATA.blockAmplifierDown.weight,
  preheater: MODULE_METADATA.preheater.weight,
  heatAmplifierLeft: MODULE_METADATA.heatAmplifierLeft.weight,
  heatAmplifierRight: MODULE_METADATA.heatAmplifierRight.weight,
  slotUnlocker: MODULE_METADATA.slotUnlocker.weight,
  generator: MODULE_METADATA.generator.weight,
}

export function isKnownModuleType(value: unknown): value is ModuleType {
  return typeof value === 'string' && (MODULE_TYPES as readonly string[]).includes(value)
}

const MODULE_ALIAS_EXACT = new Map<string, ModuleType>()
const MODULE_ALIAS_PREFIX: Array<{ prefix: string; type: ModuleType }> = []

MODULE_TYPES.forEach((type) => {
  MODULE_ALIAS_EXACT.set(type, type)
  const aliases = MODULE_METADATA[type].aliases
  aliases?.exact?.forEach((alias) => MODULE_ALIAS_EXACT.set(alias, type))
  aliases?.prefixes?.forEach((prefix) => MODULE_ALIAS_PREFIX.push({ prefix, type }))
})

export function inferModuleTypeFromAlias(value: unknown): ModuleType | null {
  if (typeof value !== 'string') return null

  const exact = MODULE_ALIAS_EXACT.get(value)
  if (exact) return exact

  for (const alias of MODULE_ALIAS_PREFIX) {
    if (value.startsWith(alias.prefix)) return alias.type
  }

  return null
}

export type ModuleCodexEntry = {
  type: ModuleType
  name: string
  icon: string
  powerCost: number
  weight: number
}

export const MODULE_CODEX_ENTRIES: ModuleCodexEntry[] = MODULE_TYPES.map((type) => {
  const meta = MODULE_METADATA[type]
  return {
    type,
    name: meta.nameKr,
    icon: meta.emoji,
    powerCost: meta.powerCost,
    weight: meta.weight,
  }
})
