import { registerAwResource } from "./_aw-resource.js";
export default (program) =>
  registerAwResource(program, "department", "department", { noGet: true });
