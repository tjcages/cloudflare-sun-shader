import type { ShaderMountUniforms } from "@paper-design/shaders"

/**
 * Sun v3 — "Waterfall". Sun particle/beam knobs plus the polar-grid controls:
 *   pivotY      — virtual focal point above the screen (in units of viewH).
 *                 Negative values place it above; more negative ⇒ shallower
 *                 curvature.
 *   angleScale  — unwrapped pixels per radian. Higher ⇒ more wisps fitting
 *                 across the visible angular sweep (denser horizontally).
 *   depthBoost  — extra brightness for wisps far from pivot (bottom of screen
 *                 reads "closer to viewer" in the waterfall metaphor).
 */
export type AccentShaderV3Config = {
  speed: number
  bgColor: string
  driftSpeed: number
  cellSize: number
  wispStretch: number
  visibleThreshold: number
  visibleThresholdReveal: number
  dotRadius: number
  dotRadiusReveal: number
  dotSoft: number
  bloomSpread: number
  bloomSpreadReveal: number
  bloomNearSigma: number
  bloomNearAmp: number
  bloomFarSigma: number
  bloomFarAmp: number
  coreAmp: number
  overlapBloom: number
  shimmerAmp: number
  shimmerWaveSpeed: number
  shimmerWaveScale: number
  shimmerNoiseScale: number
  shimmerNoiseSpeed: number
  boltSpeed: number
  boltSpawnRate: number
  boltActiveThreshold: number
  boltWidth: number
  boltHaloWidth: number
  boltAmp: number
  boltCount: number
  boltPulseLength: number
  boltSteps: number
  boltStartExtend: number
  boltEndExtend: number
  boltFromCenterMin: number
  boltFromCenterMax: number
  boltEdgeBias: number
  boltCenterExclusion: number
  boltSpread: number
  radialFadeStart: number
  radialFadeEnd: number
  brightnessRevealBoost: number
  mouseRevealAmp: number
  mouseMotionSensitivity: number
  mouseRevealFadeMs: number
  revealRadius: number
  revealInner: number
  beamColor: string
  beamYOffset: number
  beamRx: number
  beamRy: number
  semiStart: number
  semiEnd: number
  semiAmp: number
  haloRyScale: number
  haloSigma: number
  haloAmp: number
  coreBandY: number
  coreBandX: number
  coreBandAmp: number
  heatPulseSpeed: number
  heatRippleSpeed: number
  heatRippleScale: number
  heatMaskSigma: number
  heatPulseAmp: number
  heatRippleAmp: number
  beamBottomFade: number
  illumRadius: number
  illumColor: string
  illumAmp: number
  // V3 polar-waterfall
  pivotY: number
  pivotX: number
  angleScale: number
  rotation: number
  fallSwirl: number
  tangentStretch: number
  trailLength: number
  depthBoost: number
}

// @shader-config-start
export const ACCENT_SHADER_V3_DEFAULTS = {
  speed: 0.21,
  bgColor: "#FF5E1F",
  driftSpeed: 26,
  cellSize: 9.1,
  wispStretch: 0.29,
  visibleThreshold: 0.07,
  visibleThresholdReveal: 0,
  dotRadius: 1,
  dotRadiusReveal: 1.4,
  dotSoft: 0.38,
  bloomSpread: 0.95,
  bloomSpreadReveal: 2.5,
  bloomNearSigma: 1.4,
  bloomNearAmp: 0.08,
  bloomFarSigma: 6,
  bloomFarAmp: 0.32,
  coreAmp: 0.28,
  overlapBloom: 0.34,
  shimmerAmp: 0.7,
  shimmerWaveSpeed: 2.4,
  shimmerWaveScale: 0.7,
  shimmerNoiseScale: 5,
  shimmerNoiseSpeed: 1.4,
  boltSpeed: 1.3,
  boltSpawnRate: 1.5,
  boltActiveThreshold: 0.78,
  boltWidth: 1.65,
  boltHaloWidth: 9.5,
  boltAmp: 0,
  boltCount: 10,
  boltPulseLength: 0.48,
  boltSteps: 10,
  boltStartExtend: 1,
  boltEndExtend: 0,
  boltFromCenterMin: 0.71,
  boltFromCenterMax: 1,
  boltEdgeBias: 0.85,
  boltCenterExclusion: 0.32,
  boltSpread: 50,
  radialFadeStart: 0.05,
  radialFadeEnd: 1.5,
  brightnessRevealBoost: 0.18,
  mouseRevealAmp: 0.12,
  mouseMotionSensitivity: 1,
  mouseRevealFadeMs: 650,
  revealRadius: 420,
  revealInner: 0.15,
  beamColor: "#FFD08A",
  beamYOffset: 0.03,
  beamRx: 380,
  beamRy: 190,
  semiStart: 0.55,
  semiEnd: 1.15,
  semiAmp: 0.35,
  haloRyScale: 2.5,
  haloSigma: 0.35,
  haloAmp: 0.32,
  coreBandY: 0.026,
  coreBandX: 280,
  coreBandAmp: 0.34,
  heatPulseSpeed: 3.95,
  heatRippleSpeed: 4,
  heatRippleScale: 18,
  heatMaskSigma: 0.35,
  heatPulseAmp: 0.035,
  heatRippleAmp: 0.018,
  beamBottomFade: 0,
  illumRadius: 1400,
  illumColor: "#FFD9B3",
  illumAmp: 0,
  pivotY: -1.3,
  pivotX: 0,
  angleScale: 2980,
  rotation: -1.03,
  fallSwirl: 0,
  tangentStretch: 2.26,
  trailLength: 1,
  depthBoost: 0.48,
} as const
// @shader-config-end

