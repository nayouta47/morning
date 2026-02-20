import type { ResourceId } from './resources.ts'

export type EnemyId = 'siliconLifeform' | 'siliconBug' | 'wheelBug' | 'bareBonesMan'

export type EnemyDropCandidate = {
  resource: ResourceId
  minAmount: number
  maxAmount: number
  chance: number
}

export type EnemyTier = 1 | 2 | 3

export type EnemyDef = {
  id: EnemyId
  name: string
  tier: EnemyTier
  hp: number
  damage: number
  attackCooldownMs: number
  drops: EnemyDropCandidate[]
}

export const ENEMY_DEFS: Record<EnemyId, EnemyDef> = {
  siliconLifeform: {
    id: 'siliconLifeform',
    name: '벌벌떠는 기인',
    tier: 2,
    hp: 20,
    damage: 2,
    attackCooldownMs: 3000,
    drops: [
      { resource: 'siliconMass', minAmount: 1, maxAmount: 1, chance: 1 },
      { resource: 'scrap', minAmount: 1, maxAmount: 2, chance: 0.65 },
      { resource: 'iron', minAmount: 1, maxAmount: 1, chance: 0.25 },
    ],
  },
  siliconBug: {
    id: 'siliconBug',
    name: '규소충',
    tier: 1,
    hp: 4,
    damage: 1,
    attackCooldownMs: 2000,
    drops: [
      { resource: 'siliconMass', minAmount: 1, maxAmount: 1, chance: 0.4 },
      { resource: 'scrap', minAmount: 1, maxAmount: 1, chance: 0.25 },
    ],
  },
  wheelBug: {
    id: 'wheelBug',
    name: '🛞 바퀴 벌레',
    tier: 1,
    hp: 4,
    damage: 1,
    attackCooldownMs: 2000,
    drops: [
      { resource: 'scrap', minAmount: 10, maxAmount: 14, chance: 1 },
      { resource: 'siliconMass', minAmount: 1, maxAmount: 1, chance: 0.2 },
    ],
  },
  bareBonesMan: {
    id: 'bareBonesMan',
    name: '뼈만 남은 사내',
    tier: 3,
    hp: 10,
    damage: 3,
    attackCooldownMs: 2000,
    drops: [
      { resource: 'scrap', minAmount: 1, maxAmount: 2, chance: 0.8 },
      { resource: 'iron', minAmount: 1, maxAmount: 1, chance: 0.35 },
    ],
  },
}

export const ENEMY_IDS = Object.keys(ENEMY_DEFS) as EnemyId[]

export function getEnemyDef(enemyId: EnemyId): EnemyDef {
  return ENEMY_DEFS[enemyId]
}
