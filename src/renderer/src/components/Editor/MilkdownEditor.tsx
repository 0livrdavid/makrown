import { useEffect, useRef } from 'react'
import { Crepe } from '@milkdown/crepe'
import { listenerCtx } from '@milkdown/plugin-listener'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/classic-dark.css'

interface MilkdownEditorProps {
  content: string
  onChange: (value: string) => void
  onSave: () => void
  onReady?: (normalizedContent: string) => void
  fontFamily: string
  fontSize: number
}

export function MilkdownEditor({ content, onChange, onSave, onReady, fontFamily, fontSize }: MilkdownEditorProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const crepe = new Crepe({
      root: containerRef.current,
      defaultValue: content
    })

    // Capture any normalization Milkdown applies during init.
    // We never call onChange() before create() resolves — doing so would race
    // with isNormalized and mark the file dirty without any user edit.
    let initDone = false
    let capturedNormalized: string | null = null

    crepe.editor.config((ctx) => {
      ctx.get(listenerCtx).markdownUpdated((_, markdown, prevMarkdown) => {
        if (!initDone) {
          // Silently capture normalization; do NOT propagate to parent yet.
          if (markdown !== prevMarkdown) capturedNormalized = markdown
          return
        }
        if (markdown !== prevMarkdown) onChange(markdown)
      })
    })

    crepe.create().then(() => {
      initDone = true
      // Deliver the final normalised content (or original if no change) so the
      // parent can atomically set originalContent + isNormalized: true.
      onReady?.(capturedNormalized ?? content)
    })

    return () => {
      crepe.destroy()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Cmd+S / Ctrl+S
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        onSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onSave])

  // Enforce font on the ProseMirror DOM element via MutationObserver.
  //
  // Why MutationObserver instead of a one-shot setTimeout:
  //   Milkdown/ProseMirror can re-apply its own inline styles (e.g. during
  //   initialisation or focus events). Polling stops too early and loses the
  //   race. The observer watches for any 'style' attribute mutation on the
  //   .ProseMirror element and immediately re-enforces our values.
  //
  // Why setProperty(..., 'important'):
  //   Inline styles (even with !important in a <style> tag) lose to ProseMirror's
  //   own inline style assignments. element.style.setProperty(p, v, 'important')
  //   is the only thing that truly wins — it sets an inline-level !important.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const sizeStr = `${fontSize}px`
    let pmEl: HTMLElement | null = null
    let pmObserver: MutationObserver | null = null
    let rafHandle: number | null = null

    // Apply styles to a single element; skip if already correct (loop guard).
    function setOnElement(el: HTMLElement, applySize: boolean): void {
      const ffOk = el.style.getPropertyValue('font-family') === fontFamily
        && el.style.getPropertyPriority('font-family') === 'important'
      const fsOk = !applySize
        || (el.style.getPropertyValue('font-size') === sizeStr
            && el.style.getPropertyPriority('font-size') === 'important')
      if (ffOk && fsOk) return
      el.style.setProperty('font-family', fontFamily, 'important')
      if (applySize) el.style.setProperty('font-size', sizeStr, 'important')
    }

    // Heading sizes scale proportionally from the configured base fontSize.
    const headingScale: Record<string, number> = { h1: 1.8, h2: 1.5, h3: 1.25, h4: 1.1, h5: 1.0, h6: 1.0 }

    // Apply to .ProseMirror root + all text children in one pass.
    function applyFont(): void {
      if (!pmEl) return
      setOnElement(pmEl, true)
      pmEl.querySelectorAll<HTMLElement>('p, li, td, th, blockquote').forEach((el) => setOnElement(el, true))
      pmEl.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6').forEach((el) => {
        const scale = headingScale[el.tagName.toLowerCase()] ?? 1
        const ffOk = el.style.getPropertyValue('font-family') === fontFamily
          && el.style.getPropertyPriority('font-family') === 'important'
        const hSize = `${Math.round(fontSize * scale)}px`
        const fsOk = el.style.getPropertyValue('font-size') === hSize
          && el.style.getPropertyPriority('font-size') === 'important'
        if (ffOk && fsOk) return
        el.style.setProperty('font-family', fontFamily, 'important')
        el.style.setProperty('font-size', hSize, 'important')
      })
    }

    // Batch rapid bursts (e.g. user typing) into a single applyFont per frame.
    function scheduleApply(): void {
      if (rafHandle !== null) cancelAnimationFrame(rafHandle)
      rafHandle = requestAnimationFrame(() => { applyFont(); rafHandle = null })
    }

    // Called once when .ProseMirror is found. Stops containerObserver immediately
    // so we never pay the O(n²) cost of re-scanning during content rendering.
    function initPm(pm: HTMLElement): void {
      pmEl = pm
      containerObserver.disconnect() // no longer needed

      pmObserver?.disconnect()
      pmObserver = new MutationObserver(scheduleApply)
      pmObserver.observe(pm, {
        attributes: true,
        attributeFilter: ['style'], // re-enforce if Milkdown resets root style
        childList: true,            // detect new <p> nodes (Enter key, paste…)
      })

      applyFont() // immediate — no delay needed here
    }

    // Watches the container until .ProseMirror appears (Milkdown creates it async).
    // Disconnects as soon as it's found so it never observes content mutations.
    const containerObserver = new MutationObserver(() => {
      const pm = container.querySelector('.ProseMirror') as HTMLElement | null
      if (pm) initPm(pm)
    })
    containerObserver.observe(container, { childList: true, subtree: true })

    // If .ProseMirror already exists (subsequent fontFamily/fontSize changes),
    // skip the container watch and go straight to initPm.
    const existing = container.querySelector('.ProseMirror') as HTMLElement | null
    if (existing) initPm(existing)

    return () => {
      containerObserver.disconnect()
      pmObserver?.disconnect()
      if (rafHandle !== null) cancelAnimationFrame(rafHandle)
    }
  }, [fontFamily, fontSize])

  return (
    <div
      ref={containerRef}
      className="milkdown-editor h-full overflow-y-auto"
    />
  )
}
