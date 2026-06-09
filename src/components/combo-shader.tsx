"use client"

import { OrbitControls } from "@react-three/drei"
import { Canvas, useThree } from "@react-three/fiber"
import { useEffect, useState } from "react"
import { PerspectiveCamera } from "three"
import { registerShaderDev } from "shader-panel"
import { cn } from "../lib/utils"
import {
  COMBO_SHADER_DEFAULTS,
  type ComboShaderConfig,
} from "./combo-shader-config"
import { COMBO_SHADER_DEV_FIELDS } from "./combo-shader-fields"
import { ComboMesh } from "./combo-shader-mesh"

interface ComboShaderProps {
  className?: string
}

export function ComboShader({ className }: ComboShaderProps) {
  const [config, setConfig] = useState<ComboShaderConfig>(() => ({
    ...COMBO_SHADER_DEFAULTS,
  }))

  // Push current values to the dev panel on every config change WITHOUT
  // returning a cleanup — the panel treats subsequent registrations as
  // value updates. Returning a cleanup here would unregister + re-register
  // on every slider tick and break the live link.
  useEffect(() => {
    registerShaderDev({
      id: "combo",
      title: "Combo shader",
      values: config,
      defaults: { ...COMBO_SHADER_DEFAULTS },
      fields: COMBO_SHADER_DEV_FIELDS,
      onChange: setConfig,
    })
  }, [config])

  useEffect(() => {
    return () => registerShaderDev(null)
  }, [])

  return (
    <div
      className={cn(
        "pointer-events-auto absolute inset-0 overflow-hidden",
        className,
      )}
    >
      <Canvas
        dpr={[1, 1.75]}
        frameloop="always"
        camera={{
          position: [0, config.cameraY, config.cameraZ],
          fov: config.cameraFov,
          near: 0.1,
          far: 500,
        }}
        gl={{ antialias: true }}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      >
        <color attach="background" args={[config.bgColor]} />
        <ComboMesh config={config} />
        <CameraSync
          y={config.cameraY}
          z={config.cameraZ}
          fov={config.cameraFov}
        />
        <OrbitControls
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          minDistance={0.5}
          maxDistance={120}
          zoomSpeed={0.6}
          rotateSpeed={0.45}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  )
}

function CameraSync({ y, z, fov }: { y: number; z: number; fov: number }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as
    | { update: () => void }
    | null

  useEffect(() => {
    camera.position.set(0, y, z)
    if (camera instanceof PerspectiveCamera) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    controls?.update?.()
  }, [camera, controls, y, z, fov])

  return null
}
