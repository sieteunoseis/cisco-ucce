import { describe, it, expect, vi, afterEach } from "vitest";
import { flattenItem, findOne, createAwClient } from "../../lib/api/aw.js";
import { describeAgent } from "../../lib/commands/agent.js";
import { summarize } from "../../lib/api/finesse.js";
import { formatTable } from "../../lib/formatters/table.js";
import { formatCsv } from "../../lib/formatters/csv.js";
import { formatHttpError, parseXml } from "../../lib/utils/http.js";
import { checkFormat } from "../../lib/utils/output.js";

const agentXml = (sgs, extra = "") => `<agent>
  <refURL>/unifiedconfig/config/agent/9845</refURL><agentId>120954</agentId>
  <name>CMC_MCC.Dolezal_Lauren</name>
  <agentTeam><refURL>/x/5131</refURL><name>HC.CMC_MCC</name></agentTeam>
  <person><firstName>Lauren</firstName><lastName>Dolezal</lastName><userName>dolezall</userName><loginEnabled>true</loginEnabled></person>
  <skillGroups>${sgs.map((n) => `<skillGroup><refURL>/x/1</refURL><name>${n}</name></skillGroup>`).join("")}</skillGroups>
  ${extra}
</agent>`;

const rawAgent = async (sgs) => (await parseXml(agentXml(sgs))).agent;

describe("AW nested data", () => {
  it("keeps person fields and skill group names", async () => {
    const flat = flattenItem(
      await rawAgent(["HC.CMC_MCC.Default", "HC.CMC_MCC.01"]),
    );
    expect(flat).toMatchObject({
      id: "9845",
      agentTeam: "HC.CMC_MCC",
      firstName: "Lauren",
      userName: "dolezall",
      skillGroups: "HC.CMC_MCC.Default; HC.CMC_MCC.01",
    });
  });

  it("describeAgent flags default-only agents", async () => {
    const d = describeAgent(await rawAgent(["HC.CMC_MCC.Default"]));
    expect(d.routableSkillGroups).toBe(0);
    expect(d.warnings).toMatch(/default skill group/);
    const ok = describeAgent(
      await rawAgent(["HC.CMC_MCC.Default", "HC.CMC_MCC.01"]),
    );
    expect(ok.warnings).toBe("");
  });
});

describe("findOne", () => {
  afterEach(() => vi.unstubAllGlobals());
  const page = (names) =>
    `<results><pageInfo><totalResults>${names.length}</totalResults></pageInfo><agents>${names
      .map(
        (n, i) =>
          `<agent><refURL>/unifiedconfig/config/agent/${i + 1}</refURL><name>${n}</name></agent>`,
      )
      .join("")}</agents></results>`;
  const respond = (body) =>
    new Response(body, {
      status: 200,
      headers: { "content-type": "application/xml" },
    });

  it("never guesses from a single partial match", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respond(page(["CMC_MCC.Rogers_Jamie"]))),
    );
    await expect(
      findOne(createAwClient({ host: "aw" }), "agent", "CMC_MCC.Roger"),
    ).rejects.toThrow(
      /No exact agent match.*Did you mean: CMC_MCC.Rogers_Jamie/,
    );
  });

  it("returns the full record for an exact name match", async () => {
    const fetchMock = vi.fn(async (url) =>
      url.includes("?")
        ? respond(page(["A.One", "A.One_Two"]))
        : respond(agentXml(["X.01"])),
    );
    vi.stubGlobal("fetch", fetchMock);
    const r = await findOne(createAwClient({ host: "aw" }), "agent", "a.one");
    expect(r.skillGroups).toBeDefined();
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://aw/unifiedconfig/config/agent/1",
    );
  });
});

describe("output", () => {
  it("summarizes nested Finesse XML", () => {
    expect(summarize({ host: ["a"], port: ["1"] })).toBe("host=a, port=1");
    expect(summarize([{ ctiServer: [{ host: ["x"] }, { host: ["y"] }] }])).toBe(
      "x; y",
    );
  });

  it("uses columns from every row", () => {
    const csv = formatCsv([{ a: 1 }, { a: 2, b: 3 }]);
    expect(csv.split("\n")[0]).toBe("a,b");
    expect(formatTable([{ a: 1 }, { b: 2 }])).toContain("b");
  });

  it("prints a single wide record vertically", () => {
    const row = Object.fromEntries(
      "abcdefgh".split("").map((k) => [k, k.toUpperCase()]),
    );
    const lines = formatTable([row]).split("\n");
    expect(lines.length).toBeGreaterThan(8);
  });

  it("rejects unknown formats", () => {
    expect(() => checkFormat("xml")).toThrow(/Unknown --format/);
    expect(() => checkFormat("csv")).not.toThrow();
  });

  it("gives the CVP role hint on 401", () => {
    expect(
      formatHttpError(401, "https://ops:8111", "/cvp-config/version"),
    ).toMatch(/ServiceabilityAdministrationUserRole/);
  });
});
