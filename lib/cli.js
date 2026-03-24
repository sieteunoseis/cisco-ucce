import { Command } from "commander";
import { loadConfig, getCluster, getServiceConfig } from "./utils/config.js";

// AW resource commands
import registerAgent from "./commands/agent.js";
import registerSkillgroup from "./commands/skillgroup.js";
import registerCalltype from "./commands/calltype.js";
import registerPrecisionqueue from "./commands/precisionqueue.js";
import registerAttribute from "./commands/attribute.js";
import registerExpandedcallvariable from "./commands/expandedcallvariable.js";
import registerMediaroutingdomain from "./commands/mediaroutingdomain.js";
import registerBucketinterval from "./commands/bucketinterval.js";
import registerDialednumber from "./commands/dialednumber.js";
import registerPeripheralgateway from "./commands/peripheralgateway.js";
import registerDepartment from "./commands/department.js";
import registerInventory from "./commands/inventory.js";
import registerAgentteam from "./commands/agentteam.js";
import registerStatus from "./commands/status.js";

// Service commands
import registerFinesse from "./commands/finesse.js";
import registerCvp from "./commands/cvp.js";
import registerDiag from "./commands/diag.js";
import registerVvb from "./commands/vvb.js";

// Management commands
import registerCluster from "./commands/cluster.js";
import registerDoctor from "./commands/doctor.js";

const program = new Command();

program
  .name("cisco-ucce")
  .description("Monitor and troubleshoot Cisco UCCE 12.6")
  .version("1.0.0")
  .option("--format <type>", "output format: table, json, toon, csv", "table")
  .option("--host <host>", "target hostname (overrides config)")
  .option("--username <user>", "username (overrides config/env)")
  .option("--password <pass>", "password (overrides config/env)")
  .option("--cluster <name>", "use a specific named cluster")
  .option("--insecure", "skip TLS certificate verification")
  .option("--no-audit", "disable audit logging for this command")
  .option("--debug", "enable debug logging");

// Resolve config before any command runs (except cluster/doctor which handle their own config)
program.hook("preAction", (thisCommand, actionCommand) => {
  // Skip config resolution for cluster management commands (they manage config directly)
  const rootCmd = actionCommand.parent?.name() || actionCommand.name();
  if (rootCmd === "config") return;

  const opts = program.opts();

  try {
    const config = loadConfig();
    const cluster = getCluster(config, opts.cluster);

    // Apply auth precedence: CLI flags > env vars > config
    // For each service, override username/password if CLI flags or env vars are set
    const overrideUsername = opts.username || process.env.CISCO_UCCE_USERNAME;
    const overridePassword = opts.password || process.env.CISCO_UCCE_PASSWORD;

    // Build resolved config with first host pre-selected for each service
    const resolved = { ...cluster };

    // Resolve first host for services that use hosts[] array
    for (const svc of ["aw", "finesse", "vvb"]) {
      if (resolved[svc]?.hosts?.length) {
        const firstHost =
          typeof resolved[svc].hosts[0] === "object"
            ? resolved[svc].hosts[0].host
            : resolved[svc].hosts[0];
        resolved[svc] = { ...resolved[svc], host: firstHost };
      }
    }

    // Apply CLI/env overrides
    if (overrideUsername || overridePassword) {
      for (const svc of [
        "aw",
        "finesse",
        "cvpOps",
        "diagnosticPortal",
        "vvb",
      ]) {
        if (resolved[svc]) {
          if (overrideUsername)
            resolved[svc] = { ...resolved[svc], username: overrideUsername };
          if (overridePassword)
            resolved[svc] = { ...resolved[svc], password: overridePassword };
        }
      }
    }

    // Apply --insecure flag
    if (opts.insecure) {
      resolved.insecure = true;
    }

    program._resolvedConfig = resolved;
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
});

// Register all commands
registerAgent(program);
registerSkillgroup(program);
registerCalltype(program);
registerPrecisionqueue(program);
registerAttribute(program);
registerExpandedcallvariable(program);
registerMediaroutingdomain(program);
registerBucketinterval(program);
registerDialednumber(program);
registerPeripheralgateway(program);
registerDepartment(program);
registerInventory(program);
registerAgentteam(program);
registerStatus(program);
registerFinesse(program);
registerCvp(program);
registerDiag(program);
registerVvb(program);
registerCluster(program);
registerDoctor(program);

export function run(argv) {
  program.parseAsync(argv).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
