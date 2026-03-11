import rawMapData from './default-map.json'
import rawBiomeData from '../biomes.json'
import { ENEMY_DEFS, type EnemyId } from '../enemies.ts'

export type BiomeId = string

export type WeightedEnemy = {
  enemyId: EnemyId
  weight: number
}

export type BiomeDef = {
  id: BiomeId
  name: string
  emoji: string
  encounterPool: WeightedEnemy[]
}

export type MapTile = { biome: BiomeId; dungeonId?: string }

export type DungeonFloor = {
  dialogText: string
  enemyId: EnemyId
  rewardMultiplier: number
}

export type DungeonDef = {
  id: string
  name: string
  emoji: string
  entryText: string
  floors: DungeonFloor[]
}

type RawBiomeDef = {
  id?: unknown
  name?: unknown
  emoji?: unknown
  encounterPool?: Array<{ enemyId?: unknown; weight?: unknown }>
}

type RawDungeonFloor = {
  dialogText?: unknown
  enemyId?: unknown
  rewardMultiplier?: unknown
}

type RawDungeonDef = {
  id?: unknown
  name?: unknown
  emoji?: unknown
  entryText?: unknown
  floors?: RawDungeonFloor[]
}

type RawMapData = {
  id?: unknown
  name?: unknown
  size?: unknown
  start?: { x?: unknown; y?: unknown }
  dungeons?: RawDungeonDef[]
  tiles?: Array<Array<{ biome?: unknown; dungeonId?: unknown }>>
}

export type ExplorationMap = {
  id: string
  name: string
  size: number
  start: { x: number; y: number }
  dungeons: DungeonDef[]
  tiles: MapTile[][]
}

function toFiniteInt(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.floor(parsed)
}

const biomeData = rawBiomeData as { biomes?: RawBiomeDef[] }

export const BIOME_DEFS: Record<BiomeId, BiomeDef> = Object.fromEntries(
  (biomeData.biomes ?? [])
    .map((entry): BiomeDef | null => {
      if (typeof entry?.id !== 'string' || typeof entry.name !== 'string' || typeof entry.emoji !== 'string') return null
      const encounterPool = (entry.encounterPool ?? [])
        .map((pool): WeightedEnemy | null => {
          if (typeof pool.enemyId !== 'string' || !(pool.enemyId in ENEMY_DEFS)) return null
          const weight = Math.max(0, Number(pool.weight) || 0)
          if (weight <= 0) return null
          return { enemyId: pool.enemyId as EnemyId, weight }
        })
        .filter((pool): pool is WeightedEnemy => pool != null)

      return {
        id: entry.id,
        name: entry.name,
        emoji: entry.emoji,
        encounterPool,
      }
    })
    .filter((entry): entry is BiomeDef => entry != null)
    .map((entry) => [entry.id, entry]),
)

const FALLBACK_BIOME_ID = Object.keys(BIOME_DEFS)[0] ?? 'fallback'

function normalizeDungeons(raw: RawDungeonDef[]): DungeonDef[] {
  return raw
    .map((d): DungeonDef | null => {
      if (typeof d?.id !== 'string' || typeof d.name !== 'string') return null
      const floors = (d.floors ?? [])
        .map((f): DungeonFloor | null => {
          if (typeof f?.enemyId !== 'string' || !(f.enemyId in ENEMY_DEFS)) return null
          return {
            dialogText: typeof f.dialogText === 'string' ? f.dialogText : '',
            enemyId: f.enemyId as EnemyId,
            rewardMultiplier: Math.max(0.1, Number(f.rewardMultiplier) || 1),
          }
        })
        .filter((f): f is DungeonFloor => f != null)
      if (floors.length === 0) return null
      return {
        id: d.id,
        name: d.name,
        emoji: typeof d.emoji === 'string' ? d.emoji : '🏚️',
        entryText: typeof d.entryText === 'string' ? d.entryText : '',
        floors,
      }
    })
    .filter((d): d is DungeonDef => d != null)
}

function normalizeMapData(raw: RawMapData): ExplorationMap {
  const requestedSize = Math.max(8, toFiniteInt(raw.size, 33))
  const dungeons = normalizeDungeons(raw.dungeons ?? [])
  const dungeonIds = new Set(dungeons.map((d) => d.id))

  const tiles: MapTile[][] = Array.from({ length: requestedSize }, (_, y) =>
    Array.from({ length: requestedSize }, (_, x) => {
      const rawTile = raw.tiles?.[y]?.[x]
      const biomeLike = rawTile?.biome
      const biome = typeof biomeLike === 'string' && BIOME_DEFS[biomeLike] ? biomeLike : FALLBACK_BIOME_ID
      const dungeonId = typeof rawTile?.dungeonId === 'string' && dungeonIds.has(rawTile.dungeonId) ? rawTile.dungeonId : undefined
      return dungeonId ? { biome, dungeonId } : { biome }
    }),
  )

  return {
    id: typeof raw.id === 'string' ? raw.id : 'default-map',
    name: typeof raw.name === 'string' ? raw.name : '탐험 지역',
    size: requestedSize,
    start: {
      x: Math.max(0, Math.min(requestedSize - 1, toFiniteInt(raw.start?.x, Math.floor(requestedSize / 2)))),
      y: Math.max(0, Math.min(requestedSize - 1, toFiniteInt(raw.start?.y, Math.floor(requestedSize / 2)))),
    },
    dungeons,
    tiles,
  }
}

export const EXPLORATION_MAP = normalizeMapData(rawMapData as RawMapData)

export function getDungeonDef(id: string): DungeonDef | undefined {
  return EXPLORATION_MAP.dungeons.find((d) => d.id === id)
}

export function getTileAt(x: number, y: number): MapTile | undefined {
  return EXPLORATION_MAP.tiles[y]?.[x]
}

export function getBiomeAt(x: number, y: number): BiomeDef {
  const tile = EXPLORATION_MAP.tiles[y]?.[x]
  const biomeId = tile?.biome ?? FALLBACK_BIOME_ID
  return BIOME_DEFS[biomeId] ?? {
    id: FALLBACK_BIOME_ID,
    name: '미지형',
    emoji: '▫️',
    encounterPool: [],
  }
}

export function getBiomesForEnemy(enemyId: EnemyId): BiomeDef[] {
  return Object.values(BIOME_DEFS).filter((biome) => biome.encounterPool.some((entry) => entry.enemyId === enemyId))
}
