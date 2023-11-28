const cubicBezier = (p0: number, p1: number, p2: number, p3: number, t: number) => p0 * (1 - t) * (1 - t) * (1 - t) + 3 * p1 * t * (1 - t) * (1 - t) + 3 * p2 * t * t * (1 - t) + p3 * t * t * t

export interface RafOptions {
  points?: [number, number, number, number]
  duration?: number
}

export const CUBIC_BEZIER_LINEAR: [number, number, number, number] = [0, 0, 1, 1]
export const CUBIC_BEZIER_EASE: [number, number, number, number] = [0.25, 0.25, 0.25, 1]
export const CUBIC_BEZIER_EASE_IN: [number, number, number, number] = [0.42, 0, 1, 1]
export const CUBIC_BEZIER_EASE_OUT: [number, number, number, number] = [0, 0, 0.58, 1]
export const CUBIC_BEZIER_EASE_IN_OUT: [number, number, number, number] = [0.42, 0, 0.58, 1]

export default (options: RafOptions) => {
  const {
    points = CUBIC_BEZIER_LINEAR,
    duration = 300,
  } = options

  let start: number | undefined
  let lashRafId: number | undefined
  let rafHandle: (rate: number) => void

  const raf = (timestamp: number) => {
    if (start === undefined) {
      start = timestamp
    }

    const elapsed = timestamp - start
    const progress = Math.min(elapsed / duration, 1)
    const processRate = cubicBezier(...points, progress)

    rafHandle?.(processRate)

    if (progress < 1) {
      lashRafId = window.requestAnimationFrame(raf)
    }
  }

  const cancelRaf = () => {
    if (lashRafId) {
      window.cancelAnimationFrame(lashRafId)
      lashRafId = undefined
    }
  }

  const startRaf = (handle: typeof rafHandle) => {
    cancelRaf()
    start = undefined
    rafHandle = handle
    window.requestAnimationFrame(raf)
  }

  return {
    startRaf,
    cancelRaf,
  }
}
