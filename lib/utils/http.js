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

export function formatHttpError(status, host, endpoint) {
  switch (status) {
    case 401:
      return `Authentication failed for ${host} — check credentials in cluster config`;
    case 403:
      return `Permission denied — user lacks access to ${endpoint} on ${host}`;
    case 404:
      return `Endpoint not found — ${host} may not support this API`;
    default:
      return `HTTP ${status} from ${host}${endpoint}`;
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
        data: contentType.includes("json") ? JSON.parse(body) : body,
      };
    },
  };
}

export async function get(client, path, options = {}) {
  try {
    const response = await client.get(path, options);
    const contentType = response.headers["content-type"] || "";
    if (contentType.includes("json")) {
      return response.data;
    }
    return parseXml(response.data);
  } catch (err) {
    if (err.response) {
      const msg = formatHttpError(
        err.response.status,
        client.defaults.baseURL,
        path,
      );
      throw new Error(msg);
    }
    if (err.cause?.code === "ECONNREFUSED" || err.cause?.code === "ENOTFOUND") {
      throw new Error(`Cannot connect to ${client.defaults.baseURL}`);
    }
    if (err.name === "TimeoutError" || err.cause?.code === "ETIMEDOUT") {
      throw new Error(
        `Request timed out connecting to ${client.defaults.baseURL}`,
      );
    }
    throw err;
  }
}
