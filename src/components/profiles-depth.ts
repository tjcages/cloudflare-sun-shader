/**
 * In-browser monocular depth estimation via transformers.js.
 *
 * Runs Depth Anything V2 (small) — the same model `scripts/generate-depth.mjs`
 * uses to bake the default image's depth map. Tries WebGPU first (fast, fp16),
 * falls back to WASM. The model (~40 MB) downloads from the HF hub on first
 * use and is cached by the browser after that.
 */

const MODEL_ID = "onnx-community/depth-anything-v2-small"

type DepthEstimator = (src: string) => Promise<{
  depth: { data: Uint8Array; width: number; height: number; channels: number }
}>

export type DepthProgressHandler = (message: string) => void

let estimatorPromise: Promise<DepthEstimator> | null = null

async function getEstimator(
  onProgress?: DepthProgressHandler,
): Promise<DepthEstimator> {
  if (!estimatorPromise) {
    estimatorPromise = (async () => {
      onProgress?.("Loading depth model…")
      const { pipeline } = await import("@huggingface/transformers")

      const seen = new Set<string>()
      const progressCallback = (p: {
        status?: string
        file?: string
        progress?: number
      }) => {
        if (p.status === "progress" && p.file && p.file.endsWith(".onnx")) {
          onProgress?.(
            `Downloading depth model… ${Math.round(p.progress ?? 0)}%`,
          )
        } else if (p.status === "initiate" && p.file && !seen.has(p.file)) {
          seen.add(p.file)
          onProgress?.("Downloading depth model…")
        }
      }

      const hasWebGPU =
        typeof navigator !== "undefined" && "gpu" in navigator
      try {
        if (!hasWebGPU) throw new Error("WebGPU unavailable")
        return (await pipeline("depth-estimation", MODEL_ID, {
          device: "webgpu",
          dtype: "fp16",
          progress_callback: progressCallback,
        })) as unknown as DepthEstimator
      } catch {
        onProgress?.("WebGPU unavailable — falling back to WASM…")
        return (await pipeline("depth-estimation", MODEL_ID, {
          progress_callback: progressCallback,
        })) as unknown as DepthEstimator
      }
    })().catch((err) => {
      // Allow a retry on the next call instead of caching the failure.
      estimatorPromise = null
      throw err
    })
  }
  return estimatorPromise
}

/**
 * Estimate a depth map for `imageSrc` (any fetchable URL, including object
 * URLs) and return it as an object URL of a grayscale PNG (white = near).
 */
export async function generateDepthMap(
  imageSrc: string,
  onProgress?: DepthProgressHandler,
): Promise<string> {
  const estimator = await getEstimator(onProgress)

  onProgress?.("Estimating depth…")
  const { depth } = await estimator(imageSrc)

  // RawImage (single-channel) -> RGBA canvas -> PNG object URL.
  const { data, width, height, channels } = depth
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i += 1) {
    const v = data[i * channels]
    const o = i * 4
    rgba[o] = v
    rgba[o + 1] = v
    rgba[o + 2] = v
    rgba[o + 3] = 255
  }

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas 2D context unavailable")
  ctx.putImageData(new ImageData(rgba, width, height), 0, 0)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  )
  if (!blob) throw new Error("Failed to encode depth map PNG")
  return URL.createObjectURL(blob)
}
