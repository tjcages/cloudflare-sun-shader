import type { ShaderDevFieldDef } from "shader-panel"
import type { ProfilesShaderConfig } from "./profiles-shader-config"

function lightFields(
  n: 1 | 2 | 3,
  title: string,
): ShaderDevFieldDef<ProfilesShaderConfig>[] {
  return [
    { type: "section", title },
    { type: "toggle", key: `light${n}Enabled`, label: "Enabled" },
    { type: "color", key: `light${n}Color`, label: "Color" },
    {
      type: "vec2",
      key: `light${n}Pos`,
      label: "Position",
      min: -1.5,
      max: 1.5,
      step: 0.01,
    },
    {
      type: "slider",
      key: `light${n}Z`,
      label: "Height (Z)",
      min: 0,
      max: 2,
      step: 0.01,
      description:
        n === 1
          ? "How far the light floats above the image plane — depth 1.0 touches the nearest pixels."
          : undefined,
    },
    {
      type: "slider",
      key: `light${n}Radius`,
      label: "Radius",
      min: 0.05,
      max: 4,
      step: 0.01,
    },
    {
      type: "slider",
      key: `light${n}Intensity`,
      label: "Intensity",
      min: 0,
      max: 5,
      step: 0.01,
    },
    {
      type: "slider",
      key: `light${n}Diffuse`,
      label: "Details",
      min: 0,
      max: 1,
      step: 0.01,
      description:
        n === 1
          ? "Mixes in shading from depth-derived surface normals."
          : undefined,
    },
    {
      type: "slider",
      key: `light${n}Glow`,
      label: "Glow",
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      type: "toggle",
      key: `light${n}Animate`,
      label: "Animate",
      description:
        n === 1
          ? "Move the light along a path of waypoints. Position is the home / start."
          : undefined,
    },
    {
      type: "select",
      key: `light${n}Loop`,
      label: "Loop",
      options: [
        { value: "forward", label: "Forward (infinite)" },
        { value: "pingpong", label: "Back & forth" },
      ],
    },
    {
      type: "slider",
      key: `light${n}Speed`,
      label: "Anim speed",
      min: 0,
      max: 2,
      step: 0.01,
    },
    {
      type: "path",
      key: `light${n}Path`,
      anchorKey: `light${n}Pos`,
      label: "Travel path",
      min: -1.5,
      max: 1.5,
      description:
        n === 1
          ? "Waypoints the light travels through, chained off its home position."
          : undefined,
    },
  ]
}

