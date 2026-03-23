import fs from "fs";
import path from "path";
import os from "os";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const SENSITIVE_KEYS = ["password", "auth", "credentials", "token", "secret"];

function defaultAuditPath() {
  return path.join(os.homedir(), ".cisco-ucce", "audit.jsonl");
}

function sanitize(entry) {
  const clean = {};
  for (const [key, value] of Object.entries(entry)) {
    if (!SENSITIVE_KEYS.includes(key.toLowerCase())) {
      clean[key] = value;
    }
  }
  return clean;
}

function rotate(auditPath) {
  try {
    const stats = fs.statSync(auditPath);
    if (stats.size >= MAX_SIZE) {
      fs.renameSync(auditPath, auditPath + ".1");
    }
  } catch {
    /* file doesn't exist yet */
  }
}

export function logAudit(entry, auditPath = defaultAuditPath()) {
  const dir = path.dirname(auditPath);
  fs.mkdirSync(dir, { recursive: true });
  rotate(auditPath);
  const line =
    JSON.stringify({
      timestamp: new Date().toISOString(),
      ...sanitize(entry),
    }) + "\n";
  fs.appendFileSync(auditPath, line);
}
