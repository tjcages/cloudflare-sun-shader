import {
  BufferGeometry,
  Float32BufferAttribute,
  Vector3,
} from "three"
import type { ConnectShaderConfig } from "./connect-shader-config"

export type ConnectShapeType = ConnectShaderConfig["shapeType"]

export type ConnectSurfaceSample = {
  position: Vector3
  normal: Vector3
  tangent: Vector3
  uv: [number, number]
}

export type ConnectShapeParams = Pick<
  ConnectShaderConfig,
  | "shapeType"
  | "cylinderLength"
  | "shapeWidth"
  | "twistX"
  | "twistY"
  | "shapeRadius"
  | "shapeConeRadiusStart"
  | "shapeConeRadiusEnd"
  | "shapeTube"
  | "shapeBend"
  | "shapePitch"
  | "shapeAmplitude"
  | "shapeTurns"
  | "shapeWaveFreq"
  | "shapeMeshQuality"
>

const _pos = new Vector3()
const _du = new Vector3()
const _dw = new Vector3()
const _normal = new Vector3()
const _tangent = new Vector3()
const _up = new Vector3(0, 1, 0)

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function twistAroundY(
  px: number,
  py: number,
  pz: number,
  angleDeg: number,
  target: Vector3,
): Vector3 {
  const angle = (Math.PI / 180) * angleDeg
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return target.set(c * px + s * pz, py, -s * px + c * pz)
}

function evalShapePosition(
  params: ConnectShapeParams,
  u: number,
  w: number,
  target = new Vector3(),
): Vector3 {
  const width = params.shapeWidth
  const length = params.cylinderLength
  const px = (u - 0.5) * width
  const py = (w - 0.5) * length

  switch (params.shapeType) {
    case "spiral": {
      const angle = py / params.twistY + px / params.twistX
      return twistAroundY(px, py, 0, angle, target)
    }
    case "plane":
      return target.set(px, py, 0)
    case "helix": {
      const t =
        (py / Math.max(params.shapePitch, 0.01)) *
        Math.PI *
        2 *
        params.shapeTurns
      const r = params.shapeRadius + px * 0.08
      return target.set(r * Math.cos(t), py, r * Math.sin(t))
    }
    case "ribbon": {
      const bend =
        params.shapeBend *
        Math.sin((py / length) * Math.PI * 2 * params.shapeTurns)
      return target.set(px, py, bend)
    }
    case "torus": {
      const major = params.shapeRadius
      const tube = params.shapeTube
      const theta = w * Math.PI * 2
      const phi = u * Math.PI * 2
      const ring = major + tube * Math.cos(phi)
      return target.set(
        ring * Math.cos(theta),
        tube * Math.sin(phi),
        ring * Math.sin(theta),
      )
    }
    case "mobius": {
      const v = w * Math.PI * 2 * Math.max(params.shapeTurns, 0.25)
      const s = (u - 0.5) * params.shapeWidth * 0.5
      const scale = params.shapeRadius
      return target.set(
        scale * (1 + s * Math.cos(v * 0.5)) * Math.cos(v),
        scale * s * Math.sin(v * 0.5),
        scale * (1 + s * Math.cos(v * 0.5)) * Math.sin(v),
      )
    }
    case "saddle": {
      const nx = (u - 0.5) * 2
      const ny = (w - 0.5) * 2
      const z = params.shapeAmplitude * nx * ny
      return target.set(px, py, z)
    }
    case "waveSheet": {
      const freq = params.shapeWaveFreq
      const z =
        params.shapeAmplitude *
        Math.sin(u * Math.PI * 2 * freq) *
        Math.cos(w * Math.PI * 2 * freq * 0.65)
      return target.set(px, py, z)
    }
    case "cone": {
      const y = (w - 0.5) * length
      const r = Math.max(
        0.001,
        params.shapeConeRadiusStart +
          (params.shapeConeRadiusEnd - params.shapeConeRadiusStart) * w,
      )

      // Literal cone: each height is a circle of radius r(y) on the Y axis.
      // u sweeps a constant arc length (shapeWidth) around that circle.
      const arcSpan = params.shapeWidth / r
      const azimuth = (u - 0.5) * arcSpan

      // Optional spiral twist on the conical surface.
      const twist =
        (y / Math.max(params.twistY, 0.01) +
          ((u - 0.5) * params.shapeWidth) /
            Math.max(params.twistX, 0.01)) *
        (Math.PI / 180)
      const theta = azimuth + twist

      return target.set(r * Math.cos(theta), y, r * Math.sin(theta))
    }
    case "disc": {
      const r = params.shapeRadius * Math.sqrt(Math.max(u, 1e-4))
      const angle = w * Math.PI * 2 * params.shapeTurns
      const ripple =
        params.shapeAmplitude *
        0.15 *
        Math.sin(angle * params.shapeWaveFreq)
      return target.set(
        r * Math.cos(angle),
        ripple,
        r * Math.sin(angle),
      )
    }
    default: {
      const unhandled: never = params.shapeType
      throw new Error(`Unknown Connect shape: ${unhandled}`)
    }
  }
}

