// Marks which characters of `visited` do not appear (in order) in `real`, so the UI can highlight
// exactly what is different. Longest-common-subsequence on short strings: O(n*m) is negligible here.
export function diffSegments(visited, real) {
  const n = visited.length, m = real.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = visited[i] === real[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const same = new Array(n).fill(false);
  for (let i = 0, j = 0; i < n && j < m;) {
    if (visited[i] === real[j]) { same[i] = true; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  const segments = [];
  for (let i = 0; i < n; i++) {
    const changed = !same[i];
    const last = segments[segments.length - 1];
    if (last && last.changed === changed) last.text += visited[i];
    else segments.push({ text: visited[i], changed });
  }
  return segments;
}
