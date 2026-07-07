"use client"

import { useFBO } from "@react-three/drei"
import { createPortal, useFrame, useThree } from "@react-three/fiber"
import { advanceShaderDevAnimationDelta } from "shader-panel"
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react"
import {
  GLSL3,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  type Camera,
  type WebGLRenderer,
} from "three"
import type { ConnectShaderConfig } from "./connect-shader-config"
import {
  CONNECT_POSTFX_FRAGMENT,
  CONNECT_POSTFX_VERTEX,
} from "./connect-postfx-shader"

export type ConnectPostFxUniforms = {
  uBlur: number
  uBokeh: number
  uBokehThreshold: number
  uChroma: number
  uVignette: number
  uGrain: number
  uContrast: number
  uSaturation: number
  uExposure: number
  uSharpness: number
  uWarmth: number
  uProgBlur: number
  uProgFocus: number
  uFlare: number
  uFlareSpread: number
  uFlareThreshold: number
  uFlareX: number
  uFlareY: number
}

const BOKEH_THRESHOLD_NEUTRAL = 0.65
const PROG_FOCUS_NEUTRAL = 0.35
const FLARE_THRESHOLD_NEUTRAL = 0.72
const FLARE_SPREAD_NEUTRAL = 0.5

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

function uniformsFromConfig(config: ConnectShaderConfig): ConnectPostFxUniforms {
  return {
    uBlur: config.postBlur,
    uBokeh: config.postBokeh,
    uBokehThreshold: config.postBokehThreshold,
    uChroma: config.postChroma,
    uVignette: config.postVignette,
    uGrain: config.postGrain,
    uContrast: config.postContrast,
    uSaturation: config.postSaturation,
    uExposure: config.postExposure,
    uSharpness: config.postSharpness,
    uWarmth: config.postWarmth,
    uProgBlur: config.postProgBlur,
    uProgFocus: config.postProgFocus,
    uFlare: config.postFlare,
    uFlareSpread: config.postFlareSpread,
    uFlareThreshold: config.postFlareThreshold,
    uFlareX: config.postFlareX,
    uFlareY: config.postFlareY,
  }
}

function blendPresetWithSliders(
  preset: ConnectPostFxUniforms,
  sliders: ConnectPostFxUniforms,
): ConnectPostFxUniforms {
  return {
    uBlur: clamp(preset.uBlur + sliders.uBlur, 0, 1),
    uBokeh: clamp(preset.uBokeh + sliders.uBokeh, 0, 1),
    uBokehThreshold: clamp(
      preset.uBokehThreshold + (sliders.uBokehThreshold - BOKEH_THRESHOLD_NEUTRAL),
      0.2,
      0.95,
    ),
    uChroma: clamp(preset.uChroma + sliders.uChroma, 0, 1),
    uVignette: clamp(preset.uVignette + sliders.uVignette, 0, 1),
    uGrain: clamp(preset.uGrain + sliders.uGrain, 0, 1),
    uSharpness: clamp(preset.uSharpness + sliders.uSharpness, 0, 1),
    uWarmth: clamp(preset.uWarmth + sliders.uWarmth, -1, 1),
    uContrast: preset.uContrast * sliders.uContrast,
    uSaturation: preset.uSaturation * sliders.uSaturation,
    uExposure: preset.uExposure * sliders.uExposure,
    uProgBlur: clamp(preset.uProgBlur + sliders.uProgBlur, 0, 1),
    uProgFocus: clamp(
      preset.uProgFocus + (sliders.uProgFocus - PROG_FOCUS_NEUTRAL),
      0,
      1,
    ),
    uFlare: clamp(preset.uFlare + sliders.uFlare, 0, 1),
    uFlareSpread: clamp(
      preset.uFlareSpread + (sliders.uFlareSpread - FLARE_SPREAD_NEUTRAL),
      0,
      1,
    ),
    uFlareThreshold: clamp(
      preset.uFlareThreshold +
        (sliders.uFlareThreshold - FLARE_THRESHOLD_NEUTRAL),
      0.4,
      0.98,
    ),
    uFlareX: sliders.uFlareX,
    uFlareY: sliders.uFlareY,
  }
}

type ConnectPostFxPreset = ConnectShaderConfig["postPreset"]

const ZERO_FX: ConnectPostFxUniforms = {
  uBlur: 0,
  uBokeh: 0,
  uBokehThreshold: BOKEH_THRESHOLD_NEUTRAL,
  uChroma: 0,
  uVignette: 0,
  uGrain: 0,
  uContrast: 1,
  uSaturation: 1,
  uExposure: 1,
  uSharpness: 0,
  uWarmth: 0,
  uProgBlur: 0,
  uProgFocus: PROG_FOCUS_NEUTRAL,
  uFlare: 0,
  uFlareSpread: FLARE_SPREAD_NEUTRAL,
  uFlareThreshold: FLARE_THRESHOLD_NEUTRAL,
  uFlareX: 0.58,
  uFlareY: 0.42,
}

