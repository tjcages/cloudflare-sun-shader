/** Generative composition prompts — edit the reference photo; preserve identity. */
export type PortraitCompositionId =
  | "headshot"
  | "stage"
  | "speaker"
  | "close"

/** Professional framing reduces Workers AI false-positive NSFW flags (error 3030). */
const PROFESSIONAL_CONTEXT =
  "Professional corporate employee directory photograph, safe for work, fully clothed subject."

const LIKENESS_LOCK = [
  "Edit image 0.",
  PROFESSIONAL_CONTEXT,
  "Preserve the same person's face and identity from image 0.",
  "When image 1 is provided, match the face in image 1.",
  "Natural unretouched photo, realistic lighting, not illustration.",
].join(" ")

/** Shorter retry prompt when the safety filter false-positives (error 3030). */
export function portraitSafeRetryPrompt(
  composition: PortraitCompositionId,
): string {
  switch (composition) {
    case "headshot":
      return [
        "Edit image 0 into a professional corporate headshot for a company website.",
        "Same person, shoulders visible, neutral studio background, safe for work.",
      ].join(" ")
    case "stage":
      return [
        "Edit image 0 into a professional conference speaker photo for a company website.",
        "Same person, waist-up framing, dark stage background, safe for work.",
      ].join(" ")
    case "speaker":
      return [
        "Edit image 0 into a professional presentation portrait for a company website.",
        "Same person, shoulders-up framing, clean studio background, safe for work.",
      ].join(" ")
    case "close":
      return [
        "Edit image 0 into a standard professional headshot for a company directory.",
        "Same person, cropped at shoulders, neutral background, safe for work.",
      ].join(" ")
    default: {
      const never: never = composition
      return never
    }
  }
}

export const PORTRAIT_COMPOSITION_PROMPTS: Record<PortraitCompositionId, string> =
  {
    headshot: [
      LIKENESS_LOCK,
      "Adjust framing to a head-and-shoulders corporate portrait, eyes to camera.",
      "Replace the background with a soft neutral gray studio backdrop.",
      "Gentle studio key light.",
    ].join(" "),

    stage: [
      LIKENESS_LOCK,
      "Adjust framing to a waist-up conference speaker photo with headroom.",
      "Same person seated on a minimal stage stool, relaxed upright posture.",
      "Replace the background with a dark charcoal stage gradient and warm spotlight.",
    ].join(" "),

    speaker: [
      LIKENESS_LOCK,
      "Adjust framing to a shoulders-up presentation portrait, slight three-quarter angle.",
      "Replace the background with an off-white seamless studio backdrop.",
      "Natural engaged expression.",
    ].join(" "),

    close: [
      LIKENESS_LOCK,
      "Adjust framing to a standard professional headshot cropped at the shoulders.",
      "Direct eye contact, neutral studio background.",
      "Company directory portrait style, not a beauty shot.",
    ].join(" "),
  }

/** FLUX requires multiples of 16. Kept moderate for speed (avoids 504 timeouts). */
export const PORTRAIT_OUTPUT_WIDTH = 896
export const PORTRAIT_OUTPUT_HEIGHT = 1200

/** Fast 4-step model — flux-2-dev times out behind the Workers gateway. */
export const PORTRAIT_FLUX_MODEL =
  "@cf/black-forest-labs/flux-2-klein-9b" as const

export const PORTRAIT_FLUX_GUIDANCE = "1.75"
export const PORTRAIT_FLUX_SAFE_GUIDANCE = "1.5"

export function isContentModerationError(message: string): boolean {
  return /3030|flagged|nsfw|safety filter|inappropriate/i.test(message)
}

export function formatModerationError(): string {
  return "Workers AI flagged this result (false positive). Retried with a safer prompt — if it persists, try Team headshot or Speaker instead of Close profile, or use your original photo."
}
