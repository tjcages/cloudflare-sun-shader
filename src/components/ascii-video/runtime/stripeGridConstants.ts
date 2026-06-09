export const STRIPE_CELL_SIZE = 7;
export const STRIPE_BLOCK_SAMPLES = 7;
export const STRIPE_BLOCK_SAMPLE_COUNT = STRIPE_BLOCK_SAMPLES * STRIPE_BLOCK_SAMPLES;

export const STRIPE_INDEX_NONE = 0;
/** Largest stripe index that fits in the block-map red channel (1 byte). */
export const STRIPE_INDEX_MAX = 255;
/** Stripe thickness ceiling in px (equals the cell size). */
export const STRIPE_MAX_WIDTH_PX = 7;

/** Block-map red channel stores the stripe index directly (0 = background, 1…N). */
export function encodeStripeIndex(index: number): number {
  if (index <= STRIPE_INDEX_NONE) {
    return STRIPE_INDEX_NONE;
  }
  return Math.min(STRIPE_INDEX_MAX, Math.round(index));
}

export function decodeStripeIndex(encoded: number): number {
  return Math.max(STRIPE_INDEX_NONE, Math.min(STRIPE_INDEX_MAX, Math.round(encoded)));
}
