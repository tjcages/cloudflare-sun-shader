"use client"

import { useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import { advanceShaderDevAnimationDelta } from "shader-panel"
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  GLSL3,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from "three"
import type { ConnectShaderConfig } from "./connect-shader-config"
import {
  CONNECT_BASE_FRAGMENT,
  CONNECT_EMITTER_FRAGMENT,
  CONNECT_EMITTER_VERTEX,
  CONNECT_HATCH_FRAGMENT,
  CONNECT_SHADER_NOISE_UTILS,
  CONNECT_SHADER_VERTEX,
} from "./connect-shader-fragment"

// Same cylindrical pre-twist as the Wave page's stripe wave.
const TWIST_X = 0.35
const TWIST_Y = 0.35
const PLANE_W = 25
/** Default cylinder length (plane height); overridable via config.cylinderLength. */
const PLANE_H = 100

type UniformSlot<T> = { value: T }

/**
 * Builds the twisted plane. `length` is the cylinder's axial length (plane
 * height); height-segment count scales with it so quad density — and thus
 * stripe/hatch fidelity — stays constant as the cylinder grows.
 */
function buildTwistedGeometry(length: number): PlaneGeometry {
  const hSeg = Math.max(48, Math.min(320, Math.round(length * 0.96)))
  const geom = new PlaneGeometry(PLANE_W, length, 96, hSeg)
  const quat = new Quaternion()
  const up = new Vector3(0, 1, 0)
  const positionAttr = geom.attributes.position as Float32BufferAttribute
  const v = new Vector3()

  for (let i = 0; i < positionAttr.count; i += 1) {
    const px = positionAttr.getX(i)
    const py = positionAttr.getY(i)
    const pz = positionAttr.getZ(i)
    v.set(px, py, pz)
    quat.setFromAxisAngle(up, (Math.PI / 180) * (py / TWIST_Y + px / TWIST_X))
    v.applyQuaternion(quat)
    positionAttr.setXYZ(i, v.x, v.y, v.z)
  }

  geom.computeVertexNormals()
  positionAttr.needsUpdate = true
  return geom
}

export type ConnectMeshProps = {
  config: ConnectShaderConfig
  position?: [number, number, number]
  rotation?: [number, number, number]
}

export function ConnectMesh({ config, position, rotation }: ConnectMeshProps) {
  const speedRef = useRef(config.speed)
  speedRef.current = config.speed
  const animTimeRef = useRef(0)

  const geometry = useMemo(
    () => buildTwistedGeometry(config.cylinderLength),
    [config.cylinderLength],
  )
  useEffect(() => {
    return () => geometry.dispose()
  }, [geometry])

  // Shared uniform slots: both materials reference the SAME slot objects, so
  // one mutation reaches both. Each material adds its own uLift on top.
  const shared = useMemo(
    () => ({
      uTime: { value: 0 },
      uWavesX: { value: config.wavesX },
      uWavesY: { value: config.wavesY },
      uSpeedX: { value: config.speedX },
      uSpeedY: { value: config.speedY },
      uDisplacementHeight: { value: config.displacementHeight },
      uPlaneW: { value: PLANE_W },
      uPlaneH: { value: config.cylinderLength },
      uFillColor: { value: new Color(config.fillColor) },
      uFillColor2: { value: new Color(config.fillColor2) },
      uFillGradScale: { value: config.fillGradScale },
      uFillAlpha: { value: config.fillAlpha },
      uFillLow: { value: config.fillLow },
      uFillHigh: { value: config.fillHigh },
      uFillRadius: { value: config.fillRadius },
      uLineColor: { value: new Color(config.lineColor) },
      uLineCount: { value: config.lineCount },
      uLineWidth: { value: config.lineWidth },
      uLineAlpha: { value: config.lineAlpha },
      uLineFadeLow: { value: config.lineFadeLow },
      uLineFadeHigh: { value: config.lineFadeHigh },
      uHatchAngle: { value: config.hatchAngle },
      uHatchSpacing: { value: config.hatchSpacing },
      uHatchCell: { value: config.hatchCell },
      uHatchFill: { value: config.hatchFill },
      uDashMin: { value: config.dashMin },
      uDashMax: { value: config.dashMax },
      uHatchDensity: { value: config.hatchDensity },
      uDensityFloor: { value: config.densityFloor },
      uHatchDrift: { value: config.hatchDrift },
      uWaveGate: { value: config.waveGate },
      uEnvCenter: { value: config.envCenter },
      uEnvSlope: { value: config.envSlope },
      uEnvWidth: { value: config.envWidth },
      uPaleColor: { value: new Color(config.paleColor) },
      uSalmonColor: { value: new Color(config.salmonColor) },
      uOrangeColor: { value: new Color(config.orangeColor) },
      uAmberColor: { value: new Color(config.amberColor) },
      uDeepColor: { value: new Color(config.deepColor) },
    }),
    // Only build the slot objects once — their `.value`s are mutated below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const hatchLiftSlot = useMemo<UniformSlot<number>>(
    () => ({ value: config.hatchLift }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // Construct materials imperatively so they hold OUR uniform slot objects
  // by reference. Passing `uniforms` as a JSX prop lets r3f's prop-diffing
  // copy the slots — the material then animates a clone and every mutation
  // silently goes nowhere (the frozen-wave bug).
  const baseMaterial = useMemo(
    () =>
      new ShaderMaterial({
        // GLSL3: the fragments use ES 3.00 features (float[3](…) array
        // constructors, fwidth under WebGL2) that ES 1.00 compilation lacks.
        glslVersion: GLSL3,
        uniforms: { ...shared, uLift: { value: 0 } },
        vertexShader: `${CONNECT_SHADER_NOISE_UTILS}\n${CONNECT_SHADER_VERTEX}`,
        fragmentShader: `${CONNECT_SHADER_NOISE_UTILS}\n${CONNECT_BASE_FRAGMENT}`,
        transparent: true,
        side: DoubleSide,
        depthWrite: false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const hatchMaterial = useMemo(
    () =>
      new ShaderMaterial({
        glslVersion: GLSL3,
        uniforms: { ...shared, uLift: hatchLiftSlot },
        vertexShader: `${CONNECT_SHADER_NOISE_UTILS}\n${CONNECT_SHADER_VERTEX}`,
        fragmentShader: `${CONNECT_SHADER_NOISE_UTILS}\n${CONNECT_HATCH_FRAGMENT}`,
        transparent: true,
        side: DoubleSide,
        depthWrite: false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => {
    return () => {
      baseMaterial.dispose()
      hatchMaterial.dispose()
    }
  }, [baseMaterial, hatchMaterial])

  // Mutate uniform slots in-place so the GPU sees new values without recompile.
  useEffect(() => {
    shared.uPlaneH.value = config.cylinderLength
    shared.uWavesX.value = config.wavesX
    shared.uWavesY.value = config.wavesY
    shared.uSpeedX.value = config.speedX
    shared.uSpeedY.value = config.speedY
    shared.uDisplacementHeight.value = config.displacementHeight
    shared.uFillColor.value.set(config.fillColor)
    shared.uFillColor2.value.set(config.fillColor2)
    shared.uFillGradScale.value = config.fillGradScale
    shared.uFillAlpha.value = config.fillAlpha
    shared.uFillLow.value = config.fillLow
    shared.uFillHigh.value = config.fillHigh
    shared.uFillRadius.value = config.fillRadius
    shared.uLineColor.value.set(config.lineColor)
    shared.uLineCount.value = config.lineCount
    shared.uLineWidth.value = config.lineWidth
    shared.uLineAlpha.value = config.lineAlpha
    shared.uLineFadeLow.value = config.lineFadeLow
    shared.uLineFadeHigh.value = config.lineFadeHigh
    shared.uHatchAngle.value = config.hatchAngle
    shared.uHatchSpacing.value = config.hatchSpacing
    shared.uHatchCell.value = config.hatchCell
    shared.uHatchFill.value = config.hatchFill
    shared.uDashMin.value = config.dashMin
    shared.uDashMax.value = config.dashMax
    shared.uHatchDensity.value = config.hatchDensity
    shared.uDensityFloor.value = config.densityFloor
    shared.uHatchDrift.value = config.hatchDrift
    shared.uWaveGate.value = config.waveGate
    shared.uEnvCenter.value = config.envCenter
    shared.uEnvSlope.value = config.envSlope
    shared.uEnvWidth.value = config.envWidth
    shared.uPaleColor.value.set(config.paleColor)
    shared.uSalmonColor.value.set(config.salmonColor)
    shared.uOrangeColor.value.set(config.orangeColor)
    shared.uAmberColor.value.set(config.amberColor)
    shared.uDeepColor.value.set(config.deepColor)
    hatchLiftSlot.value = config.hatchLift
  }, [config, shared, hatchLiftSlot])

  // Panel animation clock (play/pause/step) drives uTime; config.speed still
  // scales how fast the wave advances relative to wall time.
  useFrame(() => {
    const { time, delta } = advanceShaderDevAnimationDelta(animTimeRef.current)
    animTimeRef.current = time
    shared.uTime.value += delta * speedRef.current
  })

  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={geometry} renderOrder={0}>
        <primitive object={baseMaterial} attach="material" />
      </mesh>
      {/* Hatch shell: same geometry, lifted off the surface by uLift so the
          dashes float around the wave instead of sitting on its skin. */}
      <mesh geometry={geometry} renderOrder={1}>
        <primitive object={hatchMaterial} attach="material" />
      </mesh>
    </group>
  )
}

/**
 * Dash-shaped particles the wave sheds: points seeded on the SAME twisted
 * cylinder surface, displaced by the SAME simplex field in the vertex
 * shader, that periodically launch outward along their surface normal and
 * fade as they fly. Oriented along the cylinder's length (the hatch
 * direction) and sized in world units so they match the hatch dashes.
 */
export function ConnectEmitter({ config }: { config: ConnectShaderConfig }) {
  const speedRef = useRef(config.speed)
  speedRef.current = config.speed
  const animTimeRef = useRef(0)

  // Seed the particles across the same-length twisted surface; rebuild when
  // the cylinder length or the particle count changes so they stay glued to
  // the mesh.
  const cylinderLength = config.cylinderLength
  const count = Math.max(1, Math.round(config.emitCount))
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const normals = new Float32Array(count * 3)
    const tangents = new Float32Array(count * 3)
    const uvs = new Float32Array(count * 2)
    const rand = new Float32Array(count * 3)
    const quat = new Quaternion()
    const up = new Vector3(0, 1, 0)
    const v = new Vector3()
    const nv = new Vector3()
    const tv = new Vector3()

    for (let i = 0; i < count; i += 1) {
      const u = Math.random()
      const w = Math.random()
      const px = (u - 0.5) * PLANE_W
      const py = (w - 0.5) * cylinderLength
      // Same cylindrical pre-twist as the mesh, so particles sit exactly on it.
      quat.setFromAxisAngle(
        up,
        (Math.PI / 180) * (py / TWIST_Y + px / TWIST_X),
      )
      v.set(px, py, 0).applyQuaternion(quat)
      nv.set(0, 0, 1).applyQuaternion(quat)
      // Tangent along the plane's length — the hatch dash direction.
      tv.set(0, 1, 0).applyQuaternion(quat)
      positions.set([v.x, v.y, v.z], i * 3)
      normals.set([nv.x, nv.y, nv.z], i * 3)
      tangents.set([tv.x, tv.y, tv.z], i * 3)
      uvs.set([u, w], i * 2)
      rand.set([Math.random(), Math.random(), Math.random()], i * 3)
    }

    const geom = new BufferGeometry()
    geom.setAttribute("position", new BufferAttribute(positions, 3))
    geom.setAttribute("normal", new BufferAttribute(normals, 3))
    geom.setAttribute("aTangent", new BufferAttribute(tangents, 3))
    geom.setAttribute("uv", new BufferAttribute(uvs, 2))
    geom.setAttribute("aRand", new BufferAttribute(rand, 3))
    return geom
  }, [cylinderLength, count])

  useEffect(() => {
    return () => geometry.dispose()
  }, [geometry])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uWavesX: { value: config.wavesX },
      uWavesY: { value: config.wavesY },
      uSpeedX: { value: config.speedX },
      uSpeedY: { value: config.speedY },
      uDisplacementHeight: { value: config.displacementHeight },
      uEmitAmount: { value: config.emitAmount },
      uEmitSpeed: { value: config.emitSpeed },
      uEmitDist: { value: config.emitDist },
      uEmitFall: { value: config.emitFall },
      uEmitSize: { value: config.emitSize },
      uEmitStretch: { value: config.emitStretch },
      uEmitAlpha: { value: config.emitAlpha },
      uViewportY: { value: 1080 },
      uPaleColor: { value: new Color(config.emitPaleColor) },
      uSalmonColor: { value: new Color(config.emitSalmonColor) },
      uOrangeColor: { value: new Color(config.emitOrangeColor) },
      uAmberColor: { value: new Color(config.emitAmberColor) },
      uDeepColor: { value: new Color(config.emitDeepColor) },
    }),
    // Only build the uniforms object once — its `.value` slots are mutated below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // Imperative material for the same reason as ConnectMesh: the material
  // must reference THIS uniforms object, not an r3f prop-diffed clone.
  const material = useMemo(
    () =>
      new ShaderMaterial({
        glslVersion: GLSL3,
        uniforms,
        vertexShader: `${CONNECT_SHADER_NOISE_UTILS}\n${CONNECT_EMITTER_VERTEX}`,
        fragmentShader: `${CONNECT_SHADER_NOISE_UTILS}\n${CONNECT_EMITTER_FRAGMENT}`,
        transparent: true,
        depthWrite: false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => {
    return () => material.dispose()
  }, [material])

  useEffect(() => {
    uniforms.uWavesX.value = config.wavesX
    uniforms.uWavesY.value = config.wavesY
    uniforms.uSpeedX.value = config.speedX
    uniforms.uSpeedY.value = config.speedY
    uniforms.uDisplacementHeight.value = config.displacementHeight
    uniforms.uEmitAmount.value = config.emitAmount
    uniforms.uEmitSpeed.value = config.emitSpeed
    uniforms.uEmitDist.value = config.emitDist
    uniforms.uEmitFall.value = config.emitFall
    uniforms.uEmitSize.value = config.emitSize
    uniforms.uEmitStretch.value = config.emitStretch
    uniforms.uEmitAlpha.value = config.emitAlpha
    uniforms.uPaleColor.value.set(config.emitPaleColor)
    uniforms.uSalmonColor.value.set(config.emitSalmonColor)
    uniforms.uOrangeColor.value.set(config.emitOrangeColor)
    uniforms.uAmberColor.value.set(config.emitAmberColor)
    uniforms.uDeepColor.value.set(config.emitDeepColor)
  }, [config, uniforms])

  useFrame((state) => {
    const { time, delta } = advanceShaderDevAnimationDelta(animTimeRef.current)
    animTimeRef.current = time
    uniforms.uTime.value += delta * speedRef.current
    uniforms.uViewportY.value = state.size.height * state.gl.getPixelRatio()
  })

  return (
    <points geometry={geometry} frustumCulled={false} renderOrder={2}>
      <primitive object={material} attach="material" />
    </points>
  )
}
