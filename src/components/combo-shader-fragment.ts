/**
 * Combo shader — ONE particle system. Every dot is a sun wisp by default;
 * a radial wave-influence field grows out from the center and locally
 * perturbs the SAME particles: lifts them in Z, brightens them, shifts
 * their color, twists them, and grows their size. The wave doesn't sit
 * on top of the sun — it emerges from within the same substrate.
 *
 * Simplex noise — MIT, Stefan Gustavson + Ian McEwan
 * https://github.com/stegu/webgl-noise
 */
export const COMBO_SHADER_NOISE_UTILS = /* glsl */ `
  vec3 permute(vec3 x) {
    return mod(((x * 34.0) + 1.0) * x, 289.0);
  }

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

  float hash12(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
`

export const COMBO_SHADER_VERTEX = /* glsl */ `
  uniform float uTime;

  uniform float uPlaneWidth;
  uniform float uPlaneHeight;
  uniform float uDriftSpeed;

  uniform float uWavesScale;
  uniform float uWaveSpeedX;
  uniform float uWaveSpeedY;
  uniform float uDisplacement;
  uniform float uTwist;

  uniform float uWaveRadius;
  uniform float uWaveSoft;
  uniform float uWavePulseSpeed;
  uniform float uWavePulseAmp;
  uniform float uWaveStrength;
  uniform float uWaveBoost;
  uniform float uWaveBreathBias;
  uniform float uWaveAspect;
  uniform float uWaveBoundaryAmp;
  uniform float uWaveBoundaryScale;
  uniform float uWaveTravelSpeed;
  uniform float uWaveTravelRange;

  uniform float uPointSize;
  uniform float uPointSizePeak;
  uniform float uSizeAttenuation;

  uniform float uValleyBrightness;
  uniform float uPeakBrightness;
  uniform float uVisibleThreshold;
  uniform float uShimmerAmp;
  uniform float uShimmerSpeed;

  uniform vec3 uCalmColor;
  uniform vec3 uPeakColor;

  varying vec3 vColor;
  varying float vBrightness;
  varying float vAlpha;
  varying float vWaveInfluence;
  varying float vCore;

  void main() {
    // Each particle drifts upward continuously, wrapping at the top so
    // the field reads as a flowing column of sun wisps.
    vec3 base = position;
    float halfH = uPlaneHeight * 0.5;
    base.y -= uTime * uDriftSpeed;
    base.y = mod(base.y + halfH, uPlaneHeight) - halfH;

    // Wave-influence center travels upward over time, wrapping. The wave
    // appears to rise through the field — combined with the per-particle
    // drift this gives a clear "growing from bottom to top" flow.
    float waveCenterY = uWaveTravelRange <= 0.001
      ? 0.0
      : mod(uTime * uWaveTravelSpeed + uWaveTravelRange * 0.5, uWaveTravelRange) - uWaveTravelRange * 0.5;

    // Squeeze the influence horizontally so the wave grows as a vertical
    // column rather than a circle — fits the "moving bottom→top" mental
    // model.
    float r = length(vec2(base.x * uWaveAspect, base.y - waveCenterY));

    // Breath: radius oscillates between (1-amp) and (1+amp) of base, with
    // bias so it spends more time small than blown out — feels like a
    // pulse growing outward.
    float pulse = 0.5 + 0.5 * sin(uTime * uWavePulseSpeed);
    pulse = pow(pulse, mix(1.0, 2.5, uWaveBreathBias));
    float currentRadius = uWaveRadius * mix(1.0 - uWavePulseAmp, 1.0 + uWavePulseAmp, pulse);

    // Organic noise-modulated boundary so the wave-zone edge feels alive,
    // not a perfect ellipse. Slow time advection makes the shape morph.
    vec2 boundaryUv = base.xy * uWaveBoundaryScale + vec2(0.0, uTime * 0.18);
    float boundaryNoise = snoise(boundaryUv) * uWaveBoundaryAmp;
    float effectiveR = r + boundaryNoise;

    // Soft falloff: 1 inside the wave zone, 0 outside.
    float mask = 1.0 - smoothstep(currentRadius - uWaveSoft, currentRadius + uWaveSoft, effectiveR);
    mask *= uWaveStrength;

    // Same simplex noise field as the wave shader, advected with time.
    // UV is 0..1 across the grid.
    vec2 noiseUv = uv * uWavesScale + vec2(uWaveSpeedX, uWaveSpeedY) * uTime;
    float n = snoise(noiseUv);
    float n01 = n * 0.5 + 0.5;

    // Z displacement modulated by mask: particles inside the wave zone
    // lift out of the plane along noise peaks.
    vec3 lifted = base;
    lifted.z += n * uDisplacement * mask;

    // Twist around Y, also gated by mask, so the wave swirls organically
    // while peripheral particles stay flat.
    float twistAngle = n * uTwist * mask;
    float cz = cos(twistAngle), sz = sin(twistAngle);
    vec3 twisted = vec3(
      cz * lifted.x - sz * lifted.z,
      lifted.y,
      sz * lifted.x + cz * lifted.z
    );

    vec4 mvPosition = modelViewMatrix * vec4(twisted, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Per-particle randomness for shimmer + visibility.
    float seed = hash12(uv * 1024.0);

    // Brightness: baseline noise of the field + a wave-peak boost where
    // both the influence mask and noise peaks coincide.
    float baseBright = mix(uValleyBrightness, uPeakBrightness, seed);
    float wavePeak = max(n01 - 0.45, 0.0) * (1.0 / 0.55);
    float boost = wavePeak * mask * uWaveBoost;
    vBrightness = baseBright + boost;

    // Color: calm → peak warm/cream where the wave is most expressed.
    float waveT = clamp(mask * n01, 0.0, 1.0);
    vColor = mix(uCalmColor, uPeakColor, waveT);

    // Size: same particle grows as the wave passes through it.
    float sizeFactor = mix(uPointSize, uPointSizePeak, mask * n01);
    gl_PointSize = sizeFactor * (uSizeAttenuation / max(-mvPosition.z, 0.001));

    // Alpha: random visibility + shimmer envelope; wave-influenced
    // particles override the visibility cull so the wave reads fully.
    float visGate = step(uVisibleThreshold, seed);
    float shimmerEnv = 0.5 + 0.5 * sin(uTime * uShimmerSpeed + seed * 6.2831853);
    float shimmer = mix(1.0 - uShimmerAmp, 1.0, shimmerEnv);
    float waveReveal = clamp(mask * 1.5, 0.0, 1.0);
    vAlpha = max(visGate, waveReveal) * shimmer;
    vWaveInfluence = waveT;
    vCore = 0.0;
  }
`

