import type { AccentShaderConfig } from "../../components/accent-shader-config"

export type AccentShaderRegistration = {
  config: AccentShaderConfig
  setConfig: (next: AccentShaderConfig) => void
}

let registration: AccentShaderRegistration | null = null
const listeners = new Set<() => void>()

export function registerAccentShader(next: AccentShaderRegistration | null) {
  registration = next
  for (const listener of listeners) listener()
}

export function getAccentShaderRegistration(): AccentShaderRegistration | null {
  return registration
}

export function subscribeAccentShader(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
