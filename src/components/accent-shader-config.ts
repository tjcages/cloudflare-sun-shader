import type { ShaderMountUniforms } from "@paper-design/shaders"

export type AccentShaderConfig = {
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
}

// @shader-config-start
export const ACCENT_SHADER_DEFAULTS = {
  speed: 0.25,
  bgColor: "#FF5E1F",
  driftSpeed: 8,
  cellSize: 7.3,
  wispStretch: 0.46,
  visibleThreshold: 0.5,
  visibleThresholdReveal: 0.3,
  dotRadius: 0.75,
  dotRadiusReveal: 1.5,
  dotSoft: 0.3,
  bloomSpread: 0.75,
  bloomSpreadReveal: 2.5,
  bloomNearSigma: 1,
  bloomNearAmp: 0,
  bloomFarSigma: 4,
  bloomFarAmp: 0.3,
  coreAmp: 0.22,
  overlapBloom: 0.28,
  shimmerAmp: 0.83,
  shimmerWaveSpeed: 2,
  shimmerWaveScale: 0.5,
  shimmerNoiseScale: 6,
  shimmerNoiseSpeed: 1.5,
  boltSpeed: 1.3,
  boltSpawnRate: 1.5,
  boltActiveThreshold: 0.78,
  boltWidth: 1.65,
  boltHaloWidth: 9.5,
  boltAmp: 0.12,
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
  radialFadeStart: 0,
  radialFadeEnd: 1.85,
  brightnessRevealBoost: 0.15,
  mouseRevealAmp: 0.1,
  mouseMotionSensitivity: 1,
  mouseRevealFadeMs: 650,
  revealRadius: 420,
  revealInner: 0.15,
  beamColor: "#C99191",
  beamYOffset: 0.035,
  beamRx: 380,
  beamRy: 190,
  semiStart: 0.5,
  semiEnd: 1.15,
  semiAmp: 0.5,
  haloRyScale: 2.5,
  haloSigma: 0.35,
  haloAmp: 0.45,
  coreBandY: 0.026,
  coreBandX: 280,
  coreBandAmp: 0.46,
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
  config: AccentShaderConfig,
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
  }
}
