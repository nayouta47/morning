import type { ResourceId } from './resources.ts'

export type EnemyId = 'siliconLifeform'

export type EnemyDropCandidate = {
  resource: ResourceId
  minAmount: number
  maxAmount: number
  chance: number
}

export type EnemyDef = {
  id: EnemyId
  name: string
  hp: number
  damage: number
  attackCooldownMs: number
  drops: EnemyDropCandidate[]
}

export const ENEMY_DEFS: Record<EnemyId, EnemyDef> = {
  siliconLifeform: {
    id: 'siliconLifeform',
    name: '규소생물',
    hp: 20,
    damage: 2,
    attackCooldownMs: 3000,
    drops: [
      { resource: 'siliconMass', minAmount: 1, maxAmount: 1, chance: 1 },
      { resource: 'scrap', minAmount: 1, maxAmount: 2, chance: 0.65 },
      { resource: 'iron', minAmount: 1, maxAmount: 1, chance: 0.25 },
    ],
  },
}

export const ENEMY_IDS = Object.keys(ENEMY_DEFS) as EnemyId[]

export function getEnemyDef(enemyId: EnemyId): EnemyDef {
  return ENEMY_DEFS[enemyId]
}
