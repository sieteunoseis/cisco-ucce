import { parseStringPromise } from "xml2js";
import https from "https";

export async function parseXml(xmlString) {
  return parseStringPromise(xmlString, { explicitArray: true });
}

export function extractId(refURL) {
  if (!refURL) return null;
  const parts = refURL.split("/");
  return parts[parts.length - 1] || null;
}

// Service-specific next steps for common auth failures.
function hint(status, endpoint = "") {
  if (endpoint.startsWith("/cvp-config")) {
    if (status === 401)
      return "CVP REST API requires an OAMP user with the ServiceabilityAdministrationUserRole role (Superuser group alone is not enough)";
  }
  if (endpoint.startsWith("/icm-dp")) {
    if (status === 401 || status === 403)
      return 'Diagnostic Portal needs a Windows admin on that server — use "DOMAIN\\user" or a local admin';
  }
  if (endpoint.startsWith("/finesse")) {
    if (status === 401)
      return "Finesse admin APIs need the Finesse/VOS application administrator";
    if (status === 403)
      return "Finesse admin APIs only answer on the primary node — omit --host or target side A";
  }
  if (endpoint.startsWith("/adminapi")) {
    if (status === 401 || status === 403)
      return "VVB admin API needs the VVB application administrator";
  }
  if (endpoint.startsWith("/unifiedconfig")) {
    if (status === 403)
      return "AW user lacks permission for this resource (agentteam often needs a config admin role)";
  }
  if (status === 401) return "check credentials in cluster config";
  return "";
}

export function formatHttpError(status, host, endpoint) {
  const h = hint(status, endpoint);
  const suffix = h ? ` — ${h}` : "";
  switch (status) {
    case 401:
      return `Authentication failed for ${host}${endpoint}${suffix}`;
    case 403:
      return `Permission denied — user lacks access to ${endpoint} on ${host}${suffix}`;
    case 404:
      return `Endpoint not found — ${host}${endpoint} (wrong ID, or this server doesn't support the API)`;
    default:
      return `HTTP ${status} from ${host}${endpoint}`;
  }
}

function parseJson(body, url) {
  if (!body.trim()) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`Invalid JSON from ${url}`);
  }
}

// `insecure` is an explicit user opt-in, so drop Node's one-time
// NODE_TLS_REJECT_UNAUTHORIZED warning; all other warnings pass through.
let tlsWarningSuppressed = false;
function suppressTlsWarning() {
  if (tlsWarningSuppressed) return;
  tlsWarningSuppressed = true;
  const emitWarning = process.emitWarning;
  process.emitWarning = function (warning, ...args) {
    const msg = typeof warning === "string" ? warning : warning?.message;
    if (msg?.includes("NODE_TLS_REJECT_UNAUTHORIZED")) return;
    return emitWarning.call(process, warning, ...args);
  };
}

export function createClient({
  host,
  port = 443,
  username,
  password,
  insecure = false,
}) {
  const baseURL = `https://${host}${port !== 443 ? ":" + port : ""}`;
  const authHeader =
    "Basic " + Buffer.from(`${username}:${password}`).toString("base64");

  if (insecure) {
    suppressTlsWarning();
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  // Per-client default headers (e.g. CVP overrides Accept to JSON)
  const defaults = { baseURL, headers: {} };

  return {
    defaults,
    // Supports the axios-style options callers still pass:
    // params (query string), timeout (ms), responseType "arraybuffer".
    async get(path, options = {}) {
      let url = `${baseURL}${path}`;
      if (options.params && Object.keys(options.params).length) {
        const qs = new URLSearchParams(
          Object.entries(options.params)
            .filter(([, v]) => v !== undefined && v !== null)
            .map(([k, v]) => [k, String(v)]),
        ).toString();
        if (qs) url += (url.includes("?") ? "&" : "?") + qs;
      }
      const response = await fetch(url, {
        headers: {
          Authorization: authHeader,
          Accept: "application/xml",
          ...defaults.headers,
          ...options.headers,
        },
        signal: AbortSignal.timeout(options.timeout || 10000),
      });

      if (!response.ok) {
        const err = new Error(`HTTP ${response.status}`);
        err.response = { status: response.status };
        throw err;
      }

      const headers = Object.fromEntries(response.headers.entries());
      if (options.responseType === "arraybuffer") {
        return {
          status: response.status,
          headers,
          data: await response.arrayBuffer(),
        };
      }
      const contentType = response.headers.get("content-type") || "";
      const body = await response.text();
      return {
        status: response.status,
        headers,
        data: contentType.includes("json") ? parseJson(body, url) : body,
      };
    },
  };
}

// Translate fetch/HTTP failures into actionable messages. Attaches
// err.status (HTTP code or error code) for audit logging.
export function mapError(err, client, path) {
  const base = client.defaults.baseURL;
  let out;
  if (err.response) {
    out = new Error(formatHttpError(err.response.status, base, path));
    out.status = err.response.status;
    return out;
  }
  const code = err.cause?.code;
  if (code === "ECONNREFUSED" || code === "ENOTFOUND") {
    out = new Error(`Cannot connect to ${base} (${code})`);
  } else if (err.name === "TimeoutError" || code === "ETIMEDOUT") {
    out = new Error(`Request timed out connecting to ${base}`);
  } else if (code && /CERT|SELF_SIGNED|UNABLE_TO_VERIFY|TLS|SSL/.test(code)) {
    out = new Error(
      `TLS certificate error from ${base} (${code}) — use --insecure or set "insecure": true for this cluster`,
    );
  } else if (code || err.cause?.message) {
    out = new Error(
      `${err.message} — ${code || err.cause.message} (${base}${path})`,
    );
  } else {
    return err;
  }
  out.status = code || "error";
  return out;
}

export async function get(client, path, options = {}) {
  let response;
  try {
    response = await client.get(path, options);
  } catch (err) {
    throw mapError(err, client, path);
  }
  const contentType = response.headers["content-type"] || "";
  if (contentType.includes("json")) return response.data;
  const body = typeof response.data === "string" ? response.data.trim() : "";
  const where = `${client.defaults.baseURL}${path}`;
  if (!body) throw new Error(`Empty response from ${where}`);
  if (contentType.includes("html") || /^<!doctype html|^<html/i.test(body))
    throw new Error(
      `Unexpected HTML response from ${where} (login page or proxy?)`,
    );
  try {
    return await parseXml(body);
  } catch (err) {
    throw new Error(`Invalid XML from ${where}: ${firstLine(err.message)}`);
  }
}

function firstLine(text) {
  return String(text).split("\n")[0];
}
