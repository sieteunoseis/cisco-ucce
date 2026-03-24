import * as diagApi from "../api/diag.js";
import { getAllHosts } from "../utils/config.js";
import { resolvePassword } from "../utils/secrets.js";
import { output } from "../utils/output.js";
import { logAudit } from "../utils/audit.js";

function resolveHosts(config, hostFlag) {
  const dpConfig = config.diagnosticPortal;
  if (!dpConfig) throw new Error("diagnosticPortal not configured in cluster.");
  const allHosts = dpConfig.hosts || [];

  if (!hostFlag) {
    // Default: first host
    const first = allHosts[0];
    if (!first) throw new Error("No diagnostic portal hosts configured.");
    return [first];
  }

  if (hostFlag === "all") {
    return allHosts;
  }

  // Match by hostname (partial match OK)
  const match = allHosts.find(
    (h) => h.host === hostFlag || h.host.startsWith(hostFlag),
  );
  if (!match)
    throw new Error(
      `Host "${hostFlag}" not found in diagnostic portal config.`,
    );
  return [match];
}

function makeClient(hostEntry, config) {
  const dpConfig = config.diagnosticPortal;
  return diagApi.createDiagClient({
    host: hostEntry.host,
    port: hostEntry.port,
    username: dpConfig.username,
    password: resolvePassword(dpConfig.password),
    insecure: config.insecure,
  });
}

async function runOnHosts(
  config,
  hostFlag,
  commandName,
  endpoint,
  apiFn,
  globalOpts,
) {
  const hosts = resolveHosts(config, hostFlag);
  const isMulti = hosts.length > 1;
  let allResults = [];

  for (const hostEntry of hosts) {
    try {
      const client = makeClient(hostEntry, config);
      const data = await apiFn(client);
      const results = Array.isArray(data) ? data : [data];
      if (isMulti) {
        // Prepend hostname column
        for (const item of results) {
          allResults.push({ host: hostEntry.host, ...flattenDiagResult(item) });
        }
      } else {
        allResults = results.map(flattenDiagResult);
      }
      if (!globalOpts.noAudit) {
        logAudit({
          command: commandName,
          host: hostEntry.host,
          endpoint,
          status: 200,
        });
      }
    } catch (err) {
      if (isMulti) {
        // Show error inline, continue
        console.error(`${hostEntry.host}: ${err.message}`);
      } else {
        throw err;
      }
    }
  }

  return allResults;
}

function flattenDiagResult(data) {
  if (typeof data === "string") return { result: data };
  if (typeof data !== "object" || data === null)
    return { result: String(data) };
  // For XML-parsed results, try to flatten one level
  const flat = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === "$" || key === "?xml") continue;
    if (
      Array.isArray(value) &&
      value.length === 1 &&
      typeof value[0] === "string"
    ) {
      flat[key] = value[0];
    } else if (typeof value === "string") {
      flat[key] = value;
    } else {
      flat[key] = JSON.stringify(value);
    }
  }
  return Object.keys(flat).length ? flat : { result: JSON.stringify(data) };
}

