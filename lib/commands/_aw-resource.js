import { createAwClient, list as awList, getById } from "../api/aw.js";
import { resolvePassword } from "../utils/secrets.js";
import { output } from "../utils/output.js";
import { logAudit } from "../utils/audit.js";

export function registerAwResource(program, name, resource, opts = {}) {
  const cmd = program.command(name).description(`Manage ${name} resources`);

  cmd
    .command("list")
    .description(`List all ${name}s`)
    .option("--page <n>", "Page number", parseInt)
    .option("--page-size <n>", "Results per page", parseInt)
    .action(async (options) => {
      const globalOpts = program.opts();
      try {
        const svc = program._resolvedConfig.aw;
        svc.password = resolvePassword(svc.password);
        const client = createAwClient(svc);
        const items = await awList(client, resource, {
          page: options.page,
          pageSize: options.pageSize,
        });
        if (!globalOpts.noAudit) {
          logAudit({
            command: `${name} list`,
            host: svc.host,
            endpoint: `/config/${resource}`,
            status: 200,
          });
        }
        await output(items, globalOpts.format);
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
      }
    });

  if (opts.noGet !== true) {
    cmd
      .command("get <id>")
      .description(`Get a single ${name} by ID`)
      .action(async (id) => {
        const globalOpts = program.opts();
        try {
          const svc = program._resolvedConfig.aw;
          svc.password = resolvePassword(svc.password);
          const client = createAwClient(svc);
          const item = await getById(client, resource, id);
          if (!item) {
            console.error(`${name} ${id} not found.`);
            process.exitCode = 1;
            return;
          }
          if (!globalOpts.noAudit) {
            logAudit({
              command: `${name} get`,
              host: svc.host,
              endpoint: `/config/${resource}/${id}`,
              status: 200,
            });
          }
          await output([item], globalOpts.format);
        } catch (err) {
          console.error(err.message);
          process.exitCode = 1;
        }
      });
  }

  return cmd;
}
