/** Standard portrait output dimensions (3:4). Height is a multiple of 16 for FLUX. */
export const PORTRAIT_OUTPUT_WIDTH = 896
export const PORTRAIT_OUTPUT_HEIGHT = 1200

export type PortraitStylePresetId =
  | "studio"
  | "studioWarm"
  | "studioCool"
  | "cloudflare"
  | "natural"

/** Standardized framing scenario — controls where the subject sits in frame. */
export type PortraitCompositionId =
  | "headshot"
  | "stage"
  | "speaker"
  | "close"

export type PortraitCompositionTemplate = {
  id: PortraitCompositionId
  label: string
  /** What the AI re-photographs — new scene, not cutout repositioning. */
  description: string
}

export const PORTRAIT_COMPOSITIONS: Record<
  PortraitCompositionId,
  PortraitCompositionTemplate
> = {
  headshot: {
    id: "headshot",
    label: "Team headshot",
    description:
      "Regenerate as a front-on corporate studio portrait — centered, shoulders in frame.",
  },
  stage: {
    id: "stage",
    label: "Stage center",
    description:
      "Regenerate as a keynote speaker on stage — seated, spotlight, wide framing.",
  },
  speaker: {
    id: "speaker",
    label: "Speaker",
    description:
      "Regenerate as a chest-up presentation portrait — three-quarter angle, clean studio.",
  },
  close: {
    id: "close",
    label: "Close profile",
    description:
      "Professional headshot cropped at the shoulders — directory / avatar style.",
  },
}

export type PortraitStyleSettings = {
  preset: PortraitStylePresetId
  composition: PortraitCompositionId
  removeBackground: boolean
  backgroundColor: string
  exposure: number
  contrast: number
  warmth: number
  saturation: number
  /** Fine-tune subject scale on top of the composition template. */
  subjectScale: number
  /** Shift face anchor vertically (− = higher in frame, + = lower). */
  anchorYOffset: number
  /** Auto-standardize on upload. */
  autoProcess: boolean
}

export const PORTRAIT_STYLE_PRESETS: Record<
  PortraitStylePresetId,
  Omit<
    PortraitStyleSettings,
    "preset" | "autoProcess" | "composition" | "subjectScale" | "anchorYOffset"
  >
> = {
  studio: {
    removeBackground: true,
    backgroundColor: "#e8e8ec",
    exposure: 1.05,
    contrast: 1.08,
    warmth: 0,
    saturation: 0.95,
  },
  studioWarm: {
    removeBackground: true,
    backgroundColor: "#f5f0ea",
    exposure: 1.08,
    contrast: 1.05,
    warmth: 0.12,
    saturation: 0.98,
  },
  studioCool: {
    removeBackground: true,
    backgroundColor: "#e8edf2",
    exposure: 1.04,
    contrast: 1.1,
    warmth: -0.08,
    saturation: 0.92,
  },
  cloudflare: {
    removeBackground: true,
    backgroundColor: "#ff5e1f",
    exposure: 1.02,
    contrast: 1.03,
    warmth: 0.02,
    saturation: 0.98,
  },
  natural: {
    removeBackground: false,
    backgroundColor: "#ffffff",
    exposure: 1.0,
    contrast: 1.0,
    warmth: 0,
    saturation: 1.0,
  },
}

export const PORTRAIT_STYLE_DEFAULTS: PortraitStyleSettings = {
  preset: "cloudflare",
  composition: "headshot",
  autoProcess: false,
  subjectScale: 1.0,
  anchorYOffset: 0,
  ...PORTRAIT_STYLE_PRESETS.cloudflare,
}

export type PortraitFaceBox = {
  x: number
  y: number
  width: number
  height: number
}

export type PortraitFaceAnalysis = {
  /** Normalized face bounding box in [0, 1]. */
  faceBox: PortraitFaceBox
  /** Normalized face center in [0, 1]. */
  center: readonly [number, number]
  /** Normalized forehead point in [0, 1]. */
  forehead: readonly [number, number]
  /** Normalized chin point in [0, 1]. */
  chin: readonly [number, number]
  confidence: number
}

export type PortraitProgressHandler = (message: string) => void
