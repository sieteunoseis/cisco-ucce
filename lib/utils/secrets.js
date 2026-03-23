import { execSync } from "child_process";

const PLACEHOLDER_RE = /<ss:(\d+):(\w+)>/g;

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

export function resolvePlaceholder(id, field) {
  try {
    const result = execSync(`ss-cli get ${id} --format json`, {
      encoding: "utf8",
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const secret = JSON.parse(result);
    const item = secret.items?.find(
      (i) => i.slug === field || i.fieldName?.toLowerCase() === field,
    );
    return item?.itemValue || null;
  } catch {
    return null;
  }
}

export function resolvePassword(password) {
  if (!hasPlaceholder(password)) return password;
  const placeholders = extractPlaceholders(password);
  let resolved = password;
  for (const p of placeholders) {
    const value = resolvePlaceholder(p.id, p.field);
    if (value) {
      resolved = resolved.replace(p.raw, value);
    }
  }
  return resolved;
}
