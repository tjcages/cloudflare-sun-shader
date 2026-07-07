/**
 * Profiles shader — depth-map relighting of a single photo.
 *
 * The photo is sampled as albedo; its AI-generated depth map (Depth Anything
 * V2, white = near) turns each pixel into a 3D point `(uv-centered xy, depth *
 * uDepthScale)`. Up to three point lights live in that same space, so a light
 * placed "in front of" the subject wraps around them realistically:
 *
 *   1. Attenuation — smoothstep falloff on 3D distance to the light, so near
 *      (bright in the depth map) pixels catch a close light first.
 *   2. Details — surface normals derived from depth-map gradients drive a
 *      lambert term, mixed in per-light. This is what makes hair edges,
 *      shoulders and facial planes pick up the light directionally.
 *   3. Glow — additive atmospheric haze, biased toward far pixels, which
 *      tints the background the way a colored studio light spills.
 *
 * Color model: `uTint` grades the ambient between pure white (0 — the photo
 * keeps its natural colors and lights are purely additive accents) and the
 * ambient color (1 — the fully re-graded look). The tone map is identity
 * below a 0.8 knee and soft-compresses highlights above it, so at tint 0 /
 * exposure 1 the untouched parts of the photo pass through unchanged.
 *
 * Extras: pointer parallax displaces UVs by depth (foreground only — the
 * background stays pinned so the image doesn't read as two sliding layers),
 * a scan band that sweeps through *depth*, and procedural overlay systems
 * (ASCII glyphs / cross-hatching / pixel LED / halftone dots) that draw over
 * the lit image, optionally masked to the near-depth subject.
 *
 * ASCII 5x5 glyph bitmaps via the classic bit-packed technique by movAX13h
 * (https://www.shadertoy.com/view/lssGDj).
 */

