import { loadConfig, getCluster, defaultConfigPath } from "../utils/config.js";
import { createAwClient, getStatus } from "../api/aw.js";
import { createFinesseClient, getSystemInfo } from "../api/finesse.js";
import { createCvpOpsClient, getVersion } from "../api/cvp.js";
import { createDiagClient, getProductVersion } from "../api/diag.js";
import { createVvbClient, getActiveCalls } from "../api/vvb.js";
import { resolvePassword } from "../utils/secrets.js";
import fs from "fs";
import path from "path";
import os from "os";

export default function (program) {
  program
    .command("doctor")
    .description("Health check across all configured services")
    .action(async () => {
      let config;
      try {
        const rawConfig = loadConfig();
        config = getCluster(rawConfig, program.opts().cluster);
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
        return;
      }

      console.log("cisco-ucce doctor\n");
      let passed = 0;
      let failed = 0;

      // 1. AW Status
      if (config.aw?.hosts?.length) {
        const host = config.aw.hosts[0];
        try {
          const client = createAwClient({
            host,
            username: config.aw.username,
            password: resolvePassword(config.aw.password),
            insecure: config.insecure,
          });
          await getStatus(client);
          console.log(`  ✓ AW Status (${host})`);
          passed++;
        } catch (err) {
          console.log(`  ✗ AW Status (${host}): ${err.message}`);
          failed++;
        }
      }

      // 2. Finesse SystemInfo
      if (config.finesse?.hosts?.length) {
        const host = config.finesse.hosts[0];
        try {
          const client = createFinesseClient({
            host,
            username: config.finesse.username,
            password: resolvePassword(config.finesse.password),
            insecure: config.insecure,
          });
          const info = await getSystemInfo(client);
          console.log(
            `  ✓ Finesse (${host}) — ${info.currentTimestamp || "OK"}`,
          );
          passed++;
        } catch (err) {
          console.log(`  ✗ Finesse (${host}): ${err.message}`);
          failed++;
        }
      }

      // 3. CVP Version
      if (config.cvpOps?.host) {
        try {
          const client = createCvpOpsClient({
            host: config.cvpOps.host,
            port: config.cvpOps.port,
            username: config.cvpOps.username,
            password: resolvePassword(config.cvpOps.password),
            insecure: config.insecure,
          });
          const ver = await getVersion(client);
          const vStr = ver.majorVersion
            ? `${ver.majorVersion}.${ver.minorVersion}.${ver.maintenanceVersion}`
            : "OK";
          console.log(`  ✓ CVP OPS (${config.cvpOps.host}) — v${vStr}`);
          passed++;
        } catch (err) {
          console.log(`  ✗ CVP OPS (${config.cvpOps.host}): ${err.message}`);
          failed++;
        }
      }

      // 4. Diagnostic Portal on each host
      if (config.diagnosticPortal?.hosts?.length) {
        for (const hostEntry of config.diagnosticPortal.hosts) {
          try {
            const client = createDiagClient({
              host: hostEntry.host,
              port: hostEntry.port,
              username: config.diagnosticPortal.username,
              password: resolvePassword(config.diagnosticPortal.password),
              insecure: config.insecure,
            });
            await getProductVersion(client);
            console.log(
              `  ✓ Diag Portal (${hostEntry.host}:${hostEntry.port})`,
            );
            passed++;
          } catch (err) {
            console.log(
              `  ✗ Diag Portal (${hostEntry.host}:${hostEntry.port}): ${err.message}`,
            );
            failed++;
          }
        }
      }

      // 5. VVB on each host
      if (config.vvb?.hosts?.length) {
        for (const h of config.vvb.hosts) {
          const host = typeof h === "string" ? h : h.host;
          try {
            const client = createVvbClient({
              host,
              username: config.vvb.username,
              password: resolvePassword(config.vvb.password),
              insecure: config.insecure,
            });
            await getActiveCalls(client);
            console.log(`  ✓ VVB (${host})`);
            passed++;
          } catch (err) {
            console.log(`  ✗ VVB (${host}): ${err.message}`);
            failed++;
          }
        }
      }

      // 6. Config permissions
      try {
        const stats = fs.statSync(defaultConfigPath());
        const perms = stats.mode & 0o777;
        if (perms === 0o600) {
          console.log("  ✓ Config permissions (0600)");
          passed++;
        } else {
          console.log(
            `  ⚠ Config permissions: ${perms.toString(8)} (should be 600)`,
          );
          failed++;
        }
      } catch {
        console.log("  ⚠ Config file not found");
        failed++;
      }

      // 7. Audit trail size
      const auditPath = path.join(os.homedir(), ".cisco-ucce", "audit.jsonl");
      try {
        const stats = fs.statSync(auditPath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`  ✓ Audit trail (${sizeMB} MB)`);
        passed++;
      } catch {
        console.log("  ✓ Audit trail (empty)");
        passed++;
      }

      console.log(`\n${passed} passed, ${failed} failed`);
      if (failed > 0) process.exitCode = 1;
    });
}
