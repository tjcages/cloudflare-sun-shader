/**
 * AI portrait recomposition via Workers AI (FLUX.2 klein).
 *
 * Actually regenerates the photograph in each composition scenario —
 * not cutout repositioning. Requires the worker with AI binding
 * (wrangler dev / deploy). Astro-only dev needs the proxy in astro.config.
 */

import type {
  PortraitCompositionId,
  PortraitProgressHandler,
} from "./profiles-portrait-types"

const AI_INPUT_MAX = 512

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Failed to load image"))
    img.src = src
  })
}

/** FLUX klein reference images must be ≤512px on the longest edge. */
async function prepareAiInput(imageSrc: string): Promise<Blob> {
  const img = await loadImage(imageSrc)
  const longest = Math.max(img.naturalWidth, img.naturalHeight)
  const scale = Math.min(1, AI_INPUT_MAX / longest)
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))

  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas 2D context unavailable")
  ctx.drawImage(img, 0, 0, w, h)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.92),
  )
  if (!blob) throw new Error("Failed to encode image for AI input")
  return blob
}

function base64ToObjectUrl(base64: string, mime = "image/png"): string {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return URL.createObjectURL(new Blob([bytes], { type: mime }))
}

/**
 * Recompose the portrait using Workers AI image-to-image.
 * Returns an object URL of the generated PNG.
 */
export async function recomposePortraitWithAi(
  imageSrc: string,
  composition: PortraitCompositionId,
  onProgress?: PortraitProgressHandler,
): Promise<string> {
  onProgress?.("Preparing image for AI…")
  const inputBlob = await prepareAiInput(imageSrc)

  const form = new FormData()
  form.append("image", inputBlob, "portrait.jpg")
  form.append("composition", composition)

  onProgress?.("AI recomposition — generating new photograph…")

  const response = await fetch("/api/portrait/recompose", {
    method: "POST",
    body: form,
  })

  const payload = (await response.json()) as {
    image?: string
    error?: string
  }

  if (!response.ok) {
    const hint =
      response.status === 404
        ? " Portrait recomposition needs the Worker — run `pnpm build && pnpm preview`."
        : ""
    throw new Error(
      (payload.error ?? `AI recompose failed (${response.status})`) + hint,
    )
  }

  if (!payload.image) {
    throw new Error("AI recompose returned no image")
  }

  onProgress?.("AI photograph ready")
  return base64ToObjectUrl(payload.image)
}
