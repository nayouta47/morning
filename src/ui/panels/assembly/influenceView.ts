import { SLOT_PENALTY_MAJOR, SLOT_PENALTY_MINOR } from '../../../core/moduleEffects.ts'
import type { ModuleType } from '../../../core/state.ts'

type InfluenceCellKind = 'empty' | 'center' | 'amp' | 'heatMinor' | 'heatMajor' | 'blockMajor'

type InfluenceCell = {
  x: number
  y: number
  kind: InfluenceCellKind
}

const MINI_GRID_SIZE = 5
const MINI_GRID_CENTER = Math.floor(MINI_GRID_SIZE / 2)

function setInfluenceCell(grid: InfluenceCellKind[][], dx: number, dy: number, kind: InfluenceCellKind): void {
  const x = MINI_GRID_CENTER + dx
  const y = MINI_GRID_CENTER + dy
  if (x < 0 || x >= MINI_GRID_SIZE || y < 0 || y >= MINI_GRID_SIZE) return
  grid[y][x] = kind
}

function getAmplifierMiniGrid(moduleType: ModuleType): InfluenceCell[] | null {
  if (
    moduleType !== 'blockAmplifierUp'
    && moduleType !== 'blockAmplifierDown'
    && moduleType !== 'heatAmplifierLeft'
    && moduleType !== 'heatAmplifierRight'
  ) {
    return null
  }

  const grid = Array.from({ length: MINI_GRID_SIZE }, () => Array.from({ length: MINI_GRID_SIZE }, () => 'empty' as InfluenceCellKind))
  setInfluenceCell(grid, 0, 0, 'center')

  if (moduleType === 'blockAmplifierUp') {
    setInfluenceCell(grid, 0, -1, 'amp')
    setInfluenceCell(grid, -1, 0, 'blockMajor')
    setInfluenceCell(grid, 1, 0, 'blockMajor')
  } else if (moduleType === 'blockAmplifierDown') {
    setInfluenceCell(grid, 0, 1, 'amp')
    setInfluenceCell(grid, -1, 0, 'blockMajor')
    setInfluenceCell(grid, 1, 0, 'blockMajor')
  } else if (moduleType === 'heatAmplifierLeft') {
    setInfluenceCell(grid, -1, 0, 'amp')
    setInfluenceCell(grid, 1, 0, 'heatMajor')
    setInfluenceCell(grid, 0, -1, 'heatMinor')
    setInfluenceCell(grid, 0, 1, 'heatMinor')
  } else if (moduleType === 'heatAmplifierRight') {
    setInfluenceCell(grid, 1, 0, 'amp')
    setInfluenceCell(grid, -1, 0, 'heatMajor')
    setInfluenceCell(grid, 0, -1, 'heatMinor')
    setInfluenceCell(grid, 0, 1, 'heatMinor')
  }

  return grid.flatMap((row, y) => row.map((kind, x) => ({ x, y, kind })))
}

export function renderInfluenceMiniGrid(moduleType: ModuleType): string {
  const cells = getAmplifierMiniGrid(moduleType)
  if (!cells) return ''

  const cellLabel: Record<InfluenceCellKind, string> = {
    empty: '',
    center: '●',
    amp: '+',
    heatMinor: `${SLOT_PENALTY_MINOR}`,
    heatMajor: `${SLOT_PENALTY_MAJOR}`,
    blockMajor: `${SLOT_PENALTY_MAJOR}`,
  }

  const gridCells = cells
    .map((cell) => `<span class="influence-cell ${cell.kind}" aria-hidden="true">${cellLabel[cell.kind]}</span>`)
    .join('')

  return `<article class="module-effect-card module-effect-map" aria-label="영향 맵"><h4>영향 맵</h4><div class="influence-preview" aria-label="모듈 영향 미니 지도"><div class="influence-grid" role="img" aria-label="중앙은 모듈 위치, +는 증폭, 열기/전자파 패널티는 타입별로 표시되며 총 패널티 10 이상은 슬롯 정지">${gridCells}</div><div class="influence-legend"><span class="legend-item"><span class="swatch center"></span>중심</span><span class="legend-item"><span class="swatch amp"></span>증폭</span><span class="legend-item"><span class="swatch heat"></span>열기</span><span class="legend-item"><span class="swatch block"></span>차단</span></div></div></article>`
}
