/** Rec.709 relative luminance, 0 (black) … 1 (white). */
export function pixelLuminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export type TextureLuminanceMode = "luminance" | "colors";

export type TextureLuminanceSettings = {
  mode: TextureLuminanceMode;
  backgroundColor: number;
};

export const DEFAULT_TEXTURE_LUMINANCE_MODE: TextureLuminanceMode = "luminance";
export const DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR = 0x000000;

export const DEFAULT_TEXTURE_GAMMA = 1;
export const TEXTURE_GAMMA_MIN = 0.05;
export const TEXTURE_GAMMA_MAX = 5;

export function normalizeTextureLuminanceMode(value: unknown): TextureLuminanceMode {
  return value === "colors" ? "colors" : DEFAULT_TEXTURE_LUMINANCE_MODE;
}

export function normalizeTextureLuminanceBackgroundColor(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value & 0xffffff;
  }
  if (typeof value === "string") {
    const trimmed = value.trim().replace(/^#/, "");
    if (/^[\da-f]{6}$/i.test(trimmed)) {
      const parsed = Number.parseInt(trimmed, 16);
      return Number.isFinite(parsed) ? parsed & 0xffffff : DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR;
    }
  }
  return DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR;
}

export function normalizeTextureGamma(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_TEXTURE_GAMMA;
  }
  return Math.max(TEXTURE_GAMMA_MIN, value);
}

export function colorDistanceLuminance(r: number, g: number, b: number, backgroundColor: number): number {
  const bg = normalizeTextureLuminanceBackgroundColor(backgroundColor);
  const br = (bg >> 16) & 0xff;
  const bgc = (bg >> 8) & 0xff;
  const bb = bg & 0xff;
  const dr = r - br;
  const dg = g - bgc;
  const db = b - bb;
  return Math.min(1, Math.sqrt(dr * dr + dg * dg + db * db) / (255 * Math.sqrt(3)));
}

export function pixelTextureLuminance(
  r: number,
  g: number,
  b: number,
  settings?: Partial<TextureLuminanceSettings>,
): number {
  return normalizeTextureLuminanceMode(settings?.mode) === "colors"
    ? colorDistanceLuminance(r, g, b, settings?.backgroundColor ?? DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR)
    : pixelLuminance(r, g, b);
}

/** Remap sampled texture luminance before stripe bucketing. */
export function applyTextureLuminanceGamma(luma01: number, gamma: number): number {
  const x = Math.min(1, Math.max(0, luma01));
  const normalizedGamma = normalizeTextureGamma(gamma);
  if (normalizedGamma === 1) {
    return x;
  }
  return Math.pow(x, normalizedGamma);
}
