import {
  createCvpOpsClient,
  createCvpOrmClient,
  getVersion,
  getServers,
  getProperties,
} from "../api/cvp.js";
import {
  clientConfig,
  hostsFor,
  runCommand,
  runOnHosts,
} from "../utils/command.js";

export default function (program) {
  const cvp = program.command("cvp").description("CVP API commands");

  function opsClient(meta) {
    const ops = program._resolvedConfig.cvpOps;
    if (!ops?.host) throw new Error("cvpOps not configured in cluster.");
    const cfg = clientConfig(program, "cvpOps", {
      host: ops.host,
      port: ops.port || 8111,
    });
    meta.host = cfg.host;
    return createCvpOpsClient(cfg);
  }

  cvp
    .command("version")
    .description("Show CVP version")
    .action(() =>
      runCommand(
        program,
        { command: "cvp version", endpoint: "/cvp-config/version" },
        async (meta) => [await getVersion(opsClient(meta))],
      ),
    );

  cvp
    .command("servers")
    .description("List CVP servers")
    .action(() =>
      runCommand(
        program,
        { command: "cvp servers", endpoint: "/cvp-config/server" },
        async (meta) => getServers(opsClient(meta)),
      ),
    );

  cvp
    .command("properties")
    .description("Show CVP call server properties (uses AW credentials)")
    .option("--host <host>", 'Target CVP call server (or "all")')
    .action(async (options) => {
      try {
        const hosts = hostsFor(program, "cvpCallServers", options);
        await runOnHosts(
          program,
          {
            command: "cvp properties",
            endpoint: "/cvp-orm/rest/cvpconfig/properties",
            hosts,
          },
          (h) =>
            getProperties(
              createCvpOrmClient(
                clientConfig(program, "cvpCallServers", h, "aw"),
              ),
            ),
        );
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
      }
    });
}
