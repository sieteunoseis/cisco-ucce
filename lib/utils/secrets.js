import { execFileSync } from "child_process";

const PLACEHOLDER_RE = /<ss:(\d+):(\w+)>/g;
const cache = new Map();

export function hasPlaceholder(value) {
  return typeof value === "string" && /<ss:\d+:\w+>/.test(value);
}

export function extractPlaceholders(value) {
  const matches = [];
  let match;
  const re = new RegExp(PLACEHOLDER_RE.source, "g");
  while ((match = re.exec(value)) !== null) {
    matches.push({ id: match[1], field: match[2], raw: match[0] });
  }
  return matches;
}

// ss-cli is a Node process: never let it inherit a disabled-TLS setting.
function childEnv() {
  const env = { ...process.env };
  delete env.NODE_TLS_REJECT_UNAUTHORIZED;
  return env;
}

function firstLine(text) {
  return (text || "").toString().trim().split("\n")[0];
}

// Throws on failure — sending the literal placeholder as a password only
// produces misleading 401s and can lock the account.
export function resolvePlaceholder(id, field, { exec = execFileSync } = {}) {
  const f = field.toLowerCase();
  const key = `${id}:${f}`;
  if (cache.has(key)) return cache.get(key);

  let out;
  try {
    out = exec("ss-cli", ["get", String(id), "--format", "json"], {
      encoding: "utf8",
      timeout: 15000,
      stdio: ["pipe", "pipe", "pipe"],
      env: childEnv(),
    });
  } catch (err) {
    const detail =
      firstLine(err.stderr) || firstLine(err.stdout) || err.message;
    throw new Error(
      `Secret Server lookup failed for <ss:${id}:${field}>: ${detail}`,
    );
  }

  let secret;
  try {
    secret = JSON.parse(out);
  } catch {
    throw new Error(
      `Secret Server lookup failed for <ss:${id}:${field}>: ${firstLine(out)}`,
    );
  }
  const item = secret.items?.find(
    (i) => i.slug?.toLowerCase() === f || i.fieldName?.toLowerCase() === f,
  );
  if (!item?.itemValue)
    throw new Error(`Secret ${id} has no value for field "${field}".`);
  cache.set(key, item.itemValue);
  return item.itemValue;
}

export function resolvePassword(password, opts) {
  if (!hasPlaceholder(password)) return password;
  let resolved = password;
  for (const p of extractPlaceholders(password)) {
    resolved = resolved.replace(p.raw, resolvePlaceholder(p.id, p.field, opts));
  }
  return resolved;
}

export function clearSecretCache() {
  cache.clear();
}
