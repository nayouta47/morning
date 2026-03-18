import type { GameState } from '../../core/state.ts'
import { setMousePos } from '../../core/combatPhysics.ts'

let overlayEl: HTMLDivElement | null = null
let canvasEl: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null

function getBackpackResourceAmount(state: GameState, resourceId: 'smallHealPotion'): number {
  return state.exploration.backpack.reduce((sum, entry) => (entry.resource === resourceId ? sum + entry.amount : sum), 0)
}

export function isCombatFullscreenActive(): boolean {
  return overlayEl !== null && overlayEl.parentElement !== null
}

export function showCombatFullscreen(
  state: GameState,
  onShoot: () => void,
  onHeal: () => void,
  onFlee: () => void,
): void {
  if (overlayEl) return

  overlayEl = document.createElement('div')
  overlayEl.id = 'combat-fullscreen'

  canvasEl = document.createElement('canvas')
  canvasEl.id = 'combat-canvas'
  overlayEl.appendChild(canvasEl)

  const hud = document.createElement('div')
  hud.id = 'combat-hud'
  hud.innerHTML = `
    <div class="combat-hud-top-left">
      <div class="combat-hud-hp" id="combat-hud-hp"></div>
    </div>
    <div class="combat-hud-top-right" id="combat-hud-enemies"></div>
    <div class="combat-hud-bottom-left">
      <button id="combat-hud-heal" type="button">회복(H)</button>
      <button id="combat-hud-flee" type="button">도주(Shift)</button>
    </div>
    <div class="combat-hud-bottom-center" id="combat-hud-flee-gauge"></div>
  `
  overlayEl.appendChild(hud)

  document.body.appendChild(overlayEl)

  ctx = canvasEl.getContext('2d')
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)

  canvasEl.addEventListener('mousemove', (e) => {
    if (!canvasEl) return
    const combat = state.exploration.combat
    if (!combat) return
    const rect = canvasEl.getBoundingClientRect()
    const scale = Math.min(rect.width / combat.worldWidth, rect.height / combat.worldHeight)
    const offsetX = (rect.width - combat.worldWidth * scale) / 2
    const offsetY = (rect.height - combat.worldHeight * scale) / 2
    setMousePos(
      (e.clientX - rect.left - offsetX) / scale,
      (e.clientY - rect.top - offsetY) / scale,
    )
  })

  canvasEl.addEventListener('mousedown', (e) => {
    if (e.button === 0) onShoot()
  })

  canvasEl.addEventListener('contextmenu', (e) => e.preventDefault())

  const healBtn = hud.querySelector<HTMLButtonElement>('#combat-hud-heal')
  if (healBtn) healBtn.addEventListener('click', onHeal)

  const fleeBtn = hud.querySelector<HTMLButtonElement>('#combat-hud-flee')
  if (fleeBtn) fleeBtn.addEventListener('click', onFlee)
}

export function hideCombatFullscreen(): void {
  if (overlayEl) {
    window.removeEventListener('resize', resizeCanvas)
    overlayEl.remove()
    overlayEl = null
    canvasEl = null
    ctx = null
  }
}

function resizeCanvas(): void {
  if (!canvasEl) return
  canvasEl.width = window.innerWidth
  canvasEl.height = window.innerHeight
}

