/**
 * Face detection via MediaPipe Face Landmarker.
 *
 * Extracts normalized face metrics used to position and scale the subject
 * into standardized composition templates (headshot, stage, speaker, etc.).
 */

import type {
  PortraitFaceAnalysis,
  PortraitFaceBox,
  PortraitProgressHandler,
} from "./profiles-portrait-types"

const WASM_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm"
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"

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

  // Slightly expand the box — landmarks hug the skin, not hair/ears.
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

/** Fallback when no face is detected — center-weighted guess. */
function fallbackMetrics(): Omit<PortraitFaceAnalysis, "confidence"> {
  return {
    faceBox: { x: 0.28, y: 0.12, width: 0.44, height: 0.5 },
    center: [0.5, 0.37],
    forehead: [0.5, 0.12],
    chin: [0.5, 0.62],
  }
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
