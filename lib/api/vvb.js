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
  // Flatten: { vvbStats: { vvbStats: [{ totalConcurrentCalls: ["2"], ... }] } }
  const stats = data?.vvbStats?.vvbStats?.[0];
  if (!stats) return data;
  const flat = {};
  for (const [key, value] of Object.entries(stats)) {
    flat[key] = Array.isArray(value) ? value[0] : value;
  }
  return flat;
}
