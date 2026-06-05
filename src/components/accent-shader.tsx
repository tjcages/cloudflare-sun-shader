"use client"

import { ShaderMount } from "@paper-design/shaders"
import { useCallback, useEffect, useRef, useState } from "react"
import { useInView } from "../hooks/use-in-view"
import { cn } from "../lib/utils"
import { SHADER_PIXEL_BUDGET } from "../lib/shader-pixel-budget"
import {
  ACCENT_SHADER_DEFAULTS,
  type AccentShaderConfig,
  configToShaderUniforms,
} from "./accent-shader-config"
import { ACCENT_SHADER_FRAGMENT } from "./accent-shader-fragment"

const MOUSE_OFF_SCREEN: [number, number] = [-9999, -9999]

type QualityTier = {
  maxPixelCount: number
  minPixelRatio: number
  boltCountCap: number
  shimmerAmpCap: number
  bloomFarAmpCap: number
}

const QUALITY_TIERS: QualityTier[] = [
  {
    maxPixelCount: Math.round(SHADER_PIXEL_BUDGET.maxPixelCount * 0.72),
    minPixelRatio: 1.0,
    boltCountCap: 6,
    shimmerAmpCap: 0.55,
    bloomFarAmpCap: 0.2,
  },
  {
    maxPixelCount: Math.round(SHADER_PIXEL_BUDGET.maxPixelCount * 0.86),
    minPixelRatio: 1.15,
    boltCountCap: 8,
    shimmerAmpCap: 0.72,
    bloomFarAmpCap: 0.25,
  },
  {
    maxPixelCount: SHADER_PIXEL_BUDGET.maxPixelCount,
    minPixelRatio: SHADER_PIXEL_BUDGET.minPixelRatio,
    boltCountCap: 10,
    shimmerAmpCap: 0.83,
    bloomFarAmpCap: 0.3,
  },
]

let webgl2Cached: boolean | null = null
function supportsWebGL2(): boolean {
  if (webgl2Cached !== null) return webgl2Cached
  if (typeof document === "undefined") return false
  try {
    const canvas = document.createElement("canvas")
    const gl = canvas.getContext("webgl2")
    if (!gl) {
      webgl2Cached = false
      return false
    }
    const ext = gl.getExtension("WEBGL_lose_context")
    ext?.loseContext()
    webgl2Cached = true
    return true
  } catch {
    webgl2Cached = false
    return false
  }
}

export type AccentShaderBoltProps = {
  /** 0 = center/random columns, 1 = left/right flanks only */
  edgeBias?: number
  /** Center band to avoid as a fraction of grid width (0–0.45) */
  centerExclusion?: number
  /** Path spread jitter around the anchor column */
  spread?: number
  fromCenterMin?: number
  fromCenterMax?: number
}

export type AccentShaderMouseProps = {
  /** Scales wisp reveal (size, visibility, bloom, brightness) near the cursor */
  revealAmp?: number
  /** Pixels of movement needed to reach full reveal strength */
  motionSensitivity?: number
  /** How long the reveal lingers after the cursor stops (ms) */
  fadeMs?: number
}

interface AccentShaderProps {
  className?: string
  bolts?: AccentShaderBoltProps
  mouse?: AccentShaderMouseProps
}

function boltPropsToConfig(
  bolts: AccentShaderBoltProps | undefined,
): Partial<AccentShaderConfig> {
  if (!bolts) return {}
  return {
    ...(bolts.edgeBias !== undefined && { boltEdgeBias: bolts.edgeBias }),
    ...(bolts.centerExclusion !== undefined && {
      boltCenterExclusion: bolts.centerExclusion,
    }),
    ...(bolts.spread !== undefined && { boltSpread: bolts.spread }),
    ...(bolts.fromCenterMin !== undefined && {
      boltFromCenterMin: bolts.fromCenterMin,
    }),
    ...(bolts.fromCenterMax !== undefined && {
      boltFromCenterMax: bolts.fromCenterMax,
    }),
  }
}

function mousePropsToConfig(
  mouse: AccentShaderMouseProps | undefined,
): Partial<AccentShaderConfig> {
  if (!mouse) return {}
  return {
    ...(mouse.revealAmp !== undefined && { mouseRevealAmp: mouse.revealAmp }),
    ...(mouse.motionSensitivity !== undefined && {
      mouseMotionSensitivity: mouse.motionSensitivity,
    }),
    ...(mouse.fadeMs !== undefined && { mouseRevealFadeMs: mouse.fadeMs }),
  }
}

function initialQualityTierIndex(): number {
  if (typeof window === "undefined") return QUALITY_TIERS.length - 1
  const dpr = window.devicePixelRatio || 1
  const cores = navigator.hardwareConcurrency ?? 8
  const memory =
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
  if (dpr >= 2 || cores <= 4 || memory <= 4) return 0
  if (dpr >= 1.5 || cores <= 6 || memory <= 8) return 1
  return QUALITY_TIERS.length - 1
}

