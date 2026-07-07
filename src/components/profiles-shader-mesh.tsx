"use client"

import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  LinearSRGBColorSpace,
  ClampToEdgeWrapping,
  Color,
  DataTexture,
  GLSL3,
  LinearFilter,
  RGBAFormat,
  ShaderMaterial,
  Texture,
  TextureLoader,
  Vector2,
} from "three"
import { advanceShaderDevAnimationDelta } from "shader-panel"
import type { ProfilesShaderConfig } from "./profiles-shader-config"
import { sampleLightPath } from "./profiles-light-path"
import {
  PROFILES_SHADER_FRAGMENT,
  PROFILES_SHADER_VERTEX,
} from "./profiles-shader-fragment"

type ProfilesUniforms = {
  uImage: { value: Texture }
  uDepth: { value: Texture }
  uImageSize: { value: Vector2 }
  uAspect: { value: number }
  uTime: { value: number }
  uPointer: { value: Vector2 }
  uParallax: { value: number }
  uDepthScale: { value: number }
  uNormalDetail: { value: number }
  uExposure: { value: number }
  uAmbientColor: { value: Color }
  uAmbientIntensity: { value: number }
  uTint: { value: number }
  uShowHelpers: { value: number }
  uLightEnabled: { value: number[] }
  uLightColor: { value: Color[] }
  uLightPos: { value: Vector2[] }
  uLightZ: { value: number[] }
  uLightRadius: { value: number[] }
  uLightIntensity: { value: number[] }
  uLightDiffuse: { value: number[] }
  uLightGlow: { value: number[] }
  uScanEnabled: { value: number }
  uScanColor: { value: Color }
  uScanSpeed: { value: number }
  uScanWidth: { value: number }
  uScanIntensity: { value: number }
  uScanDir: { value: number }
  uOverlayMode: { value: number }
  uOverlayScale: { value: number }
  uOverlayOpacity: { value: number }
  uOverlayColor: { value: Color }
  uOverlayUseImage: { value: number }
  uOverlaySpeed: { value: number }
  uOverlayDepthMin: { value: number }
  uOverlayScanOnly: { value: number }
  uDepthSpliceEnabled: { value: number }
  uDepthSplicePosition: { value: number }
  uDepthSpliceSoftness: { value: number }
}

const OVERLAY_MODE_INDEX: Record<string, number> = {
  off: 0,
  ascii: 1,
  hatch: 2,
  pixel: 3,
  dots: 4,
}

const SCAN_DIR_INDEX: Record<string, number> = {
  pingpong: 0,
  back: 1,
  front: 2,
}

function flatTexture(r: number, g: number, b: number): DataTexture {
  const tex = new DataTexture(
    new Uint8Array([r, g, b, 255]),
    1,
    1,
    RGBAFormat,
  )
  tex.needsUpdate = true
  configureTexture(tex)
  return tex
}

function configureTexture(tex: Texture): void {
  tex.colorSpace = LinearSRGBColorSpace
  tex.minFilter = LinearFilter
  tex.magFilter = LinearFilter
  tex.wrapS = ClampToEdgeWrapping
  tex.wrapT = ClampToEdgeWrapping
  tex.generateMipmaps = false
}

/** Load `src` into a uniform slot, disposing the texture it replaces. */
function useTextureUniform(
  src: string,
  slot: { value: Texture },
  fallback: Texture,
  onSize?: (w: number, h: number) => void,
) {
  const onSizeRef = useRef(onSize)
  onSizeRef.current = onSize

  useEffect(() => {
    if (!src) {
      const prev = slot.value
      slot.value = fallback
      if (prev !== fallback) prev.dispose()
      return
    }
    let cancelled = false
    new TextureLoader().load(src, (tex) => {
      if (cancelled) {
        tex.dispose()
        return
      }
      configureTexture(tex)
      const prev = slot.value
      slot.value = tex
      if (prev !== fallback) prev.dispose()
      const img = tex.image as { width: number; height: number }
      onSizeRef.current?.(img.width, img.height)
    })
    return () => {
      cancelled = true
    }
  }, [src, slot, fallback])
}

export type ProfilesMeshProps = {
  config: ProfilesShaderConfig
  /** Called while a light helper ring is dragged (light index 0-2, light-space xy). */
  onLightPosChange?: (
    lightIndex: number,
    pos: readonly [number, number],
  ) => void
}

