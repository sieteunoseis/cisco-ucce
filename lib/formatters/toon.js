export function formatToon(data) {
  if (!data.length) return "No results.";
  return data
    .map((item, i) => {
      const lines = Object.entries(item).map(([k, v]) => `  ${k}: ${v ?? ""}`);
      return `[${i}]\n${lines.join("\n")}`;
    })
    .join("\n\n");
}
