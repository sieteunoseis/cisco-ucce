import { createClient, get } from "../utils/http.js";

export function createVvbClient(config) {
  return createClient({
    host: config.host,
    port: config.port || 443,
    username: config.username,
    password: config.password,
    insecure: config.insecure,
  });
}

export async function getActiveCalls(client) {
  const data = await get(client, "/adminapi/vvbStats/activeCalls");
  return data;
}
