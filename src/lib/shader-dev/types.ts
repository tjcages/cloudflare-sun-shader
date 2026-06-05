export type ShaderDevSectionField = {
  type: "section"
  title: string
}

export type ShaderDevSliderField<T extends Record<string, unknown>> = {
  type: "slider"
  key: keyof T & string
  label: string
  min: number
  max: number
  step: number
}

export type ShaderDevColorField<T extends Record<string, unknown>> = {
  type: "color"
  key: keyof T & string
  label: string
}

export type ShaderDevFieldDef<T extends Record<string, unknown>> =
  | ShaderDevSectionField
  | ShaderDevSliderField<T>
  | ShaderDevColorField<T>

export function isShaderDevSection<T extends Record<string, unknown>>(
  field: ShaderDevFieldDef<T>,
): field is ShaderDevSectionField {
  return field.type === "section"
}
