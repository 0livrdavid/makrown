const isMac = typeof window !== 'undefined' && window.api?.platform === 'darwin'

export const shortcutTokens = {
  isMac,
  mod: isMac ? '⌘' : 'Ctrl',
  shift: '⇧',
  alt: isMac ? '⌥' : 'Alt',
} as const

export function shortcutLabel(keys: string[]): string {
  return keys.join(isMac ? '' : '+')
}

export function shortcutTitle(label: string, keys?: string[]): string {
  if (!keys || keys.length === 0) return label
  return `${label} (${shortcutLabel(keys)})`
}
