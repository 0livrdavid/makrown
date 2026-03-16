export type DiffLine = {
  type: 'equal' | 'added' | 'removed'
  left: string | null   // original (o que estava no disco)
  right: string | null  // modified (o que será enviado)
  lineLeft: number | null
  lineRight: number | null
}

export type Hunk = {
  id: number
  lines: DiffLine[]
  // Revert (← right→left): replace these lines in `modified` with `originalLines`
  modifiedStart: number   // 0-based index in modified lines where this hunk starts
  modifiedCount: number   // number of modified lines to remove
  originalLines: string[] // lines from original to restore
  // Accept (→ left→right): replace these lines in `original` with `modifiedLines`
  originalStart: number   // 0-based index in original lines
  originalCount: number   // number of original lines to remove
  modifiedLines: string[] // lines from modified to apply as new baseline
}

function lcs(a: string[], b: string[]): number[][] {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp
}

export function computeLineDiff(original: string, modified: string): DiffLine[] {
  const aLines = original.split('\n')
  const bLines = modified.split('\n')

  // Guard for very large files — skip diff
  if (aLines.length > 3000 || bLines.length > 3000) {
    return [{ type: 'equal', left: '(arquivo grande demais para diff inline)', right: '(arquivo grande demais para diff inline)', lineLeft: null, lineRight: null }]
  }

  const dp = lcs(aLines, bLines)
  const result: DiffLine[] = []
  let i = aLines.length
  let j = bLines.length
  const changes: DiffLine[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aLines[i - 1] === bLines[j - 1]) {
      changes.push({ type: 'equal', left: aLines[i - 1], right: bLines[j - 1], lineLeft: i, lineRight: j })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      changes.push({ type: 'added', left: null, right: bLines[j - 1], lineLeft: null, lineRight: j })
      j--
    } else {
      changes.push({ type: 'removed', left: aLines[i - 1], right: null, lineLeft: i, lineRight: null })
      i--
    }
  }

  changes.reverse()
  return changes.length > 0 ? changes : result
}

/** Groups consecutive non-equal DiffLines into Hunks with positional metadata. */
export function groupIntoHunks(diff: DiffLine[]): Hunk[] {
  const hunks: Hunk[] = []
  let hunkId = 0
  let i = 0
  // Track 0-based "next position" in each content after the last equal line.
  // lineRight/lineLeft are 1-indexed, so their value equals the 0-based next index.
  let prevModifiedLine = 0
  let prevOriginalLine = 0

  while (i < diff.length) {
    const line = diff[i]
    if (line.type === 'equal') {
      prevModifiedLine = line.lineRight ?? prevModifiedLine
      prevOriginalLine = line.lineLeft ?? prevOriginalLine
      i++
      continue
    }

    // Collect all consecutive non-equal lines into a hunk
    const hunkLines: DiffLine[] = []
    const originalLines: string[] = []
    const modifiedLines: string[] = []
    let firstAddedIdx: number | null = null
    let firstRemovedIdx: number | null = null

    while (i < diff.length && diff[i].type !== 'equal') {
      const l = diff[i]
      hunkLines.push(l)
      if (l.type === 'added') {
        if (firstAddedIdx === null) firstAddedIdx = (l.lineRight ?? 1) - 1
        modifiedLines.push(l.right ?? '')
      } else {
        if (firstRemovedIdx === null) firstRemovedIdx = (l.lineLeft ?? 1) - 1
        originalLines.push(l.left ?? '')
      }
      i++
    }

    hunks.push({
      id: hunkId++,
      lines: hunkLines,
      modifiedStart: firstAddedIdx ?? prevModifiedLine,
      modifiedCount: modifiedLines.length,
      originalLines,
      originalStart: firstRemovedIdx ?? prevOriginalLine,
      originalCount: originalLines.length,
      modifiedLines,
    })
  }

  return hunks
}

/** Apply a revert: restore `hunk.originalLines` into `modified`. */
export function applyRevert(modified: string, hunk: Hunk): string {
  const lines = modified.split('\n')
  lines.splice(hunk.modifiedStart, hunk.modifiedCount, ...hunk.originalLines)
  return lines.join('\n')
}

/** Apply an accept: update `original` baseline with `hunk.modifiedLines`. */
export function applyAccept(original: string, hunk: Hunk): string {
  const lines = original.split('\n')
  lines.splice(hunk.originalStart, hunk.originalCount, ...hunk.modifiedLines)
  return lines.join('\n')
}
