"use client"

import { useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  type Points,
  ShaderMaterial,
} from "three"

import type { ComboShaderConfig } from "./combo-shader-config"
import {
  COMBO_SHADER_FRAGMENT,
  COMBO_SHADER_NOISE_UTILS,
  COMBO_SHADER_VERTEX,
} from "./combo-shader-fragment"

type Props = {
  config: ComboShaderConfig
}

type Uniforms = {
  uTime: { value: number }

  uPlaneWidth: { value: number }
  uPlaneHeight: { value: number }
  uDriftSpeed: { value: number }

  uWavesScale: { value: number }
  uWaveSpeedX: { value: number }
  uWaveSpeedY: { value: number }
  uDisplacement: { value: number }
  uTwist: { value: number }

  uWaveRadius: { value: number }
  uWaveSoft: { value: number }
  uWavePulseSpeed: { value: number }
  uWavePulseAmp: { value: number }
  uWaveStrength: { value: number }
  uWaveBoost: { value: number }
  uWaveBreathBias: { value: number }
  uWaveAspect: { value: number }
  uWaveBoundaryAmp: { value: number }
  uWaveBoundaryScale: { value: number }
  uWaveTravelSpeed: { value: number }
  uWaveTravelRange: { value: number }

  uPointSize: { value: number }
  uPointSizePeak: { value: number }
  uSizeAttenuation: { value: number }

  uValleyBrightness: { value: number }
  uPeakBrightness: { value: number }
  uVisibleThreshold: { value: number }
  uShimmerAmp: { value: number }
  uShimmerSpeed: { value: number }

  uCalmColor: { value: Color }
  uPeakColor: { value: Color }
  uCoreColor: { value: Color }

  uDotRadius: { value: number }
  uDotSoft: { value: number }
  uCoreAmp: { value: number }
  uBloomFalloff: { value: number }
  uBloomAmp: { value: number }
  uOverlapBloom: { value: number }
}

function buildFieldGeometry(
  width: number,
  height: number,
  segments: number,
): BufferGeometry {
  const cols = Math.max(2, Math.floor(segments))
  const rows = Math.max(2, Math.floor(segments * (height / Math.max(width, 1))))

  const count = cols * rows
  const positions = new Float32Array(count * 3)
  const uvs = new Float32Array(count * 2)

  // Small per-particle jitter on the grid so the field doesn't look like
  // a regular dot screen — it should read as scattered wisps.
  let s = 1
  const rand = () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }

  const cellW = width / (cols - 1)
  const cellH = height / (rows - 1)
  const jitter = 0.45

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const idx = row * cols + col
      const i3 = idx * 3
      const i2 = idx * 2

      const jx = (rand() - 0.5) * jitter * cellW
      const jy = (rand() - 0.5) * jitter * cellH

      positions[i3 + 0] = (col / (cols - 1) - 0.5) * width + jx
      positions[i3 + 1] = (row / (rows - 1) - 0.5) * height + jy
      positions[i3 + 2] = 0

      uvs[i2 + 0] = col / (cols - 1)
      uvs[i2 + 1] = row / (rows - 1)
    }
  }

  const geom = new BufferGeometry()
  geom.setAttribute("position", new Float32BufferAttribute(positions, 3))
  geom.setAttribute("uv", new Float32BufferAttribute(uvs, 2))
  return geom
}

