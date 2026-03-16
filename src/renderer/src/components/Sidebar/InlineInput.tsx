import { useEffect, useRef } from 'react'

interface InlineInputProps {
  defaultValue?: string
  onConfirm: (value: string) => void
  onCancel: () => void
  indent: number
}

export function InlineInput({
  defaultValue = '',
  onConfirm,
  onCancel,
  indent
}: InlineInputProps): React.JSX.Element {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      const val = ref.current?.value.trim()
      if (val) onConfirm(val)
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <div style={{ paddingLeft: indent }} className="flex items-center gap-1 px-2 py-0.5">
      <input
        ref={ref}
        defaultValue={defaultValue}
        onKeyDown={handleKeyDown}
        onBlur={() => onCancel()}
        className="w-full rounded bg-zinc-700 px-1.5 py-0.5 text-sm text-zinc-100 outline-none ring-1 ring-indigo-500"
      />
    </div>
  )
}
