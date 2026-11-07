import { defaultConfigPath, getAllHosts } from "../utils/config.js";
import { createAwClient, getStatus } from "../api/aw.js";
import {
  createFinesseClient,
  getSystemInfo,
  getReasonCodes,
} from "../api/finesse.js";
import { createCvpOpsClient, getVersion } from "../api/cvp.js";
import { createDiagClient, getProductVersion } from "../api/diag.js";
import { createVvbClient, getActiveCalls } from "../api/vvb.js";
import { hasPlaceholder } from "../utils/secrets.js";
import { clientConfig } from "../utils/command.js";
import fs from "fs";
import path from "path";
import os from "os";

export default function (program) {
  program
    .command("doctor")
    .description(
      "Health check across all configured services (every host, authenticated)",
    )
    .action(async () => {
      const config = program._resolvedConfig;
      const json = program.opts().format === "json";
      const results = [];

      async function check(service, host, fn) {
        const r = { service, host, ok: false, detail: "" };
        try {
          const detail = await fn();
          r.ok = detail?.warn ? null : true;
          r.detail = (detail?.warn ?? detail) || "";
        } catch (err) {
          r.detail = err.message;
        }
        results.push(r);
        if (!json) {
          const mark = r.ok === true ? "✓" : r.ok === null ? "⚠" : "✗";
          console.log(
            `  ${mark} ${service}${host ? ` (${host})` : ""}${r.detail ? ` — ${r.detail}` : ""}`,
          );
        }
      }

      if (!json) console.log("cisco-ucce doctor\n");

      // Secret Server: any <ss:…> placeholders need a live ss-cli session.
      const usesSs = [
        "aw",
        "finesse",
        "cvpOps",
        "diagnosticPortal",
        "vvb",
      ].some((s) => hasPlaceholder(config[s]?.password));
      if (usesSs)
        await check("Secret Server (ss-cli)", "", async () => {
          clientConfig(
            program,
            ["aw", "finesse", "cvpOps", "diagnosticPortal", "vvb"].find((s) =>
              hasPlaceholder(config[s]?.password),
            ),
            { host: "" },
          );
          return "placeholders resolve";
        });

      for (const h of getAllHosts(config, "aw"))
        await check("AW Status", h.host, async () => {
          const rows = await getStatus(
            createAwClient(clientConfig(program, "aw", h)),
          );
          const bad = Array.isArray(rows)
            ? rows.filter((r) => r.level && r.level !== "OK")
            : [];
          return bad.length
            ? {
                warn: `${bad.length} non-OK: ${bad
                  .slice(0, 3)
                  .map((b) => `${b.name}@${b.machine}`)
                  .join(", ")}`,
              }
            : "all OK";
        });

      for (const h of getAllHosts(config, "finesse"))
        await check("Finesse", h.host, async () => {
          const client = createFinesseClient(
            clientConfig(program, "finesse", h),
          );
          const info = await getSystemInfo(client);
          const primary =
            /host=([^,]+)/.exec(info.primaryNode || "")?.[1] || "";
          const isPrimary = primary.toLowerCase() === h.host.toLowerCase();
          // Admin APIs only answer on the primary node; prove creds there.
          if (isPrimary) await getReasonCodes(client);
          const detail = `${info.status || "?"}, CTI ${info.lastCTIHeartbeatStatus || "?"}${
            isPrimary ? ", admin login OK" : ", secondary"
          }`;
          return info.status === "IN_SERVICE" ? detail : { warn: detail };
        });

      if (config.cvpOps?.host)
        await check("CVP OPS", config.cvpOps.host, async () => {
          const ver = await getVersion(
            createCvpOpsClient(
              clientConfig(program, "cvpOps", {
                host: config.cvpOps.host,
                port: config.cvpOps.port || 8111,
              }),
            ),
          );
          return ver.majorVersion
            ? `v${ver.majorVersion}.${ver.minorVersion}.${ver.maintenanceVersion}`
            : "OK";
        });

      for (const h of getAllHosts(config, "diagnosticPortal"))
        await check("Diag Portal", `${h.host}:${h.port}`, async () => {
          const v = await getProductVersion(
            createDiagClient(clientConfig(program, "diagnosticPortal", h)),
          );
          return (Array.isArray(v) ? v[0]?.VersionString : "") || "OK";
        });

      for (const h of getAllHosts(config, "vvb"))
        await check("VVB", h.host, async () => {
          const s = await getActiveCalls(
            createVvbClient(clientConfig(program, "vvb", h)),
          );
          return `${s.totalConcurrentCalls ?? "?"} active call(s)`;
        });

      await check("Config permissions", "", async () => {
        const perms = fs.statSync(defaultConfigPath()).mode & 0o777;
        if (perms !== 0o600)
          throw new Error(`${perms.toString(8)} (should be 600)`);
        return "0600";
      });

      await check("Audit trail", "", async () => {
        try {
          const st = fs.statSync(
            path.join(os.homedir(), ".cisco-ucce", "audit.jsonl"),
          );
          return `${(st.size / 1024 / 1024).toFixed(2)} MB`;
        } catch {
          return "empty";
        }
      });

      const passed = results.filter((r) => r.ok === true).length;
      const warned = results.filter((r) => r.ok === null).length;
      const failed = results.filter((r) => r.ok === false).length;
      if (json)
        console.log(
          JSON.stringify({ passed, warned, failed, results }, null, 2),
        );
      else
        console.log(
          `\n${passed} passed, ${warned ? `${warned} warning(s), ` : ""}${failed} failed`,
        );
      if (failed > 0) process.exitCode = 1;
    });
}
