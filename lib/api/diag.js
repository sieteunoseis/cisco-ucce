import fs from "fs";
import { createClient, get, mapError, parseXml } from "../utils/http.js";

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
function flattenDiagResponse(data) {
  if (!data || typeof data !== "object") return data;

  const rootKey = Object.keys(data).find((k) => k !== "$" && k !== "?xml");
  if (!rootKey) return data;
  const root = data[rootKey];

  // Check for error response
  const returnCode = root.$?.ReturnCode;
  if (returnCode && returnCode !== "0") {
    const err = new Error(
      `Diagnostic Portal error ${returnCode}: ${root.$.ErrorString || "Unknown error"}`,
    );
    err.status = `dp:${returnCode}`;
    throw err;
  }

  // Collect all leaf items recursively from dp: namespaced elements
  const results = [];
  collectItems(root, results, "");
  return results.length ? results : data;
}

function collectItems(obj, results, parentName) {
  for (const [key, value] of Object.entries(obj)) {
    if (key === "$" || key === "dp:Schema") continue;
    if (!Array.isArray(value)) continue;

    // If key is a List container (e.g. dp:TraceComponentList, dp:LogComponentList),
    // recurse into each wrapper object inside
    if (key.includes("List")) {
      for (const wrapper of value) {
        if (typeof wrapper === "object") {
          collectItems(wrapper, results, parentName);
        }
      }
      continue;
    }

    // Otherwise this is an array of items (e.g. dp:TraceComponent, dp:LogComponent)
    for (const item of value) {
      if (item.$ && typeof item.$ === "object") {
        const row = { ...item.$ };
        // Check for nested lists inside this item
        let hasNestedList = false;
        for (const [subKey, subVal] of Object.entries(item)) {
          if (subKey === "$") continue;
          if (subKey.includes("List") && Array.isArray(subVal)) {
            hasNestedList = true;
            for (const listItem of subVal) {
              collectItems(listItem, results, row.Name || parentName);
            }
          }
        }
        if (!hasNestedList) {
          if (parentName) row.Parent = parentName;
          results.push(row);
        }
      } else if (typeof item === "string") {
        results.push({ [key.replace("dp:", "")]: item });
      }
    }
  }
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
export async function listTraceFiles(
  client,
  component,
  { fromHours = 12 } = {},
) {
  const now = Date.now();
  const from = now - fromHours * 3600 * 1000;
  return diagGet(client, "ListTraceFiles", {
    Component: component,
    FromDate: from,
    ToDate: now,
    UseTzadjustoff: "NO",
    Random: now,
  });
}
export async function listLogComponents(client) {
  return diagGet(client, "ListLogComponents");
}
export async function listLogFiles(client, component, { fromHours = 12 } = {}) {
  const now = Date.now();
  const from = now - fromHours * 3600 * 1000;
  return diagGet(client, "ListLogFiles", {
    Component: component,
    FromDate: from,
    ToDate: now,
    UseTzadjustoff: "NO",
    Random: now,
  });
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
// Download a file to disk. Refuses to overwrite unless `force`, and refuses
// to save an XML error document as if it were the requested file.
async function download(client, endpoint, component, file, outputPath, force) {
  const path = `${BASE}/${endpoint}`;
  let response;
  try {
    response = await client.get(path, {
      params: { Component: component, File: file, Random: Date.now() },
      responseType: "arraybuffer",
      timeout: 120000,
    });
  } catch (err) {
    throw mapError(err, client, path);
  }
  const buf = Buffer.from(response.data);
  const ct = response.headers?.["content-type"] || "";
  if (
    ct.includes("xml") &&
    buf.toString("utf8", 0, 512).includes("ReturnCode")
  ) {
    const parsed = flattenDiagResponse(await parseXml(buf.toString("utf8")));
    throw new Error(
      `Diagnostic Portal returned no file: ${JSON.stringify(parsed)}`,
    );
  }
  try {
    fs.writeFileSync(outputPath, buf, { flag: force ? "w" : "wx" });
  } catch (err) {
    if (err.code === "EEXIST")
      throw new Error(
        `${outputPath} already exists (use --force to overwrite)`,
      );
    throw err;
  }
  return { file: outputPath, size: buf.byteLength };
}

export async function downloadTraceFile(
  client,
  component,
  file,
  outputPath,
  { force } = {},
) {
  return download(
    client,
    "DownloadTraceFile",
    component,
    file,
    outputPath,
    force,
  );
}

export async function downloadLogFile(
  client,
  component,
  file,
  outputPath,
  { force } = {},
) {
  return download(
    client,
    "DownloadLogFile",
    component,
    file,
    outputPath,
    force,
  );
}