export const PROFILES_SHADER_VERTEX = /* glsl */ `
  out vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const PROFILES_SHADER_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform sampler2D uImage;
  uniform sampler2D uDepth;
  uniform vec2 uImageSize;
  uniform float uAspect;
  uniform float uTime;
  uniform vec2 uPointer;
  uniform float uParallax;
  uniform float uDepthScale;
  uniform float uNormalDetail;
  uniform float uExposure;
  uniform vec3 uAmbientColor;
  uniform float uAmbientIntensity;
  uniform float uTint;
  uniform float uShowHelpers;

  uniform float uLightEnabled[3];
  uniform vec3 uLightColor[3];
  uniform vec2 uLightPos[3];
  uniform float uLightZ[3];
  uniform float uLightRadius[3];
  uniform float uLightIntensity[3];
  uniform float uLightDiffuse[3];
  uniform float uLightGlow[3];

  uniform float uScanEnabled;
  uniform vec3 uScanColor;
  uniform float uScanSpeed;
  uniform float uScanWidth;
  uniform float uScanIntensity;
  uniform float uScanDir; // 0 ping-pong, 1 back->front, 2 front->back

  uniform float uOverlayMode; // 0 off, 1 ascii, 2 hatch, 3 pixel, 4 dots
  uniform float uOverlayScale;
  uniform float uOverlayOpacity;
  uniform vec3 uOverlayColor;
  uniform float uOverlayUseImage;
  uniform float uOverlaySpeed;
  uniform float uOverlayDepthMin;
  uniform float uOverlayScanOnly;

  in vec2 vUv;
  out vec4 fragColor;

  const vec3 LUMA = vec3(0.299, 0.587, 0.114);

  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // Identity below the knee, soft-compressed above — so an unlit photo at
  // exposure 1 passes through untouched while stacked lights roll off.
  vec3 toneMap(vec3 c) {
    const float knee = 0.8;
    vec3 lo = min(c, vec3(knee));
    vec3 hi = max(c - knee, vec3(0.0));
    return lo + (1.0 - knee) * (1.0 - exp(-hi / (1.0 - knee)));
  }

  // 5x5 bit-packed glyph coverage. p in [-1, 1] cell space.
  float glyphBit(int n, vec2 p) {
    p = floor(p * vec2(-4.0, 4.0) + 2.5);
    if (clamp(p.x, 0.0, 4.0) == p.x && clamp(p.y, 0.0, 4.0) == p.y) {
      int a = int(p.x) + 5 * int(p.y);
      if (((n >> a) & 1) == 1) return 1.0;
    }
    return 0.0;
  }

  float hatchLine(float coord, float aa) {
    float d = abs(fract(coord) - 0.5);
    return smoothstep(0.16 + aa, 0.16 - aa, d);
  }

  vec3 applyOverlay(
    vec3 col,
    vec2 uv,
    float depth,
    vec3 lightSum,
    vec3 glowSum,
    float band
  ) {
    int mode = int(uOverlayMode + 0.5);
    if (mode == 0 || uOverlayOpacity <= 0.001) return col;

    float mask = 1.0;
    if (uOverlayDepthMin > 0.01) {
      mask = smoothstep(
        uOverlayDepthMin - 0.08,
        uOverlayDepthMin + 0.08,
        depth
      );
    }
    // Scan reveal: particles only exist inside the sweeping depth band.
    mask *= mix(1.0, band, uOverlayScanOnly);
    float strength = uOverlayOpacity * mask;
    if (strength <= 0.001) return col;

    // Square cells in image space.
    vec2 cells = vec2(uOverlayScale, uOverlayScale / uAspect);
    vec2 cellId = floor(uv * cells);
    vec2 cellUv = fract(uv * cells);
    vec2 cellCenter = (cellId + 0.5) / cells;

    // Per-cell shimmer, stepped in time so marks twinkle rather than crawl.
    float jitter = 0.0;
    if (uOverlaySpeed > 0.001) {
      jitter =
        (hash21(cellId + floor(uTime * uOverlaySpeed * 4.0) * 17.0) - 0.5) *
        0.22;
    }

    float lum = dot(col, LUMA);

    if (mode == 1) {
      // ASCII — glyph density follows the cell's brightness.
      float cLum = clamp(
        dot(texture(uImage, cellCenter).rgb, LUMA) + jitter,
        0.0,
        1.0
      );
      int glyphs[9] = int[9](
        0, 4096, 65600, 332772, 15255086, 23385164, 15252014, 13199452,
        11512810
      );
      float g = glyphBit(glyphs[int(cLum * 8.99)], cellUv * 2.0 - 1.0);
      vec3 ink = mix(uOverlayColor, col * 1.7, uOverlayUseImage);
      return mix(col, ink * g, strength);
    }

    if (mode == 2) {
      // Cross-hatch — line sets stack up as luminance falls.
      float l = clamp(lum + jitter * 0.5, 0.0, 1.0);
      vec2 q =
        mat2(0.70710678, -0.70710678, 0.70710678, 0.70710678) *
        (uv * vec2(uAspect, 1.0));
      float density = uOverlayScale * 0.5;
      float aa = fwidth(q.y * density);
      float ink = hatchLine(q.y * density, aa) *
        smoothstep(0.85, 0.7, l);
      ink = max(
        ink,
        hatchLine(q.x * density, aa) * smoothstep(0.65, 0.5, l)
      );
      ink = max(
        ink,
        hatchLine((q.x + q.y) * density * 0.7071, aa) *
          smoothstep(0.45, 0.3, l)
      );
      ink = max(
        ink,
        hatchLine((q.x - q.y) * density * 0.7071, aa) *
          smoothstep(0.25, 0.1, l)
      );
      vec3 inkCol = mix(uOverlayColor, col * 1.5, uOverlayUseImage);
      return mix(col, inkCol, ink * strength);
    }

    if (mode == 3) {
      // Pixel LED — mosaic of the *lit* image with a soft grid gap.
      vec3 pix = toneMap(
        (texture(uImage, cellCenter).rgb * lightSum + glowSum) * uExposure
      );
      float gap =
        smoothstep(0.0, 0.09, cellUv.x) *
        smoothstep(1.0, 0.91, cellUv.x) *
        smoothstep(0.0, 0.09, cellUv.y) *
        smoothstep(1.0, 0.91, cellUv.y);
      pix *= mix(0.25, 1.0, gap);
      return mix(col, pix, strength);
    }

    // mode == 4: halftone dots — radius follows the cell's brightness.
    vec3 cCol = texture(uImage, cellCenter).rgb;
    float cLum = clamp(dot(cCol, LUMA) + jitter, 0.0, 1.0);
    float radius = 0.42 * sqrt(cLum);
    float d = length(cellUv - 0.5);
    float aa = fwidth(d) * 1.5;
    float dotMark = smoothstep(radius + aa, radius - aa, d);
    vec3 ink = mix(uOverlayColor, cCol * 1.6, uOverlayUseImage);
    return mix(col, ink, dotMark * strength);
  }

  void main() {
    // Depth-driven pointer parallax, foreground only: near pixels shift with
    // the cursor while the background stays pinned — shifting both (signed
    // around a mid plane) reads as two stacked images sliding apart.
    //
    // The offset is driven by a BLURRED depth (center + two rings) — raw
    // depth jumps 1 -> 0 at the silhouette, and offsetting by it duplicates
    // the subject's edge as a hard outline tracking the depth mask. Blurring
    // eases the shift across the boundary so the picture bends instead of
    // tearing. Lighting still uses the sharp depth below.
    float dPar;
    {
      vec2 t1 = 10.0 / uImageSize;
      vec2 t2 = 22.0 / uImageSize;
      dPar = texture(uDepth, vUv).r * 0.2;
      dPar += texture(uDepth, vUv + vec2(t1.x, 0.0)).r * 0.075;
      dPar += texture(uDepth, vUv - vec2(t1.x, 0.0)).r * 0.075;
      dPar += texture(uDepth, vUv + vec2(0.0, t1.y)).r * 0.075;
      dPar += texture(uDepth, vUv - vec2(0.0, t1.y)).r * 0.075;
      dPar += texture(uDepth, vUv + t1 * 0.7071).r * 0.05;
      dPar += texture(uDepth, vUv - t1 * 0.7071).r * 0.05;
      dPar += texture(uDepth, vUv + vec2(t1.x, -t1.y) * 0.7071).r * 0.05;
      dPar += texture(uDepth, vUv + vec2(-t1.x, t1.y) * 0.7071).r * 0.05;
      dPar += texture(uDepth, vUv + vec2(t2.x, 0.0)).r * 0.075;
      dPar += texture(uDepth, vUv - vec2(t2.x, 0.0)).r * 0.075;
      dPar += texture(uDepth, vUv + vec2(0.0, t2.y)).r * 0.075;
      dPar += texture(uDepth, vUv - vec2(0.0, t2.y)).r * 0.075;
    }
    vec2 uv = clamp(
      vUv + uPointer * uParallax * dPar,
      vec2(0.001),
      vec2(0.999)
    );

    float depth = texture(uDepth, uv).r;
    vec3 albedo = texture(uImage, uv).rgb;

    // Surface normal from depth gradients (3-texel offsets smooth the noise
    // in the upscaled depth map).
    vec2 texel = 3.0 / uImageSize;
    float dR = texture(uDepth, uv + vec2(texel.x, 0.0)).r;
    float dL = texture(uDepth, uv - vec2(texel.x, 0.0)).r;
    float dT = texture(uDepth, uv + vec2(0.0, texel.y)).r;
    float dB = texture(uDepth, uv - vec2(0.0, texel.y)).r;
    float nk = uNormalDetail * 18.0;
    vec3 normal = normalize(vec3((dL - dR) * nk, (dB - dT) * nk, 1.0));

    // Pixel position in light space: xy spans [-aspect, aspect] x [-1, 1],
    // z extrudes toward the camera by the depth map.
    vec3 p = vec3((uv - 0.5) * 2.0 * vec2(uAspect, 1.0), depth * uDepthScale);

    // Tint 0 = neutral white ambient (photo keeps its own colors, lights are
    // additive accents). Tint 1 = fully re-graded by the ambient color.
    vec3 lightSum =
      mix(vec3(1.0), uAmbientColor, uTint) * uAmbientIntensity;
    vec3 glowSum = vec3(0.0);

    for (int i = 0; i < 3; i++) {
      if (uLightEnabled[i] < 0.5) continue;

      vec3 lp = vec3(uLightPos[i], uLightZ[i]);
      vec3 toL = lp - p;
      float dist = length(toL);

      float atten = smoothstep(uLightRadius[i], 0.0, dist);
      atten *= atten;

      float diff = max(dot(normal, normalize(toL)), 0.0);
      float shade = mix(1.0, diff, uLightDiffuse[i]);

      lightSum += uLightColor[i] * (uLightIntensity[i] * atten * shade);

      // Atmospheric spill — additive, strongest on far (background) pixels.
      float r2 = max(uLightRadius[i] * uLightRadius[i], 1e-4);
      float glowFall = exp(-dist * dist * (2.5 / r2));
      glowSum +=
        uLightColor[i] * (uLightGlow[i] * glowFall * (1.0 - depth * 0.75));
    }

    vec3 col = albedo * lightSum + glowSum;

    // Sweeping depth band. Computed ALWAYS (independent of uScanEnabled) so it
    // can drive the overlay particle reveal even when the colored scan line
    // isn't drawn. The band center t travels a margin BEYOND [0,1] so it fully
    // sweeps past the nearest and farthest content instead of stalling
    // mid-image at the turnaround (which read as "stops short").
    // Just enough overshoot past [0,1] that the band fully clears the nearest
    // and farthest content (no "stops short"), without a long blank stretch.
    float margin = 0.04 + uScanWidth;
    float lo = -margin;
    float hi = 1.0 + margin;
    int dir = int(uScanDir + 0.5);
    // Phase offset so uTime 0 starts the band mid-content (immediate reveal)
    // instead of parked in the off-content margin.
    float off = (dir == 0) ? 0.25 : 0.5;
    float phase = fract(uTime * uScanSpeed + off);
    float t;
    if (dir == 0) {
      // Ping-pong: back -> front -> back.
      float tri = 1.0 - abs(1.0 - 2.0 * phase);
      t = mix(lo, hi, tri);
    } else if (dir == 1) {
      // One-way loop, back -> front. Wrap happens off-content (in the margin)
      // so the reset is invisible.
      t = mix(lo, hi, phase);
    } else {
      // One-way loop, front -> back.
      t = mix(hi, lo, phase);
    }
    float band = 1.0 - smoothstep(0.0, uScanWidth, abs(depth - t));

    if (uScanEnabled > 0.5) {
      col += uScanColor * (band * uScanIntensity * (0.35 + 0.65 * albedo));
    }

    col = toneMap(col * uExposure);

    col = applyOverlay(col, uv, depth, lightSum, glowSum, band);

    // Light-position helper rings (dev aid, toggled from the panel).
    if (uShowHelpers > 0.5) {
      for (int i = 0; i < 3; i++) {
        if (uLightEnabled[i] < 0.5) continue;
        vec2 lpUv = uLightPos[i] / (2.0 * vec2(uAspect, 1.0)) + 0.5;
        float dPix = length((vUv - lpUv) * vec2(uAspect, 1.0));
        float ring = smoothstep(0.012, 0.009, abs(dPix - 0.022));
        col = mix(col, uLightColor[i], ring * 0.9);
        float dotMark = smoothstep(0.008, 0.005, dPix);
        col = mix(col, vec3(1.0), dotMark);
      }
    }

    fragColor = vec4(col, 1.0);
  }
`
