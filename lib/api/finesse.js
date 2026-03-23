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

function flattenXmlItem(item) {
  const flat = {};
  for (const [key, value] of Object.entries(item)) {
    if (key === "$") continue;
    flat[key] = Array.isArray(value) ? value[0] : value;
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
