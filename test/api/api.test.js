import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { createAwClient, list } from "../../lib/api/aw.js";
import {
  createDiagClient,
  getProductVersion,
  downloadTraceFile,
} from "../../lib/api/diag.js";
import { createCvpOpsClient, getVersion } from "../../lib/api/cvp.js";
import { createClient, get } from "../../lib/utils/http.js";

const xml = (body) =>
  new Response(body, {
    status: 200,
    headers: { "content-type": "application/xml" },
  });

afterEach(() => vi.unstubAllGlobals());

function agentsPage(ids, total) {
  const items = ids
    .map(
      (i) =>
        `<agent><refURL>/unifiedconfig/config/agent/${i}</refURL><name>a${i}</name></agent>`,
    )
    .join("");
  const pageInfo =
    total === undefined
      ? ""
      : `<pageInfo><totalResults>${total}</totalResults></pageInfo>`;
  return `<results>${pageInfo}<agents>${items}</agents></results>`;
}

describe("AW list pagination", () => {
  it("advances by returned count when the server caps page size", async () => {
    const all = Array.from({ length: 120 }, (_, i) => i + 1);
    const fetchMock = vi.fn(async (url) => {
      const start = Number(new URL(url).searchParams.get("startIndex"));
      return xml(agentsPage(all.slice(start, start + 50), 120)); // server caps at 50
    });
    vi.stubGlobal("fetch", fetchMock);
    const items = await list(createAwClient({ host: "aw" }), "agent");
    expect(items.map((i) => Number(i.id))).toEqual(all);
  });

  it("stops on a short page when totalResults is missing", async () => {
    const fetchMock = vi.fn(async (url) => {
      const start = Number(new URL(url).searchParams.get("startIndex"));
      const ids =
        start === 0 ? Array.from({ length: 100 }, (_, i) => i) : [100, 101];
      return xml(agentsPage(ids));
    });
    vi.stubGlobal("fetch", fetchMock);
    const items = await list(createAwClient({ host: "aw" }), "agent");
    expect(items).toHaveLength(102);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects page 0", async () => {
    await expect(
      list(createAwClient({ host: "aw" }), "agent", { page: 0 }),
    ).rejects.toThrow(/starts at 1/);
  });
});

describe("CVP client", () => {
  it("requests JSON", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response('{"version":{"majorVersion":"15"}}', {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const v = await getVersion(createCvpOpsClient({ host: "ops" }));
    expect(v.majorVersion).toBe("15");
    expect(fetchMock.mock.calls[0][1].headers.Accept).toBe("application/json");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://ops:8111/cvp-config/version",
    );
  });
});

describe("Diagnostic Portal", () => {
  it("throws on a non-zero ReturnCode", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        xml(
          '<dp:GetProductVersionReply ReturnCode="1" ErrorString="Access denied"/>',
        ),
      ),
    );
    await expect(
      getProductVersion(createDiagClient({ host: "pg", port: 7890 })),
    ).rejects.toThrow(/error 1: Access denied/);
  });

  it("download refuses to overwrite and saves binary otherwise", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ucce-dl-"));
    const out = path.join(dir, "f.zip");
    const bytes = new Uint8Array([0x50, 0x4b, 0x00, 0xff]);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(bytes, {
            status: 200,
            headers: { "content-type": "application/zip" },
          }),
      ),
    );
    const client = createDiagClient({ host: "pg", port: 7890 });
    const r = await downloadTraceFile(client, "c", "f.zip", out);
    expect(r.size).toBe(4);
    expect([...fs.readFileSync(out)]).toEqual([...bytes]);
    await expect(downloadTraceFile(client, "c", "f.zip", out)).rejects.toThrow(
      /--force/,
    );
    await downloadTraceFile(client, "c", "f.zip", out, { force: true });
    fs.rmSync(dir, { recursive: true });
  });

  it("download maps HTTP errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 404 })),
    );
    await expect(
      downloadTraceFile(
        createDiagClient({ host: "pg", port: 7890 }),
        "c",
        "f",
        "/nonexistent/x",
      ),
    ).rejects.toThrow(/Endpoint not found/);
  });
});

describe("http get error handling", () => {
  it("explains TLS failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const e = new TypeError("fetch failed");
        e.cause = { code: "DEPTH_ZERO_SELF_SIGNED_CERT" };
        throw e;
      }),
    );
    await expect(get(createClient({ host: "h" }), "/x")).rejects.toThrow(
      /TLS certificate error.*DEPTH_ZERO_SELF_SIGNED_CERT.*--insecure/,
    );
  });

  it("rejects empty and HTML bodies with context", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => xml("")),
    );
    await expect(get(createClient({ host: "h" }), "/x")).rejects.toThrow(
      /Empty response from https:\/\/h\/x/,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("<html><body>login</body></html>", {
            status: 200,
            headers: { "content-type": "text/html" },
          }),
      ),
    );
    await expect(get(createClient({ host: "h" }), "/x")).rejects.toThrow(
      /HTML response/,
    );
  });
});