function applyQualityCaps(
  config: AccentShaderConfig,
  tier: QualityTier,
): AccentShaderConfig {
  return {
    ...config,
    boltCount: Math.min(config.boltCount, tier.boltCountCap),
    shimmerAmp: Math.min(config.shimmerAmp, tier.shimmerAmpCap),
    bloomFarAmp: Math.min(config.bloomFarAmp, tier.bloomFarAmpCap),
  }
}

export function AccentShader({ className, bolts, mouse }: AccentShaderProps) {
  const [state, setState] = useState<"loading" | "active" | "fallback">(
    "loading",
  )
  const [shaderConfig, setShaderConfig] = useState<AccentShaderConfig>(() => ({
    ...ACCENT_SHADER_DEFAULTS,
    ...boltPropsToConfig(bolts),
    ...mousePropsToConfig(mouse),
  }))

  useEffect(() => {
    const next = boltPropsToConfig(bolts)
    if (Object.keys(next).length === 0) return
    setShaderConfig((prev) => ({ ...prev, ...next }))
  }, [bolts])

  useEffect(() => {
    const next = mousePropsToConfig(mouse)
    if (Object.keys(next).length === 0) return
    setShaderConfig((prev) => ({ ...prev, ...next }))
  }, [mouse])

  const containerRef = useRef<HTMLDivElement>(null)
  const shaderMountRef = useRef<ShaderMount | null>(null)
  const canvasHostRef = useRef<HTMLDivElement>(null)
  const shaderConfigRef = useRef(shaderConfig)
  shaderConfigRef.current = shaderConfig

  const { ref: inViewRef, isInView } = useInView<HTMLDivElement>({
    rootMargin: "600px",
    threshold: 0,
    loop: true,
  })

  const mouseTargetRef = useRef<[number, number]>(MOUSE_OFF_SCREEN)
  const mouseSmoothRef = useRef<[number, number]>(MOUSE_OFF_SCREEN)
  const mouseRevealTargetRef = useRef(0)
  const mouseRevealSmoothRef = useRef(0)
  const mouseLastMoveAtRef = useRef(0)
  const mouseLastTickAtRef = useRef(0)
  const mouseInSectionRef = useRef(false)
  const mouseRafRef = useRef<number | null>(null)
  const qualityRafRef = useRef<number | null>(null)
  const qualityTierIndexRef = useRef(initialQualityTierIndex())
  const qualitySamplesRef = useRef<number[]>([])
  const qualityLastTickAtRef = useRef(0)
  const qualityLastTierChangeAtRef = useRef(0)

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  )
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const onChange = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  useEffect(() => {
    if (prefersReducedMotion || !supportsWebGL2()) {
      setState("fallback")
      return
    }
    setState("active")
  }, [prefersReducedMotion])

  const applyConfigUniforms = useCallback(
    (nextConfig = shaderConfigRef.current) => {
      const mount = shaderMountRef.current
      if (!mount) return
      const tier = QUALITY_TIERS[qualityTierIndexRef.current]
      const effectiveConfig = applyQualityCaps(nextConfig, tier)
      mount.setSpeed(isInView ? nextConfig.speed : 0)
      mount.setMaxPixelCount(tier.maxPixelCount)
      mount.setMinPixelRatio(tier.minPixelRatio)
      mount.setUniforms(configToShaderUniforms(effectiveConfig))
    },
    [isInView],
  )

  const applyMouseUniforms = useCallback(
    (
      mouse = mouseSmoothRef.current,
      strength = mouseRevealSmoothRef.current,
    ) => {
      shaderMountRef.current?.setUniforms({
        u_mouse: mouse,
        u_mouseStrength: strength,
      })
    },
    [],
  )

  const lastMouseUniformsRef = useRef({
    x: MOUSE_OFF_SCREEN[0],
    y: MOUSE_OFF_SCREEN[1],
    strength: 0,
  })

  useEffect(() => {
    const host = canvasHostRef.current
    if (!host || state !== "active") {
      if (shaderMountRef.current) {
        shaderMountRef.current.dispose()
        shaderMountRef.current = null
        if (host) host.innerHTML = ""
      }
      return
    }

    if (shaderMountRef.current) return

    const mount = new ShaderMount(
      host,
      ACCENT_SHADER_FRAGMENT,
      {
        ...configToShaderUniforms(shaderConfigRef.current),
        u_mouse: MOUSE_OFF_SCREEN,
        u_mouseStrength: 0,
      },
      undefined,
      shaderConfigRef.current.speed,
      0,
      SHADER_PIXEL_BUDGET.minPixelRatio,
      SHADER_PIXEL_BUDGET.maxPixelCount,
    )
    shaderMountRef.current = mount

    return () => {
      mount.dispose()
      shaderMountRef.current = null
      if (host) host.innerHTML = ""
    }
  }, [state])

  useEffect(() => {
    if (state !== "active") return
    applyConfigUniforms(shaderConfig)
  }, [shaderConfig, state, applyConfigUniforms])

  useEffect(() => {
    if (state !== "active" || !isInView) {
      if (qualityRafRef.current !== null) {
        cancelAnimationFrame(qualityRafRef.current)
        qualityRafRef.current = null
      }
      return
    }

    const stop = () => {
      if (qualityRafRef.current === null) return
      cancelAnimationFrame(qualityRafRef.current)
      qualityRafRef.current = null
    }

    const setTier = (nextIndex: number) => {
      const clamped = Math.max(0, Math.min(nextIndex, QUALITY_TIERS.length - 1))
      if (clamped === qualityTierIndexRef.current) return
      qualityTierIndexRef.current = clamped
      qualityLastTierChangeAtRef.current = performance.now()
      applyConfigUniforms()
    }

    qualitySamplesRef.current = []
    qualityLastTickAtRef.current = performance.now()
    qualityLastTierChangeAtRef.current = performance.now()

    const tick = () => {
      const now = performance.now()
      const dt = now - qualityLastTickAtRef.current
      qualityLastTickAtRef.current = now
      qualitySamplesRef.current.push(dt)

      if (qualitySamplesRef.current.length >= 45) {
        const samples = qualitySamplesRef.current
        qualitySamplesRef.current = []
        const avg =
          samples.reduce((sum, value) => sum + value, 0) / samples.length
        const coolingDown = now - qualityLastTierChangeAtRef.current < 2000
        if (!coolingDown) {
          if (avg > 21) {
            setTier(qualityTierIndexRef.current - 1)
          } else if (avg < 15) {
            setTier(qualityTierIndexRef.current + 1)
          }
        }
      }

      qualityRafRef.current = requestAnimationFrame(tick)
    }

    qualityRafRef.current = requestAnimationFrame(tick)
    return stop
  }, [state, isInView, applyConfigUniforms])

  useEffect(() => {
    const container = containerRef.current
    if (!container || state !== "active" || !isInView) return

    const MOUSE_LERP = 0.08
    const STRENGTH_EPS = 0.002
    const POSITION_EPS = 0.25

    const stopMouseLoop = () => {
      if (mouseRafRef.current === null) return
      cancelAnimationFrame(mouseRafRef.current)
      mouseRafRef.current = null
    }

    const syncMouseUniforms = (
      mouse: [number, number],
      strength: number,
      force = false,
    ) => {
      const last = lastMouseUniformsRef.current
      if (
        !force &&
        Math.abs(mouse[0] - last.x) <= POSITION_EPS &&
        Math.abs(mouse[1] - last.y) <= POSITION_EPS &&
        Math.abs(strength - last.strength) <= STRENGTH_EPS
      ) {
        return
      }
      last.x = mouse[0]
      last.y = mouse[1]
      last.strength = strength
      applyMouseUniforms(mouse, strength)
    }

    const mouseEffectIdle = () => {
      if (mouseInSectionRef.current) return false
      if (mouseRevealTargetRef.current > STRENGTH_EPS) return false
      if (mouseRevealSmoothRef.current > STRENGTH_EPS) return false
      const [tx, ty] = mouseTargetRef.current
      const [sx, sy] = mouseSmoothRef.current
      if (tx < -1000) return true
      return Math.hypot(tx - sx, ty - sy) <= POSITION_EPS
    }

    const tick = () => {
      const now = performance.now()
      const dt = Math.min((now - mouseLastTickAtRef.current) / 1000, 0.05)
      mouseLastTickAtRef.current = now

      const [tx, ty] = mouseTargetRef.current
      const [sx, sy] = mouseSmoothRef.current

      if (tx < -1000) {
        mouseSmoothRef.current = [tx, ty]
      } else if (sx < -1000) {
        mouseSmoothRef.current = [tx, ty]
      } else {
        mouseSmoothRef.current = [
          sx + (tx - sx) * MOUSE_LERP,
          sy + (ty - sy) * MOUSE_LERP,
        ]
      }

      if (mouseInSectionRef.current) {
        const idleMs = now - mouseLastMoveAtRef.current
        if (idleMs > 48) {
          const fadeMs = Math.max(
            shaderConfigRef.current.mouseRevealFadeMs,
            150,
          )
          const tau = (fadeMs / 1000) * 0.55
          mouseRevealTargetRef.current *= Math.exp(-dt / tau)
          if (mouseRevealTargetRef.current < STRENGTH_EPS) {
            mouseRevealTargetRef.current = 0
          }
        }
      } else {
        mouseRevealTargetRef.current = 0
      }

      const target = mouseRevealTargetRef.current
      const smooth = mouseRevealSmoothRef.current
      const attack = 1 - Math.exp(-dt * 16)
      const release = 1 - Math.exp(-dt * 5.5)
      const blend = target > smooth ? attack : release
      mouseRevealSmoothRef.current = smooth + (target - smooth) * blend

      syncMouseUniforms(mouseSmoothRef.current, mouseRevealSmoothRef.current)

      if (mouseEffectIdle()) {
        if (lastMouseUniformsRef.current.strength > 0) {
          syncMouseUniforms(MOUSE_OFF_SCREEN, 0, true)
        }
        stopMouseLoop()
        return
      }

      mouseRafRef.current = requestAnimationFrame(tick)
    }

    const startMouseLoop = () => {
      if (mouseRafRef.current !== null) return
      mouseLastTickAtRef.current = performance.now()
      mouseRafRef.current = requestAnimationFrame(tick)
    }

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const [lx, ly] = mouseTargetRef.current
      const speed = lx < -1000 ? 0 : Math.hypot(x - lx, y - ly)
      mouseTargetRef.current = [x, y]
      mouseInSectionRef.current = true

      const sensitivity = Math.max(
        shaderConfigRef.current.mouseMotionSensitivity,
        0.5,
      )
      const impulse = Math.min(speed / sensitivity, 1)
      mouseRevealTargetRef.current = Math.max(
        mouseRevealTargetRef.current,
        impulse,
      )
      mouseLastMoveAtRef.current = performance.now()
      startMouseLoop()
    }

    const onMouseLeave = () => {
      mouseInSectionRef.current = false
      mouseRevealTargetRef.current = 0
      mouseRevealSmoothRef.current = 0
      mouseTargetRef.current = MOUSE_OFF_SCREEN
      syncMouseUniforms(MOUSE_OFF_SCREEN, 0, true)
      stopMouseLoop()
    }

    const section = container.closest("section") ?? container.parentElement
    if (section) {
      section.addEventListener("mousemove", onMouseMove)
      section.addEventListener("mouseleave", onMouseLeave)
    }

    return () => {
      stopMouseLoop()
      if (section) {
        section.removeEventListener("mousemove", onMouseMove)
        section.removeEventListener("mouseleave", onMouseLeave)
      }
    }
  }, [state, isInView, applyMouseUniforms])

  const handleContextLost = useCallback(() => {
    setState("fallback")
  }, [])

  useEffect(() => {
    const host = canvasHostRef.current
    if (!host || state !== "active") return

    const canvas = host.querySelector("canvas")
    if (!canvas) return

    canvas.addEventListener("webglcontextlost", handleContextLost)
    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLost)
    }
  }, [state, handleContextLost])

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      ;(containerRef as React.MutableRefObject<HTMLDivElement | null>).current =
        node
      ;(inViewRef as React.MutableRefObject<HTMLDivElement | null>).current =
        node
    },
    [inViewRef],
  )

  return (
    <div
      ref={setRefs}
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
      aria-hidden="true"
    >
      {state === "active" && (
        <div ref={canvasHostRef} style={{ width: "100%", height: "100%" }} />
      )}

      {state === "fallback" && (
        <div
          className="absolute inset-0 bg-accent-100"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 46% 36% at 50% 108%, rgba(255,253,238,0.84) 0%, rgba(255,242,176,0.58) 24%, rgba(255,200,102,0.3) 52%, transparent 78%), radial-gradient(ellipse 72% 62% at 50% 55%, rgba(255,225,142,0.08) 0%, transparent 64%)",
          }}
        >
          <div
            className="absolute inset-0 opacity-55"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(255,251,245,0.48) 0 0.7px, transparent 0.9px)",
              backgroundSize: "7px 7px",
              WebkitMaskImage:
                "radial-gradient(ellipse 72% 74% at 50% 54%, #000 0%, transparent 84%)",
              maskImage:
                "radial-gradient(ellipse 72% 74% at 50% 54%, #000 0%, transparent 84%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(255,251,245,0.55) 0 0.8px, transparent 1px)",
              backgroundPosition: "3px 4px",
              backgroundSize: "13px 13px",
              WebkitMaskImage:
                "radial-gradient(ellipse 55% 50% at 50% 68%, #000 0%, transparent 78%)",
              maskImage:
                "radial-gradient(ellipse 55% 50% at 50% 68%, #000 0%, transparent 78%)",
            }}
          />
          <div
            className="absolute left-1/2 bottom-[-24%] h-[46%] w-[58%] -translate-x-1/2 blur-xl"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(255,253,238,0.74) 0%, rgba(255,241,174,0.5) 32%, rgba(255,199,100,0.28) 60%, transparent 82%)",
            }}
          />
        </div>
      )}
    </div>
  )
}
