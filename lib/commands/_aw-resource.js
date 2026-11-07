import {
  createAwClient,
  list as awList,
  findOne,
  flattenItem,
} from "../api/aw.js";
import { clientConfig, hostsFor, runCommand } from "../utils/command.js";

export function awClient(program, options) {
  const [h] = hostsFor(program, "aw", options, { allowAll: false });
  const cfg = clientConfig(program, "aw", h);
  return { client: createAwClient(cfg), host: cfg.host };
}

function positiveInt(name) {
  return (v) => {
    const n = parseInt(v, 10);
    if (!Number.isInteger(n) || n < 1)
      throw new Error(`${name} must be a positive integer (got "${v}")`);
    return n;
  };
}

export function registerAwResource(program, name, resource, opts = {}) {
  const cmd = program.command(name).description(`Manage ${name} resources`);

  cmd
    .command("list")
    .description(`List all ${name}s`)
    .option("--page <n>", "Page number (starts at 1)", positiveInt("--page"))
    .option("--page-size <n>", "Results per page", positiveInt("--page-size"))
    .option(
      "--filter <text>",
      "Server-side search (AW q= query, e.g. a name fragment)",
    )
    .option("--host <host>", "AW host (default: first configured)")
    .action((options) =>
      runCommand(
        program,
        { command: `${name} list`, endpoint: `/config/${resource}` },
        async (meta) => {
          const { client, host } = awClient(program, options);
          meta.host = host;
          return awList(client, resource, {
            page: options.page,
            pageSize: options.pageSize,
            q: options.filter,
          });
        },
      ),
    );

  if (opts.noGet !== true) {
    cmd
      .command("get <idOrName>")
      .description(`Get a single ${name} by ID or name`)
      .option("--host <host>", "AW host (default: first configured)")
      .action((id, options) =>
        runCommand(
          program,
          { command: `${name} get`, endpoint: `/config/${resource}/${id}` },
          async (meta) => {
            const { client, host } = awClient(program, options);
            meta.host = host;
            return [flattenItem(await findOne(client, resource, id))];
          },
        ),
      );
  }

  return cmd;
}