export default function (program) {
  const diag = program
    .command("diag")
    .description("Diagnostic Portal commands");

  // Simple subcommands with no extra params
  const simpleCommands = [
    [
      "list-processes",
      "List running processes",
      "ListProcesses",
      diagApi.listProcesses,
    ],
    ["list-services", "List services", "ListServices", diagApi.listServices],
    [
      "version",
      "Show product version",
      "GetProductVersion",
      diagApi.getProductVersion,
    ],
    [
      "license",
      "Show product license",
      "GetProductLicense",
      diagApi.getProductLicense,
    ],
    ["netstat", "Show network statistics", "GetNetStat", diagApi.getNetStat],
    ["trace-level", "Show trace level", "GetTraceLevel", diagApi.getTraceLevel],
    ["alarms", "Show alarms", "GetAlarms", diagApi.getAlarms],
    [
      "trace-components",
      "List trace components",
      "ListTraceComponents",
      diagApi.listTraceComponents,
    ],
    [
      "log-components",
      "List log components",
      "ListLogComponents",
      diagApi.listLogComponents,
    ],
    [
      "app-servers",
      "List application servers",
      "ListAppServers",
      diagApi.listAppServers,
    ],
    [
      "config-categories",
      "List configuration categories",
      "ListConfigurationCategories",
      diagApi.listConfigCategories,
    ],
    ["traceroute", "Run traceroute", "GetTraceRoute", diagApi.getTraceRoute],
    ["ping", "Run ping", "GetPing", diagApi.getPing],
    [
      "perf-counter",
      "Get performance counter value",
      "GetPerfCounterValue",
      diagApi.getPerfCounterValue,
    ],
  ];

  for (const [name, desc, endpoint, fn] of simpleCommands) {
    diag
      .command(name)
      .description(desc)
      .option("--host <host>", 'Target host (or "all")')
      .action(async (options) => {
        try {
          const results = await runOnHosts(
            program._resolvedConfig,
            options.host,
            `diag ${name}`,
            endpoint,
            fn,
            program.opts(),
          );
          await output(results, program.opts().format);
        } catch (err) {
          console.error(err.message);
          process.exitCode = 1;
        }
      });
  }

  // Commands with extra params
  diag
    .command("ipconfig")
    .description("Show IP configuration")
    .option("--host <host>", 'Target host (or "all")')
    .option("--args <args>", 'Arguments (e.g. "/all")')
    .action(async (options) => {
      try {
        const results = await runOnHosts(
          program._resolvedConfig,
          options.host,
          "diag ipconfig",
          "GetIPConfig",
          (client) => diagApi.getIPConfig(client, options.args),
          program.opts(),
        );
        await output(results, program.opts().format);
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
      }
    });

  diag
    .command("perf")
    .description("Get performance information")
    .option("--host <host>", 'Target host (or "all")')
    .option("--component <comp>", "Component path")
    .action(async (options) => {
      try {
        const results = await runOnHosts(
          program._resolvedConfig,
          options.host,
          "diag perf",
          "GetPerformanceInformation",
          (client) => diagApi.getPerformanceInfo(client, options.component),
          program.opts(),
        );
        await output(results, program.opts().format);
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
      }
    });

  diag
    .command("config-category <category>")
    .description("Get configuration category")
    .option("--host <host>", 'Target host (or "all")')
    .action(async (category, options) => {
      try {
        const results = await runOnHosts(
          program._resolvedConfig,
          options.host,
          "diag config-category",
          "GetConfigurationCategory",
          (client) => diagApi.getConfigCategory(client, category),
          program.opts(),
        );
        await output(results, program.opts().format);
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
      }
    });

  diag
    .command("trace-files <component>")
    .description(
      "List trace files for a component (e.g. 'Peripheral Gateway 1A/opc')",
    )
    .option("--host <host>", "Target host")
    .option("--hours <n>", "Hours of history (default: 12)", parseInt)
    .action(async (component, options) => {
      try {
        const results = await runOnHosts(
          program._resolvedConfig,
          options.host,
          "diag trace-files",
          "ListTraceFiles",
          (client) =>
            diagApi.listTraceFiles(client, component, {
              fromHours: options.hours || 12,
            }),
          program.opts(),
        );
        await output(results, program.opts().format);
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
      }
    });

  diag
    .command("log-files <component>")
    .description("List log files for a component (e.g. 'EventLog')")
    .option("--host <host>", "Target host")
    .option("--hours <n>", "Hours of history (default: 12)", parseInt)
    .action(async (component, options) => {
      try {
        const results = await runOnHosts(
          program._resolvedConfig,
          options.host,
          "diag log-files",
          "ListLogFiles",
          (client) =>
            diagApi.listLogFiles(client, component, {
              fromHours: options.hours || 12,
            }),
          program.opts(),
        );
        await output(results, program.opts().format);
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
      }
    });

  diag
    .command("download-trace <component> <file>")
    .description("Download a trace file")
    .option("--host <host>", "Target host")
    .option("-o, --output <path>", "Output file path")
    .action(async (component, file, options) => {
      try {
        const config = program._resolvedConfig;
        const hosts = resolveHosts(config, options.host);
        const hostEntry = hosts[0];
        const client = makeClient(hostEntry, config);
        const outputPath = options.output || file;
        const result = await diagApi.downloadTraceFile(
          client,
          component,
          file,
          outputPath,
        );
        console.log(`Downloaded ${result.file} (${result.size} bytes)`);
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
      }
    });

  diag
    .command("download-log <component> <file>")
    .description("Download a log file")
    .option("--host <host>", "Target host")
    .option("-o, --output <path>", "Output file path")
    .action(async (component, file, options) => {
      try {
        const config = program._resolvedConfig;
        const hosts = resolveHosts(config, options.host);
        const hostEntry = hosts[0];
        const client = makeClient(hostEntry, config);
        const outputPath = options.output || file;
        const result = await diagApi.downloadLogFile(
          client,
          component,
          file,
          outputPath,
        );
        console.log(`Downloaded ${result.file} (${result.size} bytes)`);
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
      }
    });
}
