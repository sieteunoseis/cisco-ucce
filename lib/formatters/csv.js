import { stringify } from "csv-stringify/sync";

export function formatCsv(data) {
  if (!data.length) return "";
  const columns = Object.keys(data[0]);
  return stringify(data, { header: true, columns });
}
