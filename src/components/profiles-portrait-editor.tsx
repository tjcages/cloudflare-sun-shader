"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "../lib/utils"
import { analyzePortraitFace } from "./profiles-portrait-face"
import {
  processPortrait,
  regradePortrait,
} from "./profiles-portrait-process"
import {
  PORTRAIT_COMPOSITIONS,
  PORTRAIT_STYLE_PRESETS,
  type PortraitCompositionId,
  type PortraitStylePresetId,
  type PortraitStyleSettings,
} from "./profiles-portrait-types"
import type { PortraitFaceAnalysis } from "./profiles-portrait-types"

export type PortraitEditorProps = {
  /** Object URL or asset path of the raw uploaded image. */
  sourceUrl: string
  /** Initial style settings (from shader config). */
  initialSettings: PortraitStyleSettings
  open: boolean
  onClose: () => void
  /** Called with the processed portrait object URL when the user applies. */
  onApply: (processedUrl: string, settings: PortraitStyleSettings) => void
  /** Skip processing and use the original image. */
  onSkip?: (originalUrl: string) => void
}

const COMPOSITION_OPTIONS = Object.values(PORTRAIT_COMPOSITIONS)

const LOOK_OPTIONS: Array<{ value: PortraitStylePresetId; label: string }> = [
  { value: "cloudflare", label: "Cloudflare studio" },
  { value: "studio", label: "Studio neutral" },
  { value: "studioWarm", label: "Studio warm" },
  { value: "studioCool", label: "Studio cool" },
  { value: "natural", label: "Natural (minimal)" },
]

