import {
  PORTRAIT_COMPOSITION_PROMPTS,
  PORTRAIT_OUTPUT_HEIGHT,
  PORTRAIT_OUTPUT_WIDTH,
  type PortraitCompositionId,
} from "./portrait-prompts"

interface Env {
  ASSETS: Fetcher
  AI: Ai
}

const FLUX_MODEL = "@cf/black-forest-labs/flux-2-klein-4b"
const VALID_COMPOSITIONS = new Set<string>(
  Object.keys(PORTRAIT_COMPOSITION_PROMPTS),
)

function isPortraitCompositionId(
  value: string,
): value is PortraitCompositionId {
  return VALID_COMPOSITIONS.has(value)
}

async function handlePortraitRecompose(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const form = await request.formData()
    const image = form.get("image")
    const composition = form.get("composition")

    if (!(image instanceof File) || image.size === 0) {
      return Response.json({ error: "Missing image file" }, { status: 400 })
    }
    if (typeof composition !== "string" || !isPortraitCompositionId(composition)) {
      return Response.json({ error: "Invalid composition" }, { status: 400 })
    }

    const prompt = PORTRAIT_COMPOSITION_PROMPTS[composition]
    const aiForm = new FormData()
    aiForm.append("prompt", prompt)
    aiForm.append("input_image_0", image, image.name || "portrait.jpg")
    aiForm.append("width", String(PORTRAIT_OUTPUT_WIDTH))
    aiForm.append("height", String(PORTRAIT_OUTPUT_HEIGHT))

    const serialized = new Response(aiForm)
    const body = serialized.body
    const contentType = serialized.headers.get("content-type")
    if (!body || !contentType) {
      return Response.json({ error: "Failed to serialize AI request" }, { status: 500 })
    }

    const result = await env.AI.run(FLUX_MODEL, {
      multipart: {
        body,
        contentType,
      },
    })

    const imageB64 =
      typeof result === "object" &&
      result !== null &&
      "image" in result &&
      typeof (result as { image?: unknown }).image === "string"
        ? (result as { image: string }).image
        : null

    if (!imageB64) {
      return Response.json(
        { error: "AI model returned no image" },
        { status: 502 },
      )
    }

    return Response.json({
      image: imageB64,
      composition,
      width: PORTRAIT_OUTPUT_WIDTH,
      height: PORTRAIT_OUTPUT_HEIGHT,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === "/api/portrait/recompose") {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          headers: {
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        })
      }
      if (request.method === "POST") {
        return handlePortraitRecompose(request, env)
      }
      return new Response("Method not allowed", { status: 405 })
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
