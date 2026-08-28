import { test } from "node:test";
import assert from "node:assert/strict";
import { buildToolDefinitions } from "../../src/tools/registerTools.js";

function byName(tools, name) {
  const t = tools.find((t) => t.name === name);
  assert.ok(t, `tool ${name} not found`);
  return t;
}

async function call(tool, params) {
  const res = await tool.execute(params);
  assert.ok(Array.isArray(res.content) && res.content[0].type === "text");
  return { isError: !!res.isError, payload: JSON.parse(res.content[0].text) };
}

test("all 10 tools are defined with name/description/inputSchema/execute", () => {
  const tools = buildToolDefinitions();
  assert.equal(tools.length, 10);
  for (const t of tools) {
    assert.equal(typeof t.name, "string");
    assert.ok(t.description.length > 20, `${t.name} needs a real description`);
    assert.equal(t.inputSchema.type, "object");
    assert.equal(typeof t.execute, "function");
  }
});

test("get_playtest_context's description states the 'only use what's listed' rule", () => {
  const tools = buildToolDefinitions();
  const t = byName(tools, "get_playtest_context");
  assert.match(t.description, /只能使用這份輸出/);
});

test("end-to-end: draft a tiny card, run a scenario, commit a round, read the transcript", async () => {
  const tools = buildToolDefinitions();

  await call(byName(tools, "update_card_field"), { section: "first_mes", value: "開場白內容。" });
  await call(byName(tools, "update_card_field"), {
    section: "character_book_entries",
    value: [{ id: 0, constant: true, enabled: true, comment: "常駐", content: "世界觀氛圍" }],
  });
  await call(byName(tools, "update_card_field"), { section: "cast", value: { status: "known", note: "只有主角" } });

  const checklist = await call(byName(tools, "get_checklist_status"), {});
  assert.equal(checklist.payload.checklist.cast.status, "known");

  const assembled = await call(byName(tools, "assemble_card"), {});
  assert.equal(assembled.payload.card.data.first_mes, "開場白內容。");

  const scenarios = await call(byName(tools, "list_scenarios"), {});
  assert.equal(scenarios.payload.scenarios.length, 1);
  const scenarioId = scenarios.payload.scenarios[0].id;

  const started = await call(byName(tools, "run_scenario"), { scenario_id: scenarioId, rounds: 2 });
  assert.equal(started.payload.ok, true);

  const ctx = await call(byName(tools, "get_playtest_context"), { scenario_id: scenarioId, round: 1 });
  assert.deepEqual(
    ctx.payload.active_world_entries.map((e) => e.comment),
    ["常駐"],
  );

  const commit = await call(byName(tools, "commit_playtest_round"), {
    scenario_id: scenarioId,
    round: 1,
    player_text: "你好",
    char_text: "角色點頭致意。",
  });
  assert.equal(commit.payload.patch_found, false);
  assert.equal(commit.isError, false);

  const transcript = await call(byName(tools, "get_transcript"), { scenario_id: scenarioId });
  assert.equal(transcript.payload.rounds.length, 2);
});

test("add_scenario then run_scenario against the custom scenario", async () => {
  const tools = buildToolDefinitions();
  const added = await call(byName(tools, "add_scenario"), { description: "玩家一開始就很兇的情境" });
  const scenarioId = added.payload.scenario.id;
  const started = await call(byName(tools, "run_scenario"), { scenario_id: scenarioId, rounds: 1 });
  assert.equal(started.payload.opening_text, "玩家一開始就很兇的情境");
});

test("errors are surfaced with isError:true and a readable message", async () => {
  const tools = buildToolDefinitions();
  const res = await call(byName(tools, "get_playtest_context"), { scenario_id: "no-such-scenario", round: 1 });
  assert.equal(res.isError, true);
  assert.match(res.payload.error, /run_scenario/);

  const bad = await call(byName(tools, "update_card_field"), { section: "totally_invalid", value: "x" });
  assert.equal(bad.isError, true);
});
