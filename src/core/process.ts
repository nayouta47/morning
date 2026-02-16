export function advanceCycleProgress(
  progressMs: number,
  elapsedMs: number,
  cycleMs: number,
): { nextProgressMs: number; cycles: number } {
  const total = progressMs + elapsedMs
  const cycles = Math.floor(total / cycleMs)
  const nextProgressMs = total - cycles * cycleMs
  return { nextProgressMs, cycles }
}

export function advanceCountdownProcess(
  remainingMs: number,
  elapsedMs: number,
): { nextRemainingMs: number; completed: boolean } {
  const nextRemainingMs = Math.max(0, remainingMs - elapsedMs)
  return {
    nextRemainingMs,
    completed: remainingMs > 0 && nextRemainingMs <= 0,
  }
}
