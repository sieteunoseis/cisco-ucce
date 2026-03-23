import { describe, it, expect } from "vitest";
import { formatJson } from "../../lib/formatters/json.js";

describe("json formatter", () => {
  it("returns JSON string", () => {
    const data = [{ id: 1, name: "test" }];
    const result = formatJson(data);
    expect(JSON.parse(result)).toEqual(data);
  });

  it("handles empty array", () => {
    expect(JSON.parse(formatJson([]))).toEqual([]);
  });
});
