import { createClient, get } from "../utils/http.js";

const BASE = "/icm-dp/rest/DiagnosticPortal";

export function createDiagClient(hostConfig) {
  return createClient({
    host: hostConfig.host,
    port: hostConfig.port,
    username: hostConfig.username,
    password: hostConfig.password,
    insecure: hostConfig.insecure,
  });
}

// Flatten dp: namespaced XML responses into simple objects
// Diag Portal uses XML attributes ($) for data, e.g.:
//   { "dp:ProductVersion": [{ "$": { "Name": "ICM", "Major": "12" } }] }
function flattenDiagResponse(data) {
  if (!data || typeof data !== "object") return data;

  // Find the root reply key (e.g. dp:GetProductVersionReply)
  const rootKey = Object.keys(data).find((k) => k !== "$" && k !== "?xml");
  if (!rootKey) return data;
  const root = data[rootKey];

  // Extract all dp: elements, flattening $ attributes
  const results = [];
  for (const [key, value] of Object.entries(root)) {
    if (key === "$" || key === "dp:Schema") continue;
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      if (item.$ && typeof item.$ === "object") {
        results.push(item.$);
      } else if (typeof item === "string") {
        results.push({ [key.replace("dp:", "")]: item });
      }
    }
  }

  return results.length ? results : data;
}

async function diagGet(client, endpoint, params = {}) {
  const hasParams = Object.keys(params).length > 0;
  const data = await get(
    client,
    `${BASE}/${endpoint}`,
    hasParams ? { params } : {},
  );
  return flattenDiagResponse(data);
}

export async function listProcesses(client) {
  return diagGet(client, "ListProcesses");
}
export async function listServices(client) {
  return diagGet(client, "ListServices");
}
export async function getProductVersion(client) {
  return diagGet(client, "GetProductVersion");
}
export async function getProductLicense(client) {
  return diagGet(client, "GetProductLicense");
}
export async function getNetStat(client) {
  return diagGet(client, "GetNetStat");
}
export async function getIPConfig(client, args) {
  return diagGet(client, "GetIPConfig", args ? { Arguments: args } : {});
}
export async function getPerformanceInfo(client, component) {
  return diagGet(
    client,
    "GetPerformanceInformation",
    component ? { Component: component } : {},
  );
}
export async function getPerfCounterValue(client) {
  return diagGet(client, "GetPerfCounterValue");
}
export async function getTraceLevel(client) {
  return diagGet(client, "GetTraceLevel");
}
export async function getAlarms(client) {
  return diagGet(client, "GetAlarms");
}
export async function listTraceComponents(client) {
  return diagGet(client, "ListTraceComponents");
}
export async function listTraceFiles(client) {
  return diagGet(client, "ListTraceFiles");
}
export async function listLogComponents(client) {
  return diagGet(client, "ListLogComponents");
}
export async function listLogFiles(client) {
  return diagGet(client, "ListLogFiles");
}
export async function listAppServers(client) {
  return diagGet(client, "ListAppServers");
}
export async function listConfigCategories(client) {
  return diagGet(client, "ListConfigurationCategories");
}
export async function getConfigCategory(client, category) {
  return diagGet(client, "GetConfigurationCategory", { Category: category });
}
export async function getTraceRoute(client) {
  return diagGet(client, "GetTraceRoute");
}
export async function getPing(client) {
  return diagGet(client, "GetPing");
}
export async function downloadTraceFile(client, file) {
  return diagGet(client, "DownloadTraceFile", { File: file });
}
export async function downloadLogFile(client, file) {
  return diagGet(client, "DownloadLogFile", { File: file });
}
