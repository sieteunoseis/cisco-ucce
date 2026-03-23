import {
  createCvpOpsClient,
  createCvpOrmClient,
  getVersion,
  getServers,
  getProperties,
} from "../api/cvp.js";
import { resolvePassword } from "../utils/secrets.js";
import { output } from "../utils/output.js";
import { logAudit } from "../utils/audit.js";

export default function (program) {
  const cvp = program.command("cvp").description("CVP API commands");

  cvp
    .command("version")
    .description("Show CVP version")
    .action(async () => {
      try {
        const cfg = {
          ...program._resolvedConfig.cvpOps,
          insecure: program._resolvedConfig.insecure,
        };
        cfg.password = resolvePassword(cfg.password);
        const client = createCvpOpsClient(cfg);
        const version = await getVersion(client);
        if (!program.opts().noAudit)
          logAudit({
            command: "cvp version",
            host: cfg.host,
            endpoint: "/cvp-config/version",
            status: 200,
          });
        await output([version], program.opts().format);
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
      }
    });

  cvp
    .command("servers")
    .description("List CVP servers")
    .action(async () => {
      try {
        const cfg = {
          ...program._resolvedConfig.cvpOps,
          insecure: program._resolvedConfig.insecure,
        };
        cfg.password = resolvePassword(cfg.password);
        const client = createCvpOpsClient(cfg);
        const servers = await getServers(client);
        if (!program.opts().noAudit)
          logAudit({
            command: "cvp servers",
            host: cfg.host,
            endpoint: "/cvp-config/server",
            status: 200,
          });
        await output(servers, program.opts().format);
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
      }
    });

  cvp
    .command("properties")
    .description("Show CVP call server properties")
    .option("--host <host>", "Target CVP call server")
    .action(async (options) => {
      try {
        const config = program._resolvedConfig;
        const callServers = config.cvpCallServers?.hosts || [];
        const targetHost = options.host || callServers[0];
        if (!targetHost) {
          console.error("No CVP call servers configured.");
          process.exitCode = 1;
          return;
        }

        // CVP ORM uses AW credentials
        const awCfg = config.aw;
        const ormCfg = {
          host: targetHost,
          port: config.cvpCallServers?.port || 8111,
          username: awCfg.username,
          password: resolvePassword(awCfg.password),
          insecure: config.insecure,
        };
        const client = createCvpOrmClient(ormCfg);
        const props = await getProperties(client);
        if (!program.opts().noAudit)
          logAudit({
            command: "cvp properties",
            host: targetHost,
            endpoint: "/cvp-orm/rest/cvpconfig/properties",
            status: 200,
          });
        await output(props, program.opts().format);
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
      }
    });
}
