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
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  return {
    defaults: { baseURL },
    async get(path, options = {}) {
      const url = `${baseURL}${path}`;
      const response = await fetch(url, {
        headers: {
          Authorization: authHeader,
          Accept: "application/xml",
          ...options.headers,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const err = new Error(`HTTP ${response.status}`);
        err.response = { status: response.status };
        throw err;
      }

      const contentType = response.headers.get("content-type") || "";
      const body = await response.text();
      return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
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
