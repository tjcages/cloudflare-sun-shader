/**
 * Timing helpers for the stripe-letter cycle animation in stripeLetterLayer.
 *
 * NOTE: Stubbed defaults — the playground export omitted this module.
 * Replace with the canonical implementation when it's exported.
 */

const INITIAL_DELAY_MIN_MS = 1200
const INITIAL_DELAY_RANGE_MS = 5400
const IDLE_DELAY_MIN_MS = 2800
const IDLE_DELAY_RANGE_MS = 4600
const STEP_DELAY_MIN_MS = 55
const STEP_DELAY_RANGE_MS = 75
const ITERATION_MIN = 3
const ITERATION_RANGE = 4

export function scheduleInitialLetterCycleAt(nowMs: number): number {
  return nowMs + INITIAL_DELAY_MIN_MS + Math.random() * INITIAL_DELAY_RANGE_MS
}

export function randomLetterCycleDelayMs(): number {
  return IDLE_DELAY_MIN_MS + Math.random() * IDLE_DELAY_RANGE_MS
}

export function randomLetterCycleStepDelayMs(): number {
  return STEP_DELAY_MIN_MS + Math.random() * STEP_DELAY_RANGE_MS
}

export function randomLetterCycleIterationCount(): number {
  return ITERATION_MIN + Math.floor(Math.random() * ITERATION_RANGE)
}
