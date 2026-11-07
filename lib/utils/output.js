import { formatTable } from "../formatters/table.js";
import { formatJson } from "../formatters/json.js";
import { formatCsv } from "../formatters/csv.js";
import { formatToon } from "../formatters/toon.js";

export const FORMATS = ["table", "json", "toon", "csv"];

export function checkFormat(format) {
  if (!FORMATS.includes(format))
    throw new Error(
      `Unknown --format "${format}". Use one of: ${FORMATS.join(", ")}`,
    );
}

export async function output(data, format = "table") {
  checkFormat(format);
  let result;
  switch (format) {
    case "json":
      result = formatJson(data);
      break;
    case "csv":
      result = formatCsv(data);
      break;
    case "toon":
      result = formatToon(data);
      break;
    case "table":
    default:
      result = formatTable(data);
      break;
  }
  console.log(result);
}