export function hexToRgb01(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "").trim()
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized
  const n = Number.parseInt(full, 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  return [r, g, b]
}

export function configToShaderUniforms(
  config: AccentShaderV3Config,
): ShaderMountUniforms {
  return {
    u_bg: hexToRgb01(config.bgColor),
    u_driftSpeed: config.driftSpeed,
    u_cellSize: config.cellSize,
    u_wispStretch: config.wispStretch,
    u_visibleThreshold: config.visibleThreshold,
    u_visibleThresholdReveal: config.visibleThresholdReveal,
    u_dotRadius: config.dotRadius,
    u_dotRadiusReveal: config.dotRadiusReveal,
    u_dotSoft: config.dotSoft,
    u_bloomSpread: config.bloomSpread,
    u_bloomSpreadReveal: config.bloomSpreadReveal,
    u_bloomNearSigma: config.bloomNearSigma,
    u_bloomNearAmp: config.bloomNearAmp,
    u_bloomFarSigma: config.bloomFarSigma,
    u_bloomFarAmp: config.bloomFarAmp,
    u_coreAmp: config.coreAmp,
    u_overlapBloom: config.overlapBloom,
    u_shimmerAmp: config.shimmerAmp,
    u_shimmerWaveSpeed: config.shimmerWaveSpeed,
    u_shimmerWaveScale: config.shimmerWaveScale,
    u_shimmerNoiseScale: config.shimmerNoiseScale,
    u_shimmerNoiseSpeed: config.shimmerNoiseSpeed,
    u_boltSpeed: config.boltSpeed,
    u_boltSpawnRate: config.boltSpawnRate,
    u_boltActiveThreshold: config.boltActiveThreshold,
    u_boltWidth: config.boltWidth,
    u_boltHaloWidth: config.boltHaloWidth,
    u_boltAmp: config.boltAmp,
    u_boltCount: config.boltCount,
    u_boltPulseLength: config.boltPulseLength,
    u_boltSteps: config.boltSteps,
    u_boltStartExtend: config.boltStartExtend,
    u_boltEndExtend: config.boltEndExtend,
    u_boltFromCenterMin: config.boltFromCenterMin,
    u_boltFromCenterMax: config.boltFromCenterMax,
    u_boltEdgeBias: config.boltEdgeBias,
    u_boltCenterExclusion: config.boltCenterExclusion,
    u_boltSpread: config.boltSpread,
    u_radialFadeStart: config.radialFadeStart,
    u_radialFadeEnd: config.radialFadeEnd,
    u_brightnessRevealBoost: config.brightnessRevealBoost,
    u_mouseRevealAmp: config.mouseRevealAmp,
    u_revealRadius: config.revealRadius,
    u_revealInner: config.revealInner,
    u_beamColor: hexToRgb01(config.beamColor),
    u_beamYOffset: config.beamYOffset,
    u_beamRx: config.beamRx,
    u_beamRy: config.beamRy,
    u_semiStart: config.semiStart,
    u_semiEnd: config.semiEnd,
    u_semiAmp: config.semiAmp,
    u_haloRyScale: config.haloRyScale,
    u_haloSigma: config.haloSigma,
    u_haloAmp: config.haloAmp,
    u_coreBandY: config.coreBandY,
    u_coreBandX: config.coreBandX,
    u_coreBandAmp: config.coreBandAmp,
    u_heatPulseSpeed: config.heatPulseSpeed,
    u_heatRippleSpeed: config.heatRippleSpeed,
    u_heatRippleScale: config.heatRippleScale,
    u_heatMaskSigma: config.heatMaskSigma,
    u_heatPulseAmp: config.heatPulseAmp,
    u_heatRippleAmp: config.heatRippleAmp,
    u_beamBottomFade: config.beamBottomFade,
    u_illumRadius: config.illumRadius,
    u_illumColor: hexToRgb01(config.illumColor),
    u_illumAmp: config.illumAmp,
    u_pivotY: config.pivotY,
    u_pivotX: config.pivotX,
    u_angleScale: config.angleScale,
    u_rotation: config.rotation,
    u_fallSwirl: config.fallSwirl,
    u_tangentStretch: config.tangentStretch,
    u_trailLength: config.trailLength,
    u_depthBoost: config.depthBoost,
  }
}
