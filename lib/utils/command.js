import { resolveHosts } from "./config.js";
import { resolvePassword } from "./secrets.js";
import { logAudit } from "./audit.js";
import { output } from "./output.js";

// --host may land on the subcommand or the root program depending on how
// commander parses it; accept either.
export function hostFlag(program, options = {}) {
  return options.host ?? program.opts().host;
}

// Client config for one host of a service: credentials resolved, cluster
// `insecure` applied. `credsFrom` lets CVP call servers reuse AW creds.
export function clientConfig(program, serviceName, hostEntry, credsFrom) {
  const cluster = program._resolvedConfig;
  const creds = cluster[credsFrom || serviceName];
  if (!creds)
    throw new Error(`${credsFrom || serviceName} not configured in cluster.`);
  return {
    host: hostEntry.host,
    port: hostEntry.port,
    username: creds.username,
    password: resolvePassword(creds.password),
    insecure: cluster.insecure === true,
  };
}

export function hostsFor(program, serviceName, options, hostOpts) {
  return resolveHosts(
    program._resolvedConfig,
    serviceName,
    hostFlag(program, options),
    hostOpts,
  );
}

export function audit(program, entry) {
  if (program.opts().audit === false) return;
  try {
    logAudit(entry);
  } catch {
    /* audit must never break a command */
  }
}

// Run a single-host command: audit success and failure, print, set exit code.
export async function runCommand(program, meta, fn) {
  try {
    const data = await fn(meta);
    audit(program, { ...meta, status: 200 });
    if (data !== undefined) await output(data, program.opts().format);
    return data;
  } catch (err) {
    audit(program, {
      ...meta,
      status: err.status || "error",
      error: err.message,
    });
    console.error(err.message);
    process.exitCode = 1;
  }
}

// Run against one or many hosts. With several, rows get a `host` column,
// per-host errors are reported and continue, and any failure → exit 1.
export async function runOnHosts(program, { command, endpoint, hosts }, fn) {
  const multi = hosts.length > 1;
  const rows = [];
  let failures = 0;
  for (const h of hosts) {
    try {
      const data = await fn(h);
      const list = Array.isArray(data) ? data : [data];
      for (const item of list) {
        const row = item && typeof item === "object" ? item : { result: item };
        rows.push(multi ? { host: h.host, ...row } : row);
      }
      audit(program, { command, host: h.host, endpoint, status: 200 });
    } catch (err) {
      failures++;
      audit(program, {
        command,
        host: h.host,
        endpoint,
        status: err.status || "error",
        error: err.message,
      });
      console.error(multi ? `${h.host}: ${err.message}` : err.message);
    }
  }
  if (failures) process.exitCode = 1;
  if (rows.length || !failures) await output(rows, program.opts().format);
  return rows;
}
