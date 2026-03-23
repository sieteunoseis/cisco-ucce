import { Command } from "commander";

const program = new Command();

program
  .name("cisco-ucce")
  .description("Monitor and troubleshoot Cisco UCCE 12.6")
  .version("1.0.0");

export function run(argv) {
  program.parse(argv);
}
