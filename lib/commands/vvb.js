import { createVvbClient, getActiveCalls } from "../api/vvb.js";
import { resolvePassword } from "../utils/secrets.js";
import { output } from "../utils/output.js";
import { logAudit } from "../utils/audit.js";
import { watchLoop } from "../utils/sparkline.js";

function resolveVvbHosts(config, hostFlag) {
  const vvbConfig = config.vvb;
  if (!vvbConfig) throw new Error("vvb not configured in cluster.");
  const allHosts = (vvbConfig.hosts || []).map((h) =>
    typeof h === "object" ? h : { host: h, port: vvbConfig.port || 443 },
  );

  if (!hostFlag) return [allHosts[0]].filter(Boolean);
  if (hostFlag === "all") return allHosts;
  const match = allHosts.find(
    (h) => h.host === hostFlag || h.host.startsWith(hostFlag),
  );
  if (!match) throw new Error(`VVB host "${hostFlag}" not found.`);
  return [match];
}

export default function (program) {
  const vvb = program.command("vvb").description("VVB API commands");

  vvb
    .command("active-calls")
    .description("Show active calls on VVB")
    .option("--host <host>", 'Target VVB host (or "all")')
    .option(
      "--watch [seconds]",
      "Live monitoring with sparklines (default: 5s)",
    )
    .action(async (options) => {
      try {
        const config = program._resolvedConfig;
        const hosts = resolveVvbHosts(config, options.host);

        if (options.watch !== undefined) {
          const interval =
            typeof options.watch === "string" ? parseInt(options.watch) : 5;
          const hostEntry = hosts[0];
          const client = createVvbClient({
            host: hostEntry.host,
            port: hostEntry.port,
            username: config.vvb.username,
            password: resolvePassword(config.vvb.password),
            insecure: config.insecure,
          });
          await watchLoop({
            fetchFn: () => getActiveCalls(client),
            fields: [
              "totalConcurrentCalls",
              "totalCPS",
              "ringtoneCPS",
              "whisperCPS",
              "agentGreetingCPS",
            ],
            interval,
            label: `VVB Active Calls: ${hostEntry.host}`,
          });
          return;
        }

        const isMulti = hosts.length > 1;
        let allResults = [];

        for (const hostEntry of hosts) {
          try {
            const client = createVvbClient({
              host: hostEntry.host,
              port: hostEntry.port,
              username: config.vvb.username,
              password: resolvePassword(config.vvb.password),
              insecure: config.insecure,
            });
            const data = await getActiveCalls(client);
            const results = Array.isArray(data) ? data : [data];
            if (isMulti) {
              for (const item of results) {
                allResults.push({
                  host: hostEntry.host,
                  ...(typeof item === "object" ? item : { result: item }),
                });
              }
            } else {
              allResults = results;
            }
            if (!program.opts().noAudit) {
              logAudit({
                command: "vvb active-calls",
                host: hostEntry.host,
                endpoint: "/adminapi/vvbStats/activeCalls",
                status: 200,
              });
            }
          } catch (err) {
            if (isMulti) {
              console.error(`${hostEntry.host}: ${err.message}`);
            } else {
              throw err;
            }
          }
        }

        await output(allResults, program.opts().format);
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
      }
    });
}
