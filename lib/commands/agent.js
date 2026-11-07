import { findOne, extractRefId } from "../api/aw.js";
import { registerAwResource, awClient } from "./_aw-resource.js";
import { runCommand } from "../utils/command.js";
import {
  finesseClientOrNull,
  liveState,
  getUserQueues,
} from "./_finesse-live.js";

const t = (v) => (Array.isArray(v) ? v[0] : v);
const names = (wrapper, key) =>
  (wrapper?.[0]?.[key] || []).map((i) => t(i.name)).filter(Boolean);
const isDefault = (n) => /\.default$/i.test(n);

export function describeAgent(raw) {
  const person = raw.person?.[0] || {};
  const skillGroups = names(raw.skillGroups, "skillGroup");
  const routable = skillGroups.filter((n) => !isDefault(n));
  const attributes = (raw.agentAttributes?.[0]?.agentAttribute || []).map(
    (a) => `${t(a.attribute?.[0]?.name)}=${t(a.attributeValue)}`,
  );
  const warnings = [];
  if (!routable.length)
    warnings.push(
      skillGroups.length
        ? "Only in default skill group(s) — not routable; won't receive queue calls or appear in queue stats"
        : "No skill groups assigned",
    );
  if (t(person.loginEnabled) === "false") warnings.push("Login disabled");
  return {
    id: extractRefId(raw),
    agentId: t(raw.agentId),
    name: t(raw.name),
    fullName: [t(person.firstName), t(person.lastName)]
      .filter(Boolean)
      .join(" "),
    userName: t(person.userName) || "",
    loginEnabled: t(person.loginEnabled) || "",
    team: t(raw.agentTeam?.[0]?.name) || "",
    supervisor: t(raw.supervisor) || "",
    deskSettings: t(raw.agentDeskSettings?.[0]?.name) || "",
    defaultSkillGroup: t(raw.defaultSkillGroup?.[0]?.name) || "",
    skillGroups: skillGroups.join("; "),
    routableSkillGroups: routable.length,
    attributes: attributes.join("; "),
    warnings: warnings.join("; "),
  };
}

export default (program) => {
  const cmd = registerAwResource(program, "agent", "agent");

  cmd
    .command("show <idOrName>")
    .description(
      "Agent overview: team, skill groups (flags default-only), attributes, and live Finesse state/queues. Accepts AW ID, agent name, login or peripheral ID",
    )
    .option("--host <host>", "AW host (default: first configured)")
    .option("--no-live", "Skip the Finesse live-state lookup")
    .action((term, options) =>
      runCommand(
        program,
        { command: "agent show", endpoint: "/config/agent" },
        async (meta) => {
          const { client, host } = awClient(program, options);
          meta.host = host;
          const raw = await findOne(client, "agent", term);
          const info = describeAgent(raw);
          if (options.live) {
            const fin = finesseClientOrNull(program);
            if (fin) {
              const live = await liveState(fin, info.agentId);
              info.finesseState = live.state;
              if (live.reasonCodeId) info.reasonCodeId = live.reasonCodeId;
              info.finesseExtension = live.extension || "";
              info.finesseStateSince = live.since || "";
              try {
                info.finesseQueues = (await getUserQueues(fin, info.agentId))
                  .map((q) => `${q.name} (${q.id})`)
                  .join("; ");
              } catch (err) {
                info.finesseQueues = `unavailable (${err.message})`;
              }
            }
          }
          return [info];
        },
      ),
    );
  return cmd;
};