const POST_PRESETS: Record<
  Exclude<ConnectPostFxPreset, "custom" | "off">,
  ConnectPostFxUniforms
> = {
  soft: {
    ...ZERO_FX,
    uBlur: 0.18,
    uBokeh: 0.22,
    uBokehThreshold: 0.58,
    uChroma: 0.08,
    uVignette: 0.18,
    uGrain: 0.04,
    uContrast: 1.02,
    uSaturation: 1.05,
    uExposure: 1.02,
    uWarmth: 0.08,
    uProgBlur: 0.42,
    uProgFocus: 0.38,
  },
  cinematic: {
    ...ZERO_FX,
    uBlur: 0.12,
    uBokeh: 0.35,
    uBokehThreshold: 0.62,
    uChroma: 0.38,
    uVignette: 0.48,
    uGrain: 0.14,
    uContrast: 1.1,
    uSaturation: 0.94,
    uExposure: 1.04,
    uSharpness: 0.12,
    uWarmth: 0.15,
    uProgBlur: 0.22,
    uFlare: 0.28,
    uFlareSpread: 0.55,
  },
  dreamy: {
    ...ZERO_FX,
    uBlur: 0.12,
    uBokeh: 0.52,
    uBokehThreshold: 0.52,
    uChroma: 0.12,
    uVignette: 0.22,
    uGrain: 0.06,
    uContrast: 0.96,
    uSaturation: 1.14,
    uExposure: 1.06,
    uWarmth: 0.2,
    uProgBlur: 0.78,
    uProgFocus: 0.26,
  },
  punchy: {
    ...ZERO_FX,
    uBlur: 0.05,
    uBokeh: 0.18,
    uBokehThreshold: 0.68,
    uChroma: 0.15,
    uVignette: 0.28,
    uGrain: 0.08,
    uContrast: 1.22,
    uSaturation: 1.26,
    uExposure: 1.08,
    uSharpness: 0.38,
    uWarmth: 0.05,
    uProgBlur: 0.08,
  },
  bloom: {
    ...ZERO_FX,
    uBlur: 0.28,
    uBokeh: 0.72,
    uBokehThreshold: 0.48,
    uChroma: 0.06,
    uVignette: 0.12,
    uGrain: 0.03,
    uContrast: 1.05,
    uSaturation: 1.1,
    uExposure: 1.1,
    uSharpness: 0.05,
    uWarmth: 0.1,
    uFlare: 0.35,
  },
  retro: {
    ...ZERO_FX,
    uBlur: 0.08,
    uBokeh: 0.1,
    uBokehThreshold: 0.7,
    uChroma: 0.55,
    uVignette: 0.55,
    uGrain: 0.28,
    uContrast: 1.15,
    uSaturation: 0.88,
    uExposure: 0.98,
    uSharpness: 0.08,
    uWarmth: 0.25,
    uFlare: 0.2,
    uFlareSpread: 0.65,
  },
  flare: {
    ...ZERO_FX,
    uBlur: 0.1,
    uBokeh: 0.45,
    uBokehThreshold: 0.55,
    uChroma: 0.22,
    uVignette: 0.32,
    uExposure: 1.12,
    uSaturation: 1.08,
    uProgBlur: 0.48,
    uProgFocus: 0.22,
    uFlare: 0.72,
    uFlareSpread: 0.68,
    uFlareThreshold: 0.58,
    uFlareX: 0.55,
    uFlareY: 0.38,
  },
}

export function resolveConnectPostFxUniforms(
  config: ConnectShaderConfig,
): ConnectPostFxUniforms {
  const sliders = uniformsFromConfig(config)
  if (config.postPreset === "off" || config.postPreset === "custom") {
    return sliders
  }
  return blendPresetWithSliders(POST_PRESETS[config.postPreset], sliders)
}

export function isConnectPostFxActive(config: ConnectShaderConfig): boolean {
  return config.postEnabled
}

export type ConnectPostFxApi = {
  bufferScene: Scene
  renderFrame: (
    gl: WebGLRenderer,
    camera: Camera,
    targetWidth?: number,
    targetHeight?: number,
  ) => void
}

const ConnectPostFxContext = createContext<ConnectPostFxApi | null>(null)

export function useConnectPostFx(): ConnectPostFxApi | null {
  return useContext(ConnectPostFxContext)
}

type ConnectPostPipelineProps = {
  config: ConnectShaderConfig
  /** Drawn through the post pass when FX are active. */
  scene: ReactNode
  /** Stays in the main R3F tree (capture hooks, etc.). */
  overlay?: ReactNode
}

