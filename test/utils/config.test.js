import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  loadConfig,
  saveConfig,
  getCluster,
  getServiceConfig,
  getAllHosts,
} from "../../lib/utils/config.js";
import fs from "fs";
import path from "path";
import os from "os";

describe("config", () => {
  const tmpDir = path.join(os.tmpdir(), "cisco-ucce-test-" + Date.now());
  const configPath = path.join(tmpDir, "config.json");

  beforeEach(() => fs.mkdirSync(tmpDir, { recursive: true }));
  afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  it("returns empty config when file missing", () => {
    const config = loadConfig(configPath);
    expect(config).toEqual({ activeCluster: null, clusters: {} });
  });

  it("loads and saves config", () => {
    const config = {
      activeCluster: "test",
      clusters: { test: { insecure: true } },
    };
    saveConfig(config, configPath);
    const loaded = loadConfig(configPath);
    expect(loaded.activeCluster).toBe("test");
  });

  it("sets file permissions to 0600", () => {
    saveConfig({ activeCluster: null, clusters: {} }, configPath);
    const stats = fs.statSync(configPath);
    expect(stats.mode & 0o777).toBe(0o600);
  });

  it("getCluster returns active cluster", () => {
    const config = {
      activeCluster: "prod",
      clusters: { prod: { aw: { hosts: ["aw1"] } } },
    };
    expect(getCluster(config).aw.hosts).toEqual(["aw1"]);
  });

  it("getCluster with override returns named cluster", () => {
    const config = {
      activeCluster: "prod",
      clusters: {
        prod: { aw: { hosts: ["aw1"] } },
        lab: { aw: { hosts: ["lab-aw1"] } },
      },
    };
    expect(getCluster(config, "lab").aw.hosts).toEqual(["lab-aw1"]);
  });

  it("getServiceConfig returns service block with host/creds", () => {
    const cluster = {
      aw: { hosts: ["aw1.test"], username: "admin", password: "pass" },
    };
    const svc = getServiceConfig(cluster, "aw");
    expect(svc.host).toBe("aw1.test");
    expect(svc.username).toBe("admin");
  });

  it("getAllHosts returns normalized host objects", () => {
    const cluster = {
      diagnosticPortal: {
        hosts: [
          { host: "pg1.test", port: 7890 },
          { host: "aw1.test", port: 8443 },
        ],
        username: "admin",
        password: "pass",
      },
    };
    const hosts = getAllHosts(cluster, "diagnosticPortal");
    expect(hosts).toEqual([
      { host: "pg1.test", port: 7890 },
      { host: "aw1.test", port: 8443 },
    ]);
  });

  it("getAllHosts normalizes string hosts with default port", () => {
    const cluster = { vvb: { hosts: ["vvb1.test"], port: 443 } };
    const hosts = getAllHosts(cluster, "vvb");
    expect(hosts).toEqual([{ host: "vvb1.test", port: 443 }]);
  });
});
