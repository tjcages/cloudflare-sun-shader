"use client"

import { useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import {
  Color,
  DoubleSide,
  Float32BufferAttribute,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from "three"

type PatchedShader = Parameters<
  NonNullable<MeshStandardMaterial["onBeforeCompile"]>
>[0]
import type { WaveShaderConfig } from "./wave-shader-config"
import {
  WAVE_SHADER_FRAGMENT_COLOR,
  WAVE_SHADER_FRAGMENT_DITHERING,
  WAVE_SHADER_FRAGMENT_PARS,
  WAVE_SHADER_NOISE_UTILS,
  WAVE_SHADER_VERTEX_COLOR,
  WAVE_SHADER_VERTEX_DISPLACEMENT,
  WAVE_SHADER_VERTEX_PARS,
} from "./wave-shader-fragment"

const TWIST_X = 0.35
const TWIST_Y = 0.35

type WaveUniforms = {
  uWavesX: { value: number }
  uWavesY: { value: number }
  uDisplacementHeight: { value: number }
  uSpeedX: { value: number }
  uSpeedY: { value: number }
  uTime: { value: number }
  uPrimaryColor: { value: Color }
  uValleyColor: { value: Color }
  uPeakColor: { value: Color }
  uVisibleBand: { value: number }
  uVisibleFade: { value: number }
}

export type WaveMeshProps = {
  config: WaveShaderConfig
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: [number, number, number] | number
}

export function WaveMesh({ config, position, rotation, scale }: WaveMeshProps) {
  const geometryRef = useRef<PlaneGeometry>(null)
  const materialRef = useRef<MeshStandardMaterial>(null)
  const shaderRef = useRef<PatchedShader | null>(null)

  const uniforms = useMemo<WaveUniforms>(
    () => ({
      uWavesX: { value: config.wavesX },
      uWavesY: { value: config.wavesY },
      uDisplacementHeight: { value: config.displacementHeight },
      uSpeedX: { value: config.speedX },
      uSpeedY: { value: config.speedY },
      uTime: { value: 0 },
      uPrimaryColor: { value: new Color(config.primaryColor) },
      uValleyColor: { value: new Color(config.valleyColor) },
      uPeakColor: { value: new Color(config.peakColor) },
      uVisibleBand: { value: config.visibleBand },
      uVisibleFade: { value: config.visibleFade },
    }),
    // Only build the uniforms object once — its `.value` slots are mutated below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // Pre-twist the plane so vertical strips spiral around the Y axis.
  useEffect(() => {
    const geom = geometryRef.current
    if (!geom) return

    const quat = new Quaternion()
    const up = new Vector3(0, 1, 0)
    const position = geom.attributes.position as Float32BufferAttribute
    const normal = geom.attributes.normal as Float32BufferAttribute
    const v = new Vector3()

    for (let i = 0; i < position.count; i += 1) {
      const px = position.getX(i)
      const py = position.getY(i)
      const pz = position.getZ(i)
      v.set(px, py, pz)
      quat.setFromAxisAngle(
        up,
        (Math.PI / 180) * (py / TWIST_Y + px / TWIST_X),
      )
      v.applyQuaternion(quat)
      position.setXYZ(i, v.x, v.y, v.z)
    }

    geom.computeVertexNormals()
    position.needsUpdate = true
    normal.needsUpdate = true
  }, [])

  useEffect(() => {
    const material = materialRef.current
    if (!material) return

    material.onBeforeCompile = (shader) => {
      shaderRef.current = shader
      for (const [key, value] of Object.entries(uniforms)) {
        shader.uniforms[key] = value
      }

      shader.vertexShader = `
        ${WAVE_SHADER_VERTEX_PARS}
        ${WAVE_SHADER_NOISE_UTILS}
        ${shader.vertexShader}
      `
      shader.vertexShader = shader.vertexShader.replace(
        "#include <displacementmap_vertex>",
        `
          ${WAVE_SHADER_VERTEX_DISPLACEMENT}
          ${WAVE_SHADER_VERTEX_COLOR}
        `,
      )

      shader.fragmentShader = `
        ${WAVE_SHADER_FRAGMENT_PARS}
        ${WAVE_SHADER_NOISE_UTILS}
        ${shader.fragmentShader}
      `
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        WAVE_SHADER_FRAGMENT_COLOR,
      )
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <dithering_fragment>",
        WAVE_SHADER_FRAGMENT_DITHERING,
      )
    }

    material.needsUpdate = true
  }, [uniforms])

  // Mutate uniform slots in-place so the GPU sees the new values without a recompile.
  useEffect(() => {
    uniforms.uWavesX.value = config.wavesX
    uniforms.uWavesY.value = config.wavesY
    uniforms.uDisplacementHeight.value = config.displacementHeight
    uniforms.uSpeedX.value = config.speedX
    uniforms.uSpeedY.value = config.speedY
    uniforms.uPrimaryColor.value.set(config.primaryColor)
    uniforms.uValleyColor.value.set(config.valleyColor)
    uniforms.uPeakColor.value.set(config.peakColor)
    uniforms.uVisibleBand.value = config.visibleBand
    uniforms.uVisibleFade.value = config.visibleFade
  }, [config, uniforms])

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime()
  })

  return (
    <mesh position={position} rotation={rotation} scale={scale}>
      <planeGeometry ref={geometryRef} args={[25, 100, 64, 64]} />
      <meshStandardMaterial
        ref={materialRef}
        metalness={0}
        roughness={1}
        color={0x000000}
        side={DoubleSide}
        transparent
        dithering
      />
    </mesh>
  )
}
