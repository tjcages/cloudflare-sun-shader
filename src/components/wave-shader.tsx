"use client"

import { OrbitControls } from "@react-three/drei"
import { Canvas, useThree } from "@react-three/fiber"
import { useEffect } from "react"
import { PerspectiveCamera } from "three"
import { useShaderDev } from "shader-panel"
import { cn } from "../lib/utils"
import {
  WAVE_SHADER_DEFAULTS,
  type WaveShaderConfig,
} from "./wave-shader-config"
import { WAVE_SHADER_DEV_FIELDS } from "./wave-shader-fields"
import { WaveMesh } from "./wave-shader-mesh"

interface WaveShaderProps {
  className?: string
}

export function WaveShader({ className }: WaveShaderProps) {
  // One call: owns state, registers, and injects the panel. No <ShaderDevRoot/>.
  const [config] = useShaderDev<WaveShaderConfig>({
    id: "wave",
    title: "Wave shader",
    defaults: WAVE_SHADER_DEFAULTS,
    fields: WAVE_SHADER_DEV_FIELDS,
    defaultTheme: "dark",
  })

  return (
    <div
      className={cn(
        "pointer-events-auto absolute inset-0 overflow-hidden",
        className,
      )}
    >
      <Canvas
        dpr={[1, 1.75]}
        camera={{
          position: [0, config.cameraY, config.cameraZ],
          fov: config.cameraFov,
          near: 0.1,
          far: 500,
        }}
        gl={{ antialias: true, alpha: true }}
        style={{ width: "100%", height: "100%" }}
      >
        <color attach="background" args={["#0b0b14"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 5]} intensity={1.1} />
        <pointLight position={[-2, 1, 3]} intensity={0.8} color="#635BFF" />
        <WaveMesh config={config} position={[0, 0, 0]} rotation={[0, 0, 0]} />
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
