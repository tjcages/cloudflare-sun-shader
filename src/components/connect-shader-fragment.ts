/**
 * Connect shader — the cylindrical stripe wave (twisted-plane WaveMesh base)
 * dressed in three coordinated passes, all driven by ONE simplex wave field:
 *
 *   1. Base mesh — organic interior fill (two-color gradient drifting through
 *      the crests) + thin stripe lines ringing the cylinder, dissolving into
 *      white in patches.
 *
 *   2. Hatch shell — the dash grids live on a SECOND copy of the surface,
 *      pushed outward along the normals (uLift), so the hatch floats above
 *      the wave and wraps around it instead of sitting on the skin. It still
 *      displaces with the same noise, so it staggers with the wave.
 *
 *   3. Emitter — dash-shaped particles seeded on the surface that repeatedly
 *      launch outward along their normal and fade: the wave continually
 *      sheds hatch dashes. Oriented along the cylinder's length (the hatch
 *      direction) and sized in world units so they read at any zoom.
 *
 * Simplex noise — MIT, Stefan Gustavson + Ian McEwan
 * https://github.com/stegu/webgl-noise
 */
export const CONNECT_SHADER_NOISE_UTILS = /* glsl */ `
  // sin-free hash — same role as the classic sin(fract(dot)) variant, cheaper on ALU.
  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  vec3 permute(vec3 x) {
    return mod(((x * 34.0) + 1.0) * x, 289.0);
  }

  // Simplex noise — MIT, Stefan Gustavson + Ian McEwan
  // https://github.com/stegu/webgl-noise
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
`

/**
 * Shared vertex for the base mesh and the hatch shell. uLift pushes the
 * whole surface outward along its normals — 0 for the base, hatchLift for
 * the floating shell.
 */
export const CONNECT_SHADER_VERTEX = /* glsl */ `
  uniform highp float uTime;
  uniform float uWavesX;
  uniform float uWavesY;
  uniform float uSpeedX;
  uniform float uSpeedY;
  uniform float uDisplacementHeight;
  uniform float uLift;
  uniform float uFillGradScale;

  varying vec2 vUv;
  varying float vNoise;
  varying float vFillGrad;
  varying float vLineDissolve;
  varying vec2 vScreen;

  void main() {
    vUv = uv;
    // Identical displacement to the Wave page's cylindrical stripe wave.
    vec2 waveUv = vec2(
      (uv.x + uTime * uSpeedX) * uWavesX,
      (uv.y + uTime * uSpeedY) * uWavesY
    );
    float n = snoise(waveUv);
    vNoise = n;
    // Per-vertex noise fields the base fragment used to recompute every pixel.
    vFillGrad = snoise(vec2(
      (uv.x + uTime * uSpeedX * 0.7) * uFillGradScale,
      (uv.y + uTime * uSpeedY * 0.7) * uFillGradScale * 3.0 + 41.7
    ));
    vLineDissolve = snoise(waveUv * 0.53 + vec2(7.7, 3.1));
    vec3 displaced = position + normal * (n * uDisplacementHeight + uLift);
    vec4 mv = modelViewMatrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * mv;
    // NDC → 0..1, used for the screen-space hatch density swath.
    vScreen = gl_Position.xy / max(gl_Position.w, 0.001) * 0.5 + 0.5;
  }
`

