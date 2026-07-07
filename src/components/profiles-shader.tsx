"use client"

import { Canvas } from "@react-three/fiber"
import { useCallback, useEffect, useRef, useState } from "react"
import { useShaderDev } from "shader-panel"
import { cn } from "../lib/utils"
import { generateDepthMap } from "./profiles-depth"
import { PortraitEditor } from "./profiles-portrait-editor"
import {
  portraitSettingsFromConfig,
  portraitSettingsToConfig,
  PROFILES_SHADER_DEFAULTS,
  PROFILES_SHADER_PRESETS,
  type ProfilesShaderConfig,
} from "./profiles-shader-config"
import { PROFILES_SHADER_DEV_FIELDS } from "./profiles-shader-fields"
import type { PortraitStyleSettings } from "./profiles-portrait-types"
import { ProfilesMesh } from "./profiles-shader-mesh"

interface ProfilesShaderProps {
  className?: string
}

export function ProfilesShader({ className }: ProfilesShaderProps) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorSource, setEditorSource] = useState<string | null>(null)
  const [editorSettings, setEditorSettings] =
    useState<PortraitStyleSettings | null>(null)
  const openEditorRef = useRef<() => void>(() => {})

  const openPortraitEditor = useCallback((src: string) => {
    setEditorSettings(portraitSettingsFromConfig(configRef.current))
    setEditorSource(src)
    setEditorOpen(true)
  }, [])

  const [config, setConfig] = useShaderDev<ProfilesShaderConfig>({
    id: "profiles-relight",
    title: "Profile relight",
    defaults: PROFILES_SHADER_DEFAULTS,
    fields: PROFILES_SHADER_DEV_FIELDS,
    defaultTheme: "dark",
    defaultOpen: true,
    actionHandlers: {
      openPortraitEditor: () => openEditorRef.current(),
    },
  })

  const configRef = useRef(config)
  configRef.current = config

  openEditorRef.current = () => {
    const src = configRef.current.imageSrc
    if (!src || src === PROFILES_SHADER_DEFAULTS.imageSrc) return
    openPortraitEditor(src)
  }

  const [status, setStatus] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const portraitReadyRef = useRef(true)
  const editorAppliedRef = useRef(false)

  // Intercept panel uploads — the image field writes blob URLs directly to config.
  useEffect(() => {
    if (editorAppliedRef.current) {
      editorAppliedRef.current = false
      return
    }

    const src = config.imageSrc
    if (
      config.portraitAutoProcess &&
      src.startsWith("blob:") &&
      src !== PROFILES_SHADER_DEFAULTS.imageSrc &&
      !editorOpen &&
      editorSource !== src
    ) {
      portraitReadyRef.current = false
      openPortraitEditor(src)
    }
  }, [
    config.imageSrc,
    config.portraitAutoProcess,
    editorOpen,
    editorSource,
    openPortraitEditor,
  ])

  // Apply a lighting scenario when the preset select changes.
  const lastPresetRef = useRef(config.preset)
  useEffect(() => {
    if (config.preset === lastPresetRef.current) return
    lastPresetRef.current = config.preset
    const preset = PROFILES_SHADER_PRESETS[config.preset]
    if (preset) {
      setConfig({ ...configRef.current, ...preset, preset: config.preset })
    }
  }, [config.preset, setConfig])

  // Generate a depth map whenever a new image arrives (panel upload or drop).
  // The default image ships with a precomputed depth map, so it's exempt.
  const processedSrcRef = useRef(PROFILES_SHADER_DEFAULTS.imageSrc)
  useEffect(() => {
    const src = config.imageSrc
    if (!src || src === processedSrcRef.current) return
    if (!portraitReadyRef.current) return
    processedSrcRef.current = src

    if (src === PROFILES_SHADER_DEFAULTS.imageSrc) {
      if (configRef.current.depthSrc !== PROFILES_SHADER_DEFAULTS.depthSrc) {
        setConfig({
          ...configRef.current,
          depthSrc: PROFILES_SHADER_DEFAULTS.depthSrc,
        })
      }
      return
    }

    // Flat-depth fallback renders while the model runs.
    setConfig({ ...configRef.current, depthSrc: "" })
    generateDepthMap(src, setStatus)
      .then((depthUrl) => {
        // A newer upload may have superseded this one.
        if (configRef.current.imageSrc !== src) return
        setConfig({ ...configRef.current, depthSrc: depthUrl })
        setStatus(null)
      })
      .catch((err: unknown) => {
        if (configRef.current.imageSrc !== src) return
        setStatus(
          `Depth generation failed: ${err instanceof Error ? err.message : String(err)}`,
        )
      })
  }, [config.imageSrc, setConfig])

  // Dragging a light helper ring on the canvas re-positions that light.
  const handleLightPosChange = useCallback(
    (lightIndex: number, pos: readonly [number, number]) => {
      const key = `light${lightIndex + 1}Pos` as
        | "light1Pos"
        | "light2Pos"
        | "light3Pos"
      setConfig({ ...configRef.current, [key]: pos })
    },
    [setConfig],
  )

  const handleIncomingFile = useCallback(
    (file: File | null | undefined) => {
      if (!file || !file.type.startsWith("image/")) return
      const objectUrl = URL.createObjectURL(file)

      if (configRef.current.portraitAutoProcess) {
        portraitReadyRef.current = false
        openPortraitEditor(objectUrl)
        return
      }

      portraitReadyRef.current = true
      setConfig({
        ...configRef.current,
        imageSrc: objectUrl,
      })
    },
    [openPortraitEditor, setConfig],
  )

  const handleEditorApply = useCallback(
    (processedUrl: string, settings: PortraitStyleSettings) => {
      editorAppliedRef.current = true
      portraitReadyRef.current = true
      processedSrcRef.current = ""
      setConfig({
        ...configRef.current,
        imageSrc: processedUrl,
        ...portraitSettingsToConfig(settings),
      })
      setEditorOpen(false)
      setEditorSource(null)
      setEditorSettings(null)
    },
    [setConfig],
  )

  const handleEditorSkip = useCallback(
    (originalUrl: string) => {
      editorAppliedRef.current = true
      portraitReadyRef.current = true
      processedSrcRef.current = ""
      setConfig({
        ...configRef.current,
        imageSrc: originalUrl,
      })
      setEditorOpen(false)
      setEditorSource(null)
      setEditorSettings(null)
    },
    [setConfig],
  )

  const handleEditorClose = useCallback(() => {
    if (editorSource?.startsWith("blob:")) {
      URL.revokeObjectURL(editorSource)
    }
    setEditorOpen(false)
    setEditorSource(null)
    setEditorSettings(null)
  }, [editorSource])

  return (
    <div
      className={cn(
        "pointer-events-auto absolute inset-0 overflow-hidden",
        className,
      )}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        handleIncomingFile(e.dataTransfer.files?.[0])
      }}
    >
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 5], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        style={{ width: "100%", height: "100%" }}
      >
        <color attach="background" args={["#050507"]} />
        <ProfilesMesh config={config} onLightPosChange={handleLightPosChange} />
      </Canvas>

      {status ? (
        <div className="profiles-status" role="status">
          <span className="profiles-status-dot" />
          {status}
        </div>
      ) : null}

      {dragOver ? (
        <div className="profiles-dropzone" aria-hidden="true">
          Drop to relight
        </div>
      ) : null}

      {editorSource && editorSettings ? (
        <PortraitEditor
          sourceUrl={editorSource}
          initialSettings={editorSettings}
          open={editorOpen}
          onClose={handleEditorClose}
          onApply={handleEditorApply}
          onSkip={handleEditorSkip}
        />
      ) : null}
    </div>
  )
}
