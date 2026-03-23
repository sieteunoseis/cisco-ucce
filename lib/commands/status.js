import { createAwClient, getStatus } from "../api/aw.js";
import { resolvePassword } from "../utils/secrets.js";
import { output } from "../utils/output.js";
import { logAudit } from "../utils/audit.js";

export default function (program) {
  program
    .command("status")
    .description("Show system-wide status from AW")
    .action(async () => {
      const globalOpts = program.opts();
      try {
        const svc = program._resolvedConfig.aw;
        svc.password = resolvePassword(svc.password);
        const client = createAwClient(svc);
        const data = await getStatus(client);
        if (!globalOpts.noAudit) {
          logAudit({
            command: "status",
            host: svc.host,
            endpoint: "/config/status",
            status: 200,
          });
        }
        await output(Array.isArray(data) ? data : [data], globalOpts.format);
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
      }
    });
}
