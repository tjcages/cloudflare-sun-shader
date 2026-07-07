import {
  PORTRAIT_STYLE_DEFAULTS,
  type PortraitCompositionId,
  type PortraitStylePresetId,
  type PortraitStyleSettings,
} from "./profiles-portrait-types"

export type ProfilesShaderConfig = {
  preset: string
  // Image
  imageSrc: string
  depthSrc: string
  fit: string // "contain" | "cover"
  // Portrait standardization (pre-depth)
  portraitPreset: string
  portraitComposition: string
  portraitAutoProcess: boolean
  portraitRemoveBg: boolean
  portraitBgColor: string
  portraitExposure: number
  portraitContrast: number
  portraitWarmth: number
  portraitSaturation: number
  portraitSubjectScale: number
  portraitAnchorYOffset: number
  // Scene
  exposure: number
  ambientColor: string
  ambientIntensity: number
  /** 0 = keep the photo's natural colors (lights are additive accents),
   *  1 = fully re-grade with the ambient color. */
  tint: number
  depthScale: number
  normalDetail: number
  parallax: number
  showHelpers: boolean
  // Light 1
  light1Enabled: boolean
  light1Color: string
  light1Pos: readonly [number, number]
  light1Z: number
  light1Radius: number
  light1Intensity: number
  light1Diffuse: number
  light1Glow: number
  light1Animate: boolean
  light1Loop: string // "forward" | "pingpong"
  light1Speed: number
  light1Path: readonly (readonly [number, number])[]
  // Light 2
  light2Enabled: boolean
  light2Color: string
  light2Pos: readonly [number, number]
  light2Z: number
  light2Radius: number
  light2Intensity: number
  light2Diffuse: number
  light2Glow: number
  light2Animate: boolean
  light2Loop: string
  light2Speed: number
  light2Path: readonly (readonly [number, number])[]
  // Light 3
  light3Enabled: boolean
  light3Color: string
  light3Pos: readonly [number, number]
  light3Z: number
  light3Radius: number
  light3Intensity: number
  light3Diffuse: number
  light3Glow: number
  light3Animate: boolean
  light3Loop: string
  light3Speed: number
  light3Path: readonly (readonly [number, number])[]
  // Depth scan
  scanEnabled: boolean
  scanColor: string
  scanSpeed: number
  scanWidth: number
  scanIntensity: number
  /** "pingpong" | "back" (back→front loop) | "front" (front→back loop) */
  scanDirection: string
  // Overlay particles
  overlayMode: string // "off" | "ascii" | "hatch" | "pixel" | "dots"
  overlayScale: number
  overlayOpacity: number
  overlayColor: string
  overlayUseImage: boolean
  overlaySpeed: number
  overlayDepthMin: number
  /** Reveal particles only inside the depth-scan band (requires the scan). */
  overlayScanOnly: boolean
}

export function portraitSettingsFromConfig(
  config: ProfilesShaderConfig,
): PortraitStyleSettings {
  const preset = config.portraitPreset as PortraitStylePresetId
  return {
    preset,
    composition: config.portraitComposition as PortraitCompositionId,
    autoProcess: config.portraitAutoProcess,
    removeBackground: config.portraitRemoveBg,
    backgroundColor: config.portraitBgColor,
    exposure: config.portraitExposure,
    contrast: config.portraitContrast,
    warmth: config.portraitWarmth,
    saturation: config.portraitSaturation,
    subjectScale: config.portraitSubjectScale,
    anchorYOffset: config.portraitAnchorYOffset,
  }
}

export function portraitSettingsToConfig(
  settings: PortraitStyleSettings,
): Partial<ProfilesShaderConfig> {
  return {
    portraitPreset: settings.preset,
    portraitComposition: settings.composition,
    portraitAutoProcess: settings.autoProcess,
    portraitRemoveBg: settings.removeBackground,
    portraitBgColor: settings.backgroundColor,
    portraitExposure: settings.exposure,
    portraitContrast: settings.contrast,
    portraitWarmth: settings.warmth,
    portraitSaturation: settings.saturation,
    portraitSubjectScale: settings.subjectScale,
    portraitAnchorYOffset: settings.anchorYOffset,
  }
}

