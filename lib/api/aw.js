import { createClient, get, extractId } from "../utils/http.js";

const BASE = "/unifiedconfig/config";

const text = (v) => (Array.isArray(v) ? v[0] : v);

// Names from a wrapper like skillGroups: [{ skillGroup: [{ name }, ...] }]
function namedList(wrapper) {
  if (!wrapper || typeof wrapper !== "object" || wrapper.name) return null;
  const keys = Object.keys(wrapper).filter((k) => k !== "$");
  if (keys.length !== 1 || !Array.isArray(wrapper[keys[0]])) return null;
  const items = wrapper[keys[0]];
  if (
    !items.length ||
    !items.every((i) => i && typeof i === "object" && i.name)
  )
    return null;
  return items.map((i) => text(i.name)).join("; ");
}

export function extractRefId(item) {
  return extractId(text(item?.refURL));
}

export function flattenItem(item) {
  const flat = {};
  flat.id = extractId(item.refURL?.[0]);
  for (const [key, value] of Object.entries(item)) {
    if (key === "refURL" || key === "$" || key === "changeStamp") continue;
    if (!Array.isArray(value) || value.length !== 1) continue;
    const v = value[0];
    if (typeof v === "string") {
      flat[key] = v;
    } else if (v && typeof v === "object") {
      if (v.name) {
        flat[key] = text(v.name);
      } else if (key === "person") {
        flat.firstName = text(v.firstName) || "";
        flat.lastName = text(v.lastName) || "";
        flat.userName = text(v.userName) || "";
      } else {
        const names = namedList(v);
        if (names !== null) flat[key] = names;
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
  const raw = Array.isArray(rawItems) ? rawItems : [];
  const items = raw.map(flattenItem);

  const totalResults = parseInt(root.pageInfo?.[0]?.totalResults?.[0] || "0");
  return { items, raw, totalResults };
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

export async function list(
  client,
  resource,
  { page, pageSize, q, raw = false } = {},
) {
  const pick = (r) => (raw ? r.raw : r.items);
  const query = q ? { q } : {};
  if (page !== undefined) {
    if (page < 1) throw new Error("--page starts at 1");
    // Explicit page requested
    const startIndex = (page - 1) * (pageSize || 25);
    const data = await get(client, `${BASE}/${resource}`, {
      params: { ...query, startIndex, resultsPerPage: pageSize || 25 },
    });
    return pick(extractItems(data, resource));
  }

  // Auto-paginate: fetch all records
  let allItems = [];
  let startIndex = 0;
  const batchSize = 100;
  while (true) {
    const data = await get(client, `${BASE}/${resource}`, {
      params: { ...query, startIndex, resultsPerPage: batchSize },
    });
    const result = extractItems(data, resource);
    const { items, totalResults } = result;
    if (!items.length) break;
    allItems = allItems.concat(pick(result));
    // Advance by what the server actually returned (it may cap page size);
    // without a totalResults, a short page means we've reached the end.
    startIndex += items.length;
    if (totalResults ? startIndex >= totalResults : items.length < batchSize)
      break;
  }
  return allItems;
}

export async function getRawById(client, resource, id) {
  const data = await get(client, `${BASE}/${resource}/${id}`);
  // Single item response — the root element IS the item
  const rootKey = Object.keys(data).find((k) => k !== "$" && k !== "?xml");
  return rootKey ? data[rootKey] : null;
}

export async function getById(client, resource, id) {
  const item = await getRawById(client, resource, id);
  return item ? flattenItem(item) : null;
}

// Resolve an ID or a name (case-insensitive exact match on name, userName,
// or person login; falls back to a unique partial match). Returns raw item.
export async function findOne(client, resource, term) {
  term = String(term).trim();
  if (/^\d+$/.test(term)) {
    try {
      const item = await getRawById(client, resource, term);
      if (item) return item;
    } catch (err) {
      if (!/not found/i.test(err.message)) throw err;
    }
  }
  const raw = await list(client, resource, { q: term, raw: true });
  const t = term.toLowerCase();
  const keys = (r) =>
    [r.name, r.userName, r.person?.[0]?.userName, r.agentId, r.peripheralNumber]
      .map((v) => String(text(v) ?? "").toLowerCase())
      .filter(Boolean);
  const exact = raw.filter((r) => keys(r).includes(t));
  if (exact.length === 1) {
    const id = extractId(text(exact[0].refURL));
    return (await getRawById(client, resource, id)) || exact[0];
  }
  // Never guess from a partial match — AW's q= search is fuzzy and can
  // return a different person whose name merely contains the term.
  const candidates = exact.length ? exact : raw;
  if (!candidates.length) throw new Error(`No ${resource} matches "${term}".`);
  const shown = candidates
    .slice(0, 10)
    .map((r) => `${text(r.name)} (${extractId(text(r.refURL))})`)
    .join(", ");
  throw new Error(
    `No exact ${resource} match for "${term}". ${
      exact.length ? "Ambiguous" : "Did you mean"
    }: ${shown}${candidates.length > 10 ? `, … (${candidates.length} total)` : ""}. Use the full name, login, or ID.`,
  );
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
