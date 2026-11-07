import { stringify } from "csv-stringify/sync";
import { columns } from "./columns.js";

export function formatCsv(data) {
  if (!data.length) return "";
  return stringify(data, { header: true, columns: columns(data) });
}