export function renderCombatCanvas(state: GameState): void {
  if (!ctx || !canvasEl) return
  const combat = state.exploration.combat
  if (!combat) return

  const cw = canvasEl.width
  const ch = canvasEl.height
  const scale = Math.min(cw / combat.worldWidth, ch / combat.worldHeight)
  const offsetX = (cw - combat.worldWidth * scale) / 2
  const offsetY = (ch - combat.worldHeight * scale) / 2

  ctx.clearRect(0, 0, cw, ch)

  // Dark background
  ctx.fillStyle = '#0d0d0d'
  ctx.fillRect(0, 0, cw, ch)

  ctx.save()
  ctx.translate(offsetX, offsetY)
  ctx.scale(scale, scale)

  // World background
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, combat.worldWidth, combat.worldHeight)

  // Bullets
  ctx.fillStyle = '#f0d060'
  for (const b of combat.bullets) {
    ctx.beginPath()
    ctx.arc(b.x, b.y, combat.bulletRadius, 0, Math.PI * 2)
    ctx.fill()
  }

  // Enemies
  for (const enemy of combat.enemies) {
    if (enemy.hp <= 0) continue

    // Body
    ctx.fillStyle = '#c04040'
    ctx.beginPath()
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2)
    ctx.fill()

    // HP bar
    const barW = enemy.radius * 2.5
    const barH = 4
    const barX = enemy.x - barW / 2
    const barY = enemy.y - enemy.radius - 8
    ctx.fillStyle = '#333'
    ctx.fillRect(barX, barY, barW, barH)
    const hpRatio = enemy.hp / enemy.maxHp
    ctx.fillStyle = hpRatio > 0.5 ? '#4caf50' : hpRatio > 0.25 ? '#ff9800' : '#f44336'
    ctx.fillRect(barX, barY, barW * hpRatio, barH)
  }

  // Player
  ctx.fillStyle = '#4488cc'
  ctx.beginPath()
  ctx.arc(combat.playerX, combat.playerY, combat.playerRadius, 0, Math.PI * 2)
  ctx.fill()

  // Aim line
  const aimLen = 30
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(combat.playerX, combat.playerY)
  ctx.lineTo(
    combat.playerX + Math.cos(combat.playerAngle) * aimLen,
    combat.playerY + Math.sin(combat.playerAngle) * aimLen,
  )
  ctx.stroke()

  // Attack cooldown arc
  const cdRatio = Math.min(1, combat.playerAttackElapsedMs / combat.playerAttackCooldownMs)
  if (cdRatio < 1) {
    ctx.strokeStyle = 'rgba(240, 208, 96, 0.6)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(combat.playerX, combat.playerY, combat.playerRadius + 4, -Math.PI / 2, -Math.PI / 2 + cdRatio * Math.PI * 2)
    ctx.stroke()
  }

  ctx.restore()

  // HUD updates
  updateHUD(state)
}

function updateHUD(state: GameState): void {
  const combat = state.exploration.combat
  if (!combat) return

  const hpEl = document.getElementById('combat-hud-hp')
  if (hpEl) {
    hpEl.textContent = `HP ${state.exploration.hp}/${state.exploration.maxHp}`
  }

  const enemiesEl = document.getElementById('combat-hud-enemies')
  if (enemiesEl) {
    enemiesEl.innerHTML = combat.enemies
      .filter(e => e.hp > 0)
      .map(e => `<div class="combat-hud-enemy-row">${e.name} ${e.hp}/${e.maxHp}</div>`)
      .join('')
  }

  const potionAmount = getBackpackResourceAmount(state, 'smallHealPotion')
  const potionReady = combat.smallHealPotionCooldownRemainingMs <= 0
  const healBtn = document.querySelector<HTMLButtonElement>('#combat-hud-heal')
  if (healBtn) {
    healBtn.disabled = !potionReady || potionAmount <= 0
    healBtn.textContent = `회복 H (${potionAmount})`
  }

  const fleeBtn = document.querySelector<HTMLButtonElement>('#combat-hud-flee')
  if (fleeBtn) fleeBtn.disabled = combat.fleeGaugeRunning

  const fleeGaugeEl = document.getElementById('combat-hud-flee-gauge')
  if (fleeGaugeEl) {
    if (combat.fleeGaugeRunning) {
      const pct = Math.round((combat.fleeGaugeElapsedMs / combat.fleeGaugeDurationMs) * 100)
      fleeGaugeEl.textContent = `도주 ${pct}%`
    } else {
      fleeGaugeEl.textContent = ''
    }
  }
}

export function patchExplorationCombatOverlay(_app: ParentNode, _state: GameState, _now?: number): void {
  // No-op: canvas rendering is done in renderCombatCanvas
}

export function renderExplorationCombatOverlay(_state: GameState, _now?: number): string {
  return ''
}
