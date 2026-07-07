import {
  formatModerationError,
  isContentModerationError,
  portraitSafeRetryPrompt,
  PORTRAIT_COMPOSITION_PROMPTS,
  PORTRAIT_FLUX_GUIDANCE,
  PORTRAIT_FLUX_MODEL,
  PORTRAIT_FLUX_SAFE_GUIDANCE,
  PORTRAIT_OUTPUT_HEIGHT,
  PORTRAIT_OUTPUT_WIDTH,
  type PortraitCompositionId,
} from "./portrait-prompts"

interface Env {
  ASSETS: Fetcher
  AI: Ai
}

const VALID_COMPOSITIONS = new Set<string>(
  Object.keys(PORTRAIT_COMPOSITION_PROMPTS),
)

function isPortraitCompositionId(
  value: string,
): value is PortraitCompositionId {
  return VALID_COMPOSITIONS.has(value)
}

function buildAiForm(
  prompt: string,
  image: File,
  face: FormDataEntryValue | null,
  guidance: string,
  includeFace: boolean,
): FormData {
  const aiForm = new FormData()
  aiForm.append("prompt", prompt)
  aiForm.append("input_image_0", image, image.name || "portrait.png")
  if (
    includeFace &&
    face instanceof File &&
    face.size > 0
  ) {
    aiForm.append("input_image_1", face, face.name || "face.png")
  }
  aiForm.append("width", String(PORTRAIT_OUTPUT_WIDTH))
  aiForm.append("height", String(PORTRAIT_OUTPUT_HEIGHT))
  aiForm.append("guidance", guidance)
  return aiForm
}

type FluxResult =
  | { ok: true; image: string }
  | { ok: false; error: string; moderated: boolean }

async function runFluxPortrait(
  env: Env,
  aiForm: FormData,
): Promise<FluxResult> {
  const serialized = new Response(aiForm)
  const body = serialized.body
  const contentType = serialized.headers.get("content-type")
  if (!body || !contentType) {
    return { ok: false, error: "Failed to serialize AI request", moderated: false }
  }

  try {
    const result = await env.AI.run(PORTRAIT_FLUX_MODEL, {
      multipart: {
        body,
        contentType,
      },
    })

    if (
      typeof result === "object" &&
      result !== null &&
      "success" in result &&
      (result as { success?: boolean }).success === false
    ) {
      const errObj = result as {
        errors?: Array<{ message?: string; code?: number }>
      }
      const message =
        errObj.errors?.map((e) => e.message).filter(Boolean).join("; ") ||
        "Workers AI request failed"
      return {
        ok: false,
        error: message,
        moderated: isContentModerationError(message) ||
          (errObj.errors?.some((e) => e.code === 3030) ?? false),
      }
    }

    const imageB64 =
      typeof result === "object" &&
      result !== null &&
      "image" in result &&
      typeof (result as { image?: unknown }).image === "string"
        ? (result as { image: string }).image
        : null

    if (!imageB64) {
      return { ok: false, error: "AI model returned no image", moderated: false }
    }

    return { ok: true, image: imageB64 }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      error: message,
      moderated: isContentModerationError(message),
    }
  }
}

async function handlePortraitRecompose(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const form = await request.formData()
    const image = form.get("image")
    const face = form.get("face")
    const composition = form.get("composition")

    if (!(image instanceof File) || image.size === 0) {
      return Response.json({ error: "Missing image file" }, { status: 400 })
    }
    if (typeof composition !== "string" || !isPortraitCompositionId(composition)) {
      return Response.json({ error: "Invalid composition" }, { status: 400 })
    }

    const prompt = PORTRAIT_COMPOSITION_PROMPTS[composition]
    const hasFace = face instanceof File && face.size > 0

    let result = await runFluxPortrait(
      env,
      buildAiForm(prompt, image, face, PORTRAIT_FLUX_GUIDANCE, hasFace),
    )

    if (!result.ok && result.moderated) {
      result = await runFluxPortrait(
        env,
        buildAiForm(
          portraitSafeRetryPrompt(composition),
          image,
          face,
          PORTRAIT_FLUX_SAFE_GUIDANCE,
          false,
        ),
      )
    }

    if (result.ok) {
      return Response.json({
        image: result.image,
        composition,
        width: PORTRAIT_OUTPUT_WIDTH,
        height: PORTRAIT_OUTPUT_HEIGHT,
        model: PORTRAIT_FLUX_MODEL,
      })
    }

    const error = result.moderated
      ? formatModerationError()
      : result.error

    return Response.json(
      { error, code: result.moderated ? 3030 : undefined },
      { status: result.moderated ? 422 : 502 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const moderated = isContentModerationError(message)
    const timedOut =
      /timeout|timed out|504|deadline exceeded/i.test(message)
    return Response.json(
      {
        error: moderated
          ? formatModerationError()
          : timedOut
            ? "AI generation timed out. The model may be busy — try again in a moment."
            : message,
        code: moderated ? 3030 : undefined,
      },
      { status: moderated ? 422 : timedOut ? 504 : 500 },
    )
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
