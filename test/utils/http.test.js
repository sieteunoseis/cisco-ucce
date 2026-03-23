import { describe, it, expect } from "vitest";
import { parseXml, extractId, formatHttpError } from "../../lib/utils/http.js";

describe("http utils", () => {
  it("parseXml converts XML string to JS object", async () => {
    const xml = "<root><name>test</name></root>";
    const result = await parseXml(xml);
    expect(result.root.name[0]).toBe("test");
  });

  it("extractId pulls ID from refURL", () => {
    expect(extractId("/unifiedconfig/config/agent/5000")).toBe("5000");
  });

  it("extractId returns null for empty string", () => {
    expect(extractId("")).toBeNull();
  });

  it("extractId returns null for undefined", () => {
    expect(extractId(undefined)).toBeNull();
  });

  it("formatHttpError returns descriptive message for 401", () => {
    const msg = formatHttpError(401, "aw1.test", "/config/agent");
    expect(msg).toContain("Authentication failed");
    expect(msg).toContain("aw1.test");
  });

  it("formatHttpError returns descriptive message for 403", () => {
    const msg = formatHttpError(403, "aw1.test", "/config/agent");
    expect(msg).toContain("Permission denied");
  });

  it("formatHttpError returns descriptive message for 404", () => {
    const msg = formatHttpError(404, "aw1.test", "/config/agent");
    expect(msg).toContain("not found");
  });

  it("formatHttpError returns generic message for other codes", () => {
    const msg = formatHttpError(500, "aw1.test", "/config/agent");
    expect(msg).toContain("500");
  });
});
