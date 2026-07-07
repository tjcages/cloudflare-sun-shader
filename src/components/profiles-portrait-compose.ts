/**
 * Compose a standardized portrait by scaling and positioning the subject
 * so the face lands at a consistent anchor for each composition scenario.
 */

import type {
  PortraitCompositionId,
  PortraitFaceAnalysis,
  PortraitStyleSettings,
} from "./profiles-portrait-types"
import {
  PORTRAIT_COMPOSITIONS,
  PORTRAIT_OUTPUT_HEIGHT,
  PORTRAIT_OUTPUT_WIDTH,
} from "./profiles-portrait-types"

function parseHexColor(hex: string): [number, number, number] {
  const h = hex.replace("#", "")
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ]
}

function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = imageData.width
  canvas.height = imageData.height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas 2D context unavailable")
  ctx.putImageData(imageData, 0, 0)
  return canvas
}

/**
 * Place the subject on a solid background at standard dimensions.
 * Face center is mapped to the composition template anchor.
 */
export function composePortrait(
  source: ImageData,
  face: PortraitFaceAnalysis,
  settings: Pick<
    PortraitStyleSettings,
    "composition" | "backgroundColor" | "subjectScale" | "anchorYOffset"
  >,
): ImageData {
  const outW = PORTRAIT_OUTPUT_WIDTH
  const outH = PORTRAIT_OUTPUT_HEIGHT
  const template = PORTRAIT_COMPOSITIONS[settings.composition]

  const canvas = document.createElement("canvas")
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas 2D context unavailable")

  const [br, bg, bb] = parseHexColor(settings.backgroundColor)
  ctx.fillStyle = `rgb(${br}, ${bg}, ${bb})`
  ctx.fillRect(0, 0, outW, outH)

  const faceHeightPx = face.faceBox.height * source.height
  const faceCx = face.center[0] * source.width
  const faceCy = face.center[1] * source.height

  const targetFaceH = outH * template.faceHeightRatio
  const scale =
    (targetFaceH / Math.max(faceHeightPx, 1)) *
    template.subjectScale *
    settings.subjectScale

  const anchorX = outW * template.faceAnchor[0]
  const anchorY = outH * (template.faceAnchor[1] + settings.anchorYOffset)

  const drawW = source.width * scale
  const drawH = source.height * scale
  const drawX = anchorX - faceCx * scale
  const drawY = anchorY - faceCy * scale

  const sourceCanvas = imageDataToCanvas(source)
  ctx.drawImage(sourceCanvas, drawX, drawY, drawW, drawH)

  return ctx.getImageData(0, 0, outW, outH)
}

export function getCompositionTemplate(id: PortraitCompositionId) {
  return PORTRAIT_COMPOSITIONS[id]
}