function gradeOnlyFields(settings: PortraitStyleSettings) {
  return {
    preset: settings.preset,
    exposure: settings.exposure,
    contrast: settings.contrast,
    warmth: settings.warmth,
    saturation: settings.saturation,
    backgroundColor: settings.backgroundColor,
    removeBackground: settings.removeBackground,
  }
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <label className="portrait-editor-slider">
      <span className="portrait-editor-slider-label">
        <span>{label}</span>
        <span className="portrait-editor-slider-value">{value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        className="shader-dev-range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

export function PortraitEditor({
  sourceUrl,
  initialSettings,
  open,
  onClose,
  onApply,
  onSkip,
}: PortraitEditorProps) {
  const [settings, setSettings] = useState<PortraitStyleSettings>(initialSettings)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [faceAnalysis, setFaceAnalysis] = useState<PortraitFaceAnalysis | null>(
    null,
  )
  const [compareMode, setCompareMode] = useState<"split" | "processed" | "original">(
    "split",
  )

  const previewUrlRef = useRef<string | null>(null)
  const aiBaseUrlRef = useRef<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runIdRef = useRef(0)
  const initialDoneRef = useRef(false)
  const settingsSnapshotRef = useRef("")
  const compositionSnapshotRef = useRef<PortraitCompositionId>(
    initialSettings.composition,
  )

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
  }, [])

  const revokeAiBase = useCallback(() => {
    if (aiBaseUrlRef.current) {
      URL.revokeObjectURL(aiBaseUrlRef.current)
      aiBaseUrlRef.current = null
    }
  }, [])

  const applyComposition = useCallback((composition: PortraitCompositionId) => {
    setSettings((prev) => ({ ...prev, composition }))
  }, [])

  const applyPreset = useCallback((preset: PortraitStylePresetId) => {
    const presetSettings = PORTRAIT_STYLE_PRESETS[preset]
    setSettings((prev) => ({
      ...prev,
      preset,
      ...presetSettings,
    }))
  }, [])

  // Initial face analysis + AI recomposition on open.
  useEffect(() => {
    if (!open) return

    setSettings(initialSettings)
    setPreviewUrl(null)
    setFaceAnalysis(null)
    initialDoneRef.current = false
    revokePreview()
    revokeAiBase()

    const runId = ++runIdRef.current
    let cancelled = false

    ;(async () => {
      setProcessing(true)
      setError(null)
      setStatus("Analyzing portrait…")
      try {
        const analysis = await analyzePortraitFace(sourceUrl, setStatus)
        if (cancelled || runId !== runIdRef.current) return
        setFaceAnalysis(analysis)

        const result = await processPortrait(
          sourceUrl,
          initialSettings,
          setStatus,
          analysis,
        )
        if (cancelled || runId !== runIdRef.current) return
        revokePreview()
        previewUrlRef.current = result.url
        aiBaseUrlRef.current = result.aiUrl
        setPreviewUrl(result.url)
        setFaceAnalysis(result.faceAnalysis)
        setStatus(null)
        initialDoneRef.current = true
        compositionSnapshotRef.current = initialSettings.composition
        settingsSnapshotRef.current = JSON.stringify(initialSettings)
      } catch (err) {
        if (cancelled || runId !== runIdRef.current) return
        setStatus(null)
        setError(
          err instanceof Error ? err.message : String(err),
        )
      } finally {
        if (!cancelled && runId === runIdRef.current) setProcessing(false)
      }
    })()

    return () => {
      cancelled = true
    }
    // initialSettings is snapshotted by the parent when the editor opens —
    // only re-run when the dialog opens or the source image changes.
  }, [open, sourceUrl, initialSettings, revokePreview, revokeAiBase])

  // Debounced re-process when the user tweaks settings (after initial load).
  useEffect(() => {
    if (!open || !faceAnalysis || !initialDoneRef.current) return

    const settingsJson = JSON.stringify(settings)
    if (settingsJson === settingsSnapshotRef.current) return

    const compositionChanged =
      settings.composition !== compositionSnapshotRef.current
    const prevSettings = JSON.parse(
      settingsSnapshotRef.current,
    ) as PortraitStyleSettings
    const gradeOnlyChanged =
      !compositionChanged &&
      JSON.stringify(gradeOnlyFields(settings)) !==
        JSON.stringify(gradeOnlyFields(prevSettings))

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      settingsSnapshotRef.current = settingsJson
      const runId = ++runIdRef.current
      let cancelled = false

      ;(async () => {
        setProcessing(true)
        setError(null)
        setStatus(
          compositionChanged
            ? "AI recomposition — generating new photograph…"
            : "Updating color grade…",
        )
        try {
          if (compositionChanged || !aiBaseUrlRef.current) {
            const result = await processPortrait(
              sourceUrl,
              settings,
              setStatus,
              faceAnalysis,
            )
            if (cancelled || runId !== runIdRef.current) return
            revokeAiBase()
            revokePreview()
            previewUrlRef.current = result.url
            aiBaseUrlRef.current = result.aiUrl
            setPreviewUrl(result.url)
            compositionSnapshotRef.current = settings.composition
          } else if (gradeOnlyChanged && aiBaseUrlRef.current) {
            const url = await regradePortrait(
              aiBaseUrlRef.current,
              settings,
              setStatus,
            )
            if (cancelled || runId !== runIdRef.current) return
            revokePreview()
            previewUrlRef.current = url
            setPreviewUrl(url)
          }
          setStatus(null)
        } catch (err) {
          if (cancelled || runId !== runIdRef.current) return
          setStatus(null)
          setError(
            err instanceof Error ? err.message : String(err),
          )
        } finally {
          if (!cancelled && runId === runIdRef.current) setProcessing(false)
        }
      })()

      return () => {
        cancelled = true
      }
    }, compositionChanged ? 300 : 450)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [
    settings,
    open,
    faceAnalysis,
    sourceUrl,
    revokePreview,
    revokeAiBase,
  ])

  useEffect(() => {
    return () => {
      revokePreview()
      revokeAiBase()
    }
  }, [revokePreview, revokeAiBase])

  if (!open) return null

  const faceDetected = (faceAnalysis?.confidence ?? 0) > 0

  return (
    <div className="portrait-editor-backdrop" role="presentation">
      <div
        className="portrait-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="portrait-editor-title"
      >
        <header className="portrait-editor-header">
          <div>
            <h2 id="portrait-editor-title" className="portrait-editor-title">
              Portrait editor
            </h2>
            <p className="portrait-editor-subtitle">
              AI re-photographs each upload in a consistent scenario — new
              composition, lighting, and background. Likeness is preserved via
              Workers AI (FLUX).
            </p>
          </div>
          <button
            type="button"
            className="portrait-editor-close"
            onClick={onClose}
            aria-label="Close portrait editor"
          >
            ×
          </button>
        </header>

        <div className="portrait-editor-body">
          <div className="portrait-editor-preview">
            <div className="portrait-editor-preview-tabs">
              {(["split", "processed", "original"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={cn(
                    "portrait-editor-tab",
                    compareMode === mode && "is-active",
                  )}
                  onClick={() => setCompareMode(mode)}
                >
                  {mode === "split"
                    ? "Before / After"
                    : mode === "processed"
                      ? "Generated"
                      : "Original"}
                </button>
              ))}
            </div>

            <div
              className={cn(
                "portrait-editor-canvas",
                compareMode === "split" && "is-split",
              )}
            >
              {compareMode !== "processed" ? (
                <div className="portrait-editor-pane">
                  <span className="portrait-editor-pane-label">Original</span>
                  <img
                    src={sourceUrl}
                    alt="Original upload"
                    className="portrait-editor-img"
                    draggable={false}
                  />
                </div>
              ) : null}
              {compareMode !== "original" ? (
                <div className="portrait-editor-pane">
                  <span className="portrait-editor-pane-label">
                    {processing ? "Generating…" : "AI portrait"}
                  </span>
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="AI-generated portrait"
                      className="portrait-editor-img"
                      draggable={false}
                    />
                  ) : (
                    <div className="portrait-editor-placeholder">
                      {processing
                        ? (status ?? "Generating portrait…")
                        : (status ?? "Preparing…")}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {faceAnalysis ? (
              <p className="portrait-editor-face-hint">
                {faceDetected
                  ? `Face detected — regenerating as “${PORTRAIT_COMPOSITIONS[settings.composition].label}”.`
                  : "No face detected — AI may drift from likeness. Use a clearer front-facing photo."}
              </p>
            ) : null}
          </div>

          <aside className="portrait-editor-controls">
            <div className="portrait-editor-section">
              <span className="portrait-editor-section-title">Scenario</span>
              <p className="portrait-editor-section-hint">
                Each option generates a new photograph — not a crop or reposition.
              </p>
              <div className="portrait-editor-compositions">
                {COMPOSITION_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={cn(
                      "portrait-editor-composition",
                      settings.composition === opt.id && "is-active",
                    )}
                    onClick={() => applyComposition(opt.id)}
                  >
                    <span className="portrait-editor-composition-label">
                      {opt.label}
                    </span>
                    <span className="portrait-editor-composition-desc">
                      {opt.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="portrait-editor-section">
              <span className="portrait-editor-section-title">Color look</span>
              <div className="portrait-editor-presets">
                {LOOK_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={cn(
                      "portrait-editor-preset",
                      settings.preset === opt.value && "is-active",
                    )}
                    onClick={() => applyPreset(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="portrait-editor-section">
              <span className="portrait-editor-section-title">Color grade</span>
              <SliderRow
                label="Exposure"
                value={settings.exposure}
                min={0.5}
                max={1.5}
                step={0.01}
                onChange={(v) => setSettings((s) => ({ ...s, exposure: v }))}
              />
              <SliderRow
                label="Contrast"
                value={settings.contrast}
                min={0.8}
                max={1.3}
                step={0.01}
                onChange={(v) => setSettings((s) => ({ ...s, contrast: v }))}
              />
              <SliderRow
                label="Warmth"
                value={settings.warmth}
                min={-0.2}
                max={0.2}
                step={0.01}
                onChange={(v) => setSettings((s) => ({ ...s, warmth: v }))}
              />
              <SliderRow
                label="Saturation"
                value={settings.saturation}
                min={0.7}
                max={1.3}
                step={0.01}
                onChange={(v) =>
                  setSettings((s) => ({ ...s, saturation: v }))
                }
              />
            </div>
          </aside>
        </div>

        <footer className="portrait-editor-footer">
          {error ? (
            <div className="portrait-editor-error-badge">
              <span className="portrait-editor-error-dot" aria-hidden="true" />
              <span>Error</span>
              <div className="portrait-editor-error-tooltip" role="tooltip">
                {error}
              </div>
            </div>
          ) : status ? (
            <div className="portrait-editor-status" role="status">
              <span className="profiles-status-dot" />
              {status}
            </div>
          ) : (
            <span className="portrait-editor-footer-hint">
              Requires Workers AI — run `pnpm build && pnpm preview`
            </span>
          )}
          <div className="portrait-editor-actions">
            {onSkip ? (
              <button
                type="button"
                className="portrait-editor-btn"
                disabled={processing}
                onClick={() => onSkip(sourceUrl)}
              >
                Use original
              </button>
            ) : null}
            <button
              type="button"
              className="portrait-editor-btn"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="portrait-editor-btn portrait-editor-btn-primary"
              disabled={processing || !previewUrl}
              onClick={() => {
                if (previewUrl) onApply(previewUrl, settings)
              }}
            >
              Apply portrait
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
