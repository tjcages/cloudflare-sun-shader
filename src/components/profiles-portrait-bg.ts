/**
 * Portrait background removal via transformers.js.
 *
 * Uses Xenova/modnet — the default transformers.js background-removal model,
 * with a 6 MB quantized ONNX build and broad browser support.
 *
 * Runs on WASM only for broad compatibility.
 */

const MODEL_ID = "Xenova/modnet"
const LOAD_TIMEOUT_MS = 120_000
const INFERENCE_TIMEOUT_MS = 90_000

type RawImageOutput = {
  data: Uint8ClampedArray
  width: number
  height: number
  channels: number
}

type BackgroundRemover = (src: string) => Promise<RawImageOutput>

export type BgProgressHandler = (message: string) => void

let removerPromise: Promise<BackgroundRemover> | null = null

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(message))
    }, ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (err: unknown) => {
        window.clearTimeout(timer)
        reject(err instanceof Error ? err : new Error(String(err)))
      },
    )
  })
}

async function createBackgroundRemover(
  onProgress?: BgProgressHandler,
): Promise<BackgroundRemover> {
  onProgress?.("Loading background removal model…")
  const { pipeline } = await import("@huggingface/transformers")

  const seen = new Set<string>()
  const progressCallback = (p: {
    status?: string
    file?: string
    progress?: number
  }) => {
    if (p.status === "progress" && p.file && p.file.endsWith(".onnx")) {
      onProgress?.(
        `Downloading portrait model… ${Math.round(p.progress ?? 0)}%`,
      )
    } else if (p.status === "initiate" && p.file && !seen.has(p.file)) {
      seen.add(p.file)
      onProgress?.("Downloading portrait model…")
    }
  }

  return withTimeout(
    pipeline("background-removal", MODEL_ID, {
      progress_callback: progressCallback,
    }) as Promise<BackgroundRemover>,
    LOAD_TIMEOUT_MS,
    "Background removal model download timed out — check your connection and retry.",
  )
}

async function getBackgroundRemover(
  onProgress?: BgProgressHandler,
): Promise<BackgroundRemover> {
  if (!removerPromise) {
    removerPromise = createBackgroundRemover(onProgress).catch((err) => {
      removerPromise = null
      throw err
    })
  }
  return removerPromise
}

function rawImageToImageData(raw: RawImageOutput): ImageData {
  const { data, width, height, channels } = raw
  if (channels === 4) {
    return new ImageData(new Uint8ClampedArray(data), width, height)
  }

  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i += 1) {
    const o = i * 4
    const s = i * channels
    rgba[o] = data[s]
    rgba[o + 1] = data[s + 1] ?? data[s]
    rgba[o + 2] = data[s + 2] ?? data[s]
    rgba[o + 3] = 255
  }
  return new ImageData(rgba, width, height)
}

/**
 * Remove the background from an image, returning RGBA ImageData with alpha.
 */
export async function removePortraitBackground(
  imageSrc: string,
  onProgress?: BgProgressHandler,
): Promise<ImageData> {
  const remover = await getBackgroundRemover(onProgress)
  onProgress?.("Removing background…")
  const raw = await withTimeout(
    remover(imageSrc),
    INFERENCE_TIMEOUT_MS,
    "Background removal timed out — try disabling background removal or use a smaller image.",
  )
  return rawImageToImageData(raw)
}
