import { createClient, get, extractId } from "../utils/http.js";

const BASE = "/unifiedconfig/config";

function flattenItem(item) {
  const flat = {};
  flat.id = extractId(item.refURL?.[0]);
  for (const [key, value] of Object.entries(item)) {
    if (key === "refURL" || key === "$" || key === "changeStamp") continue;
    if (Array.isArray(value) && value.length === 1) {
      if (typeof value[0] === "string") {
        flat[key] = value[0];
      } else if (typeof value[0] === "object" && value[0] !== null) {
        // Nested object — extract name if available
        const nested = value[0];
        if (nested.name) {
          flat[key] = Array.isArray(nested.name) ? nested.name[0] : nested.name;
        }
      }
    }
  }
  return flat;
}

function extractItems(data, resource) {
  const root = data.results || data;
  // Find the plural container key (not pageInfo, not permissionInfo, not $)
  const skipKeys = ["pageInfo", "permissionInfo", "$", "xmlns:xsi"];
  const pluralKey = Object.keys(root).find((k) => !skipKeys.includes(k));
  if (!pluralKey) return { items: [], totalResults: 0 };

  const container = root[pluralKey];
  // container is an array with one element (the wrapper), which contains the singular items
  const wrapper = Array.isArray(container) ? container[0] : container;
  if (!wrapper || typeof wrapper !== "object")
    return { items: [], totalResults: 0 };

  // Find the singular key inside the wrapper
  const singularKey = Object.keys(wrapper).find((k) => k !== "$");
  const rawItems = singularKey ? wrapper[singularKey] : [];
  const items = Array.isArray(rawItems) ? rawItems.map(flattenItem) : [];

  const totalResults = parseInt(root.pageInfo?.[0]?.totalResults?.[0] || "0");
  return { items, totalResults };
}

export function createAwClient(config) {
  return createClient({
    host: config.host,
    port: config.port || 443,
    username: config.username,
    password: config.password,
    insecure: config.insecure,
  });
}

export async function list(client, resource, { page, pageSize } = {}) {
  if (page !== undefined) {
    // Explicit page requested
    const startIndex = (page - 1) * (pageSize || 25);
    const data = await get(client, `${BASE}/${resource}`, {
      params: { startIndex, resultsPerPage: pageSize || 25 },
    });
    const { items } = extractItems(data, resource);
    return items;
  }

  // Auto-paginate: fetch all records
  let allItems = [];
  let startIndex = 0;
  const batchSize = 100;
  while (true) {
    const data = await get(client, `${BASE}/${resource}`, {
      params: { startIndex, resultsPerPage: batchSize },
    });
    const { items, totalResults } = extractItems(data, resource);
    if (!items.length) break;
    allItems = allItems.concat(items);
    startIndex += batchSize;
    if (startIndex >= totalResults) break;
  }
  return allItems;
}

export async function getById(client, resource, id) {
  const data = await get(client, `${BASE}/${resource}/${id}`);
  // Single item response — the root element IS the item
  const rootKey = Object.keys(data).find((k) => k !== "$" && k !== "?xml");
  if (!rootKey) return null;
  const item = data[rootKey];
  return flattenItem(item);
}

export async function getStatus(client) {
  const data = await get(client, `${BASE}/status`);
  // Flatten: results.statuses[0].status[] → [{ name, category, level, machine, machineType }]
  const statuses = data?.results?.statuses?.[0]?.status;
  if (!Array.isArray(statuses)) return data;
  const rows = [];
  for (const s of statuses) {
    const name = s.name?.[0] || "";
    const category = s.category?.[0] || "";
    const level = s.level?.[0] || "";
    const machines = s.machines?.[0]?.machine || [];
    if (machines.length) {
      for (const m of machines) {
        rows.push({
          name,
          category,
          level,
          machine: m.name?.[0] || "",
          machineType: m.machineType?.[0] || "",
        });
      }
    } else {
      rows.push({ name, category, level, machine: "", machineType: "" });
    }
  }
  return rows;
}
