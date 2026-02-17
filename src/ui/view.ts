export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function formatActionTime(progress: number, totalMs: number, isActive: boolean): string {
  const totalSec = totalMs / 1000
  if (!isActive) return `- / ${totalSec.toFixed(1)}s`
  const remainingSec = (1 - clamp01(progress)) * totalSec
  return `${remainingSec.toFixed(1)}s / ${totalSec.toFixed(1)}s`
}

export function setText(app: ParentNode, selector: string, text: string): void {
  const node = app.querySelector<HTMLElement>(selector)
  if (node && node.textContent !== text) node.textContent = text
}

export function setHidden(app: ParentNode, selector: string, hidden: boolean): void {
  const node = app.querySelector<HTMLElement>(selector)
  if (!node) return
  if (hidden) node.setAttribute('hidden', '')
  else node.removeAttribute('hidden')
}

export function getEventTargetElement(eventTarget: EventTarget | null): Element | null {
  if (!eventTarget) return null
  if (eventTarget instanceof Element) return eventTarget
  if (eventTarget instanceof Node) return eventTarget.parentElement
  return null
}
