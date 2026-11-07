import { createVvbClient, getActiveCalls } from "../api/vvb.js";
import { clientConfig, hostsFor, runOnHosts } from "../utils/command.js";
import { watchLoop } from "../utils/sparkline.js";

export default function (program) {
  const vvb = program.command("vvb").description("VVB API commands");

  vvb
    .command("active-calls")
    .description("Show active calls on VVB")
    .option("--host <host>", 'Target VVB host (or "all")')
    .option(
      "--watch [seconds]",
      "Live monitoring with sparklines (default: 5s, single host only)",
    )
    .action(async (options) => {
      try {
        const watching = options.watch !== undefined;
        const hosts = hostsFor(program, "vvb", options, {
          allowAll: !watching,
        });
        const client = (h) => createVvbClient(clientConfig(program, "vvb", h));

        if (watching) {
          const interval =
            typeof options.watch === "string" ? parseInt(options.watch) : 5;
          const c = client(hosts[0]);
          await watchLoop({
            fetchFn: () => getActiveCalls(c),
            fields: [
              "totalConcurrentCalls",
              "totalCPS",
              "ringtoneCPS",
              "whisperCPS",
              "agentGreetingCPS",
            ],
            interval,
            label: `VVB Active Calls: ${hosts[0].host}`,
          });
          return;
        }

        await runOnHosts(
          program,
          {
            command: "vvb active-calls",
            endpoint: "/adminapi/vvbStats/activeCalls",
            hosts,
          },
          (h) => getActiveCalls(client(h)),
        );
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
      }
    });
}
