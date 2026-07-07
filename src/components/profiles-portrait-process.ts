/**
 * Portrait standardization — AI recomposition per scenario, then optional
 * color grading. No cutout-and-reposition; each scenario regenerates the photo.
 */

import { recomposePortraitWithAi } from "./profiles-portrait-ai"
import {
  compositeCutoutOnBackground,
  imageDataToObjectUrl,
} from "./profiles-portrait-background"
import { removePortraitBackground } from "./profiles-portrait-bg"
import { analyzePortraitFace } from "./profiles-portrait-face"
import type {
  PortraitFaceAnalysis,
  PortraitProgressHandler,
  PortraitStyleSettings,
} from "./profiles-portrait-types"

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Failed to load image"))
    img.src = src
  })
}

/** Apply exposure, contrast, warmth, and saturation to RGBA pixels. */
function applyColorGrade(
  data: Uint8ClampedArray,
  settings: Pick<
    PortraitStyleSettings,
    "exposure" | "contrast" | "warmth" | "saturation"
  >,
): void {
  const { exposure, contrast, warmth, saturation } = settings
  const contrastFactor = contrast
  const contrastOffset = 128 * (1 - contrast)

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] * exposure
    let g = data[i + 1] * exposure
    let b = data[i + 2] * exposure

    r += warmth * 30
    b -= warmth * 30

    r = (r - contrastOffset) * contrastFactor + contrastOffset
    g = (g - contrastOffset) * contrastFactor + contrastOffset
    b = (b - contrastOffset) * contrastFactor + contrastOffset

    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    r = lum + (r - lum) * saturation
    g = lum + (g - lum) * saturation
    b = lum + (b - lum) * saturation

    data[i] = Math.max(0, Math.min(255, Math.round(r)))
    data[i + 1] = Math.max(0, Math.min(255, Math.round(g)))
    data[i + 2] = Math.max(0, Math.min(255, Math.round(b)))
  }
}

async function applyStyleGrade(
  imageUrl: string,
  settings: PortraitStyleSettings,
): Promise<string> {
  const img = await loadImage(imageUrl)
  const canvas = document.createElement("canvas")
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas 2D context unavailable")
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  applyColorGrade(imageData.data, settings)
  ctx.putImageData(imageData, 0, 0)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  )
  if (!blob) throw new Error("Failed to encode portrait PNG")
  return URL.createObjectURL(blob)
}

async function applyPortraitFinish(
  imageUrl: string,
  settings: PortraitStyleSettings,
  onProgress?: PortraitProgressHandler,
): Promise<string> {
  let url = imageUrl

  if (settings.removeBackground) {
    onProgress?.("Replacing background…")
    const cutout = await removePortraitBackground(url, onProgress)
    const composited = compositeCutoutOnBackground(
      cutout,
      settings.backgroundColor,
    )
    url = await imageDataToObjectUrl(composited)
  }

  onProgress?.("Applying color grade…")
  return applyStyleGrade(url, settings)
}

export type ProcessPortraitResult = {
  url: string
  faceAnalysis: PortraitFaceAnalysis
  /** Raw AI output before color grading — reuse for look-only tweaks. */
  aiUrl: string
}

/**
 * Full pipeline:
 * 1. Optional face check (likeness validation hint)
 * 2. AI recomposition — new photograph in the chosen scenario
 * 3. Color grade from the look preset
 */
export async function processPortrait(
  imageSrc: string,
  settings: PortraitStyleSettings,
  onProgress?: PortraitProgressHandler,
  existingFaceAnalysis?: PortraitFaceAnalysis,
): Promise<ProcessPortraitResult> {
  const faceAnalysis =
    existingFaceAnalysis ??
    (await analyzePortraitFace(imageSrc, onProgress))

  const aiUrl = await recomposePortraitWithAi(
    imageSrc,
    settings.composition,
    onProgress,
    faceAnalysis,
  )

  const url = await applyPortraitFinish(aiUrl, settings, onProgress)

  return { url, faceAnalysis, aiUrl }
}

/** Color grade only — use when composition is unchanged. */
export async function regradePortrait(
  aiImageUrl: string,
  settings: PortraitStyleSettings,
  onProgress?: PortraitProgressHandler,
): Promise<string> {
  return applyPortraitFinish(aiImageUrl, settings, onProgress)
}
