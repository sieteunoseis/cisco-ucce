// Union of keys across all rows, in first-seen order, so fields missing
// from the first row aren't dropped.
export function columns(data) {
  const seen = new Set();
  for (const row of data) for (const k of Object.keys(row || {})) seen.add(k);
  return [...seen];
}
