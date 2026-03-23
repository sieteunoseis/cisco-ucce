import {
  createFinesseClient,
  getSystemInfo,
  getUsers,
  getQueue,
  getTeams,
  getReasonCodes,
  getWrapUpReasons,
  getPhoneBooks,
} from "../api/finesse.js";
import { resolvePassword } from "../utils/secrets.js";
import { output } from "../utils/output.js";
import { logAudit } from "../utils/audit.js";
import { watchLoop } from "../utils/sparkline.js";

export default function (program) {
  const finesse = program
    .command("finesse")
    .description("Finesse API commands");

  function getClient() {
    const svc = {
      ...program._resolvedConfig.finesse,
      insecure: program._resolvedConfig.insecure,
    };
    svc.password = resolvePassword(svc.password);
    return createFinesseClient(svc);
  }

  finesse
    .command("system-info")
    .description("Show Finesse system information")
    .action(async () => {
      try {
        const client = getClient();
        const info = await getSystemInfo(client);
        if (!program.opts().noAudit)
          logAudit({
            command: "finesse system-info",
            host: program._resolvedConfig.finesse.host,
            endpoint: "/finesse/api/SystemInfo",
            status: 200,
          });
        await output([info], program.opts().format);
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
      }
    });

  finesse
    .command("users")
    .description("List Finesse users/agents")
    .action(async () => {
      try {
        const client = getClient();
        const users = await getUsers(client);
        if (!program.opts().noAudit)
          logAudit({
            command: "finesse users",
            host: program._resolvedConfig.finesse.host,
            endpoint: "/finesse/api/Users",
            status: 200,
          });
        await output(users, program.opts().format);
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
      }
    });

  finesse
    .command("queue <id>")
    .description("Get queue statistics by ID")
    .option(
      "--watch [seconds]",
      "Live monitoring with sparklines (default: 5s)",
    )
    .action(async (id, options) => {
      try {
        const client = getClient();

        if (options.watch !== undefined) {
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
          return;
        }

        const queue = await getQueue(client, id);
        if (!queue) {
          console.error(`Queue ${id} not found.`);
          process.exitCode = 1;
          return;
        }
        if (!program.opts().noAudit)
          logAudit({
            command: "finesse queue",
            host: program._resolvedConfig.finesse.host,
            endpoint: `/finesse/api/Queue/${id}`,
            status: 200,
          });
        await output([queue], program.opts().format);
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
      }
    });

  finesse
    .command("teams")
    .description("List Finesse teams")
    .action(async () => {
      try {
        const client = getClient();
        const teams = await getTeams(client);
        if (!program.opts().noAudit)
          logAudit({
            command: "finesse teams",
            host: program._resolvedConfig.finesse.host,
            endpoint: "/finesse/api/Teams",
            status: 200,
          });
        await output(teams, program.opts().format);
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
      }
    });

  finesse
    .command("reason-codes")
    .description("List reason codes")
    .option("--category <cat>", "Category (NOT_READY or LOGOUT)", "NOT_READY")
    .action(async (options) => {
      try {
        const client = getClient();
        const codes = await getReasonCodes(client, options.category);
        if (!program.opts().noAudit)
          logAudit({
            command: "finesse reason-codes",
            host: program._resolvedConfig.finesse.host,
            endpoint: "/finesse/api/ReasonCodes",
            status: 200,
          });
        await output(codes, program.opts().format);
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
      }
    });

  finesse
    .command("wrapup-reasons")
    .description("List wrap-up reasons")
    .action(async () => {
      try {
        const client = getClient();
        const reasons = await getWrapUpReasons(client);
        if (!program.opts().noAudit)
          logAudit({
            command: "finesse wrapup-reasons",
            host: program._resolvedConfig.finesse.host,
            endpoint: "/finesse/api/WrapUpReasons",
            status: 200,
          });
        await output(reasons, program.opts().format);
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
      }
    });

  finesse
    .command("phonebooks")
    .description("List phone books")
    .action(async () => {
      try {
        const client = getClient();
        const books = await getPhoneBooks(client);
        if (!program.opts().noAudit)
          logAudit({
            command: "finesse phonebooks",
            host: program._resolvedConfig.finesse.host,
            endpoint: "/finesse/api/PhoneBooks",
            status: 200,
          });
        await output(books, program.opts().format);
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
      }
    });
}