/** Base pass: gradient interior fill + stripe lines. No hatch. */
export const CONNECT_BASE_FRAGMENT = /* glsl */ `
  precision mediump float;

  uniform vec3 uFillColor;
  uniform vec3 uFillColor2;
  uniform float uFillAlpha;
  uniform float uFillLow;
  uniform float uFillHigh;
  uniform float uFillRadius;

  uniform vec3 uLineColor;
  uniform float uLineCount;
  uniform float uLineWidth;
  uniform float uLineAlpha;
  uniform float uLineFadeLow;
  uniform float uLineFadeHigh;

  uniform vec3 uPaleColor;
  uniform vec3 uDeepColor;

  varying vec2 vUv;
  varying float vNoise;
  varying float vFillGrad;
  varying float vLineDissolve;
  varying vec2 vScreen;

  // GLSL3 ShaderMaterial: three.js does not provide gl_FragColor — declare
  // our own output.
  out vec4 fragColor;

  // src-over compositing, premultiplied alpha.
  vec4 blendOver(vec4 src, vec4 dst) {
    return vec4(src.rgb + dst.rgb * (1.0 - src.a), src.a + dst.a * (1.0 - src.a));
  }

  void main() {
    // === Organic interior fill with a drifting two-color gradient ===
    float n01 = vNoise * 0.5 + 0.5;
    // uFillRadius scales how much of the surface the body covers, like a
    // radius: 1 = default, <1 raises the entry threshold so the fill tightens
    // to the wave peaks (smaller radius), >1 lowers it so the fill floods.
    float fillLo = clamp(uFillLow - (uFillRadius - 1.0) * 0.5, 0.0, uFillHigh - 0.02);
    float fillS = smoothstep(fillLo, uFillHigh, n01);
    // Slow gradient noise — interpolated from the vertex shader.
    float g = vFillGrad * 0.5 + 0.5;
    vec3 gradCol = mix(uFillColor, uFillColor2, g);
    // Deepen the very peaks for extra body.
    gradCol = mix(gradCol, uDeepColor, smoothstep(0.82, 1.0, n01) * 0.55);
    vec3 fillCol = mix(uPaleColor, gradCol, fillS);
    float fillA = uFillAlpha * fillS;
    vec4 acc = vec4(fillCol * fillA, fillA);

    // === Stripe lines ringing the cylinder ===
    float v = vUv.y * uLineCount;
    float dLine = abs(fract(v + 0.5) - 0.5);
    float grad = fwidth(v) + 1e-5;
    float halfW = 0.5 * uLineWidth * grad;
    float line = 1.0 - smoothstep(halfW, halfW + grad, dLine);
    float alias = 1.0 - smoothstep(0.3, 0.62, grad);
    float dn = vLineDissolve * 0.5 + 0.5;
    float dissolve = smoothstep(uLineFadeLow, uLineFadeHigh, dn);
    float lineA = line * uLineAlpha * alias * dissolve;
    acc = blendOver(vec4(uLineColor * lineA, lineA), acc);

    float outA = acc.a;
    fragColor = outA < 0.003
      ? vec4(0.0)
      : vec4(acc.rgb / max(outA, 1e-3), outA);
  }
`

