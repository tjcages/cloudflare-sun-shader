export type WaveShaderConfig = {
  wavesX: number
  wavesY: number
  displacementHeight: number
  speedX: number
  speedY: number
  primaryColor: string
  valleyColor: string
  peakColor: string
  visibleBand: number
  visibleFade: number
  cameraZ: number
  cameraY: number
  cameraFov: number
}

export const WAVE_SHADER_DEFAULTS = {
  wavesX: 3,
  wavesY: 3,
  displacementHeight: 3,
  speedX: 0.01,
  speedY: 0.05,
  primaryColor: "#15171C",
  valleyColor: "#160AFF",
  peakColor: "#635BFF",
  visibleBand: 1,
  visibleFade: 0,
  cameraZ: 18,
  cameraY: 4,
  cameraFov: 55,
} as const
