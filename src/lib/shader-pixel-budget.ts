/**
 * Caps ShaderMount (@paper-design/shaders) internal resolution on high-DPR screens.
 *
 * Retina DPR 2 can make a “1080p” hero shade near 4K (~4× fragment cost). A pixel
 * budget scales renderScale down on resize — same idea as:
 *   min(devicePixelRatio, 1.5, sqrt(maxPixels / (width * height)))
 */
export const SHADER_PIXEL_BUDGET = {
  /** ~1080p-equivalent fragment count at 1×; mount scales down when the element is larger. */
  maxPixelCount: 1_350_000,
  /** Floor for antialiasing on 1× displays; combined with maxPixelCount on Retina. */
  minPixelRatio: 1.35,
} as const