/** Hatch shell pass: dash grids only, floating above the wave via uLift. */
export const CONNECT_HATCH_FRAGMENT = /* glsl */ `
  precision mediump float;
  uniform highp float uTime;
  uniform float uPlaneW;
  uniform float uPlaneH;

  uniform float uHatchAngle;
  uniform float uHatchSpacing;
  uniform float uHatchCell;
  uniform float uHatchFill;
  uniform float uDashMin;
  uniform float uDashMax;
  uniform float uHatchDensity;
  uniform float uDensityFloor;
  uniform float uHatchDrift;
  uniform float uWaveGate;
  uniform float uEnvCenter;
  uniform float uEnvSlope;
  uniform float uEnvWidth;

  uniform vec3 uPaleColor;
  uniform vec3 uSalmonColor;
  uniform vec3 uOrangeColor;
  uniform vec3 uAmberColor;
  uniform vec3 uDeepColor;

  varying vec2 vUv;
  varying float vNoise;
  varying float vFillGrad;
  varying float vLineDissolve;
  varying vec2 vScreen;

  out vec4 fragColor;

  vec4 blendOver(vec4 src, vec4 dst) {
    return vec4(src.rgb + dst.rgb * (1.0 - src.a), src.a + dst.a * (1.0 - src.a));
  }

  void main() {
    vec2 suv = vec2(vUv.x * uPlaneW, vUv.y * uPlaneH);

    // Screen-space density swath — rational approx of exp(-x²), same falloff shape.
    float centerY = uEnvCenter + uEnvSlope * (vScreen.x - 0.5);
    float envW = max(uEnvWidth * (0.6 + 0.9 * vScreen.x), 0.02);
    float dyEnv = (vScreen.y - centerY) / envW;
    float dy2 = dyEnv * dyEnv;
    float env = (1.0 / (1.0 + dy2 + dy2 * dy2 * 0.5)) * mix(0.25, 1.2, clamp(vScreen.x, 0.0, 1.0));

    const float SP_MUL[3]    = float[3](0.65, 1.5, 2.9);
    const float CELL_MUL[3]  = float[3](0.75, 1.0, 1.35);
    const float DEN_MUL[3]   = float[3](1.35, 1.0, 0.55);
    const float FLOOR_MUL[3] = float[3](1.0, 0.4, 0.0);
    const float ALPHA_MUL[3] = float[3](0.7, 0.95, 1.0);
    const float AO_C[3]      = float[3](1.0, 0.999902, 0.999800);
    const float AO_S[3]      = float[3](0.0, 0.013999, -0.019999);
    const float DRIFT_MUL[3] = float[3](1.0, 0.7, 0.45);

    // Wave gate from the same field as displacement — avoids 3× snoise per pixel.
    float nA = vNoise * 0.5 + 0.5;
    float gate = mix(1.0, smoothstep(0.35, 0.78, nA), uWaveGate);

    vec4 acc = vec4(0.0);
    float baseAng = radians(uHatchAngle);
    float bc = cos(baseAng);
    float bs = sin(baseAng);
    for (int L = 0; L < 3; L++) {
      vec2 dir = vec2(bc * AO_C[L] - bs * AO_S[L], bs * AO_C[L] + bc * AO_S[L]);
      vec2 perp = vec2(-dir.y, dir.x);
      float sp = max(uHatchSpacing * SP_MUL[L], 0.005);
      float cell = max(uHatchCell * CELL_MUL[L], 0.05);

      vec2 rc = vec2(dot(suv, dir), dot(suv, perp));
      float row = floor(rc.y / sp);
      float wLocal = rc.y - (row + 0.5) * sp;

      float rowH = hash(vec2(row, 17.0 + float(L) * 31.0));
      float uOff = rowH * 91.3
        + uTime * uHatchDrift * DRIFT_MUL[L] * (0.35 + 0.65 * hash(vec2(row, 3.7)));
      float uu = rc.x + uOff;
      float cid = floor(uu / cell);
      float cu = uu - cid * cell;

      vec2 seed = vec2(cid, row * 3.17 + float(L) * 29.3);
      float s1 = hash(seed);
      float s2 = hash(seed + 7.31);
      float s3 = hash(seed + 19.13);
      float s4 = hash(seed + 11.71);

      float dens = clamp(
        env * gate * uHatchDensity * DEN_MUL[L] + uDensityFloor * FLOOR_MUL[L],
        0.0,
        1.0
      );

      // Soft threshold: dashes fade in/out as the crest passes, not pop.
      float vis = smoothstep(s1 - 0.06, s1 + 0.06, dens);

      float len = cell * mix(uDashMin, uDashMax, s2);
      float start = (cell - len) * s4;
      float halfT = sp * uHatchFill * 0.5 * (0.55 + 0.45 * s3);
      float duEdge = min(cu - start, start + len - cu);
      float dwEdge = halfT - abs(wLocal);
      float aaU = fwidth(uu) + 1e-4;
      float aaW = fwidth(rc.y) + 1e-4;
      float m = smoothstep(0.0, aaU * 1.5, duEdge) * smoothstep(0.0, aaW * 1.5, dwEdge);

      float c = hash(seed + 23.9);
      vec3 dashColor = c < 0.24 ? uPaleColor
        : c < 0.44 ? uSalmonColor
        : c < 0.68 ? uOrangeColor
        : c < 0.88 ? uAmberColor
        : uDeepColor;
      float sat = clamp(dens * 2.2, 0.0, 1.0);
      dashColor = mix(mix(uPaleColor, dashColor, 0.55), dashColor, sat);

      float dashA = ALPHA_MUL[L] * m * vis * mix(0.8, 1.0, s3);
      acc = blendOver(vec4(dashColor * dashA, dashA), acc);
    }

    float outA = acc.a;
    fragColor = outA < 0.003
      ? vec4(0.0)
      : vec4(acc.rgb / max(outA, 1e-3), outA);
  }
`

/**
 * Emitter — dash-shaped particles the wave continually sheds: seeded on the
 * surface, launched outward along the normal, fading as they fly. Oriented
 * along the cylinder's LENGTH (the hatch direction) and sized in WORLD units
 * so they match the hatch dashes and stay visible at any zoom.
 */
