import fs from "fs";
import path from "path";
import os from "os";

const DEFAULT_CONFIG_DIR = path.join(os.homedir(), ".cisco-ucce");
const DEFAULT_CONFIG_FILE = "config.json";

export function defaultConfigPath() {
  return path.join(DEFAULT_CONFIG_DIR, DEFAULT_CONFIG_FILE);
}

export function loadConfig(configPath = defaultConfigPath()) {
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return { activeCluster: null, clusters: {} };
  }
}

export function saveConfig(config, configPath = defaultConfigPath()) {
  const dir = path.dirname(configPath);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", {
    mode: 0o600,
  });
}

export function getCluster(config, name) {
  const clusterName = name || config.activeCluster;
  if (!clusterName)
    throw new Error("No active cluster. Run: cisco-ucce cluster add <name>");
  const cluster = config.clusters[clusterName];
  if (!cluster) throw new Error(`Cluster "${clusterName}" not found.`);
  return cluster;
}

export function getServiceConfig(cluster, serviceName) {
  const svc = cluster[serviceName];
  if (!svc)
    throw new Error(`Service "${serviceName}" not configured in cluster.`);
  let host;
  if (svc.hosts) {
    host = typeof svc.hosts[0] === "object" ? svc.hosts[0].host : svc.hosts[0];
  } else if (svc.host) {
    host = svc.host;
  }
  return { ...svc, host };
}

export function getAllHosts(cluster, serviceName) {
  const svc = cluster[serviceName];
  if (!svc) return [];
  if (svc.hosts) {
    return svc.hosts.map((h) =>
      typeof h === "object" ? h : { host: h, port: svc.port || 443 },
    );
  }
  if (svc.host) return [{ host: svc.host, port: svc.port || 443 }];
  return [];
}
