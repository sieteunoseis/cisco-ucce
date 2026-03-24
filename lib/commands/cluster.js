import {
  loadConfig,
  saveConfig,
  defaultConfigPath,
  getCluster,
  getServiceConfig,
} from "../utils/config.js";
import { resolvePassword } from "../utils/secrets.js";
import { createClient, get } from "../utils/http.js";
import fs from "fs";

export default function (program) {
  const cluster = program
    .command("config")
    .description("Manage cluster configurations");

  cluster
    .command("add <name>")
    .description("Add a new cluster (creates skeleton config)")
    .action((name) => {
      const config = loadConfig();
      if (config.clusters[name]) {
        console.error(`Cluster "${name}" already exists.`);
        process.exitCode = 1;
        return;
      }
      config.clusters[name] = {
        aw: { hosts: [], username: "", password: "" },
        finesse: { hosts: [], username: "", password: "" },
        cvpOps: { host: "", port: 8111, username: "", password: "" },
        cvpCallServers: { hosts: [], port: 8111 },
        diagnosticPortal: { hosts: [], username: "", password: "" },
        vvb: { hosts: [], username: "", password: "" },
        insecure: true,
      };
      if (!config.activeCluster) config.activeCluster = name;
      saveConfig(config);
      console.log(
        `Cluster "${name}" added. Edit config at: ${defaultConfigPath()}`,
      );
    });

  cluster
    .command("use <name>")
    .description("Set active cluster")
    .action((name) => {
      const config = loadConfig();
      if (!config.clusters[name]) {
        console.error(`Cluster "${name}" not found.`);
        process.exitCode = 1;
        return;
      }
      config.activeCluster = name;
      saveConfig(config);
      console.log(`Active cluster set to "${name}".`);
    });

  cluster
    .command("list")
    .description("List all clusters")
    .action(() => {
      const config = loadConfig();
      const names = Object.keys(config.clusters);
      if (!names.length) {
        console.log(
          "No clusters configured. Run: cisco-ucce cluster add <name>",
        );
        return;
      }
      for (const name of names) {
        const marker = name === config.activeCluster ? " (active)" : "";
        console.log(`  ${name}${marker}`);
      }
    });

  cluster
    .command("show")
    .description("Show active cluster configuration")
    .action(() => {
      const config = loadConfig();
      if (!config.activeCluster) {
        console.error("No active cluster. Run: cisco-ucce cluster add <name>");
        process.exitCode = 1;
        return;
      }
      const c = config.clusters[config.activeCluster];
      console.log(`Cluster: ${config.activeCluster}`);
      console.log(JSON.stringify(c, null, 2));
    });

  cluster
    .command("remove <name>")
    .description("Remove a cluster")
    .action((name) => {
      const config = loadConfig();
      if (!config.clusters[name]) {
        console.error(`Cluster "${name}" not found.`);
        process.exitCode = 1;
        return;
      }
      delete config.clusters[name];
      if (config.activeCluster === name) {
        config.activeCluster = Object.keys(config.clusters)[0] || null;
      }
      saveConfig(config);
      console.log(`Cluster "${name}" removed.`);
    });

  cluster
    .command("test")
    .description("Test connectivity to all services in active cluster")
    .action(async () => {
      const config = loadConfig();
      if (!config.activeCluster) {
        console.error("No active cluster configured.");
        process.exitCode = 1;
        return;
      }
      const c = config.clusters[config.activeCluster];
      console.log(`Testing cluster: ${config.activeCluster}\n`);

      // Test AW
      if (c.aw?.hosts?.length) {
        try {
          const awClient = createClient({
            host: c.aw.hosts[0],
            username: c.aw.username,
            password: resolvePassword(c.aw.password),
            insecure: c.insecure,
          });
          await get(awClient, "/unifiedconfig/config/status");
          console.log(`  ✓ AW (${c.aw.hosts[0]})`);
        } catch (err) {
          console.log(`  ✗ AW (${c.aw.hosts[0]}): ${err.message}`);
        }
      }

      // Test Finesse
      if (c.finesse?.hosts?.length) {
        try {
          const finClient = createClient({
            host: c.finesse.hosts[0],
            username: c.finesse.username,
            password: resolvePassword(c.finesse.password),
            insecure: c.insecure,
          });
          await get(finClient, "/finesse/api/SystemInfo");
          console.log(`  ✓ Finesse (${c.finesse.hosts[0]})`);
        } catch (err) {
          console.log(`  ✗ Finesse (${c.finesse.hosts[0]}): ${err.message}`);
        }
      }

      // Test CVP OPS
      if (c.cvpOps?.host) {
        try {
          const cvpClient = createClient({
            host: c.cvpOps.host,
            port: c.cvpOps.port || 8111,
            username: c.cvpOps.username,
            password: resolvePassword(c.cvpOps.password),
            insecure: c.insecure,
          });
          cvpClient.defaults.headers["Accept"] = "application/json";
          await get(cvpClient, "/cvp-config/version");
          console.log(`  ✓ CVP OPS (${c.cvpOps.host})`);
        } catch (err) {
          console.log(`  ✗ CVP OPS (${c.cvpOps.host}): ${err.message}`);
        }
      }

      // Test first Diagnostic Portal host
      if (c.diagnosticPortal?.hosts?.length) {
        const dpHost = c.diagnosticPortal.hosts[0];
        try {
          const dpClient = createClient({
            host: dpHost.host,
            port: dpHost.port,
            username: c.diagnosticPortal.username,
            password: resolvePassword(c.diagnosticPortal.password),
            insecure: c.insecure,
          });
          await get(
            dpClient,
            "/icm-dp/rest/DiagnosticPortal/GetProductVersion",
          );
          console.log(`  ✓ Diagnostic Portal (${dpHost.host}:${dpHost.port})`);
        } catch (err) {
          console.log(
            `  ✗ Diagnostic Portal (${dpHost.host}:${dpHost.port}): ${err.message}`,
          );
        }
      }

      // Test first VVB host
      if (c.vvb?.hosts?.length) {
        const vvbHost =
          typeof c.vvb.hosts[0] === "string"
            ? c.vvb.hosts[0]
            : c.vvb.hosts[0].host;
        try {
          const vvbClient = createClient({
            host: vvbHost,
            username: c.vvb.username,
            password: resolvePassword(c.vvb.password),
            insecure: c.insecure,
          });
          await get(vvbClient, "/adminapi/vvbStats/activeCalls");
          console.log(`  ✓ VVB (${vvbHost})`);
        } catch (err) {
          console.log(`  ✗ VVB (${vvbHost}): ${err.message}`);
        }
      }

      // Check config permissions
      try {
        const stats = fs.statSync(defaultConfigPath());
        const perms = stats.mode & 0o777;
        if (perms === 0o600) {
          console.log("  ✓ Config file permissions (0600)");
        } else {
          console.log(
            `  ⚠ Config file permissions: ${perms.toString(8)} (should be 600)`,
          );
        }
      } catch {
        console.log("  ⚠ Config file not found");
      }
    });
}
