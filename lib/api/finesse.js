import { createClient, get } from "../utils/http.js";

export function createFinesseClient(config) {
  return createClient({
    host: config.host,
    port: config.port || 443,
    username: config.username,
    password: config.password,
    insecure: config.insecure,
  });
}

// Render nested XML (e.g. primaryNode, ctiServers, roles) as readable text
// instead of "[object Object]".
export function summarize(value) {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return value.map(summarize).join("; ");
  const entries = Object.entries(value).filter(([k]) => k !== "$");
  if (entries.length === 1) return summarize(entries[0][1]);
  return entries.map(([k, v]) => `${k}=${summarize(v)}`).join(", ");
}

const EPOCH_MS = /^\d{13}$/;

function flattenXmlItem(item) {
  const flat = {};
  for (const [key, value] of Object.entries(item)) {
    if (key === "$") continue;
    let v = summarize(
      Array.isArray(value) && value.length === 1 ? value[0] : value,
    );
    if (/Time$/.test(key) && EPOCH_MS.test(v))
      v = new Date(Number(v)).toISOString();
    flat[key] = v;
  }
  return flat;
}

export async function getSystemInfo(client) {
  const data = await get(client, "/finesse/api/SystemInfo");
  return data.SystemInfo ? flattenXmlItem(data.SystemInfo) : {};
}

export async function getUsers(client) {
  const data = await get(client, "/finesse/api/Users");
  const users = data.Users?.User || [];
  return users.map(flattenXmlItem);
}

export async function getQueue(client, id) {
  const data = await get(client, `/finesse/api/Queue/${id}`);
  const q = data.Queue;
  if (!q) return null;
  const flat = { name: q.name?.[0], uri: q.uri?.[0] };
  if (q.statistics?.[0]) {
    for (const [key, value] of Object.entries(q.statistics[0])) {
      if (key === "$") continue;
      flat[key] = Array.isArray(value) ? value[0] : value;
    }
  }
  return flat;
}

export async function getTeams(client) {
  const data = await get(client, "/finesse/api/Teams");
  const teams = data.Teams?.Team || [];
  return teams.map((t) => ({
    id: t.id?.[0],
    name: t.name?.[0],
    uri: t.uri?.[0],
  }));
}

export async function getReasonCodes(client, category = "NOT_READY") {
  const data = await get(
    client,
    `/finesse/api/ReasonCodes?category=${category}`,
  );
  const codes = data.ReasonCodes?.ReasonCode || [];
  return codes.map((c) => ({
    id: c.id?.[0],
    category: c.category?.[0],
    code: c.code?.[0],
    label: c.label?.[0],
    forAll: c.forAll?.[0],
    systemCode: c.systemCode?.[0],
  }));
}

export async function getWrapUpReasons(client) {
  const data = await get(client, "/finesse/api/WrapUpReasons");
  const reasons = data.WrapUpReasons?.WrapUpReason || [];
  return reasons.map((r) => ({
    id: r.id?.[0],
    label: r.label?.[0],
    forAll: r.forAll?.[0],
  }));
}

export async function getPhoneBooks(client) {
  const data = await get(client, "/finesse/api/PhoneBooks");
  const books = data.PhoneBooks?.PhoneBook || [];
  return books.map((b) => ({
    id: b.id?.[0],
    name: b.name?.[0],
    type: b.type?.[0],
    uri: b.uri?.[0],
  }));
}

export async function getUser(client, loginId) {
  const data = await get(
    client,
    `/finesse/api/User/${encodeURIComponent(loginId)}`,
  );
  return data.User ? flattenXmlItem(data.User) : null;
}

// Queues (skill groups) Finesse associates with the agent — these are what
// Finesse queue statistics count the agent toward.
export async function getUserQueues(client, loginId) {
  const data = await get(
    client,
    `/finesse/api/User/${encodeURIComponent(loginId)}/Queues`,
  );
  const queues = data.Queues?.Queue || [];
  return queues.map((q) => ({
    id: q.uri?.[0]?.split("/").pop(),
    name: q.name?.[0],
  }));
}

export async function getTeam(client, id) {
  const data = await get(client, `/finesse/api/Team/${encodeURIComponent(id)}`);
  const t = data.Team;
  if (!t) return null;
  const users = t.users?.[0]?.User || [];
  return {
    id: t.id?.[0],
    name: t.name?.[0],
    users: users.map((u) => ({
      loginId: u.loginId?.[0],
      firstName: u.firstName?.[0],
      lastName: u.lastName?.[0],
      state: u.state?.[0],
      reasonCodeId: u.reasonCodeId?.[0] ?? "",
      extension: u.extension?.[0] ?? "",
      stateChangeTime: u.stateChangeTime?.[0],
    })),
  };
}
