/**
 * Stripe-width pulse driver. Matches the sparkle file's shape so the same
 * "active percent" / "speed" slider scheme can drive it.
 *
 * NOTE: This module was missing from the playground export; it's stubbed here
 * with sensible defaults inferred from how the shader's `uWidthShuffle*`
 * uniforms are used. Replace with the canonical version when the playground
 * exports it next time.
 */

export type PlaygroundWidthShuffleOptions = {
  enabled: boolean
  /** Fraction of cells (0–1) running a width pulse at the same time. */
  coverage: number
  periodMinSec: number
  periodMaxSec: number
}

export const WIDTH_SHUFFLE_BASE_PERIOD_MIN_SEC = 0.45
export const WIDTH_SHUFFLE_BASE_PERIOD_MAX_SEC = 1.1
export const DEFAULT_PLAYGROUND_SPARKLE_WIDTH_ACTIVE_PERCENT = 0.18
export const DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED = 1

export const DEFAULT_PLAYGROUND_WIDTH_SHUFFLE_OPTIONS: PlaygroundWidthShuffleOptions =
  {
    enabled: false,
    coverage: DEFAULT_PLAYGROUND_SPARKLE_WIDTH_ACTIVE_PERCENT,
    periodMinSec: WIDTH_SHUFFLE_BASE_PERIOD_MIN_SEC,
    periodMaxSec: WIDTH_SHUFFLE_BASE_PERIOD_MAX_SEC,
  }

export function normalizeWidthShuffleActivePercent(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PLAYGROUND_SPARKLE_WIDTH_ACTIVE_PERCENT
  }
  const ratio = value > 1 ? value / 100 : value
  return Math.min(1, Math.max(0, Math.round(ratio * 1000) / 1000))
}

export function normalizeWidthShuffleSpeed(speed: number): number {
  if (!Number.isFinite(speed)) {
    return DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED
  }
  return Math.max(0.05, Math.round(speed * 1000) / 1000)
}

export function playgroundWidthShuffleOptionsFromSliders(
  activeRatio: number,
  speedFactor: number,
): PlaygroundWidthShuffleOptions {
  const coverage = normalizeWidthShuffleActivePercent(activeRatio)
  const speed = normalizeWidthShuffleSpeed(speedFactor)
  return {
    enabled: coverage > 0,
    coverage,
    periodMinSec: WIDTH_SHUFFLE_BASE_PERIOD_MIN_SEC / speed,
    periodMaxSec: WIDTH_SHUFFLE_BASE_PERIOD_MAX_SEC / speed,
  }
}

export function resolvePersistedSparkleWidthActivePercent(config: {
  sparkleWidthActivePercent?: number
}): number {
  if (config.sparkleWidthActivePercent !== undefined) {
    return normalizeWidthShuffleActivePercent(config.sparkleWidthActivePercent)
  }
  return 0
}

export function resolvePersistedSparkleWidthSpeed(config: {
  sparkleWidthSpeed?: number
}): number {
  if (config.sparkleWidthSpeed !== undefined) {
    return normalizeWidthShuffleSpeed(config.sparkleWidthSpeed)
  }
  return DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED
}
