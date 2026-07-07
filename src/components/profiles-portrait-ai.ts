/**
 * AI portrait recomposition via Workers AI (FLUX.2 klein 9B).
 *
 * Edits the reference photo in each composition scenario while locking
 * identity via a face-centered crop + tight face reference image.
 */

import {
  createFaceReferenceBlob,
  createPortraitReferenceBlob,
} from "./profiles-portrait-face"
import type {
  PortraitCompositionId,
  PortraitFaceAnalysis,
  PortraitProgressHandler,
} from "./profiles-portrait-types"

const AI_REQUEST_TIMEOUT_MS = 90_000

function base64ToObjectUrl(base64: string, mime = "image/png"): string {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return URL.createObjectURL(new Blob([bytes], { type: mime }))
}

function parseAiError(response: Response, bodyText: string): string {
  if (response.status === 504 || bodyText.includes("504 Gateway Time-out")) {
    return "AI generation timed out — the model took too long. Try again in a moment."
  }

  try {
    const payload = JSON.parse(bodyText) as { error?: string; code?: number }
    if (payload.code === 3030 || /3030|flagged/i.test(payload.error ?? "")) {
      return (
        payload.error ??
        "Workers AI flagged this portrait (known false-positive filter). Try Team headshot or Speaker, or use your original photo."
      )
    }
    if (payload.error) return payload.error
  } catch {
    /* HTML or plain-text error from the gateway */
  }

  if (/3030|flagged/i.test(bodyText)) {
    return "Workers AI flagged this portrait (known false-positive filter). Try Team headshot or Speaker, or use your original photo."
  }

  if (response.status === 404) {
    return "Portrait recomposition needs the Worker — run `pnpm build && pnpm preview`."
  }

  return `AI recompose failed (${response.status})`
}

/**
 * Recompose the portrait using Workers AI image-to-image.
 * Returns an object URL of the generated PNG.
 */
export async function recomposePortraitWithAi(
  imageSrc: string,
  composition: PortraitCompositionId,
  onProgress?: PortraitProgressHandler,
  faceAnalysis?: PortraitFaceAnalysis,
): Promise<string> {
  onProgress?.("Preparing reference images for AI…")
  const inputBlob = await createPortraitReferenceBlob(
    imageSrc,
    faceAnalysis,
    composition,
  )

  const form = new FormData()
  form.append("image", inputBlob, "portrait.png")
  form.append("composition", composition)

  if (faceAnalysis && faceAnalysis.confidence > 0) {
    const faceBlob = await createFaceReferenceBlob(
      imageSrc,
      faceAnalysis.faceBox,
    )
    form.append("face", faceBlob, "face.png")
  }

  onProgress?.("AI edit — preserving face details…")

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch("/api/portrait/recompose", {
      method: "POST",
      body: form,
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        "AI generation timed out — the request took longer than 90 seconds. Try again.",
      )
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }

  const bodyText = await response.text()
  if (!response.ok) {
    throw new Error(parseAiError(response, bodyText))
  }

  let payload: { image?: string }
  try {
    payload = JSON.parse(bodyText) as { image?: string }
  } catch {
    throw new Error(parseAiError(response, bodyText))
  }

  if (!payload.image) {
    throw new Error("AI recompose returned no image")
  }

  onProgress?.("AI photograph ready")
  return base64ToObjectUrl(payload.image)
}
