/** Solid backdrop presets for standardized portraits. */
export const PORTRAIT_BACKGROUND_PRESETS = [
  { id: "orange", label: "Orange", color: "#ff5e1f" },
  { id: "white", label: "White", color: "#ffffff" },
  { id: "black", label: "Black", color: "#000000" },
] as const

export function parseHexColor(hex: string): [number, number, number] {
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

/** Draw a cutout (RGBA with alpha) on a flat background color. */
export function compositeCutoutOnBackground(
  cutout: ImageData,
  backgroundColor: string,
): ImageData {
  const canvas = document.createElement("canvas")
  canvas.width = cutout.width
  canvas.height = cutout.height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas 2D context unavailable")

  const [r, g, b] = parseHexColor(backgroundColor)
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
  ctx.fillRect(0, 0, cutout.width, cutout.height)
  ctx.drawImage(imageDataToCanvas(cutout), 0, 0)

  return ctx.getImageData(0, 0, cutout.width, cutout.height)
}

export async function imageDataToObjectUrl(imageData: ImageData): Promise<string> {
  const canvas = imageDataToCanvas(imageData)
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  )
  if (!blob) throw new Error("Failed to encode portrait PNG")
  return URL.createObjectURL(blob)
}
