/** Generative composition prompts — each re-photographs the subject in a new scenario. */
export type PortraitCompositionId =
  | "headshot"
  | "stage"
  | "speaker"
  | "close"

export const PORTRAIT_COMPOSITION_PROMPTS: Record<PortraitCompositionId, string> =
  {
    headshot: [
      "Professional corporate team headshot of the exact same person from the reference photo.",
      "Front-facing, eyes to camera, neutral confident expression.",
      "Head and shoulders, centered, classic LinkedIn-style framing.",
      "Soft studio key light, solid light gray background.",
      "Photorealistic, sharp focus on face.",
      "Preserve identical facial features, skin tone, hair, age, and likeness.",
    ].join(" "),

    stage: [
      "Professional keynote speaker photograph of the exact same person from the reference photo.",
      "Seated on a minimal dark stage stool, relaxed upright posture, three-quarter view.",
      "Medium-wide shot from waist up, subject centered with generous headroom above.",
      "Warm spotlight, subtle stage ambience, deep charcoal gradient background.",
      "Photorealistic conference keynote portrait.",
      "Preserve identical facial features, hair, and likeness.",
    ].join(" "),

    speaker: [
      "Professional presentation portrait of the exact same person from the reference photo.",
      "Chest-up framing, slight three-quarter angle, engaged natural expression.",
      "Clean studio lighting, off-white seamless background.",
      "Photorealistic corporate speaker photo.",
      "Preserve identical facial features, hair, and likeness.",
    ].join(" "),

    close: [
      "Tight professional profile portrait of the exact same person from the reference photo.",
      "Close crop from upper chest, face prominent, direct eye contact.",
      "Crisp studio lighting, minimal neutral background.",
      "Photorealistic avatar-style headshot.",
      "Preserve identical facial features and likeness.",
    ].join(" "),
  }

export const PORTRAIT_OUTPUT_WIDTH = 1024
export const PORTRAIT_OUTPUT_HEIGHT = 1365
