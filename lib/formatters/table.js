import Table from "cli-table3";
import { columns } from "./columns.js";

const cell = (v) =>
  v === null || v === undefined
    ? ""
    : typeof v === "object"
      ? JSON.stringify(v)
      : String(v);

export function formatTable(data) {
  if (!data.length) return "No results.";
  const keys = columns(data);
  // A single wide record reads better as key/value rows.
  if (data.length === 1 && keys.length > 6) {
    const table = new Table();
    for (const k of keys) table.push({ [k]: cell(data[0][k]) });
    return table.toString();
  }
  const table = new Table({ head: keys });
  for (const row of data) table.push(keys.map((k) => cell(row[k])));
  return table.toString();
}
