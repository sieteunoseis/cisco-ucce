import * as diagApi from "../api/diag.js";
import path from "path";
import { clientConfig, hostsFor, runOnHosts, audit } from "../utils/command.js";

function diagHosts(program, options) {
  return hostsFor(program, "diagnosticPortal", options);
}

function makeClient(program, hostEntry) {
  return diagApi.createDiagClient(
    clientConfig(program, "diagnosticPortal", hostEntry),
  );
}

async function runDiag(program, options, command, endpoint, apiFn) {
  try {
    const hosts = diagHosts(program, options);
    await runOnHosts(program, { command, endpoint, hosts }, async (h) => {
      const data = await apiFn(makeClient(program, h));
      return (Array.isArray(data) ? data : [data]).map(flattenDiagResult);
    });
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
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
      .action((options) =>
        runDiag(program, options, `diag ${name}`, endpoint, fn),
      );
  }

  // Commands with extra params
  diag
    .command("ipconfig")
    .description("Show IP configuration")
    .option("--host <host>", 'Target host (or "all")')
    .option("--args <args>", 'Arguments (e.g. "/all")')
    .action((options) =>
      runDiag(program, options, "diag ipconfig", "GetIPConfig", (client) =>
        diagApi.getIPConfig(client, options.args),
      ),
    );

  diag
    .command("perf")
    .description("Get performance information")
    .option("--host <host>", 'Target host (or "all")')
    .option("--component <comp>", "Component path")
    .action((options) =>
      runDiag(
        program,
        options,
        "diag perf",
        "GetPerformanceInformation",
        (client) => diagApi.getPerformanceInfo(client, options.component),
      ),
    );

  diag
    .command("config-category <category>")
    .description("Get configuration category")
    .option("--host <host>", 'Target host (or "all")')
    .action((category, options) =>
      runDiag(
        program,
        options,
        "diag config-category",
        "GetConfigurationCategory",
        (client) => diagApi.getConfigCategory(client, category),
      ),
    );

  diag
    .command("trace-files <component>")
    .description(
      "List trace files for a component (e.g. 'Peripheral Gateway 1A/opc')",
    )
    .option("--host <host>", "Target host")
    .option("--hours <n>", "Hours of history (default: 12)", parseInt)
    .action((component, options) =>
      runDiag(
        program,
        options,
        "diag trace-files",
        "ListTraceFiles",
        (client) =>
          diagApi.listTraceFiles(client, component, {
            fromHours: options.hours || 12,
          }),
      ),
    );

  diag
    .command("log-files <component>")
    .description("List log files for a component (e.g. 'EventLog')")
    .option("--host <host>", "Target host")
    .option("--hours <n>", "Hours of history (default: 12)", parseInt)
    .action((component, options) =>
      runDiag(program, options, "diag log-files", "ListLogFiles", (client) =>
        diagApi.listLogFiles(client, component, {
          fromHours: options.hours || 12,
        }),
      ),
    );

  diag
    .command("download-trace <component> <file>")
    .description("Download a trace file")
    .option("--host <host>", "Target host")
    .option(
      "-o, --output <path>",
      "Output file path (default: file name in current dir)",
    )
    .option("--force", "Overwrite the output file if it exists")
    .action(async (component, file, options) => {
      const meta = {
        command: "diag download-trace",
        endpoint: "DownloadTraceFile",
      };
      try {
        const [h] = hostsFor(program, "diagnosticPortal", options, {
          allowAll: false,
        });
        meta.host = h.host;
        const outputPath = options.output || path.win32.basename(file);
        const result = await diagApi.downloadTraceFile(
          makeClient(program, h),
          component,
          file,
          outputPath,
          { force: options.force },
        );
        audit(program, { ...meta, status: 200 });
        console.log(`Downloaded ${result.file} (${result.size} bytes)`);
      } catch (err) {
        audit(program, {
          ...meta,
          status: err.status || "error",
          error: err.message,
        });
        console.error(err.message);
        process.exitCode = 1;
      }
    });

  diag
    .command("download-log <component> <file>")
    .description("Download a log file")
    .option("--host <host>", "Target host")
    .option(
      "-o, --output <path>",
      "Output file path (default: file name in current dir)",
    )
    .option("--force", "Overwrite the output file if it exists")
    .action(async (component, file, options) => {
      const meta = {
        command: "diag download-log",
        endpoint: "DownloadLogFile",
      };
      try {
        const [h] = hostsFor(program, "diagnosticPortal", options, {
          allowAll: false,
        });
        meta.host = h.host;
        const outputPath = options.output || path.win32.basename(file);
        const result = await diagApi.downloadLogFile(
          makeClient(program, h),
          component,
          file,
          outputPath,
          { force: options.force },
        );
        audit(program, { ...meta, status: 200 });
        console.log(`Downloaded ${result.file} (${result.size} bytes)`);
      } catch (err) {
        audit(program, {
          ...meta,
          status: err.status || "error",
          error: err.message,
        });
        console.error(err.message);
        process.exitCode = 1;
      }
    });
}