export function ComboMesh({ config }: Props) {
  const pointsRef = useRef<Points>(null)

  const uniforms = useMemo<Uniforms>(
    () => ({
      uTime: { value: 0 },

      uPlaneWidth: { value: config.planeWidth },
      uPlaneHeight: { value: config.planeHeight },
      uDriftSpeed: { value: config.driftSpeed },

      uWavesScale: { value: config.wavesScale },
      uWaveSpeedX: { value: config.waveSpeedX },
      uWaveSpeedY: { value: config.waveSpeedY },
      uDisplacement: { value: config.displacement },
      uTwist: { value: config.twist },

      uWaveRadius: { value: config.waveRadius },
      uWaveSoft: { value: config.waveSoft },
      uWavePulseSpeed: { value: config.wavePulseSpeed },
      uWavePulseAmp: { value: config.wavePulseAmp },
      uWaveStrength: { value: config.waveStrength },
      uWaveBoost: { value: config.waveBoost },
      uWaveBreathBias: { value: config.waveBreathBias },
      uWaveAspect: { value: config.waveAspect },
      uWaveBoundaryAmp: { value: config.waveBoundaryAmp },
      uWaveBoundaryScale: { value: config.waveBoundaryScale },
      uWaveTravelSpeed: { value: config.waveTravelSpeed },
      uWaveTravelRange: { value: config.waveTravelRange },

      uPointSize: { value: config.pointSize },
      uPointSizePeak: { value: config.pointSizePeak },
      uSizeAttenuation: { value: config.sizeAttenuation },

      uValleyBrightness: { value: config.valleyBrightness },
      uPeakBrightness: { value: config.peakBrightness },
      uVisibleThreshold: { value: config.visibleThreshold },
      uShimmerAmp: { value: config.shimmerAmp },
      uShimmerSpeed: { value: config.shimmerSpeed },

      uCalmColor: { value: new Color(config.calmColor) },
      uPeakColor: { value: new Color(config.peakColor) },
      uCoreColor: { value: new Color(config.coreColor) },

      uDotRadius: { value: config.dotRadius },
      uDotSoft: { value: config.dotSoft },
      uCoreAmp: { value: config.coreAmp },
      uBloomFalloff: { value: config.bloomFalloff },
      uBloomAmp: { value: config.bloomAmp },
      uOverlapBloom: { value: config.overlapBloom },
    }),
    // Built once; values mutated below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const vertexShader = useMemo(
    () => `${COMBO_SHADER_NOISE_UTILS}\n${COMBO_SHADER_VERTEX}`,
    [],
  )

  // Create the ShaderMaterial imperatively so its uniforms reference is
  // bound at construction time and never replaced by JSX reconciliation.
  // Mutations to `uniforms.uXxx.value` flow straight to the GPU.
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: uniforms as unknown as Record<string, { value: unknown }>,
        vertexShader,
        fragmentShader: COMBO_SHADER_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [uniforms, vertexShader],
  )

  useEffect(() => {
    return () => {
      material.dispose()
    }
  }, [material])

  const geometry = useMemo(
    () =>
      buildFieldGeometry(config.planeWidth, config.planeHeight, config.gridSize),
    [config.planeWidth, config.planeHeight, config.gridSize],
  )

  useEffect(() => {
    return () => {
      geometry.dispose()
    }
  }, [geometry])


  // Mirror current config onto uniforms every frame so any slider change
  // is reflected in the very next render — robust against effect timing.
  const configRef = useRef(config)
  configRef.current = config
  const timeRef = useRef(0)

  useFrame((_, delta) => {
    timeRef.current += delta
    const u = uniforms
    const c = configRef.current
    u.uTime.value = timeRef.current

    u.uPlaneWidth.value = c.planeWidth
    u.uPlaneHeight.value = c.planeHeight
    u.uDriftSpeed.value = c.driftSpeed
    u.uWavesScale.value = c.wavesScale
    u.uWaveSpeedX.value = c.waveSpeedX
    u.uWaveSpeedY.value = c.waveSpeedY
    u.uDisplacement.value = c.displacement
    u.uTwist.value = c.twist
    u.uWaveRadius.value = c.waveRadius
    u.uWaveSoft.value = c.waveSoft
    u.uWavePulseSpeed.value = c.wavePulseSpeed
    u.uWavePulseAmp.value = c.wavePulseAmp
    u.uWaveStrength.value = c.waveStrength
    u.uWaveBoost.value = c.waveBoost
    u.uWaveBreathBias.value = c.waveBreathBias
    u.uWaveAspect.value = c.waveAspect
    u.uWaveBoundaryAmp.value = c.waveBoundaryAmp
    u.uWaveBoundaryScale.value = c.waveBoundaryScale
    u.uWaveTravelSpeed.value = c.waveTravelSpeed
    u.uWaveTravelRange.value = c.waveTravelRange
    u.uPointSize.value = c.pointSize
    u.uPointSizePeak.value = c.pointSizePeak
    u.uSizeAttenuation.value = c.sizeAttenuation
    u.uValleyBrightness.value = c.valleyBrightness
    u.uPeakBrightness.value = c.peakBrightness
    u.uVisibleThreshold.value = c.visibleThreshold
    u.uShimmerAmp.value = c.shimmerAmp
    u.uShimmerSpeed.value = c.shimmerSpeed
    u.uCalmColor.value.set(c.calmColor)
    u.uPeakColor.value.set(c.peakColor)
    u.uCoreColor.value.set(c.coreColor)
    u.uDotRadius.value = c.dotRadius
    u.uDotSoft.value = c.dotSoft
    u.uCoreAmp.value = c.coreAmp
    u.uBloomFalloff.value = c.bloomFalloff
    u.uBloomAmp.value = c.bloomAmp
    u.uOverlapBloom.value = c.overlapBloom
  })

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <primitive object={material} attach="material" />
    </points>
  )
}