/** Light-space distance within which a pointer-down grabs a helper ring. */
const LIGHT_GRAB_RADIUS = 0.14

export function ProfilesMesh({ config, onLightPosChange }: ProfilesMeshProps) {
  const viewport = useThree((s) => s.viewport)
  const glDomElement = useThree((s) => s.gl.domElement)
  const [imageSize, setImageSize] = useState<[number, number]>([533, 800])

  // Neutral fallbacks: mid-gray albedo, flat mid depth (lighting still reads
  // while a depth map is being generated).
  const fallbacks = useMemo(
    () => ({
      image: flatTexture(128, 128, 128),
      depth: flatTexture(128, 128, 128),
    }),
    [],
  )

  const uniforms = useMemo<ProfilesUniforms>(
    () => ({
      uImage: { value: fallbacks.image },
      uDepth: { value: fallbacks.depth },
      uImageSize: { value: new Vector2(533, 800) },
      uAspect: { value: 533 / 800 },
      uTime: { value: 0 },
      uPointer: { value: new Vector2(0, 0) },
      uParallax: { value: config.parallax },
      uDepthScale: { value: config.depthScale },
      uNormalDetail: { value: config.normalDetail },
      uExposure: { value: config.exposure },
      uAmbientColor: { value: new Color(config.ambientColor) },
      uAmbientIntensity: { value: config.ambientIntensity },
      uTint: { value: config.tint },
      uShowHelpers: { value: 0 },
      uLightEnabled: { value: [0, 0, 0] },
      uLightColor: { value: [new Color(), new Color(), new Color()] },
      uLightPos: { value: [new Vector2(), new Vector2(), new Vector2()] },
      uLightZ: { value: [0, 0, 0] },
      uLightRadius: { value: [1, 1, 1] },
      uLightIntensity: { value: [0, 0, 0] },
      uLightDiffuse: { value: [0, 0, 0] },
      uLightGlow: { value: [0, 0, 0] },
      uScanEnabled: { value: 0 },
      uScanColor: { value: new Color(config.scanColor) },
      uScanSpeed: { value: config.scanSpeed },
      uScanWidth: { value: config.scanWidth },
      uScanIntensity: { value: config.scanIntensity },
      uScanDir: { value: SCAN_DIR_INDEX[config.scanDirection] ?? 1 },
      uOverlayMode: { value: OVERLAY_MODE_INDEX[config.overlayMode] ?? 0 },
      uOverlayScale: { value: config.overlayScale },
      uOverlayOpacity: { value: config.overlayOpacity },
      uOverlayColor: { value: new Color(config.overlayColor) },
      uOverlayUseImage: { value: config.overlayUseImage ? 1 : 0 },
      uOverlaySpeed: { value: config.overlaySpeed },
      uOverlayDepthMin: { value: config.overlayDepthMin },
      uOverlayScanOnly: { value: config.overlayScanOnly ? 1 : 0 },
      uDepthSpliceEnabled: { value: config.depthSpliceEnabled ? 1 : 0 },
      uDepthSplicePosition: { value: config.depthSplicePosition },
      uDepthSpliceSoftness: { value: config.depthSpliceSoftness },
    }),
    // Build once — `.value` slots are mutated below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useTextureUniform(config.imageSrc, uniforms.uImage, fallbacks.image, (w, h) =>
    setImageSize([w, h]),
  )
  useTextureUniform(config.depthSrc, uniforms.uDepth, fallbacks.depth)

  useEffect(() => {
    uniforms.uImageSize.value.set(imageSize[0], imageSize[1])
    uniforms.uAspect.value = imageSize[0] / imageSize[1]
  }, [imageSize, uniforms])

  // Mutate uniform slots in-place so the GPU sees new values without recompile.
  useEffect(() => {
    uniforms.uParallax.value = config.parallax
    uniforms.uDepthScale.value = config.depthScale
    uniforms.uNormalDetail.value = config.normalDetail
    uniforms.uExposure.value = config.exposure
    uniforms.uAmbientColor.value.set(config.ambientColor)
    uniforms.uAmbientIntensity.value = config.ambientIntensity
    uniforms.uTint.value = config.tint
    uniforms.uShowHelpers.value = config.showHelpers ? 1 : 0

    const lights = [
      {
        enabled: config.light1Enabled,
        color: config.light1Color,
        pos: config.light1Pos,
        z: config.light1Z,
        radius: config.light1Radius,
        intensity: config.light1Intensity,
        diffuse: config.light1Diffuse,
        glow: config.light1Glow,
        animate: config.light1Animate,
        path: config.light1Path,
      },
      {
        enabled: config.light2Enabled,
        color: config.light2Color,
        pos: config.light2Pos,
        z: config.light2Z,
        radius: config.light2Radius,
        intensity: config.light2Intensity,
        diffuse: config.light2Diffuse,
        glow: config.light2Glow,
        animate: config.light2Animate,
        path: config.light2Path,
      },
      {
        enabled: config.light3Enabled,
        color: config.light3Color,
        pos: config.light3Pos,
        z: config.light3Z,
        radius: config.light3Radius,
        intensity: config.light3Intensity,
        diffuse: config.light3Diffuse,
        glow: config.light3Glow,
        animate: config.light3Animate,
        path: config.light3Path,
      },
    ]
    lights.forEach((l, i) => {
      uniforms.uLightEnabled.value[i] = l.enabled ? 1 : 0
      uniforms.uLightColor.value[i].set(l.color)
      const animating = l.animate && l.path.length > 0
      if (!animating) {
        uniforms.uLightPos.value[i].set(l.pos[0], l.pos[1])
      }
      uniforms.uLightZ.value[i] = l.z
      uniforms.uLightRadius.value[i] = l.radius
      uniforms.uLightIntensity.value[i] = l.intensity
      uniforms.uLightDiffuse.value[i] = l.diffuse
      uniforms.uLightGlow.value[i] = l.glow
    })

    uniforms.uScanEnabled.value = config.scanEnabled ? 1 : 0
    uniforms.uScanColor.value.set(config.scanColor)
    uniforms.uScanSpeed.value = config.scanSpeed
    uniforms.uScanWidth.value = config.scanWidth
    uniforms.uScanIntensity.value = config.scanIntensity
    uniforms.uScanDir.value = SCAN_DIR_INDEX[config.scanDirection] ?? 1

    uniforms.uOverlayMode.value = OVERLAY_MODE_INDEX[config.overlayMode] ?? 0
    uniforms.uOverlayScale.value = config.overlayScale
    uniforms.uOverlayOpacity.value = config.overlayOpacity
    uniforms.uOverlayColor.value.set(config.overlayColor)
    uniforms.uOverlayUseImage.value = config.overlayUseImage ? 1 : 0
    uniforms.uOverlaySpeed.value = config.overlaySpeed
    uniforms.uOverlayDepthMin.value = config.overlayDepthMin
    uniforms.uOverlayScanOnly.value = config.overlayScanOnly ? 1 : 0
    uniforms.uDepthSpliceEnabled.value = config.depthSpliceEnabled ? 1 : 0
    uniforms.uDepthSplicePosition.value = config.depthSplicePosition
    uniforms.uDepthSpliceSoftness.value = config.depthSpliceSoftness
  }, [config, uniforms])

  const dragLightRef = useRef<number | null>(null)
  const configRef = useRef(config)
  const animTimeRef = useRef(0)
  configRef.current = config

  useFrame((state, delta) => {
    const { time } = advanceShaderDevAnimationDelta(animTimeRef.current)
    animTimeRef.current = time
    // Scan band marches on wall-clock delta (original behaviour). The dev-panel
    // animation clock only drives light-path waypoints — coupling uTime to it
    // made the band jump or run backward on reset/step.
    uniforms.uTime.value += delta
    uniforms.uPointer.value.lerp(state.pointer, 0.06)

    const c = configRef.current
    const dragging = dragLightRef.current
    const lightDefs = [
      {
        animate: c.light1Animate,
        path: c.light1Path,
        pos: c.light1Pos,
        loop: c.light1Loop,
        speed: c.light1Speed,
      },
      {
        animate: c.light2Animate,
        path: c.light2Path,
        pos: c.light2Pos,
        loop: c.light2Loop,
        speed: c.light2Speed,
      },
      {
        animate: c.light3Animate,
        path: c.light3Path,
        pos: c.light3Pos,
        loop: c.light3Loop,
        speed: c.light3Speed,
      },
    ]

    lightDefs.forEach((l, i) => {
      if (dragging === i) return
      if (!l.animate || l.path.length === 0) return
      const [x, y] = sampleLightPath(l.pos, l.path, time, l.speed, l.loop)
      uniforms.uLightPos.value[i].set(x, y)
    })
  })

  // --- Draggable light helpers -------------------------------------------
  // With helpers visible, pointer-down near a ring grabs that light; drags
  // re-position it in light space ((uv - 0.5) * 2 * [aspect, 1]).
  const lightAtUv = useCallback(
    (uvX: number, uvY: number): number => {
      const c = configRef.current
      const a = uniforms.uAspect.value
      const px = (uvX - 0.5) * 2 * a
      const py = (uvY - 0.5) * 2
      const lights: {
        enabled: boolean
        pos: Vector2
      }[] = [
        { enabled: c.light1Enabled, pos: uniforms.uLightPos.value[0] },
        { enabled: c.light2Enabled, pos: uniforms.uLightPos.value[1] },
        { enabled: c.light3Enabled, pos: uniforms.uLightPos.value[2] },
      ]
      let best = -1
      let bestDist = LIGHT_GRAB_RADIUS
      lights.forEach((l, i) => {
        if (!l.enabled) return
        const d = Math.hypot(px - l.pos.x, py - l.pos.y)
        if (d < bestDist) {
          best = i
          bestDist = d
        }
      })
      return best
    },
    [uniforms],
  )

  const handlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!configRef.current.showHelpers || !onLightPosChange || !e.uv) return
      const hit = lightAtUv(e.uv.x, e.uv.y)
      if (hit < 0) return
      e.stopPropagation()
      dragLightRef.current = hit
      try {
        glDomElement.setPointerCapture(e.pointerId)
      } catch {
        /* synthetic pointers have no capturable id — drag still works */
      }
      glDomElement.style.cursor = "grabbing"
    },
    [glDomElement, lightAtUv, onLightPosChange],
  )

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!e.uv) return
      const dragging = dragLightRef.current
      if (dragging === null) {
        // Hover affordance only — no state churn.
        if (configRef.current.showHelpers && onLightPosChange) {
          glDomElement.style.cursor =
            lightAtUv(e.uv.x, e.uv.y) >= 0 ? "grab" : ""
        }
        return
      }
      const a = uniforms.uAspect.value
      const clampTo = (v: number) => Math.max(-1.5, Math.min(1.5, v))
      onLightPosChange?.(dragging, [
        clampTo((e.uv.x - 0.5) * 2 * a),
        clampTo((e.uv.y - 0.5) * 2),
      ])
    },
    [glDomElement, lightAtUv, onLightPosChange, uniforms],
  )

  const handlePointerUp = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (dragLightRef.current === null) return
      dragLightRef.current = null
      try {
        glDomElement.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      glDomElement.style.cursor = ""
    },
    [glDomElement],
  )

  // Fit the plane to the viewport, preserving the image's aspect ratio.
  const aspect = imageSize[0] / imageSize[1]
  const height =
    config.fit === "cover"
      ? Math.max(viewport.height, viewport.width / aspect)
      : Math.min(viewport.height, viewport.width / aspect)
  const width = height * aspect

  // Construct the material imperatively: r3f clones a `uniforms` prop when
  // applying it to <shaderMaterial>, which orphans every later in-place
  // mutation (loaded textures, uTime, pointer). `new ShaderMaterial` +
  // <primitive attach="material"> keeps `material.uniforms === uniforms`.
  const material = useMemo(
    () =>
      new ShaderMaterial({
        glslVersion: GLSL3,
        uniforms,
        vertexShader: PROFILES_SHADER_VERTEX,
        fragmentShader: PROFILES_SHADER_FRAGMENT,
      }),
    [uniforms],
  )

  useEffect(() => {
    return () => {
      material.dispose()
      fallbacks.image.dispose()
      fallbacks.depth.dispose()
    }
  }, [material, fallbacks])

  return (
    <mesh
      scale={[width, height, 1]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <planeGeometry args={[1, 1, 1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}