export const PROFILES_SHADER_DEV_FIELDS: ShaderDevFieldDef<ProfilesShaderConfig>[] =
  [
    { type: "section", title: "Scenario" },
    {
      type: "select",
      key: "preset",
      label: "Preset",
      options: [
        { value: "natural", label: "Natural accents" },
        { value: "crimson", label: "Crimson noir" },
        { value: "azure", label: "Electric azure" },
        { value: "golden", label: "Golden hour" },
        { value: "neon", label: "Neon club" },
        { value: "scanline", label: "Depth scan" },
        { value: "ascii", label: "ASCII glitch" },
      ],
    },
    { type: "section", title: "Image" },
    {
      type: "image",
      key: "imageSrc",
      label: "Source image",
      emptyLabel: "Click or drop a profile photo",
    },
    {
      type: "image",
      key: "depthSrc",
      label: "Depth map (auto-generated)",
      readonly: true,
      emptyLabel: "Generating depth map…",
    },
    {
      type: "action",
      actionId: "openPortraitEditor",
      label: "Edit portrait",
      variant: "primary",
      description:
        "Re-open the portrait editor to regenerate the photo in a new scenario before depth mapping.",
      when: (values) => {
        const src = values.imageSrc
        return (
          typeof src === "string" &&
          src.length > 0 &&
          !src.startsWith("/profiles/")
        )
      },
    },
    { type: "section", title: "Portrait style" },
    {
      type: "select",
      key: "portraitComposition",
      label: "Composition",
      layout: "stacked",
      options: [
        { value: "headshot", label: "Team headshot" },
        { value: "stage", label: "Stage center" },
        { value: "speaker", label: "Speaker" },
        { value: "close", label: "Close profile" },
      ],
      description:
        "AI re-photographs the subject in this scenario — new scene, not cutout repositioning.",
    },
    {
      type: "select",
      key: "portraitPreset",
      label: "Color look",
      layout: "stacked",
      options: [
        { value: "cloudflare", label: "Cloudflare studio" },
        { value: "studio", label: "Studio neutral" },
        { value: "studioWarm", label: "Studio warm" },
        { value: "studioCool", label: "Studio cool" },
        { value: "natural", label: "Natural (minimal)" },
      ],
      description: "Color grade applied after AI recomposition.",
    },
    {
      type: "color",
      key: "portraitBgColor",
      label: "Background",
      description:
        "Solid backdrop behind the subject — orange, white, black, or any custom color.",
    },
    {
      type: "toggle",
      key: "portraitRemoveBg",
      label: "Replace background",
      description:
        "Remove the AI backdrop and composite the subject on the background color.",
    },
    {
      type: "toggle",
      key: "portraitAutoProcess",
      label: "Open AI studio on upload",
      description:
        "When enabled, uploads open the optional AI portrait studio. Off = use the photo directly and generate depth immediately.",
    },
    {
      type: "slider",
      key: "portraitExposure",
      label: "Exposure",
      min: 0.5,
      max: 1.5,
      step: 0.01,
    },
    {
      type: "slider",
      key: "portraitContrast",
      label: "Contrast",
      min: 0.8,
      max: 1.3,
      step: 0.01,
    },
    {
      type: "slider",
      key: "portraitWarmth",
      label: "Warmth",
      min: -0.2,
      max: 0.2,
      step: 0.01,
    },
    {
      type: "slider",
      key: "portraitSaturation",
      label: "Saturation",
      min: 0.7,
      max: 1.3,
      step: 0.01,
    },
    {
      type: "select",
      key: "fit",
      label: "Fit",
      options: [
        { value: "contain", label: "Contain" },
        { value: "cover", label: "Cover" },
      ],
    },
    { type: "section", title: "Scene" },
    {
      type: "slider",
      key: "exposure",
      label: "Exposure",
      min: 0.2,
      max: 3,
      step: 0.01,
    },
    { type: "color", key: "ambientColor", label: "Ambient color" },
    {
      type: "slider",
      key: "ambientIntensity",
      label: "Ambient level",
      min: 0,
      max: 3,
      step: 0.01,
    },
    {
      type: "slider",
      key: "tint",
      label: "Color grade",
      min: 0,
      max: 1,
      step: 0.01,
      description:
        "0 keeps the photo's natural colors (lights are additive accents); 1 fully re-grades with the ambient color.",
    },
    {
      type: "slider",
      key: "depthScale",
      label: "Depth scale",
      min: 0,
      max: 2,
      step: 0.01,
      description: "How far the depth map extrudes toward the lights.",
    },
    {
      type: "slider",
      key: "normalDetail",
      label: "Normal detail",
      min: 0,
      max: 4,
      step: 0.01,
    },
    {
      type: "slider",
      key: "parallax",
      label: "Mouse parallax",
      min: 0,
      max: 0.3,
      step: 0.005,
    },
    { type: "toggle", key: "showHelpers", label: "Light helpers" },
    ...lightFields(1, "Light 1"),
    ...lightFields(2, "Light 2"),
    ...lightFields(3, "Light 3"),
    { type: "section", title: "Depth scan" },
    {
      type: "toggle",
      key: "scanEnabled",
      label: "Enabled",
      description:
        "Draws the colored sweep. The band itself always runs — it also drives overlay Scan reveal even when this is off.",
    },
    { type: "color", key: "scanColor", label: "Color" },
    {
      type: "select",
      key: "scanDirection",
      label: "Direction",
      options: [
        { value: "back", label: "Back → front (loop)" },
        { value: "front", label: "Front → back (loop)" },
        { value: "pingpong", label: "Ping-pong" },
      ],
    },
    {
      type: "slider",
      key: "scanSpeed",
      label: "Speed",
      min: 0,
      max: 2,
      step: 0.01,
    },
    {
      type: "slider",
      key: "scanWidth",
      label: "Band width",
      min: 0.01,
      max: 0.5,
      step: 0.005,
    },
    {
      type: "slider",
      key: "scanIntensity",
      label: "Intensity",
      min: 0,
      max: 3,
      step: 0.01,
    },
    { type: "section", title: "Overlay particles" },
    {
      type: "select",
      key: "overlayMode",
      label: "Mode",
      options: [
        { value: "off", label: "Off" },
        { value: "ascii", label: "ASCII glyphs" },
        { value: "hatch", label: "Cross-hatch" },
        { value: "pixel", label: "Pixel LED" },
        { value: "dots", label: "Halftone dots" },
      ],
    },
    {
      type: "toggle",
      key: "overlayScanOnly",
      label: "Scan reveal",
      description:
        "Reveal particles only inside the sweeping depth band (uses the Depth scan Speed / Direction / Width). Off = cover the whole image.",
    },
    {
      type: "slider",
      key: "overlayScale",
      label: "Cell density",
      min: 20,
      max: 300,
      step: 1,
    },
    {
      type: "slider",
      key: "overlayOpacity",
      label: "Opacity",
      min: 0,
      max: 1,
      step: 0.01,
    },
    { type: "toggle", key: "overlayUseImage", label: "Use image colors" },
    { type: "color", key: "overlayColor", label: "Ink color" },
    {
      type: "slider",
      key: "overlaySpeed",
      label: "Shimmer",
      min: 0,
      max: 3,
      step: 0.01,
      description: "Per-cell twinkle rate. 0 = static.",
    },
    {
      type: "slider",
      key: "overlayDepthMin",
      label: "Depth mask",
      min: 0,
      max: 1,
      step: 0.01,
      description:
        "Only draw where the depth map is nearer than this — raise it to keep particles on the subject. 0 = everywhere.",
    },
  ]
