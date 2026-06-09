import { DEFAULT_TEXTURE_GAMMA, normalizeTextureGamma } from "./colorWhiteness";

export type PlaygroundTextureAdjustments = {
  brightness: number;
  exposure: number;
  contrast: number;
  blackPoint: number;
  whitePoint: number;
  gamma: number;
  invert: boolean;
  posterizeLevels: number;
  thresholdBias: number;
  noiseAmount: number;
  blurRadius: number;
  sharpenAmount: number;
};

export const DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS: PlaygroundTextureAdjustments = {
  brightness: 0,
  exposure: 0,
  contrast: 1,
  blackPoint: 0,
  whitePoint: 1,
  gamma: DEFAULT_TEXTURE_GAMMA,
  invert: false,
  posterizeLevels: 0,
  thresholdBias: 0,
  noiseAmount: 0,
  blurRadius: 0,
  sharpenAmount: 0,
};

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numeric));
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  return Math.round(clampNumber(value, min, max, fallback));
}

export function normalizePlaygroundTextureAdjustments(
  input: Partial<PlaygroundTextureAdjustments> | undefined,
): PlaygroundTextureAdjustments {
  const base = DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS;
  if (!input) {
    return { ...base };
  }
  const blackPoint = clampNumber(input.blackPoint ?? base.blackPoint, 0, 1, base.blackPoint);
  const whitePoint = clampNumber(input.whitePoint ?? base.whitePoint, blackPoint + 0.01, 1, base.whitePoint);
  return {
    brightness: clampNumber(input.brightness ?? base.brightness, -1, 1, base.brightness),
    exposure: clampNumber(input.exposure ?? base.exposure, -5, 5, base.exposure),
    contrast: clampNumber(input.contrast ?? base.contrast, 0, 4, base.contrast),
    blackPoint,
    whitePoint,
    gamma: normalizeTextureGamma(Number(input.gamma ?? base.gamma)),
    invert: input.invert === true,
    posterizeLevels: clampInt(input.posterizeLevels ?? base.posterizeLevels, 0, 16, base.posterizeLevels),
    thresholdBias: clampNumber(input.thresholdBias ?? base.thresholdBias, -1, 1, base.thresholdBias),
    noiseAmount: clampNumber(input.noiseAmount ?? base.noiseAmount, 0, 1, base.noiseAmount),
    blurRadius: clampNumber(input.blurRadius ?? base.blurRadius, 0, 4, base.blurRadius),
    sharpenAmount: clampNumber(input.sharpenAmount ?? base.sharpenAmount, 0, 4, base.sharpenAmount),
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function lumaNoiseHash(col: number, row: number): number {
  const x = Math.sin((col + 17) * 12.9898 + (row + 31) * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function applyGamma(luma: number, gamma: number): number {
  const normalizedGamma = normalizeTextureGamma(gamma);
  if (normalizedGamma === 1) return luma;
  return Math.pow(luma, normalizedGamma);
}

export function applyTextureLuminanceAdjustments(
  luma01: number,
  adjustmentsInput: PlaygroundTextureAdjustments,
  col = 0,
  row = 0,
): number {
  const adjustments = normalizePlaygroundTextureAdjustments(adjustmentsInput);
  let value = clamp01(luma01);
  value = clamp01((value - adjustments.blackPoint) / (adjustments.whitePoint - adjustments.blackPoint));
  value = applyGamma(value, adjustments.gamma);
  value = clamp01(value * 2 ** adjustments.exposure);
  value = clamp01((value - 0.5) * adjustments.contrast + 0.5);
  value = clamp01(value + adjustments.brightness + adjustments.thresholdBias);
  if (adjustments.noiseAmount > 0) {
    value = clamp01(value + (lumaNoiseHash(col, row) * 2 - 1) * adjustments.noiseAmount);
  }
  if (adjustments.invert) {
    value = 1 - value;
  }
  if (adjustments.posterizeLevels >= 2) {
    const steps = adjustments.posterizeLevels - 1;
    value = Math.round(value * steps) / steps;
  }
  return clamp01(value);
}
