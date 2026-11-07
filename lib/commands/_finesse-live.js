import { createFinesseClient, getUser, getUserQueues } from "../api/finesse.js";
import { clientConfig, hostsFor } from "../utils/command.js";

// Finesse client on the first configured host (ignores --host, which the
// AW-side commands use for the AW server). Null if Finesse isn't configured.
export function finesseClientOrNull(program) {
  if (!program._resolvedConfig.finesse?.hosts?.length) return null;
  const [h] = hostsFor(
    program,
    "finesse",
    { host: undefined },
    { allowAll: false },
  );
  return createFinesseClient(clientConfig(program, "finesse", h));
}

// Run fn over items with limited concurrency, preserving order.
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return out;
}

export async function liveState(client, loginId) {
  try {
    const u = await getUser(client, loginId);
    return u
      ? {
          state: u.state,
          reasonCodeId: u.reasonCodeId === "-1" ? "" : u.reasonCodeId,
          extension: u.extension,
          since: u.stateChangeTime,
        }
      : { state: "unknown" };
  } catch (err) {
    return { state: `unavailable (${err.message})` };
  }
}

export { getUserQueues };
