/**
 * Single-pass Connect post-FX — progressive Kawase blur, bokeh, chromatic
 * aberration, lens flare, vignette, grain, and grade.
 */
export const CONNECT_POSTFX_VERTEX = /* glsl */ `
  out vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

export const CONNECT_POSTFX_FRAGMENT = /* glsl */ `
  precision mediump float;

  uniform sampler2D tDiffuse;
  uniform vec2 uResolution;
  uniform float uTime;

  uniform float uBlur;
  uniform float uBokeh;
  uniform float uBokehThreshold;
  uniform float uChroma;
  uniform float uVignette;
  uniform float uGrain;
  uniform float uContrast;
  uniform float uSaturation;
  uniform float uExposure;
  uniform float uSharpness;
  uniform float uWarmth;
  uniform float uProgBlur;
  uniform float uProgFocus;
  uniform float uFlare;
  uniform float uFlareSpread;
  uniform float uFlareThreshold;
  uniform float uFlareX;
  uniform float uFlareY;

  in vec2 vUv;
  out vec4 fragColor;

  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  vec3 sampleScene(vec2 uv) {
    return texture(tDiffuse, clamp(uv, 0.0, 1.0)).rgb;
  }

  float fxLuma(vec3 c) {
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
  }

  // 9-tap Kawase blur — cheap, single-pass friendly.
  vec3 kawaseBlur(vec2 uv, float offset) {
    vec2 texel = offset / uResolution;
    vec3 c = sampleScene(uv) * 4.0;
    c += sampleScene(uv + vec2(texel.x, texel.y));
    c += sampleScene(uv + vec2(-texel.x, texel.y));
    c += sampleScene(uv + vec2(texel.x, -texel.y));
    c += sampleScene(uv + vec2(-texel.x, -texel.y));
    c += sampleScene(uv + vec2(texel.x, 0.0));
    c += sampleScene(uv + vec2(-texel.x, 0.0));
    c += sampleScene(uv + vec2(0.0, texel.y));
    c += sampleScene(uv + vec2(0.0, -texel.y));
    return c * (1.0 / 12.0);
  }

  // Progressive blur: sharp center, heavy blur toward frame edges (tilt-shift).
  vec3 progressiveBlur(vec2 uv, vec3 base) {
    vec2 centered = uv - 0.5;
    // Slightly oval to match the wide Connect frame.
    float radial = length(centered * vec2(1.0, 0.82)) * 2.35;
    float prog = smoothstep(uProgFocus, 1.0, radial);

    // Blur ramps from uniform-only at center to uniform+edge at corners.
    float blurAmt = clamp(uBlur + prog * uProgBlur, 0.0, 1.0);
    if (blurAmt < 0.002) return base;

    float radiusA = 2.0 + blurAmt * 16.0;
    float radiusB = 6.0 + blurAmt * blurAmt * 44.0;
    vec3 soft = kawaseBlur(uv, radiusA);
    vec3 wide = kawaseBlur(uv, radiusB);
    vec3 blurred = mix(soft, wide, clamp(prog * uProgBlur + blurAmt * 0.35, 0.0, 1.0));

    return mix(base, blurred, blurAmt);
  }

  vec3 applyChroma(vec2 uv, vec3 base) {
    if (uChroma < 0.001) return base;
    vec2 dir = uv - 0.5;
    float dist = dot(dir, dir);
    vec2 push = dir * (uChroma * (0.004 + dist * 0.035));
    vec3 split;
    split.r = sampleScene(uv + push).r;
    split.g = base.g;
    split.b = sampleScene(uv - push).b;
    return mix(base, split, clamp(uChroma, 0.0, 1.0));
  }

  vec3 applyLensFlare(vec2 uv, vec3 color) {
    if (uFlare < 0.001) return color;

    vec2 lightPos = vec2(uFlareX, uFlareY);
    vec2 axis = lightPos - 0.5;
    vec3 flare = vec3(0.0);

    // Ghost chain mirrored through frame center.
    for (float i = 0.0; i < 5.0; i += 1.0) {
      float t = i / 4.0;
      vec2 ghostUv = 0.5 - axis * t * (0.6 + uFlareSpread * 1.8);
      float lum = fxLuma(sampleScene(ghostUv));
      float w = smoothstep(uFlareThreshold, 1.0, lum) * (1.0 - t * 0.55);
      flare += vec3(1.0, 0.9, 0.72) * w * 0.22;
    }

    // Streak through the light point.
    vec2 d = uv - lightPos;
    float streak = exp(-abs(d.y * 5.0)) * exp(-abs(d.x) * 3.5);
    flare += vec3(1.0, 0.82, 0.55) * streak * 0.35;

    // Soft halo around the light origin.
    float halo = exp(-length(d) * 7.0);
    flare += vec3(1.0, 0.95, 0.85) * halo * 0.4;

    return color + flare * uFlare;
  }

  void main() {
    vec2 uv = vUv;
    vec3 base = sampleScene(uv);

    vec3 color = progressiveBlur(uv, base);

    if (uSharpness > 0.001) {
      vec3 sharp = kawaseBlur(uv, 0.75);
      vec3 high = base + (base - sharp) * (uSharpness * 2.0);
      // Don't sharpen pixels that progressive blur intentionally softened.
      float radial = length((uv - 0.5) * vec2(1.0, 0.82)) * 2.35;
      float prog = smoothstep(uProgFocus, 1.0, radial) * uProgBlur;
      float sharpMask = 1.0 - prog * 0.85;
      color = mix(color, high, uSharpness * sharpMask);
    }

    if (uBokeh > 0.001) {
      float lum = fxLuma(base);
      float bloom = smoothstep(uBokehThreshold, 1.0, lum);
      float blurOffset = 1.0 + (uBlur + uProgBlur * 0.5) * 8.0;
      vec3 wide = kawaseBlur(uv, blurOffset + 3.0 + uBokeh * 6.0);
      color += wide * bloom * uBokeh * 0.85;
    }

    color = applyChroma(uv, color);
    color = applyLensFlare(uv, color);

    vec2 vigUv = uv - 0.5;
    float vig = 1.0 - uVignette * dot(vigUv, vigUv) * 2.8;
    color *= clamp(vig, 0.0, 1.0);

    color *= uExposure;
    color = (color - 0.5) * uContrast + 0.5;

    float luma = fxLuma(color);
    color = mix(vec3(luma), color, uSaturation);

    vec3 warm = vec3(1.04, 1.0, 0.94);
    vec3 cool = vec3(0.94, 0.98, 1.04);
    color = mix(color, uWarmth >= 0.0 ? color * warm : color * cool, abs(uWarmth));

    if (uGrain > 0.001) {
      float n = hash(uv * uResolution + uTime * 47.0);
      color += (n - 0.5) * uGrain * 0.1;
    }

    fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`
