import { describe, it, expect, beforeEach } from "vitest";
import { resolveHosts } from "../../lib/utils/config.js";
import { resolvePassword, clearSecretCache } from "../../lib/utils/secrets.js";

const cluster = {
  diagnosticPortal: {
    hosts: [
      { host: "pg1a.example.com", port: 7890 },
      { host: "pg1b.example.com", port: 7890 },
      { host: "rgra.example.com", port: 7890 },
    ],
  },
  aw: { hosts: ["awa.example.com", "awb.example.com"] },
};

describe("resolveHosts", () => {
  it("defaults to the first host", () => {
    expect(resolveHosts(cluster, "aw")).toEqual([
      { host: "awa.example.com", port: 443 },
    ]);
  });
  it("returns all hosts for 'all'", () => {
    expect(resolveHosts(cluster, "diagnosticPortal", "all")).toHaveLength(3);
  });
  it("prefix-matches a configured host", () => {
    expect(resolveHosts(cluster, "diagnosticPortal", "rgra")[0].host).toBe(
      "rgra.example.com",
    );
  });
  it("rejects unknown hosts instead of silently using the first", () => {
    expect(() => resolveHosts(cluster, "diagnosticPortal", "nope")).toThrow(
      /not found.*pg1a/,
    );
  });
  it("rejects 'all' where not supported", () => {
    expect(() =>
      resolveHosts(cluster, "aw", "all", { allowAll: false }),
    ).toThrow(/not supported/);
  });
});

describe("resolvePassword with ss-cli", () => {
  beforeEach(() => clearSecretCache());
  const secret = JSON.stringify({
    items: [{ slug: "password", fieldName: "Password", itemValue: "s3cret" }],
  });

  it("matches fields case-insensitively and strips disabled-TLS env", () => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    let seenEnv;
    const exec = (cmd, args, opts) => {
      seenEnv = opts.env;
      expect(cmd).toBe("ss-cli");
      expect(args).toEqual(["get", "42", "--format", "json"]);
      return secret;
    };
    expect(resolvePassword("<ss:42:Password>", { exec })).toBe("s3cret");
    expect(seenEnv.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined();
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  });

  it("throws a clear error instead of sending the placeholder", () => {
    const exec = () => {
      const err = new Error("Command failed");
      err.stderr = "Token expired. Run: ss-cli login\n";
      throw err;
    };
    expect(() => resolvePassword("<ss:42:password>", { exec })).toThrow(
      /Secret Server lookup failed.*Token expired/,
    );
  });

  it("caches lookups within a run", () => {
    let calls = 0;
    const exec = () => (calls++, secret);
    resolvePassword("<ss:42:password>", { exec });
    resolvePassword("<ss:42:password>", { exec });
    expect(calls).toBe(1);
  });
});
