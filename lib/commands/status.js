import { getStatus } from "../api/aw.js";
import { runCommand } from "../utils/command.js";
import { awClient } from "./_aw-resource.js";

export default function (program) {
  program
    .command("status")
    .description("Show system-wide status from AW")
    .option("--host <host>", "AW host (default: first configured)")
    .action((options) =>
      runCommand(
        program,
        { command: "status", endpoint: "/config/status" },
        async (meta) => {
          const { client, host } = awClient(program, options);
          meta.host = host;
          const data = await getStatus(client);
          return Array.isArray(data) ? data : [data];
        },
      ),
    );
}
