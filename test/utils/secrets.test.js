import { describe, it, expect } from "vitest";
import {
  hasPlaceholder,
  extractPlaceholders,
  resolvePassword,
} from "../../lib/utils/secrets.js";

describe("secrets", () => {
  it("hasPlaceholder detects ss-cli placeholders", () => {
    expect(hasPlaceholder("<ss:21991:password>")).toBe(true);
    expect(hasPlaceholder("plainpassword")).toBe(false);
    expect(hasPlaceholder("")).toBe(false);
    expect(hasPlaceholder(undefined)).toBe(false);
  });

  it("extractPlaceholders parses ID and field", () => {
    const result = extractPlaceholders("<ss:21991:password>");
    expect(result).toEqual([
      { id: "21991", field: "password", raw: "<ss:21991:password>" },
    ]);
  });

  it("extractPlaceholders handles multiple placeholders", () => {
    const result = extractPlaceholders(
      "prefix-<ss:100:user>-<ss:200:pass>-suffix",
    );
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("100");
    expect(result[1].id).toBe("200");
  });

  it("resolvePassword returns plain passwords unchanged", () => {
    expect(resolvePassword("mypassword")).toBe("mypassword");
  });
});
