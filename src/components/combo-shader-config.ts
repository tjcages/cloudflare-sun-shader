export type ComboShaderConfig = {
  bgColor: string

  // Unified particle field
  planeWidth: number
  planeHeight: number
  gridSize: number
  driftSpeed: number

  // Wave noise (same field as the standalone wave shader)
  wavesScale: number
  waveSpeedX: number
  waveSpeedY: number
  displacement: number
  twist: number

  // Wave influence — where & how strongly the noise perturbs the field
  waveRadius: number
  waveSoft: number
  wavePulseSpeed: number
  wavePulseAmp: number
  waveStrength: number
  waveBoost: number
  waveBreathBias: number
  waveAspect: number
  waveBoundaryAmp: number
  waveBoundaryScale: number
  waveTravelSpeed: number
  waveTravelRange: number

  // Per-particle
  pointSize: number
  pointSizePeak: number
  sizeAttenuation: number

  valleyBrightness: number
  peakBrightness: number
  visibleThreshold: number
  shimmerAmp: number
  shimmerSpeed: number

  calmColor: string
  peakColor: string
  coreColor: string

  // Wisp shape (per-point sprite)
  dotRadius: number
  dotSoft: number
  coreAmp: number
  bloomFalloff: number
  bloomAmp: number
  overlapBloom: number

  cameraZ: number
  cameraY: number
  cameraFov: number
}

// @shader-config-start
export const COMBO_SHADER_DEFAULTS: ComboShaderConfig = {
  bgColor: "#FF5E1F",

  planeWidth: 58,
  planeHeight: 52,
  gridSize: 260,
  driftSpeed: 1.2,

  wavesScale: 2.6,
  waveSpeedX: 0.06,
  waveSpeedY: 0.38,
  displacement: 0.6,
  twist: 1.9,

  waveRadius: 12.5,
  waveSoft: 7,
  wavePulseSpeed: 0.23,
  wavePulseAmp: 0.28,
  waveStrength: 0.54,
  waveBoost: 4,
  waveBreathBias: 0,
  waveAspect: 0.5,
  waveBoundaryAmp: 0,
  waveBoundaryScale: 0.25,
  waveTravelSpeed: 1.6,
  waveTravelRange: 28,

  pointSize: 1.6,
  pointSizePeak: 3,
  sizeAttenuation: 320,

  valleyBrightness: 0.08,
  peakBrightness: 0.32,
  visibleThreshold: 0.23,
  shimmerAmp: 0.29,
  shimmerSpeed: 6,

  calmColor: "#FFB48A",
  peakColor: "#FFE6B6",
  coreColor: "#FFFDEE",

  dotRadius: 0.23,
  dotSoft: 1,
  coreAmp: 0.7,
  bloomFalloff: 18,
  bloomAmp: 0.3,
  overlapBloom: 0.04,

  cameraZ: 22,
  cameraY: 3.5,
  cameraFov: 55,
}
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