/** Sample position, normal, tangent, and UV on the Connect surface patch. */
export function sampleConnectSurface(
  params: ConnectShapeParams,
  u: number,
  w: number,
): ConnectSurfaceSample {
  const uu = clamp01(u)
  const ww = clamp01(w)
  const eps = 1 / 512

  const position = evalShapePosition(params, uu, ww, new Vector3())
  evalShapePosition(params, uu + eps, ww, _du)
  evalShapePosition(params, uu - eps, ww, _pos)
  _du.sub(_pos).multiplyScalar(1 / (2 * eps))

  evalShapePosition(params, uu, ww + eps, _dw)
  evalShapePosition(params, uu, ww - eps, _pos)
  _dw.sub(_pos).multiplyScalar(1 / (2 * eps))

  _normal.crossVectors(_du, _dw)
  if (_normal.lengthSq() < 1e-10) {
    _normal.set(0, 0, 1)
  } else {
    _normal.normalize()
  }

  _tangent.copy(_dw)
  if (_tangent.lengthSq() < 1e-10) {
    _tangent.copy(_up)
  } else {
    _tangent.normalize()
  }

  return {
    position: position.clone(),
    normal: _normal.clone(),
    tangent: _tangent.clone(),
    uv: [uu, ww],
  }
}

function shapeGridSegments(params: ConnectShapeParams): {
  widthSeg: number
  heightSeg: number
} {
  const quality = Math.max(0.25, params.shapeMeshQuality)
  const length = params.cylinderLength
  const heightSeg = Math.round(
    Math.max(32, Math.min(640, length * 0.96 * quality)),
  )
  const baseWidth =
    params.shapeType === "torus" || params.shapeType === "mobius" ? 128 : 96
  const widthSeg = Math.round(
    Math.max(24, Math.min(512, baseWidth * quality)),
  )
  return { widthSeg, heightSeg }
}

/** Build a Connect surface mesh for the active shape type. */
export function buildConnectGeometry(
  params: ConnectShapeParams,
): BufferGeometry {
  const { widthSeg, heightSeg } = shapeGridSegments(params)
  const vertexCount = (widthSeg + 1) * (heightSeg + 1)
  const positions = new Float32Array(vertexCount * 3)
  const normals = new Float32Array(vertexCount * 3)
  const uvs = new Float32Array(vertexCount * 2)

  let vi = 0
  for (let j = 0; j <= heightSeg; j += 1) {
    const w = j / heightSeg
    for (let i = 0; i <= widthSeg; i += 1) {
      const u = i / widthSeg
      const sample = sampleConnectSurface(params, u, w)
      positions.set(sample.position.toArray(), vi * 3)
      normals.set(sample.normal.toArray(), vi * 3)
      uvs.set(sample.uv, vi * 2)
      vi += 1
    }
  }

  const indices: number[] = []
  for (let j = 0; j < heightSeg; j += 1) {
    for (let i = 0; i < widthSeg; i += 1) {
      const a = j * (widthSeg + 1) + i
      const b = a + 1
      const c = a + widthSeg + 1
      const d = c + 1
      indices.push(a, b, d, a, d, c)
    }
  }

  const geom = new BufferGeometry()
  geom.setAttribute("position", new Float32BufferAttribute(positions, 3))
  geom.setAttribute("normal", new Float32BufferAttribute(normals, 3))
  geom.setAttribute("uv", new Float32BufferAttribute(uvs, 2))
  geom.setIndex(indices)
  return geom
}

/** Pick shape params from the full Connect config. */
export function connectShapeParams(
  config: ConnectShaderConfig,
): ConnectShapeParams {
  return {
    shapeType: config.shapeType,
    cylinderLength: config.cylinderLength,
    shapeWidth: config.shapeWidth,
    twistX: config.twistX,
    twistY: config.twistY,
    shapeRadius: config.shapeRadius,
    shapeConeRadiusStart: config.shapeConeRadiusStart,
    shapeConeRadiusEnd: config.shapeConeRadiusEnd,
    shapeTube: config.shapeTube,
    shapeBend: config.shapeBend,
    shapePitch: config.shapePitch,
    shapeAmplitude: config.shapeAmplitude,
    shapeTurns: config.shapeTurns,
    shapeWaveFreq: config.shapeWaveFreq,
    shapeMeshQuality: config.shapeMeshQuality,
  }
}

export const CONNECT_SHAPE_OPTIONS: ReadonlyArray<{
  value: ConnectShapeType
  label: string
  description: string
}> = [
  {
    value: "spiral",
    label: "Spiral cylinder",
    description: "Classic twisted ribbon — the original Connect look.",
  },
  {
    value: "plane",
    label: "Flat plane",
    description: "Open sheet with no twist — clean billboard waves.",
  },
  {
    value: "helix",
    label: "Helix",
    description: "Ribbon wrapped around a corkscrew path.",
  },
  {
    value: "ribbon",
    label: "Bent ribbon",
    description: "Sine-curved sheet that sweeps through space.",
  },
  {
    value: "torus",
    label: "Torus",
    description: "Donut tube — stripes wrap the cross-section.",
  },
  {
    value: "mobius",
    label: "Möbius strip",
    description: "Single-sided loop with a half-twist seam.",
  },
  {
    value: "saddle",
    label: "Saddle",
    description: "Hyperbolic sheet — peaks and valleys at corners.",
  },
  {
    value: "waveSheet",
    label: "Wave sheet",
    description: "Baked rolling hills under the live noise displacement.",
  },
  {
    value: "cone",
    label: "Cone spiral",
    description: "True conical surface — circular cross-sections taper along Y.",
  },
  {
    value: "disc",
    label: "Disc",
    description: "Radial ripple disc — great for top-down camera angles.",
  },
]
