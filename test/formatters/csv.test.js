import { describe, it, expect } from "vitest";
import { formatCsv } from "../../lib/formatters/csv.js";

describe("csv formatter", () => {
  it("produces CSV with headers", () => {
    const data = [{ id: "1", name: "test" }];
    const result = formatCsv(data);
    expect(result).toContain("id,name");
    expect(result).toContain("1,test");
  });

  it("handles empty array", () => {
    expect(formatCsv([])).toBe("");
  });
});
