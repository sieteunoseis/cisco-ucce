import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseXml,
  extractId,
  formatHttpError,
  createClient,
} from "../../lib/utils/http.js";

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

  describe("createClient default headers", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("exposes defaults.headers and merges overrides into requests", async () => {
      const fetchMock = vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => "{}",
      }));
      vi.stubGlobal("fetch", fetchMock);

      const client = createClient({ host: "cvp.test", username: "u", password: "p" });
      client.defaults.headers["Accept"] = "application/json";
      await client.get("/cvp-config/version");

      const { headers } = fetchMock.mock.calls[0][1];
      expect(headers.Accept).toBe("application/json");
      expect(headers.Authorization).toMatch(/^Basic /);
    });
  });

  it("insecure mode suppresses only the TLS warning", () => {
    const original = process.emitWarning;
    const seen = [];
    process.emitWarning = (w) => seen.push(String(w?.message ?? w));
    try {
      createClient({ host: "x.test", username: "u", password: "p", insecure: true });
      process.emitWarning("Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0'");
      process.emitWarning("some other warning");
    } finally {
      process.emitWarning = original;
    }
    expect(seen).toEqual(["some other warning"]);
  });

  describe("createClient request options", () => {
    afterEach(() => vi.unstubAllGlobals());

    const okResponse = (body = "<x/>") => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/xml" }),
      text: async () => body,
      arrayBuffer: async () => new TextEncoder().encode(body).buffer,
    });

    it("encodes params into the query string", async () => {
      const fetchMock = vi.fn(async () => okResponse());
      vi.stubGlobal("fetch", fetchMock);
      const client = createClient({ host: "aw.test", username: "u", password: "p" });
      await client.get("/unifiedconfig/config/agent", {
        params: { startIndex: 100, resultsPerPage: 100, skip: undefined },
      });
      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://aw.test/unifiedconfig/config/agent?startIndex=100&resultsPerPage=100",
      );
    });

    it("returns an ArrayBuffer for responseType arraybuffer", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => okResponse("abc")));
      const client = createClient({ host: "pg.test", username: "u", password: "p" });
      const res = await client.get("/x", { responseType: "arraybuffer" });
      expect(res.data).toBeInstanceOf(ArrayBuffer);
      expect(res.data.byteLength).toBe(3);
    });
  });
});
