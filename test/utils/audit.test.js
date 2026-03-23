import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { logAudit } from "../../lib/utils/audit.js";
import fs from "fs";
import path from "path";
import os from "os";

describe("audit", () => {
  const tmpDir = path.join(os.tmpdir(), "cisco-ucce-audit-" + Date.now());
  const auditPath = path.join(tmpDir, "audit.jsonl");

  beforeEach(() => fs.mkdirSync(tmpDir, { recursive: true }));
  afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  it("writes JSONL entry", () => {
    logAudit(
      {
        command: "agent list",
        host: "aw1",
        endpoint: "/config/agent",
        status: 200,
      },
      auditPath,
    );
    const lines = fs.readFileSync(auditPath, "utf8").trim().split("\n");
    const entry = JSON.parse(lines[0]);
    expect(entry.command).toBe("agent list");
    expect(entry.status).toBe(200);
    expect(entry.timestamp).toBeDefined();
  });

  it("appends multiple entries", () => {
    logAudit({ command: "agent list", host: "aw1", status: 200 }, auditPath);
    logAudit({ command: "status", host: "aw1", status: 200 }, auditPath);
    const lines = fs.readFileSync(auditPath, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
  });

  it("never logs password or credentials", () => {
    logAudit(
      {
        command: "agent list",
        host: "aw1",
        password: "secret",
        username: "admin",
        auth: "basic",
        token: "abc",
      },
      auditPath,
    );
    const content = fs.readFileSync(auditPath, "utf8");
    expect(content).not.toContain("secret");
    expect(content).not.toContain('"auth"');
    expect(content).not.toContain('"token"');
    expect(content).toContain("agent list");
    expect(content).toContain("admin"); // username is NOT sensitive
  });
});
