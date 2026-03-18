import type { GameState } from './state.ts'
import { narrate } from './actions/logging.ts'

export const pressedKeys = new Set<string>()
export let mouseX = 0
export let mouseY = 0

export function setMousePos(x: number, y: number): void {
  mouseX = x
  mouseY = y
}

export function updateCombatFrame(state: GameState, dtMs: number): void {
  if (state.exploration.mode !== 'active' || state.exploration.phase !== 'combat') return
  const combat = state.exploration.combat
  if (!combat) return

  const dt = dtMs / 1000

  // 1. Player movement
  let vx = 0
  let vy = 0
  if (pressedKeys.has('w') || pressedKeys.has('arrowup')) vy -= 1
  if (pressedKeys.has('s') || pressedKeys.has('arrowdown')) vy += 1
  if (pressedKeys.has('a') || pressedKeys.has('arrowleft')) vx -= 1
  if (pressedKeys.has('d') || pressedKeys.has('arrowright')) vx += 1

  if (vx !== 0 || vy !== 0) {
    const mag = Math.sqrt(vx * vx + vy * vy)
    vx = (vx / mag) * combat.playerSpeed * dt
    vy = (vy / mag) * combat.playerSpeed * dt
    combat.playerX = Math.max(combat.playerRadius, Math.min(combat.worldWidth - combat.playerRadius, combat.playerX + vx))
    combat.playerY = Math.max(combat.playerRadius, Math.min(combat.worldHeight - combat.playerRadius, combat.playerY + vy))
  }

  // 2. Aim angle
  combat.playerAngle = Math.atan2(mouseY - combat.playerY, mouseX - combat.playerX)

  // 3. Attack cooldown
  combat.playerAttackElapsedMs += dtMs

  // 4. Bullet movement + boundary removal
  for (let i = combat.bullets.length - 1; i >= 0; i--) {
    const b = combat.bullets[i]!
    b.x += b.vx * dt
    b.y += b.vy * dt
    if (b.x < 0 || b.x > combat.worldWidth || b.y < 0 || b.y > combat.worldHeight) {
      combat.bullets.splice(i, 1)
    }
  }

  // 5. Bullet-enemy collision
  for (let bi = combat.bullets.length - 1; bi >= 0; bi--) {
    const b = combat.bullets[bi]!
    let hit = false
    for (const enemy of combat.enemies) {
      if (enemy.hp <= 0) continue
      const dx = b.x - enemy.x
      const dy = b.y - enemy.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < combat.bulletRadius + enemy.radius) {
        enemy.hp = Math.max(0, enemy.hp - b.damage)
        narrate(state, `${enemy.name}에게 타격. (${enemy.hp}/${enemy.maxHp})`)
        hit = true
        break
      }
    }
    if (hit) {
      combat.bullets.splice(bi, 1)
    }
  }

  // 6. Enemy AI
  for (const enemy of combat.enemies) {
    if (enemy.hp <= 0) continue

    // Move towards player
    const dx = combat.playerX - enemy.x
    const dy = combat.playerY - enemy.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const contactDist = enemy.radius + combat.playerRadius

    if (dist > contactDist) {
      const moveAmount = enemy.speed * dt
      const nx = dx / dist
      const ny = dy / dist
      enemy.x += nx * moveAmount
      enemy.y += ny * moveAmount
    }

    // Contact attack
    const currentDist = Math.sqrt((combat.playerX - enemy.x) ** 2 + (combat.playerY - enemy.y) ** 2)
    if (currentDist <= contactDist + 2) {
      enemy.attackElapsedMs += dtMs
      if (enemy.attackElapsedMs >= enemy.attackCooldownMs) {
        enemy.attackElapsedMs -= enemy.attackCooldownMs
        state.exploration.hp = Math.max(0, state.exploration.hp - enemy.damage)
        narrate(state, `${enemy.name}의 접촉 공격. (${state.exploration.hp}/${state.exploration.maxHp})`)
      }
    }
  }

  // 7. Potion cooldown
  combat.smallHealPotionCooldownRemainingMs = Math.max(0, combat.smallHealPotionCooldownRemainingMs - dtMs)
}