/** Routes scene draws through an FBO + single post pass when enabled. */
export function ConnectPostPipeline({
  config,
  scene,
  overlay = null,
}: ConnectPostPipelineProps) {
  const postActive = isConnectPostFxActive(config)
  const api = useMemo<ConnectPostFxApi>(
    () => ({
      bufferScene: new Scene(),
      renderFrame: () => {},
    }),
    [],
  )

  return (
    <ConnectPostFxContext.Provider value={postActive ? api : null}>
      {postActive ? createPortal(scene, api.bufferScene) : scene}
      {postActive ? <ConnectPostFxRenderer api={api} config={config} /> : null}
      {overlay}
    </ConnectPostFxContext.Provider>
  )
}

function ConnectPostFxRenderer({
  api,
  config,
}: {
  api: ConnectPostFxApi
  config: ConnectShaderConfig
}) {
  const { gl, camera, size, viewport } = useThree()
  const fbo = useFBO(size.width * viewport.dpr, size.height * viewport.dpr, {
    depthBuffer: true,
    type: UnsignedByteType,
  })
  const animTimeRef = useRef(0)
  const configRef = useRef(config)
  configRef.current = config

  const postScene = useMemo(() => new Scene(), [])
  const postCamera = useMemo(
    () => new OrthographicCamera(-1, 1, 1, -1, 0, 1),
    [],
  )

  const uniforms = useMemo(
    () => ({
      tDiffuse: { value: fbo.texture },
      uResolution: { value: [fbo.width, fbo.height] as [number, number] },
      uTime: { value: 0 },
      uBlur: { value: 0 },
      uBokeh: { value: 0 },
      uBokehThreshold: { value: 0.65 },
      uChroma: { value: 0 },
      uVignette: { value: 0 },
      uGrain: { value: 0 },
      uContrast: { value: 1 },
      uSaturation: { value: 1 },
      uExposure: { value: 1 },
      uSharpness: { value: 0 },
      uWarmth: { value: 0 },
      uProgBlur: { value: 0 },
      uProgFocus: { value: PROG_FOCUS_NEUTRAL },
      uFlare: { value: 0 },
      uFlareSpread: { value: FLARE_SPREAD_NEUTRAL },
      uFlareThreshold: { value: FLARE_THRESHOLD_NEUTRAL },
      uFlareX: { value: 0.58 },
      uFlareY: { value: 0.42 },
    }),
    [fbo.texture],
  )

  const material = useMemo(
    () =>
      new ShaderMaterial({
        glslVersion: GLSL3,
        uniforms,
        vertexShader: CONNECT_POSTFX_VERTEX,
        fragmentShader: CONNECT_POSTFX_FRAGMENT,
        depthTest: false,
        depthWrite: false,
      }),
    [uniforms],
  )

  useEffect(() => {
    const mesh = new Mesh(new PlaneGeometry(2, 2), material)
    postScene.add(mesh)
    return () => {
      postScene.remove(mesh)
      mesh.geometry.dispose()
      material.dispose()
    }
  }, [material, postScene])

  api.renderFrame = (
    renderGl,
    renderCamera,
    targetWidth,
    targetHeight,
  ) => {
    const w = targetWidth ?? size.width * viewport.dpr
    const h = targetHeight ?? size.height * viewport.dpr
    if (fbo.width !== w || fbo.height !== h) {
      fbo.setSize(w, h)
    }

    const fx = resolveConnectPostFxUniforms(configRef.current)
    uniforms.uResolution.value = [fbo.width, fbo.height]
    uniforms.uBlur.value = fx.uBlur
    uniforms.uBokeh.value = fx.uBokeh
    uniforms.uBokehThreshold.value = fx.uBokehThreshold
    uniforms.uChroma.value = fx.uChroma
    uniforms.uVignette.value = fx.uVignette
    uniforms.uGrain.value = fx.uGrain
    uniforms.uContrast.value = fx.uContrast
    uniforms.uSaturation.value = fx.uSaturation
    uniforms.uExposure.value = fx.uExposure
    uniforms.uSharpness.value = fx.uSharpness
    uniforms.uWarmth.value = fx.uWarmth
    uniforms.uProgBlur.value = fx.uProgBlur
    uniforms.uProgFocus.value = fx.uProgFocus
    uniforms.uFlare.value = fx.uFlare
    uniforms.uFlareSpread.value = fx.uFlareSpread
    uniforms.uFlareThreshold.value = fx.uFlareThreshold
    uniforms.uFlareX.value = fx.uFlareX
    uniforms.uFlareY.value = fx.uFlareY

    const prevTarget = renderGl.getRenderTarget()
    renderGl.setRenderTarget(fbo)
    renderGl.clear()
    renderGl.render(api.bufferScene, renderCamera)

    renderGl.setRenderTarget(prevTarget)
    renderGl.clear()
    renderGl.render(postScene, postCamera)
  }

  useFrame(() => {
    const { time } = advanceShaderDevAnimationDelta(animTimeRef.current)
    animTimeRef.current = time
    uniforms.uTime.value = time
    api.renderFrame(gl, camera)
  }, 1)

  return null
}
