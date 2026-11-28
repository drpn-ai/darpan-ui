import type { InlineSelectOption } from './useInlineSelect'

/** The fields an enum-backed option carries (EnumOption, a saved run's system option, a file type...). */
export interface LabelledEnum {
  enumId: string
  label?: string | null
  description?: string | null
  enumCode?: string | null
}

/** DAR-OPS-029 S99-123. What a dropdown shows for an enum option: its label, else description, else code, else id. */
export function enumOptionLabel(option: LabelledEnum): string {
  return option.label || option.description || option.enumCode || option.enumId
}

/** A select option keyed by the enum id, labelled as enumOptionLabel says. */
export function toEnumSelectOption(option: LabelledEnum): InlineSelectOption {
  return { value: option.enumId, label: enumOptionLabel(option) }
}
