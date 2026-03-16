export type DiffLine = {
  type: 'equal' | 'added' | 'removed'
  left: string | null   // original (o que estava no disco)
  right: string | null  // modified (o que será enviado)
  lineLeft: number | null
  lineRight: number | null
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
