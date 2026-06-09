/**
 * GLSL chunks injected into a MeshStandardMaterial via `onBeforeCompile`.
 * Simplex noise is the MIT-licensed implementation by Stefan Gustavson + Ian McEwan
 * (https://github.com/stegu/webgl-noise) — credit preserved inline.
 */
export const WAVE_SHADER_NOISE_UTILS = /* glsl */ `
  float remap(float value, float min1, float max1, float min2, float max2) {
    return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
  }

  vec3 permute(vec3 x){
    return mod(((x*34.0)+1.0)*x, 289.0);
  }

  // Simplex noise — MIT, Stefan Gustavson + Ian McEwan
  // https://github.com/stegu/webgl-noise
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute( permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m;
    m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
`

export const WAVE_SHADER_VERTEX_PARS = /* glsl */ `
  uniform float uWavesX;
  uniform float uWavesY;
  uniform float uDisplacementHeight;
  uniform float uTime;
  uniform float uSpeedX;
  uniform float uSpeedY;
  uniform vec3 uPrimaryColor;
  uniform vec3 uValleyColor;
  uniform vec3 uPeakColor;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vTime;
`

export const WAVE_SHADER_FRAGMENT_PARS = /* glsl */ `
  varying vec3 vColor;
  varying vec2 vUv;
  varying float vTime;
  uniform float uVisibleBand;
  uniform float uVisibleFade;
`

export const WAVE_SHADER_VERTEX_DISPLACEMENT = /* glsl */ `
  vUv = uv;
  vec2 waveUv = vec2((uv.x + uTime * uSpeedX) * uWavesX, (uv.y + uTime * uSpeedY) * uWavesY);
  float noiseValue = snoise(waveUv);
  transformed += normalize(objectNormal) * noiseValue * uDisplacementHeight;
  vTime = uTime;
`

export const WAVE_SHADER_VERTEX_COLOR = /* glsl */ `
  float remapedNoise = remap(noiseValue, -1.0, 1.0, 0.0, 1.0);
  vColor = uPrimaryColor;
  vColor = mix(uPeakColor, vColor, smoothstep(0.0, 0.5, remapedNoise));
  vColor = mix(vColor, uValleyColor, smoothstep(0.5, 1.0, remapedNoise));
`

export const WAVE_SHADER_FRAGMENT_COLOR = /* glsl */ `
  diffuseColor.rgb = vColor;
`

export const WAVE_SHADER_FRAGMENT_DITHERING = /* glsl */ `
  #include <dithering_fragment>
  float visibleBandY = 1.0 - smoothstep(uVisibleBand, uVisibleBand + uVisibleFade, vUv.y);
  gl_FragColor.a = visibleBandY;
`
