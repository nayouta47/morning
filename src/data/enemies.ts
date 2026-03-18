import type { ResourceId } from './resources.ts'

export type EnemyId = 'siliconLifeform' | 'siliconBug' | 'wheelBug' | 'bareBonesMan' | 'rustGolem' | 'staticHound' | 'moldedWorker' | 'chromiumCrawler' | 'hunterHunter' | 'divineElk' | 'steelEagle' | 'willowFish' | 'emberCrane' | 'phoenixBird' | 'tailor' | 'webSpider'

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
  speed: number
  drops: EnemyDropCandidate[]
}

export const ENEMY_DEFS: Record<EnemyId, EnemyDef> = {
  siliconLifeform: {
    id: 'siliconLifeform',
    name: '🧏‍♀️ 석화인',
    tier: 2,
    hp: 20,
    damage: 2,
    attackCooldownMs: 3000,
    speed: 70,
    drops: [
      { resource: 'siliconMass', minAmount: 1, maxAmount: 1, chance: 1 },
      { resource: 'scrap', minAmount: 1, maxAmount: 2, chance: 0.65 },
      { resource: 'iron', minAmount: 1, maxAmount: 1, chance: 0.25 },
    ],
  },
  siliconBug: {
    id: 'siliconBug',
    name: '🐛 석충',
    tier: 1,
    hp: 3,
    damage: 1,
    attackCooldownMs: 2000,
    speed: 90,
    drops: [
      { resource: 'siliconMass', minAmount: 1, maxAmount: 1, chance: 0.4 },
      { resource: 'scrap', minAmount: 1, maxAmount: 1, chance: 0.25 },
    ],
  },
  wheelBug: {
    id: 'wheelBug',
    name: '🛞 윤각',
    tier: 1,
    hp: 4,
    damage: 3,
    attackCooldownMs: 4500,
    speed: 100,
    drops: [
      { resource: 'scrap', minAmount: 10, maxAmount: 14, chance: 1 },
      { resource: 'siliconMass', minAmount: 1, maxAmount: 1, chance: 0.2 },
    ],
  },
  bareBonesMan: {
    id: 'bareBonesMan',
    name: '🩻 해골무사',
    tier: 3,
    hp: 10,
    damage: 3,
    attackCooldownMs: 2000,
    speed: 95,
    drops: [
      { resource: 'scrap', minAmount: 1, maxAmount: 2, chance: 0.8 },
      { resource: 'iron', minAmount: 1, maxAmount: 1, chance: 0.35 },
    ],
  },
  rustGolem: {
    id: 'rustGolem',
    name: '🐃 적철장',
    tier: 2,
    hp: 18,
    damage: 5,
    attackCooldownMs: 5000,
    speed: 50,
    drops: [
      { resource: 'iron', minAmount: 2, maxAmount: 4, chance: 1 },
      { resource: 'scrap', minAmount: 3, maxAmount: 6, chance: 0.7 },
    ],
  },
  staticHound: {
    id: 'staticHound',
    name: '🐩 뇌견',
    tier: 1,
    hp: 5,
    damage: 2,
    attackCooldownMs: 1500,
    speed: 110,
    drops: [
      { resource: 'scrap', minAmount: 1, maxAmount: 3, chance: 0.6 },
      { resource: 'carbon', minAmount: 1, maxAmount: 1, chance: 0.3 },
    ],
  },
  moldedWorker: {
    id: 'moldedWorker',
    name: '👷 균역부',
    tier: 2,
    hp: 14,
    damage: 2,
    attackCooldownMs: 2500,
    speed: 65,
    drops: [
      { resource: 'carbon', minAmount: 1, maxAmount: 2, chance: 0.75 },
      { resource: 'siliconMass', minAmount: 1, maxAmount: 1, chance: 0.4 },
      { resource: 'scrap', minAmount: 1, maxAmount: 3, chance: 0.5 },
    ],
  },
  chromiumCrawler: {
    id: 'chromiumCrawler',
    name: '🦀 백갑장군',
    tier: 3,
    hp: 30,
    damage: 5,
    attackCooldownMs: 4000,
    speed: 55,
    drops: [
      { resource: 'chromium', minAmount: 1, maxAmount: 2, chance: 0.8 },
      { resource: 'iron', minAmount: 1, maxAmount: 2, chance: 0.5 },
      { resource: 'scrap', minAmount: 2, maxAmount: 4, chance: 0.9 },
    ],
  },
  hunterHunter: {
    id: 'hunterHunter',
    name: '🏹 역포수',
    tier: 3,
    hp: 15,
    damage: 4,
    attackCooldownMs: 1800,
    speed: 85,
    drops: [
      { resource: 'scrap', minAmount: 1, maxAmount: 3, chance: 0.7 },
      { resource: 'cash', minAmount: 2, maxAmount: 5, chance: 0.5 },
      { resource: 'iron', minAmount: 1, maxAmount: 2, chance: 0.4 },
    ],
  },
  divineElk: {
    id: 'divineElk',
    name: '🦌 녹신',
    tier: 3,
    hp: 28,
    damage: 3,
    attackCooldownMs: 4000,
    speed: 75,
    drops: [
      { resource: 'wood', minAmount: 2, maxAmount: 4, chance: 0.8 },
      { resource: 'carbon', minAmount: 1, maxAmount: 2, chance: 0.6 },
      { resource: 'siliconMass', minAmount: 1, maxAmount: 1, chance: 0.2 },
    ],
  },
  steelEagle: {
    id: 'steelEagle',
    name: '🦅 철응',
    tier: 2,
    hp: 12,
    damage: 4,
    attackCooldownMs: 2000,
    speed: 100,
    drops: [
      { resource: 'iron', minAmount: 1, maxAmount: 2, chance: 0.7 },
      { resource: 'scrap', minAmount: 1, maxAmount: 2, chance: 0.5 },
      { resource: 'chromium', minAmount: 1, maxAmount: 1, chance: 0.3 },
    ],
  },
  willowFish: {
    id: 'willowFish',
    name: '🐟 유사',
    tier: 1,
    hp: 4,
    damage: 1,
    attackCooldownMs: 3000,
    speed: 60,
    drops: [
      { resource: 'syntheticFood', minAmount: 1, maxAmount: 2, chance: 0.8 },
      { resource: 'carbon', minAmount: 1, maxAmount: 1, chance: 0.2 },
    ],
  },
  emberCrane: {
    id: 'emberCrane',
    name: '🦢 잔화학',
    tier: 2,
    hp: 16,
    damage: 3,
    attackCooldownMs: 2800,
    speed: 70,
    drops: [
      { resource: 'carbon', minAmount: 1, maxAmount: 3, chance: 0.75 },
      { resource: 'scrap', minAmount: 1, maxAmount: 2, chance: 0.4 },
    ],
  },
  phoenixBird: {
    id: 'phoenixBird',
    name: '🐦‍🔥 회염조',
    tier: 3,
    hp: 30,
    damage: 5,
    attackCooldownMs: 3000,
    speed: 80,
    drops: [
      { resource: 'carbon', minAmount: 2, maxAmount: 4, chance: 0.9 },
      { resource: 'chromium', minAmount: 1, maxAmount: 2, chance: 0.4 },
      { resource: 'iron', minAmount: 1, maxAmount: 2, chance: 0.3 },
    ],
  },
  tailor: {
    id: 'tailor',
    name: '🪡 재봉사',
    tier: 1,
    hp: 40,
    damage: 4,
    attackCooldownMs: 3500,
    speed: 60,
    drops: [
      { resource: 'scrap', minAmount: 8, maxAmount: 14, chance: 1 },
      { resource: 'iron', minAmount: 1, maxAmount: 3, chance: 0.6 },
    ],
  },
  webSpider: {
    id: 'webSpider',
    name: '🕷️ 거미',
    tier: 1,
    hp: 5,
    damage: 2,
    attackCooldownMs: 2000,
    speed: 95,
    drops: [
      { resource: 'scrap', minAmount: 3, maxAmount: 6, chance: 0.9 },
      { resource: 'carbon', minAmount: 1, maxAmount: 2, chance: 0.4 },
    ],
  },
}

export const ENEMY_IDS = Object.keys(ENEMY_DEFS) as EnemyId[]

export function getEnemyDef(enemyId: EnemyId): EnemyDef {
  return ENEMY_DEFS[enemyId]
}

export function getEnemyDisplayEmoji(enemyId: EnemyId): string {
  const enemy = getEnemyDef(enemyId)
  const [leadingToken] = enemy.name.trim().split(/\s+/, 1)
  return leadingToken || '👾'
}