export const PROFILES_DEFAULT_IMAGE = "/profiles/michelle-zatlyn.jpg"
export const PROFILES_DEFAULT_DEPTH = "/profiles/michelle-zatlyn-depth.png"

/**
 * Lighting scenarios — everything except the image itself. Selecting one in
 * the panel applies the partial on top of the current config.
 *
 * "natural" is the base look: neutral ambient (tint 0) so the photo keeps its
 * own colors and the lights read as additive accents. The others are stylized
 * variants that re-grade the whole image (tint ~1).
 */
export const PROFILES_SHADER_PRESETS: Record<
  string,
  Partial<ProfilesShaderConfig>
> = {
  natural: {
    exposure: 1.0,
    ambientColor: "#ffffff",
    ambientIntensity: 1.0,
    tint: 0,
    depthScale: 0.55,
    normalDetail: 1.0,
    parallax: 0.05,
    light1Enabled: true,
    light1Color: "#ff5e1f",
    light1Pos: [-0.7, 0.3],
    light1Z: 0.6,
    light1Radius: 1.7,
    light1Intensity: 1.0,
    light1Diffuse: 0.55,
    light1Glow: 0.12,
    light2Enabled: true,
    light2Color: "#4d7dff",
    light2Pos: [0.75, -0.1],
    light2Z: 0.5,
    light2Radius: 1.7,
    light2Intensity: 0.8,
    light2Diffuse: 0.55,
    light2Glow: 0.1,
    light3Enabled: false,
    light3Color: "#ffb84d",
    light3Pos: [0, 0.8],
    light3Z: 0.7,
    light3Radius: 1.2,
    light3Intensity: 1.2,
    light3Diffuse: 0.4,
    light3Glow: 0.15,
    scanEnabled: false,
    scanColor: "#ff5e1f",
    scanSpeed: 0.25,
    scanWidth: 0.08,
    scanIntensity: 0.9,
    overlayMode: "off",
  },
  crimson: {
    exposure: 1.05,
    ambientColor: "#3a4a85",
    ambientIntensity: 1.5,
    tint: 1,
    depthScale: 0.55,
    normalDetail: 1.2,
    parallax: 0.05,
    light1Enabled: true,
    light1Color: "#ff2f18",
    light1Pos: [-0.75, 0.1],
    light1Z: 0.5,
    light1Radius: 1.9,
    light1Intensity: 2.8,
    light1Diffuse: 0.45,
    light1Glow: 0.35,
    light2Enabled: true,
    light2Color: "#1f4dff",
    light2Pos: [0.8, -0.05],
    light2Z: 0.45,
    light2Radius: 2.0,
    light2Intensity: 2.4,
    light2Diffuse: 0.5,
    light2Glow: 0.3,
    light3Enabled: false,
    scanEnabled: false,
    overlayMode: "off",
  },
  azure: {
    exposure: 1.0,
    ambientColor: "#0a1430",
    ambientIntensity: 0.85,
    tint: 1,
    depthScale: 0.55,
    normalDetail: 1.3,
    parallax: 0.05,
    light1Enabled: true,
    light1Color: "#37c8ff",
    light1Pos: [-0.6, 0.35],
    light1Z: 0.5,
    light1Radius: 1.8,
    light1Intensity: 2.0,
    light1Diffuse: 0.5,
    light1Glow: 0.4,
    light2Enabled: true,
    light2Color: "#2136ff",
    light2Pos: [0.7, -0.2],
    light2Z: 0.4,
    light2Radius: 1.6,
    light2Intensity: 1.7,
    light2Diffuse: 0.55,
    light2Glow: 0.35,
    light3Enabled: true,
    light3Color: "#b03cff",
    light3Pos: [0, 0.9],
    light3Z: 0.6,
    light3Radius: 1.3,
    light3Intensity: 1.1,
    light3Diffuse: 0.4,
    light3Glow: 0.25,
    scanEnabled: false,
    overlayMode: "off",
  },
  golden: {
    exposure: 1.1,
    ambientColor: "#43304a",
    ambientIntensity: 1.0,
    tint: 0.9,
    depthScale: 0.5,
    normalDetail: 1.1,
    parallax: 0.05,
    light1Enabled: true,
    light1Color: "#ffb347",
    light1Pos: [-0.55, 0.5],
    light1Z: 0.6,
    light1Radius: 2.0,
    light1Intensity: 2.2,
    light1Diffuse: 0.55,
    light1Glow: 0.3,
    light2Enabled: true,
    light2Color: "#ff6f91",
    light2Pos: [0.75, -0.1],
    light2Z: 0.4,
    light2Radius: 1.5,
    light2Intensity: 1.2,
    light2Diffuse: 0.5,
    light2Glow: 0.25,
    light3Enabled: false,
    scanEnabled: false,
    overlayMode: "off",
  },
  neon: {
    exposure: 1.0,
    ambientColor: "#071214",
    ambientIntensity: 0.7,
    tint: 1,
    depthScale: 0.6,
    normalDetail: 1.5,
    parallax: 0.07,
    light1Enabled: true,
    light1Color: "#00ff9d",
    light1Pos: [-0.7, 0.2],
    light1Z: 0.5,
    light1Radius: 1.5,
    light1Intensity: 2.1,
    light1Diffuse: 0.55,
    light1Glow: 0.35,
    light2Enabled: true,
    light2Color: "#ff2fd6",
    light2Pos: [0.7, 0.1],
    light2Z: 0.45,
    light2Radius: 1.5,
    light2Intensity: 1.9,
    light2Diffuse: 0.55,
    light2Glow: 0.35,
    light3Enabled: true,
    light3Color: "#00c8ff",
    light3Pos: [0, -0.7],
    light3Z: 0.5,
    light3Radius: 1.2,
    light3Intensity: 1.0,
    light3Diffuse: 0.4,
    light3Glow: 0.2,
    scanEnabled: false,
    overlayMode: "off",
  },
  scanline: {
    exposure: 1.0,
    ambientColor: "#1c1c22",
    ambientIntensity: 1.15,
    tint: 0.85,
    depthScale: 0.55,
    normalDetail: 1.0,
    parallax: 0.04,
    light1Enabled: true,
    light1Color: "#ff5e1f",
    light1Pos: [-0.4, 0.4],
    light1Z: 0.6,
    light1Radius: 1.8,
    light1Intensity: 1.4,
    light1Diffuse: 0.4,
    light1Glow: 0.2,
    light2Enabled: false,
    light3Enabled: false,
    scanEnabled: true,
    scanColor: "#ff5e1f",
    scanSpeed: 0.16,
    scanWidth: 0.24,
    scanIntensity: 0.35,
    scanDirection: "back",
    overlayMode: "ascii",
    overlayScanOnly: true,
    overlayScale: 110,
    overlayOpacity: 1.0,
    overlayColor: "#ff5e1f",
    overlayUseImage: false,
    overlaySpeed: 1.2,
    overlayDepthMin: 0,
  },
  ascii: {
    exposure: 1.0,
    ambientColor: "#ffffff",
    ambientIntensity: 1.0,
    tint: 0,
    depthScale: 0.55,
    normalDetail: 1.0,
    parallax: 0.05,
    light1Enabled: true,
    light1Color: "#ff5e1f",
    light1Pos: [-0.7, 0.3],
    light1Z: 0.6,
    light1Radius: 1.7,
    light1Intensity: 1.2,
    light1Diffuse: 0.5,
    light1Glow: 0.15,
    light2Enabled: true,
    light2Color: "#4d7dff",
    light2Pos: [0.75, -0.1],
    light2Z: 0.5,
    light2Radius: 1.7,
    light2Intensity: 0.9,
    light2Diffuse: 0.5,
    light2Glow: 0.1,
    light3Enabled: false,
    scanEnabled: true,
    scanColor: "#4d7dff",
    scanSpeed: 0.18,
    scanWidth: 0.3,
    scanIntensity: 0.25,
    scanDirection: "back",
    overlayMode: "ascii",
    overlayScanOnly: true,
    overlayScale: 100,
    overlayOpacity: 1.0,
    overlayColor: "#9ecbff",
    overlayUseImage: false,
    overlaySpeed: 1.5,
    overlayDepthMin: 0,
  },
}