export const CONNECT_EMITTER_VERTEX = /* glsl */ `
  uniform highp float uTime;
  uniform float uWavesX;
  uniform float uWavesY;
  uniform float uSpeedX;
  uniform float uSpeedY;
  uniform float uDisplacementHeight;
  uniform float uEmitAmount;
  uniform float uEmitSpeed;
  uniform float uEmitDist;
  uniform float uEmitFall;
  uniform float uEmitSize;
  uniform float uViewportY;

  uniform vec3 uPaleColor;
  uniform vec3 uSalmonColor;
  uniform vec3 uOrangeColor;
  uniform vec3 uAmberColor;
  uniform vec3 uDeepColor;

  in vec3 aRand;
  in vec3 aTangent;

  varying vec3 vColor;
  varying float vAlpha;
  varying vec2 vDir;

  void main() {
    // Same wave field as the mesh, so particles stay glued to the surface.
    vec2 waveUv = vec2(
      (uv.x + uTime * uSpeedX) * uWavesX,
      (uv.y + uTime * uSpeedY) * uWavesY
    );
    float n = snoise(waveUv);
    float n01 = n * 0.5 + 0.5;
    vec3 surf = position + normal * n * uDisplacementHeight;

    // Per-particle launch cycle, desynchronised by the random attribute.
    float rate = uEmitSpeed * (0.5 + aRand.x);
    float t = uTime * rate + aRand.y * 19.0;
    float cycle = fract(t);
    float lifeId = floor(t);

    // Crests shed particles; troughs stay quiet. Re-rolled every cycle so
    // emission follows the wave instead of being a fixed particle subset.
    float gate = smoothstep(0.45, 0.85, n01);
    float roll = hash(vec2(aRand.z * 913.7, lifeId));
    float act = step(1.0 - clamp(uEmitAmount * gate, 0.0, 1.0), roll);

    // Burst physics: eased launch — explodes off the surface, then coasts.
    float inv = 1.0 - cycle;
    float eased = 1.0 - inv * inv * sqrt(inv);
    float dist = eased * uEmitDist * (0.6 + 0.8 * aRand.x);
    // Lateral streak along the length as it flies, so trajectories read as
    // energetic diagonal sprays rather than straight pop-offs.
    float lateral = (aRand.z - 0.5) * 2.0 * eased * uEmitDist * 0.3;
    // Downward advection with the wave: the crest pattern scrolls toward -uv.y
    // (down the cylinder). Carrying the particle down -aTangent at a steady
    // (linear-in-cycle) rate makes it ride the wave's flow while also flying
    // out — two simultaneous directions, tracing a diagonal fall.
    float fall = cycle * uEmitFall * (0.7 + 0.6 * aRand.y);
    vec3 pos = surf + normal * (0.15 + dist) + aTangent * (lateral - fall);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    // Screen-space direction of the surface's LENGTH tangent — the same
    // direction the hatch dashes run — for stretching in the fragment.
    vec4 clipA = gl_Position;
    vec4 clipB = projectionMatrix * (modelViewMatrix * vec4(pos + aTangent, 1.0));
    vec2 d2 = clipB.xy / max(clipB.w, 1e-4) - clipA.xy / max(clipA.w, 1e-4);
    vDir = normalize(d2 + vec2(1e-5, 0.0));

    float fadeIn = smoothstep(0.0, 0.08, cycle);
    float fadeOut = 1.0 - smoothstep(0.45, 1.0, cycle);
    vAlpha = act * fadeIn * fadeOut;

    float c = hash(vec2(aRand.y * 517.3, lifeId + 7.0));
    vColor = c < 0.24 ? uPaleColor
      : c < 0.44 ? uSalmonColor
      : c < 0.68 ? uOrangeColor
      : c < 0.88 ? uAmberColor
      : uDeepColor;

    // WORLD-unit sizing: uEmitSize is the dash length in world units, so the
    // sprite scales exactly like the mesh's hatch dashes at any camera zoom.
    // pixels = world * (viewportPx / (2 * tan(fov/2) * dist)); projection[1][1]
    // is 1/tan(fov/2).
    float worldLen = uEmitSize * (0.6 + 0.8 * aRand.y);
    float pxSize = worldLen * projectionMatrix[1][1] * uViewportY * 0.5 / max(-mv.z, 0.1);
    gl_PointSize = min(pxSize, 128.0);
  }
`

export const CONNECT_EMITTER_FRAGMENT = /* glsl */ `
  precision mediump float;
  uniform float uEmitStretch;
  uniform float uEmitAlpha;

  varying vec3 vColor;
  varying float vAlpha;
  varying vec2 vDir;

  out vec4 fragColor;

  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    c.y = -c.y;
    // Rectangular dash, long axis along the surface tangent — matches the
    // hatch pattern instead of reading as a round spark.
    vec2 perp = vec2(-vDir.y, vDir.x);
    float along = dot(c, vDir);
    float across = dot(c, perp);
    float wHalf = clamp(1.0 / max(uEmitStretch, 1.0), 0.04, 1.0);
    float mask = (1.0 - smoothstep(0.78, 0.92, abs(along)))
      * (1.0 - smoothstep(wHalf * 0.7, wHalf, abs(across)));
    float alpha = mask * vAlpha * uEmitAlpha;
    if (alpha < 0.004) discard;
    // Straight alpha — matches the base/hatch passes and Three.js NormalBlending.
    // Premultiplied rgb here reads as a dark halo at every soft edge.
    fragColor = vec4(vColor, alpha);
  }
`
