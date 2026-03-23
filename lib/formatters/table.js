import Table from "cli-table3";

export function formatTable(data) {
  if (!data.length) return "No results.";
  const keys = Object.keys(data[0]);
  const table = new Table({ head: keys });
  for (const row of data) {
    table.push(keys.map((k) => String(row[k] ?? "")));
  }
  return table.toString();
}