// @shader-config-start
export const PROFILES_SHADER_DEFAULTS: ProfilesShaderConfig = {
  preset: "natural",
  imageSrc: PROFILES_DEFAULT_IMAGE,
  depthSrc: PROFILES_DEFAULT_DEPTH,
  fit: "contain",
  portraitPreset: PORTRAIT_STYLE_DEFAULTS.preset,
  portraitComposition: PORTRAIT_STYLE_DEFAULTS.composition,
  portraitAutoProcess: PORTRAIT_STYLE_DEFAULTS.autoProcess,
  portraitRemoveBg: PORTRAIT_STYLE_DEFAULTS.removeBackground,
  portraitBgColor: PORTRAIT_STYLE_DEFAULTS.backgroundColor,
  portraitExposure: PORTRAIT_STYLE_DEFAULTS.exposure,
  portraitContrast: PORTRAIT_STYLE_DEFAULTS.contrast,
  portraitWarmth: PORTRAIT_STYLE_DEFAULTS.warmth,
  portraitSaturation: PORTRAIT_STYLE_DEFAULTS.saturation,
  portraitSubjectScale: PORTRAIT_STYLE_DEFAULTS.subjectScale,
  portraitAnchorYOffset: PORTRAIT_STYLE_DEFAULTS.anchorYOffset,
  exposure: 1.0,
  ambientColor: "#ffffff",
  ambientIntensity: 1.0,
  tint: 0,
  depthScale: 0.55,
  normalDetail: 1.0,
  parallax: 0.05,
  showHelpers: false,
  light1Enabled: true,
  light1Color: "#ff5e1f",
  light1Pos: [-0.7, 0.3],
  light1Z: 0.6,
  light1Radius: 1.7,
  light1Intensity: 1.0,
  light1Diffuse: 0.55,
  light1Glow: 0.12,
  light1Animate: false,
  light1Loop: "forward",
  light1Speed: 0.6,
  light1Path: [],
  light2Enabled: true,
  light2Color: "#4d7dff",
  light2Pos: [0.75, -0.1],
  light2Z: 0.5,
  light2Radius: 1.7,
  light2Intensity: 0.8,
  light2Diffuse: 0.55,
  light2Glow: 0.1,
  light2Animate: false,
  light2Loop: "forward",
  light2Speed: 0.6,
  light2Path: [],
  light3Enabled: false,
  light3Color: "#ffb84d",
  light3Pos: [0, 0.8],
  light3Z: 0.7,
  light3Radius: 1.2,
  light3Intensity: 1.2,
  light3Diffuse: 0.4,
  light3Glow: 0.15,
  light3Animate: false,
  light3Loop: "forward",
  light3Speed: 0.6,
  light3Path: [],
  scanEnabled: false,
  scanColor: "#ff5e1f",
  scanSpeed: 0.18,
  scanWidth: 0.2,
  scanIntensity: 0.9,
  scanDirection: "back",
  overlayMode: "off",
  overlayScale: 100,
  overlayOpacity: 1.0,
  overlayColor: "#ff5e1f",
  overlayUseImage: false,
  overlaySpeed: 0.5,
  overlayDepthMin: 0,
  overlayScanOnly: true,
}
// @shader-config-end
