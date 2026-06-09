import { bandUniformRgb } from "../colorSpace";
import type { Rgb01, Stripe, StripeColors } from "../types";
import { STRIPE_MAX_WIDTH_PX } from "./stripeGridConstants";

export function clampStripeWidth(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(STRIPE_MAX_WIDTH_PX, Math.max(1, value));
}

/** Stripe index (1-based; 0 = background) for a 0–1 luminance. */
export function stripeIndexForLuminance(luma01: number, stripes: readonly Stripe[]): number {
  let best = 0;
  let bestStart = -1;
  for (let i = 0; i < stripes.length; i++) {
    const entry = stripes[i]!;
    if (entry.startFrom <= luma01 && entry.startFrom > bestStart) {
      best = i + 1;
      bestStart = entry.startFrom;
    }
  }
  return best;
}

/** 256-entry lookup from luminance byte (0–255) to stripe index. */
export function buildStripeIndexLut(stripes: readonly Stripe[]): Uint8Array {
  const lut = new Uint8Array(256);
  for (let value = 0; value < 256; value++) {
    lut[value] = stripeIndexForLuminance(value / 255, stripes);
  }
  return lut;
}

/** Maps a per-cell luminance grid (0–255) to per-cell stripe indices via a LUT. */
export function resolveStripeIndices(luma: Uint8Array, stripes: readonly Stripe[]): Uint8Array {
  const lut = buildStripeIndexLut(stripes);
  const out = new Uint8Array(luma.length);
  for (let i = 0; i < luma.length; i++) {
    out[i] = lut[luma[i] ?? 0] ?? 0;
  }
  return out;
}

export type StripePaletteEntry = { rgb: Rgb01; width: number };

/** Per-stripe resolved color + width, in list order, for the palette texture. */
export function resolveStripePalette(colors: StripeColors, preferP3: boolean): StripePaletteEntry[] {
  return colors.stripes.map((entry) => ({
    rgb: bandUniformRgb(entry.hex, entry.p3Css, preferP3),
    width: clampStripeWidth(entry.width),
  }));
}

export function stripeAtIndex(colors: StripeColors, index: number): Stripe | undefined {
  if (index < 1 || index > colors.stripes.length) {
    return undefined;
  }
  return colors.stripes[index - 1];
}
