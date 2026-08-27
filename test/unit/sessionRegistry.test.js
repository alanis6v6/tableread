import { test } from "node:test";
import assert from "node:assert/strict";
import { createDraftStore } from "../../src/tools/draftStore.js";
import { createScenarioStore } from "../../src/tools/scenarioStore.js";
import { createSessionRegistry } from "../../src/tools/sessionRegistry.js";

function setup() {
  const draft = createDraftStore();
  draft.updateField("first_mes", "開場白：主角走進客廳。");
  draft.updateField("character_book_entries", [
    { id: 0, constant: true, enabled: true, comment: "常駐", content: "氛圍" },
  ]);
  const scenarios = createScenarioStore(draft);
  const registry = createSessionRegistry(draft, scenarios);
  return { draft, scenarios, registry };
}

test("getPlaytestContext/commitPlaytestRound fail with a helpful error before run_scenario", () => {
  const { registry } = setup();
  const ctx = registry.getPlaytestContext("first_mes", 1);
  assert.equal(ctx.ok, false);
  assert.match(ctx.error, /run_scenario/);

  const commit = registry.commitPlaytestRound("first_mes", 1, "p", "c");
  assert.equal(commit.ok, false);
});

test("runScenario rejects an unknown scenario id", () => {
  const { registry } = setup();
  const res = registry.runScenario("nope", 5);
  assert.equal(res.ok, false);
  assert.match(res.error, /unknown scenario_id/);
});

test("run_scenario then get_playtest_context/commit_playtest_round happy path", () => {
  const { registry } = setup();
  const started = registry.runScenario("first_mes", 3);
  assert.equal(started.ok, true);
  assert.equal(started.opening_text, "開場白：主角走進客廳。");
  assert.equal(started.target_rounds, 3);

  const ctx = registry.getPlaytestContext("first_mes", 1);
  assert.equal(ctx.ok, true);
  assert.deepEqual(
    ctx.active_world_entries.map((e) => e.comment),
    ["常駐"],
  );

  const commit = registry.commitPlaytestRound("first_mes", 1, "你好", "角色點頭。");
  assert.equal(commit.ok, true);
  assert.equal(commit.patch_found, false);

  const transcript = registry.getTranscript("first_mes");
  assert.equal(transcript.ok, true);
  assert.equal(transcript.rounds.length, 2); // round 0 opening + round 1
});

test("runScenario reflects draft edits made after the scenario was first listed", () => {
  const { draft, registry } = setup();
  registry.runScenario("first_mes", 1);
  draft.updateField("character_book_entries", [
    { id: 0, constant: true, enabled: true, comment: "換過的常駐", content: "新氛圍" },
  ]);
  registry.runScenario("first_mes", 1); // re-run should rebuild from the latest draft
  const ctx = registry.getPlaytestContext("first_mes", 1);
  assert.deepEqual(
    ctx.active_world_entries.map((e) => e.comment),
    ["換過的常駐"],
  );
});