export const COMBO_SHADER_FRAGMENT = /* glsl */ `
  uniform float uDotRadius;
  uniform float uDotSoft;
  uniform float uCoreAmp;
  uniform float uBloomFalloff;
  uniform float uBloomAmp;
  uniform float uOverlapBloom;
  uniform vec3 uCoreColor;

  varying vec3 vColor;
  varying float vBrightness;
  varying float vAlpha;
  varying float vWaveInfluence;

  void main() {
    if (vAlpha < 0.01) discard;

    vec2 c = gl_PointCoord - 0.5;
    float r = length(c) * 2.0;
    if (r > 1.0) discard;

    // Sharp pinprick — the falloff window is intentionally tight so calm
    // wisps read as crisp dots, not gaussian smudges. Soft edge keeps
    // anti-aliasing.
    float core = 1.0 - smoothstep(uDotRadius - uDotSoft, uDotRadius + uDotSoft, r);

    // Bloom is contained to the point sprite and gated by wave influence,
    // so the calm field stays sharp and only the wave-touched particles
    // grow a halo as they emerge.
    float bloomGate = clamp(vWaveInfluence * 1.6, 0.0, 1.0);
    float bloom = exp(-r * r * uBloomFalloff) * bloomGate;

    float intensity = core * uCoreAmp + bloom * uBloomAmp;
    intensity += core * core * intensity * uOverlapBloom;
    intensity *= vBrightness * vAlpha;

    // Hot core color only blooms inside wave-influenced particles.
    vec3 finalColor = mix(vColor, uCoreColor, core * vWaveInfluence);
    gl_FragColor = vec4(finalColor * intensity, intensity);
  }
`
