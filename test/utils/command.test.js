import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../lib/utils/audit.js", () => ({ logAudit: vi.fn() }));
const { logAudit } = await import("../../lib/utils/audit.js");
const { runOnHosts, runCommand, hostFlag } = await import(
  "../../lib/utils/command.js"
);

function fakeProgram(opts = {}) {
  return { opts: () => ({ format: "json", ...opts }) };
}

describe("command helpers", () => {
  beforeEach(() => {
    logAudit.mockClear();
    process.exitCode = undefined;
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it("hostFlag prefers subcommand option, falls back to global", () => {
    expect(hostFlag(fakeProgram({ host: "g" }), { host: "s" })).toBe("s");
    expect(hostFlag(fakeProgram({ host: "g" }), {})).toBe("g");
  });

  it("--no-audit (audit:false) suppresses audit logging", async () => {
    await runCommand(
      fakeProgram({ audit: false }),
      { command: "x" },
      async () => [],
    );
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("audits failures with status and sets exit code", async () => {
    await runCommand(fakeProgram(), { command: "x" }, async () => {
      const e = new Error("nope");
      e.status = 401;
      throw e;
    });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401, error: "nope" }),
    );
    expect(process.exitCode).toBe(1);
  });

  it("runOnHosts sets exit code when any host fails and tags rows", async () => {
    const rows = await runOnHosts(
      fakeProgram(),
      { command: "c", endpoint: "e", hosts: [{ host: "a" }, { host: "b" }] },
      async (h) => {
        if (h.host === "b") throw new Error("down");
        return { v: 1 };
      },
    );
    expect(rows).toEqual([{ host: "a", v: 1 }]);
    expect(process.exitCode).toBe(1);
  });
});
