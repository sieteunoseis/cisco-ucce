import { findOne } from "../api/aw.js";
import { registerAwResource, awClient } from "./_aw-resource.js";
import { runCommand } from "../utils/command.js";
import { finesseClientOrNull, liveState, mapLimit } from "./_finesse-live.js";

const t = (v) => (Array.isArray(v) ? v[0] : v);

export default (program) => {
  const cmd = registerAwResource(program, "skillgroup", "skillgroup");

  cmd
    .command("members <idOrName>")
    .description("List agents in a skill group (by AW ID or exact name)")
    .option("--host <host>", "AW host (default: first configured)")
    .option("--live", "Add live Finesse state for each agent")
    .action((term, options) =>
      runCommand(
        program,
        { command: "skillgroup members", endpoint: "/config/skillgroup" },
        async (meta) => {
          const { client, host } = awClient(program, options);
          meta.host = host;
          const sg = await findOne(client, "skillgroup", term);
          const agents = (sg.agents?.[0]?.agent || []).map((a) => ({
            agentId: t(a.agentId),
            userName: t(a.userName),
            firstName: t(a.firstName) || "",
            lastName: t(a.lastName) || "",
            team: t(a.agentTeam?.[0]?.name) || "",
          }));
          console.error(
            `${t(sg.name)} — ${agents.length} agent(s), Finesse queue ID ${t(sg.peripheralNumber)}`,
          );
          if (options.live && agents.length) {
            const fin = finesseClientOrNull(program);
            if (fin) {
              const states = await mapLimit(agents, 8, (a) =>
                liveState(fin, a.agentId),
              );
              agents.forEach((a, i) => {
                a.state = states[i].state;
                a.reasonCodeId = states[i].reasonCodeId || "";
                a.since = states[i].since || "";
              });
            }
          }
          return agents;
        },
      ),
    );
  return cmd;
};
