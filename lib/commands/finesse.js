import {
  createFinesseClient,
  getSystemInfo,
  getUsers,
  getQueue,
  getTeams,
  getReasonCodes,
  getWrapUpReasons,
  getPhoneBooks,
  getTeam,
} from "../api/finesse.js";
import { findOne } from "../api/aw.js";
import { awClient } from "./_aw-resource.js";
import { clientConfig, hostsFor, runCommand } from "../utils/command.js";
import { watchLoop } from "../utils/sparkline.js";

export default function (program) {
  const finesse = program
    .command("finesse")
    .description("Finesse API commands");

  function finesseClient(options, meta) {
    const [h] = hostsFor(program, "finesse", options, { allowAll: false });
    const cfg = clientConfig(program, "finesse", h);
    if (meta) meta.host = cfg.host;
    return createFinesseClient(cfg);
  }

  // Simple list/info commands: [name, description, endpoint, fn, wrapInArray]
  const simple = [
    [
      "system-info",
      "Show Finesse system information",
      "/finesse/api/SystemInfo",
      getSystemInfo,
      true,
    ],
    ["users", "List Finesse users/agents", "/finesse/api/Users", getUsers],
    ["teams", "List Finesse teams", "/finesse/api/Teams", getTeams],
    [
      "wrapup-reasons",
      "List wrap-up reasons",
      "/finesse/api/WrapUpReasons",
      getWrapUpReasons,
    ],
    [
      "phonebooks",
      "List phone books",
      "/finesse/api/PhoneBooks",
      getPhoneBooks,
    ],
  ];
  for (const [name, desc, endpoint, fn, wrap] of simple) {
    finesse
      .command(name)
      .description(desc)
      .option("--host <host>", "Finesse host (default: first configured)")
      .action((options) =>
        runCommand(
          program,
          { command: `finesse ${name}`, endpoint },
          async (meta) => {
            const data = await fn(finesseClient(options, meta));
            return wrap ? [data] : data;
          },
        ),
      );
  }

  finesse
    .command("reason-codes")
    .description("List reason codes")
    .option("--category <cat>", "Category (NOT_READY or LOGOUT)", "NOT_READY")
    .option("--host <host>", "Finesse host (default: first configured)")
    .action((options) =>
      runCommand(
        program,
        {
          command: "finesse reason-codes",
          endpoint: "/finesse/api/ReasonCodes",
        },
        async (meta) =>
          getReasonCodes(finesseClient(options, meta), options.category),
      ),
    );

  // Finesse queue IDs are the skill group's peripheral number, not its AW ID.
  async function queueId(term) {
    if (/^\d+$/.test(term)) return term;
    const { client } = awClient(program, {});
    const sg = await findOne(client, "skillgroup", term);
    return sg.peripheralNumber?.[0];
  }

  async function teamId(client, term) {
    if (/^\d+$/.test(term)) return term;
    const teams = await getTeams(client);
    const match = teams.find(
      (t) => t.name?.toLowerCase() === term.toLowerCase(),
    );
    if (!match) {
      const near = teams
        .filter((t) => t.name?.toLowerCase().includes(term.toLowerCase()))
        .slice(0, 10)
        .map((t) => `${t.name} (${t.id})`);
      throw new Error(
        `No team named "${term}".${near.length ? ` Did you mean: ${near.join(", ")}` : ""}`,
      );
    }
    return match.id;
  }

  finesse
    .command("team <idOrName>")
    .description("List a team's agents with live state")
    .option("--host <host>", "Finesse host (default: first configured)")
    .action((term, options) =>
      runCommand(
        program,
        { command: "finesse team", endpoint: "/finesse/api/Team" },
        async (meta) => {
          const client = finesseClient(options, meta);
          const team = await getTeam(client, await teamId(client, term));
          if (!team) throw new Error(`Team ${term} not found.`);
          console.error(
            `${team.name} (${team.id}) — ${team.users.length} agent(s)`,
          );
          return team.users;
        },
      ),
    );

  finesse
    .command("queue <idOrName>")
    .description(
      "Get queue statistics by Finesse queue ID (skill group peripheral number) or skill group name",
    )
    .option("--host <host>", "Finesse host (default: first configured)")
    .option(
      "--watch [seconds]",
      "Live monitoring with sparklines (default: 5s)",
    )
    .action(async (term, options) => {
      let id;
      try {
        id = await queueId(term);
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
        return;
      }
      if (options.watch !== undefined) {
        try {
          const client = finesseClient(options);
          const interval =
            typeof options.watch === "string" ? parseInt(options.watch) : 5;
          await watchLoop({
            fetchFn: () => getQueue(client, id),
            fields: [
              "callsInQueue",
              "agentsLoggedOn",
              "agentsReady",
              "agentsNotReady",
              "agentsTalkingInbound",
              "agentsTalkingOutbound",
              "agentsWrapUpReady",
              "agentsWrapUpNotReady",
              "agentsBusyOther",
            ],
            interval,
            label: `Finesse Queue: ${id}`,
          });
        } catch (err) {
          console.error(err.message);
          process.exitCode = 1;
        }
        return;
      }
      await runCommand(
        program,
        { command: "finesse queue", endpoint: `/finesse/api/Queue/${id}` },
        async (meta) => {
          const queue = await getQueue(finesseClient(options, meta), id);
          if (!queue) throw new Error(`Queue ${id} not found.`);
          return [queue];
        },
      );
    });
}
