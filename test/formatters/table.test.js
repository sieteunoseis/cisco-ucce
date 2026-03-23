import { describe, it, expect } from "vitest";
import { formatTable } from "../../lib/formatters/table.js";

describe("table formatter", () => {
  it("returns string with column headers", () => {
    const data = [{ id: "1", name: "test" }];
    const result = formatTable(data);
    expect(result).toContain("id");
    expect(result).toContain("name");
    expect(result).toContain("test");
  });

  it("handles empty array", () => {
    const result = formatTable([]);
    expect(result).toContain("No results");
  });
});
