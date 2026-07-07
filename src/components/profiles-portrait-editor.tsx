"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "../lib/utils"
import { analyzePortraitFace } from "./profiles-portrait-face"
import {
  processPortrait,
  regradePortrait,
} from "./profiles-portrait-process"
import { PORTRAIT_BACKGROUND_PRESETS } from "./profiles-portrait-background"
import {
  PORTRAIT_COMPOSITIONS,
  PORTRAIT_STYLE_PRESETS,
  type PortraitCompositionId,
  type PortraitStylePresetId,
  type PortraitStyleSettings,
} from "./profiles-portrait-types"
import type { PortraitFaceAnalysis } from "./profiles-portrait-types"

export const PORTRAIT_EDITOR_EXIT_MS = 220

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

function PortraitErrorBadge({ message }: { message: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
    setOpen(true)
  }, [])

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => {
      setOpen(false)
      setCopied(false)
    }, 180)
  }, [])

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      show()
    } catch {
      setCopied(false)
    }
  }, [message, show])

  return (
    <div
      className={cn(
        "portrait-editor-error-badge",
        open && "is-open",
      )}
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
    >
      <span className="portrait-editor-error-dot" aria-hidden="true" />
      <span>Error</span>
      <div
        className="portrait-editor-error-tooltip"
        role="tooltip"
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
      >
        <p className="portrait-editor-error-message">{message}</p>
        <button
          type="button"
          className="portrait-editor-error-copy"
          onClick={() => {
            void handleCopy()
          }}
        >
          {copied ? "Copied" : "Copy error"}
        </button>
      </div>
    </div>
  )
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
  const aiGeneratedRef = useRef(false)
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

  const transferPreviewUrl = useCallback((): string | null => {
    const url = previewUrlRef.current
    previewUrlRef.current = null
    aiBaseUrlRef.current = null
    return url
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

  // Reset when the dialog opens — show the original immediately, no auto AI.
  useEffect(() => {
    if (!open) return

    setSettings(initialSettings)
    setPreviewUrl(null)
    setFaceAnalysis(null)
    setError(null)
    setStatus(null)
    setProcessing(false)
    aiGeneratedRef.current = false
    revokePreview()
    revokeAiBase()
    settingsSnapshotRef.current = JSON.stringify(initialSettings)
    compositionSnapshotRef.current = initialSettings.composition
  }, [open, sourceUrl, initialSettings, revokePreview, revokeAiBase])

  const runAiGeneration = useCallback(
    async (nextSettings: PortraitStyleSettings) => {
      const runId = ++runIdRef.current
      let cancelled = false

      setProcessing(true)
      setError(null)
      setStatus("Preparing face reference…")

      try {
        const analysis =
          faceAnalysis ??
          (await analyzePortraitFace(sourceUrl, setStatus))
        if (cancelled || runId !== runIdRef.current) return
        setFaceAnalysis(analysis)

        const result = await processPortrait(
          sourceUrl,
          nextSettings,
          setStatus,
          analysis,
        )
        if (cancelled || runId !== runIdRef.current) return

        revokeAiBase()
        revokePreview()
        previewUrlRef.current = result.url
        aiBaseUrlRef.current = result.aiUrl
        setPreviewUrl(result.url)
        aiGeneratedRef.current = true
        compositionSnapshotRef.current = nextSettings.composition
        settingsSnapshotRef.current = JSON.stringify(nextSettings)
        setStatus(null)
      } catch (err) {
        if (cancelled || runId !== runIdRef.current) return
        setStatus(null)
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled && runId === runIdRef.current) setProcessing(false)
      }
    },
    [faceAnalysis, revokeAiBase, revokePreview, sourceUrl],
  )

  // Re-run AI or regrade when the user tweaks settings after a generation.
  useEffect(() => {
    if (!open || !aiGeneratedRef.current || !faceAnalysis) return

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
            ? "AI edit — preserving face details…"
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
          setError(err instanceof Error ? err.message : String(err))
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

  const STUDIO_EXIT_MS = PORTRAIT_EDITOR_EXIT_MS
  const [present, setPresent] = useState(open)
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (open) {
      setPresent(true)
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setActive(true))
      })
      return () => cancelAnimationFrame(frame)
    }

    setActive(false)
    const timeout = window.setTimeout(() => setPresent(false), STUDIO_EXIT_MS)
    return () => window.clearTimeout(timeout)
  }, [open])

  if (!present) return null

  const faceDetected = (faceAnalysis?.confidence ?? 0) > 0

  return (
    <div
      className={cn(
        "portrait-editor-backdrop",
        active && "is-active",
      )}
      role="presentation"
    >
      <div
        className="portrait-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="portrait-editor-title"
      >
        <header className="portrait-editor-header">
          <div>
            <h2 id="portrait-editor-title" className="portrait-editor-title">
              AI portrait studio
            </h2>
            <p className="portrait-editor-subtitle">
              Optional — edit your photo into a new scenario while preserving
              facial identity. Uses FLUX.2 klein 9B (fast, ~10–30s).
            </p>
          </div>
          <button
            type="button"
            className="portrait-editor-close"
            onClick={onClose}
            aria-label="Close portrait editor"
          >
            <svg
              aria-hidden="true"
              className="portrait-editor-close-icon"
              viewBox="0 0 14 14"
              width="14"
              height="14"
            >
              <path
                d="M2 2 12 12M12 2 2 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
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
                      ? "AI result"
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
                    {processing ? "Generating…" : previewUrl ? "AI result" : "Not generated"}
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
                        : "Click “Generate AI portrait” to create a new scenario."}
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
              <button
                type="button"
                className="portrait-editor-btn portrait-editor-btn-primary portrait-editor-generate"
                disabled={processing}
                onClick={() => {
                  void runAiGeneration(settings)
                }}
              >
                {processing ? "Generating…" : "Generate AI portrait"}
              </button>
            </div>

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
              <span className="portrait-editor-section-title">Background</span>
              <p className="portrait-editor-section-hint">
                Replaces the backdrop behind the subject after AI generation.
              </p>
              <div className="portrait-editor-bg-swatches">
                {PORTRAIT_BACKGROUND_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={cn(
                      "portrait-editor-bg-swatch",
                      settings.backgroundColor.toLowerCase() ===
                        preset.color.toLowerCase() && "is-active",
                    )}
                    onClick={() =>
                      setSettings((s) => ({
                        ...s,
                        backgroundColor: preset.color,
                        removeBackground: true,
                      }))
                    }
                  >
                    <span
                      className="portrait-editor-bg-swatch-chip"
                      style={{ background: preset.color }}
                      aria-hidden="true"
                    />
                    {preset.label}
                  </button>
                ))}
              </div>
              <label className="portrait-editor-color">
                <span>Custom color</span>
                <input
                  type="color"
                  value={settings.backgroundColor}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      backgroundColor: e.target.value,
                      removeBackground: true,
                    }))
                  }
                />
              </label>
              <label className="portrait-editor-toggle">
                <input
                  type="checkbox"
                  checked={settings.removeBackground}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      removeBackground: e.target.checked,
                    }))
                  }
                />
                Replace background with solid color
              </label>
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
            <PortraitErrorBadge message={error} />
          ) : status ? (
            <div className="portrait-editor-status" role="status">
              <span className="profiles-status-dot" />
              {status}
            </div>
          ) : (
            <span className="portrait-editor-footer-hint">
              Use your original photo, or generate then apply an AI portrait.
            </span>
          )}
          <div className="portrait-editor-actions">
            {onSkip ? (
              <button
                type="button"
                className="portrait-editor-btn portrait-editor-btn-primary"
                disabled={processing}
                onClick={() => onSkip(sourceUrl)}
              >
                Use original photo
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
              className="portrait-editor-btn"
              disabled={processing || !previewUrl}
              onClick={() => {
                const url = transferPreviewUrl()
                if (url) onApply(url, settings)
              }}
            >
              Apply AI portrait
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
