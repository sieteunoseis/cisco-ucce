import { createClient, get } from "../utils/http.js";

export function createCvpOpsClient(config) {
  const client = createClient({
    host: config.host,
    port: config.port || 8111,
    username: config.username,
    password: config.password,
    insecure: config.insecure,
  });
  // Override Accept header for CVP
  client.defaults.headers["Accept"] = "application/json";
  return client;
}

export function createCvpOrmClient(config) {
  const client = createClient({
    host: config.host,
    port: config.port || 8111,
    username: config.username,
    password: config.password,
    insecure: config.insecure,
  });
  client.defaults.headers["Accept"] = "application/json";
  return client;
}

export async function getVersion(client) {
  const data = await get(client, "/cvp-config/version");
  return data.version || data;
}

export async function getServers(client) {
  const data = await get(client, "/cvp-config/server");
  const servers = data.results?.servers?.server || [];
  return servers.map((s) => ({
    hostname: s.hostname,
    ipaddr: s.ipaddr,
    type: s.type,
  }));
}

export async function getProperties(client) {
  const data = await get(client, "/cvp-orm/rest/cvpconfig/properties");
  const props = data.properties || [];
  return props.map((p) => ({ name: p.name, value: p.value }));
}
