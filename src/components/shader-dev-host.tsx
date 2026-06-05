"use client"

import { useCallback, useMemo, useState, useSyncExternalStore } from "react"
import {
  type AccentShaderConfig,
  ACCENT_SHADER_DEFAULTS,
} from "./accent-shader-config"
import { ACCENT_SHADER_DEV_FIELDS } from "./accent-shader-fields"
import {
  getAccentShaderRegistration,
  subscribeAccentShader,
} from "../lib/shader-dev/store"
import {
  isShaderDevSection,
  type ShaderDevFieldDef,
} from "../lib/shader-dev/types"

const DEFAULTS = ACCENT_SHADER_DEFAULTS as AccentShaderConfig

export function ShaderDevHost() {
  const registration = useSyncExternalStore(
    subscribeAccentShader,
    getAccentShaderRegistration,
    () => null,
  )
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const toggle = useCallback(() => setOpen((v) => !v), [])

  const handleCopy = useCallback(() => {
    if (!registration) return
    const json = JSON.stringify(registration.config, null, 2)
    void navigator.clipboard.writeText(json)
    setStatus("Copied JSON")
    setTimeout(() => setStatus(null), 1800)
  }, [registration])

  const handleReset = useCallback(() => {
    registration?.setConfig({ ...DEFAULTS })
    setStatus("Reset to defaults")
    setTimeout(() => setStatus(null), 1800)
  }, [registration])

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label={open ? "Close shader controls" : "Open shader controls"}
        aria-expanded={open}
        className={`fixed right-4 bottom-4 z-[60] flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-black/30 text-white shadow-lg backdrop-blur-md transition-all duration-200 hover:border-white/40 hover:bg-black/50 ${
          open ? "opacity-100" : "opacity-25 hover:opacity-100"
        }`}
      >
        <GearIcon className={`h-5 w-5 transition-transform duration-300 ${open ? "rotate-45" : ""}`} />
      </button>

      {open && registration && (
        <DevPanel
          config={registration.config}
          onChange={registration.setConfig}
          onClose={() => setOpen(false)}
          onCopy={handleCopy}
          onReset={handleReset}
          status={status}
        />
      )}

      {open && !registration && (
        <div className="pointer-events-auto fixed right-4 bottom-20 z-[60] max-w-[280px] rounded-lg border border-white/15 bg-black/60 p-3 text-[13px] text-white shadow-lg backdrop-blur-md">
          Shader not ready yet — the controls will appear once it hydrates.
        </div>
      )}
    </>
  )
}

function DevPanel({
  config,
  onChange,
  onClose,
  onCopy,
  onReset,
  status,
}: {
  config: AccentShaderConfig
  onChange: (next: AccentShaderConfig) => void
  onClose: () => void
  onCopy: () => void
  onReset: () => void
  status: string | null
}) {
  const setKey = useCallback(
    <K extends keyof AccentShaderConfig>(key: K, value: AccentShaderConfig[K]) => {
      onChange({ ...config, [key]: value })
    },
    [config, onChange],
  )

  const sections = useMemo(() => groupBySection(ACCENT_SHADER_DEV_FIELDS), [])

  return (
    <aside
      role="dialog"
      aria-label="Shader controls"
      className="pointer-events-auto fixed top-4 right-4 bottom-20 z-[59] flex w-[320px] flex-col overflow-hidden rounded-2xl border border-white/15 bg-black/70 text-white shadow-2xl backdrop-blur-xl"
    >
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <h2 className="text-[13px] font-semibold tracking-tight">Accent shader</h2>
          <p className="text-[11px] text-white/50">Live uniforms</p>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {sections.map((section) => (
          <section key={section.title} className="mb-4 last:mb-0">
            <h3 className="mb-2 text-[10px] font-semibold tracking-[0.12em] text-white/50 uppercase">
              {section.title}
            </h3>
            <div className="flex flex-col gap-2.5">
              {section.fields.map((field) => (
                <FieldRow
                  key={field.key}
                  field={field}
                  config={config}
                  setKey={setKey}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer className="flex flex-col gap-2 border-t border-white/10 px-4 py-3">
        {status && (
          <div className="px-1 text-[11px] text-white/60">{status}</div>
        )}
        <div className="flex gap-2">
          <ActionButton onClick={onReset}>Reset</ActionButton>
          <ActionButton onClick={onCopy}>Copy JSON</ActionButton>
        </div>
      </footer>
    </aside>
  )
}

type Section = {
  title: string
  fields: (
    | ReturnType<typeof asSlider>
    | ReturnType<typeof asColor>
  )[]
}

function asSlider(
  f: Extract<ShaderDevFieldDef<AccentShaderConfig>, { type: "slider" }>,
) {
  return f
}

function asColor(
  f: Extract<ShaderDevFieldDef<AccentShaderConfig>, { type: "color" }>,
) {
  return f
}

function groupBySection(
  fields: ShaderDevFieldDef<AccentShaderConfig>[],
): Section[] {
  const sections: Section[] = []
  let current: Section | null = null
  for (const field of fields) {
    if (isShaderDevSection(field)) {
      current = { title: field.title, fields: [] }
      sections.push(current)
      continue
    }
    if (!current) {
      current = { title: "Parameters", fields: [] }
      sections.push(current)
    }
    current.fields.push(field)
  }
  return sections
}

function FieldRow({
  field,
  config,
  setKey,
}: {
  field: Exclude<
    ShaderDevFieldDef<AccentShaderConfig>,
    { type: "section" }
  >
  config: AccentShaderConfig
  setKey: <K extends keyof AccentShaderConfig>(
    key: K,
    value: AccentShaderConfig[K],
  ) => void
}) {
  if (field.type === "slider") {
    const value = config[field.key] as number
    return (
      <label className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between text-[11px]">
          <span className="text-white/80">{field.label}</span>
          <span className="font-mono text-white/55">{formatNumber(value)}</span>
        </div>
        <input
          type="range"
          min={field.min}
          max={field.max}
          step={field.step}
          value={value}
          onChange={(e) =>
            setKey(field.key, Number.parseFloat(e.target.value) as never)
          }
          className="shader-dev-range"
        />
      </label>
    )
  }

  const value = config[field.key] as string
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-[11px] text-white/80">{field.label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-white/50">{value}</span>
        <input
          type="color"
          value={value}
          onChange={(e) => setKey(field.key, e.target.value as never)}
          className="h-6 w-8 cursor-pointer rounded border border-white/15 bg-transparent p-0"
        />
      </div>
    </label>
  )
}

function ActionButton({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 cursor-pointer rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-medium text-white/85 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white"
    >
      {children}
    </button>
  )
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value)
  const abs = Math.abs(value)
  if (abs >= 100) return value.toFixed(0)
  if (abs >= 10) return value.toFixed(1)
  return value.toFixed(2)
}

function GearIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M2 2l10 10M12 2L2 12" />
    </svg>
  )
}
