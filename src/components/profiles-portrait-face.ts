/**
 * Face detection via MediaPipe Face Landmarker.
 *
 * Extracts normalized face metrics used for AI identity reference crops.
 */

import type {
  PortraitCompositionId,
  PortraitFaceAnalysis,
  PortraitFaceBox,
  PortraitProgressHandler,
} from "./profiles-portrait-types"

const WASM_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm"
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"

const AI_INPUT_MAX = 512

type FaceLandmarkerInstance = {
  detect: (image: HTMLCanvasElement | HTMLImageElement) => {
    faceLandmarks: Array<Array<{ x: number; y: number; z?: number }>>
  }
  close: () => void
}

let landmarkerPromise: Promise<FaceLandmarkerInstance> | null = null

async function getFaceLandmarker(
  onProgress?: PortraitProgressHandler,
): Promise<FaceLandmarkerInstance> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      onProgress?.("Loading face detection model…")
      const { FaceLandmarker, FilesetResolver } = await import(
        "@mediapipe/tasks-vision"
      )
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN)
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: "IMAGE",
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      })
    })().catch((err) => {
      landmarkerPromise = null
      throw err
    })
  }
  return landmarkerPromise
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Failed to load image for face detection"))
    img.src = src
  })
}

function metricsFromLandmarks(
  landmarks: Array<{ x: number; y: number }>,
): Omit<PortraitFaceAnalysis, "confidence"> {
  let minX = 1
  let maxX = 0
  let minY = 1
  let maxY = 0

  for (const pt of landmarks) {
    minX = Math.min(minX, pt.x)
    maxX = Math.max(maxX, pt.x)
    minY = Math.min(minY, pt.y)
    maxY = Math.max(maxY, pt.y)
  }

  const padX = (maxX - minX) * 0.12
  const padTop = (maxY - minY) * 0.35
  const padBottom = (maxY - minY) * 0.08

  minX = Math.max(0, minX - padX)
  maxX = Math.min(1, maxX + padX)
  minY = Math.max(0, minY - padTop)
  maxY = Math.min(1, maxY + padBottom)

  const faceBox: PortraitFaceBox = {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }

  const center: readonly [number, number] = [
    (minX + maxX) / 2,
    (minY + maxY) / 2,
  ]

  let foreheadY = 1
  let chinY = 0
  for (const pt of landmarks) {
    foreheadY = Math.min(foreheadY, pt.y)
    chinY = Math.max(chinY, pt.y)
  }

  return {
    faceBox,
    center,
    forehead: [center[0], foreheadY],
    chin: [center[0], chinY],
  }
}

function fallbackMetrics(): Omit<PortraitFaceAnalysis, "confidence"> {
  return {
    faceBox: { x: 0.28, y: 0.12, width: 0.44, height: 0.5 },
    center: [0.5, 0.37],
    forehead: [0.5, 0.12],
    chin: [0.5, 0.62],
  }
}

function scaleToMaxEdge(width: number, height: number, maxEdge: number) {
  const longest = Math.max(width, height)
  const scale = maxEdge / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

async function imageToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  )
  if (!blob) throw new Error("Failed to encode image PNG")
  return blob
}

/**
 * Detect face landmarks and return metrics for composition placement.
 */
export async function analyzePortraitFace(
  imageSrc: string,
  onProgress?: PortraitProgressHandler,
): Promise<PortraitFaceAnalysis> {
  const landmarker = await getFaceLandmarker(onProgress)
  const img = await loadImageElement(imageSrc)

  onProgress?.("Detecting face…")
  const result = landmarker.detect(img)

  if (result.faceLandmarks.length === 0) {
    onProgress?.("No face detected — using default placement")
    return { ...fallbackMetrics(), confidence: 0 }
  }

  return {
    ...metricsFromLandmarks(result.faceLandmarks[0]),
    confidence: 1,
  }
}

/**
 * Tight face crop for FLUX identity reference (input_image_1).
 */
export async function createFaceReferenceBlob(
  imageSrc: string,
  faceBox: PortraitFaceBox,
): Promise<Blob> {
  const img = await loadImageElement(imageSrc)
  const pad = 0.08
  const x = Math.max(0, Math.floor((faceBox.x - pad) * img.naturalWidth))
  const y = Math.max(0, Math.floor((faceBox.y - pad) * img.naturalHeight))
  const w = Math.min(
    img.naturalWidth - x,
    Math.ceil((faceBox.width + pad * 2) * img.naturalWidth),
  )
  const h = Math.min(
    img.naturalHeight - y,
    Math.ceil((faceBox.height + pad * 2) * img.naturalHeight),
  )

  const scaled = scaleToMaxEdge(w, h, AI_INPUT_MAX)
  const canvas = document.createElement("canvas")
  canvas.width = scaled.width
  canvas.height = scaled.height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas 2D context unavailable")
  ctx.drawImage(img, x, y, w, h, 0, 0, scaled.width, scaled.height)
  return imageToPngBlob(canvas)
}

/**
 * Face-centered portrait crop for the main FLUX reference (input_image_0).
 * Maximizes facial detail within the 512px input limit.
 */
export async function createPortraitReferenceBlob(
  imageSrc: string,
  faceAnalysis?: PortraitFaceAnalysis,
  composition?: PortraitCompositionId,
): Promise<Blob> {
  const img = await loadImageElement(imageSrc)

  let sx = 0
  let sy = 0
  let sw = img.naturalWidth
  let sh = img.naturalHeight

  if (faceAnalysis && faceAnalysis.confidence > 0) {
    const { faceBox, center } = faceAnalysis
    // Wider crops reduce Workers AI false-positive moderation on close framing.
    const isClose = composition === "close"
    const cropW = Math.min(1, faceBox.width * (isClose ? 3.0 : 2.4))
    const cropH = Math.min(1, faceBox.height * (isClose ? 4.0 : 3.2))
    const anchorY = isClose ? 0.38 : 0.42
    sx = Math.max(0, (center[0] - cropW / 2) * img.naturalWidth)
    sy = Math.max(0, (center[1] - cropH * anchorY) * img.naturalHeight)
    sw = Math.min(img.naturalWidth - sx, cropW * img.naturalWidth)
    sh = Math.min(img.naturalHeight - sy, cropH * img.naturalHeight)
  }

  const scaled = scaleToMaxEdge(sw, sh, AI_INPUT_MAX)
  const canvas = document.createElement("canvas")
  canvas.width = scaled.width
  canvas.height = scaled.height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas 2D context unavailable")
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, scaled.width, scaled.height)
  return imageToPngBlob(canvas)
}
