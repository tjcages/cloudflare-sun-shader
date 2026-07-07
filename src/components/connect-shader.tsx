"use client"

import { TrackballControls } from "@react-three/drei"
import { Canvas, useThree } from "@react-three/fiber"
import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react"
import { MOUSE, PerspectiveCamera } from "three"
import { registerShaderCapture, useShaderDev } from "shader-panel"
import { cn } from "../lib/utils"
import {
  CONNECT_SHADER_DEFAULTS,
  type ConnectShaderConfig,
} from "./connect-shader-config"
import { CONNECT_SHADER_DEV_FIELDS } from "./connect-shader-fields"
import { ConnectEmitter, ConnectMesh } from "./connect-shader-mesh"
import {
  ConnectPostPipeline,
  useConnectPostFx,
} from "./connect-postfx"

interface ConnectShaderProps {
  className?: string
}

export function ConnectShader({ className }: ConnectShaderProps) {
  const [config] = useShaderDev<ConnectShaderConfig>({
    id: "connect-v6",
    title: "Connect shader",
    defaults: CONNECT_SHADER_DEFAULTS,
    fields: CONNECT_SHADER_DEV_FIELDS,
    defaultTheme: "light",
  })

  return (
    <div
      className={cn(
        "pointer-events-auto absolute inset-0 overflow-hidden",
        className,
      )}
    >
      <Canvas
        key={config.renderAntialias ? "connect-aa" : "connect-no-aa"}
        dpr={config.renderDpr}
        onContextMenu={(event) => event.preventDefault()}
        camera={{
          position: [0, config.cameraY, config.cameraZ],
          fov: config.cameraFov,
          near: 0.1,
          far: 500,
        }}
        // preserveDrawingBuffer keeps the last frame readable so the panel's
        // image export (canvas.toBlob) captures actual pixels, not a blank
        // buffer.
        gl={{
          antialias: config.renderAntialias,
          alpha: true,
          preserveDrawingBuffer: true,
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <RenderDprSync dpr={config.renderDpr} />
        <ConnectPostPipeline
          config={config}
          scene={
            <>
              <color attach="background" args={["#ffffff"]} />
              <ConnectMesh config={config} position={[0, 0, 0]} rotation={[0, 0, 0]} />
              <ConnectEmitter config={config} />
              <CameraSync
                y={config.cameraY}
                z={config.cameraZ}
                fov={config.cameraFov}
              />
              <ConnectTrackballControls
                makeDefault
                rotateSpeed={3.5}
                zoomSpeed={1.2}
                panSpeed={1.2}
                noPan={false}
                dynamicDampingFactor={0.15}
                minDistance={0.5}
                maxDistance={120}
              />
            </>
          }
          overlay={<HiResCapture />}
        />
      </Canvas>
    </div>
  )
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",")
  const mime = /:(.*?);/.exec(head)?.[1] ?? "image/png"
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/**
 * Registers a hi-res capture with the shader-dev panel: on demand, momentarily
 * resize the real renderer to the requested super-resolution, render one frame
 * of the actual scene, read it back as a PNG, then restore. Because it's a
 * synchronous render + `toDataURL` (not a rAF/captureStream), the frame is
 * pixel-exact to the live shader — just with far more samples — and it works
 * even when the tab is backgrounded.
 */
function HiResCapture() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const postFx = useConnectPostFx()
  const live = useRef({ gl, scene, camera, size, postFx })
  live.current = { gl, scene, camera, size, postFx }

  useEffect(() => {
    return registerShaderCapture(async ({ maxEdge }) => {
      const { gl, scene, camera, size, postFx: fx } = live.current
      const ctx = gl.getContext()
      // The drawing buffer can't exceed the smaller of the texture and
      // renderbuffer limits (the default framebuffer needs both, and with
      // antialias the multisampled renderbuffer is the tighter one).
      const texMax = (ctx.getParameter(ctx.MAX_TEXTURE_SIZE) as number) || 8192
      const rbMax =
        (ctx.getParameter(ctx.MAX_RENDERBUFFER_SIZE) as number) || texMax
      const hardMax = Math.min(texMax, rbMax)
      const { width: w, height: h } = size
      const longest = Math.max(w, h)
      // Only ever upscale; clamp the longest edge to the GPU's real limit.
      const scale = Math.max(1, Math.min(maxEdge, hardMax) / longest)
      const prevDpr = gl.getPixelRatio()

      try {
        gl.setPixelRatio(1)
        let tw = Math.round(w * scale)
        let th = Math.round(h * scale)
        gl.setSize(tw, th, false)

        // Some GPUs silently cap the *actual* drawing buffer below the size we
        // asked for. If we don't detect that, the scene renders into a corner
        // of an over-sized canvas (the "only top-left" bug). Fit the requested
        // size down to what the buffer can really back, preserving aspect, so
        // the frame always fills the image.
        const bw = ctx.drawingBufferWidth
        const bh = ctx.drawingBufferHeight
        if (bw < tw || bh < th) {
          const fit = Math.min(bw / tw, bh / th)
          tw = Math.max(1, Math.floor(tw * fit))
          th = Math.max(1, Math.floor(th * fit))
          gl.setSize(tw, th, false)
        }

        if (fx) {
          fx.renderFrame(gl, camera, tw, th)
        } else {
          gl.render(scene, camera)
        }
        // Synchronous read — nothing can repaint between render and read.
        const url = gl.domElement.toDataURL("image/png")
        return dataUrlToBlob(url)
      } finally {
        gl.setPixelRatio(prevDpr)
        gl.setSize(w, h, false)
        if (fx) {
          fx.renderFrame(gl, camera, w, h)
        } else {
          gl.render(scene, camera)
        }
      }
    })
  }, [])

  return null
}

/** TrackballControls instance fields used for shift+pan wiring. */
type TrackballControlsInstance = {
  noPan: boolean
  mouseButtons: { MIDDLE: number }
  _keyState: number
  STATE: { NONE: number; PAN: number }
}

/**
 * TrackballControls with reliable pan:
 * - Right-drag (built in)
 * - Shift + left-drag (via _keyState — remapping mouseButtons.LEFT does NOT work)
 * - Middle-drag (scroll wheel still zooms)
 * - domElement pinned to the canvas, not r3f's internal event target
 */
function ConnectTrackballControls(
  props: ComponentProps<typeof TrackballControls>,
) {
  const gl = useThree((s) => s.gl)
  const [controls, setControls] = useState<TrackballControlsInstance | null>(
    null,
  )

  const setControlsRef = useCallback((instance: TrackballControlsInstance | null) => {
    setControls(instance)
  }, [])

  useEffect(() => {
    if (!controls) return

    controls.noPan = false
    // Middle-click pan; wheel handler still handles zoom.
    const defaultMiddle = controls.mouseButtons.MIDDLE
    controls.mouseButtons.MIDDLE = MOUSE.PAN

    const el = gl.domElement

    const onPointerDown = (event: PointerEvent) => {
      if (event.shiftKey && event.button === 0 && !controls.noPan) {
        controls._keyState = controls.STATE.PAN
      }
    }

    const onPointerUp = () => {
      if (controls._keyState === controls.STATE.PAN) {
        controls._keyState = controls.STATE.NONE
      }
    }

    el.addEventListener("pointerdown", onPointerDown, true)
    el.addEventListener("pointerup", onPointerUp, true)

    return () => {
      controls.mouseButtons.MIDDLE = defaultMiddle
      el.removeEventListener("pointerdown", onPointerDown, true)
      el.removeEventListener("pointerup", onPointerUp, true)
    }
  }, [controls, gl])

  return (
    <TrackballControls
      ref={setControlsRef as ComponentProps<typeof TrackballControls>["ref"]}
      domElement={gl.domElement}
      {...props}
    />
  )
}

function RenderDprSync({ dpr }: { dpr: number }) {
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)

  useEffect(() => {
    gl.setPixelRatio(dpr)
    gl.setSize(size.width, size.height, false)
  }, [dpr, gl, size.width, size.height])

  return null
}

function CameraSync({ y, z, fov }: { y: number; z: number; fov: number }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as
    | { update: () => void; target?: { set: (x: number, y: number, z: number) => void } }
    | null

  useEffect(() => {
    camera.position.set(0, y, z)
    // Panel camera edits reset pan offset so sliders always mean what they say.
    controls?.target?.set(0, 0, 0)
    if (camera instanceof PerspectiveCamera) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    controls?.update?.()
  }, [camera, controls, y, z, fov])

  return null
}
