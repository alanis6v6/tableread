import { test } from "node:test";
import assert from "node:assert/strict";
import { createDraftStore } from "../../src/tools/draftStore.js";
import { createScenarioStore } from "../../src/tools/scenarioStore.js";
import { createSessionRegistry } from "../../src/tools/sessionRegistry.js";
import { createActivityLog } from "../../src/tools/activityLog.js";
import { createCompareScenarios } from "../../src/tools/compareScenarios.js";

// Mirrors how registerTools.js's defineTool() wrapper logs get_playtest_context
// calls to activityLog -- compareScenarios reads triggered world entries back
// out of that log, so tests have to log the same way the real tool wrapper does.
function loggedGetPlaytestContext(registry, activityLog, scenarioId, round) {
  const result = registry.getPlaytestContext(scenarioId, round);
  activityLog.record("get_playtest_context", { scenario_id: scenarioId, round }, result);
  return result;
}

function setup() {
  const draft = createDraftStore();
  draft.updateField("first_mes", "開場白：主角走進客廳。");
  draft.updateField("alternate_greetings", ["開局B：主角在廚房。"]);
  draft.updateField("character_book_entries", [
    { id: 0, constant: true, enabled: true, comment: "常駐氛圍", content: "氛圍" },
    { id: 1, constant: false, enabled: true, comment: "廚房限定", content: "廚房", keys: ["廚房"] },
    { id: 2, constant: false, enabled: true, comment: "永不觸發", content: "沒人會提到這個", keys: ["絕對不會出現的關鍵字"] },
  ]);
  const scenarios = createScenarioStore(draft);
  const registry = createSessionRegistry(draft, scenarios);
  const activityLog = createActivityLog();
  const compare = createCompareScenarios(draft, scenarios, registry, activityLog);
  return { draft, scenarios, registry, activityLog, compare };
}

test("intersection/union: entries triggered in every scenario vs only some", () => {
  const { registry, activityLog, compare } = setup();

  registry.runScenario("first_mes", 1);
  loggedGetPlaytestContext(registry, activityLog, "first_mes", 1);
  registry.commitPlaytestRound("first_mes", 1, "你好", "角色點頭。");

  registry.runScenario("alt_0", 1);
  loggedGetPlaytestContext(registry, activityLog, "alt_0", 1);
  registry.commitPlaytestRound("alt_0", 1, "你好", "角色轉身。");

  const result = compare.compareScenarios(["first_mes", "alt_0"]);
  assert.equal(result.ok, true);
  assert.equal(result.scenarios.length, 2);

  const firstMes = result.scenarios.find((s) => s.scenario_id === "first_mes");
  const alt0 = result.scenarios.find((s) => s.scenario_id === "alt_0");
  assert.deepEqual(firstMes.triggered_world_entries, ["常駐氛圍"]);
  assert.deepEqual(alt0.triggered_world_entries, ["常駐氛圍", "廚房限定"]);

  // "常駐氛圍" fires in both (constant entry) -> intersection.
  assert.deepEqual(result.world_entries_triggered_in_all, ["常駐氛圍"]);
  // "廚房限定" only fires for alt_0 -> inconsistent, the QA signal.
  assert.deepEqual(result.world_entries_triggered_in_some, ["廚房限定"]);
  // "永不觸發" fires in neither.
  assert.deepEqual(result.world_entries_never_triggered_in_any, ["永不觸發"]);
});

test("scenario_ids that were never run_scenario'd are marked with an error, not a thrown exception", () => {
  const { registry, compare } = setup();
  registry.runScenario("first_mes", 1);

  const result = compare.compareScenarios(["first_mes", "never_ran", "also_never_ran"]);
  assert.equal(result.ok, true);
  assert.equal(result.scenarios.length, 3);

  const firstMes = result.scenarios.find((s) => s.scenario_id === "first_mes");
  assert.equal(firstMes.error, undefined);
  assert.equal(firstMes.rounds_played, 0);

  const neverRan = result.scenarios.find((s) => s.scenario_id === "never_ran");
  assert.deepEqual(neverRan, { scenario_id: "never_ran", error: "尚未執行" });
  const alsoNeverRan = result.scenarios.find((s) => s.scenario_id === "also_never_ran");
  assert.deepEqual(alsoNeverRan, { scenario_id: "also_never_ran", error: "尚未執行" });
});

test("aggregates degenerate sensibly when comparing a single scenario", () => {
  const { registry, activityLog, compare } = setup();
  registry.runScenario("first_mes", 1);
  loggedGetPlaytestContext(registry, activityLog, "first_mes", 1);
  registry.commitPlaytestRound("first_mes", 1, "你好", "角色點頭。");

  const result = compare.compareScenarios(["first_mes"]);
  assert.equal(result.ok, true);
  const [scenario] = result.scenarios;
  assert.deepEqual(scenario.triggered_world_entries, ["常駐氛圍"]);

  // Intersection of one set is itself.
  assert.deepEqual(result.world_entries_triggered_in_all, ["常駐氛圍"]);
  // Union minus intersection of one set is empty -- no cross-scenario
  // inconsistency to flag when there's nothing to compare against.
  assert.deepEqual(result.world_entries_triggered_in_some, []);
  assert.deepEqual(result.world_entries_never_triggered_in_any, ["廚房限定", "永不觸發"]);
});

test("aggregates are empty when every requested scenario_id is unresolved", () => {
  const { compare } = setup();
  const result = compare.compareScenarios(["nope"]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.scenarios, [{ scenario_id: "nope", error: "尚未執行" }]);
  assert.deepEqual(result.world_entries_triggered_in_all, []);
  assert.deepEqual(result.world_entries_triggered_in_some, []);
  assert.deepEqual(result.world_entries_never_triggered_in_any, ["常駐氛圍", "廚房限定", "永不觸發"]);
});

test("rounds_played/warnings_count/patch_miss_count/final_vars come straight from the transcript", () => {
  const { registry, activityLog, compare } = setup();
  registry.runScenario("first_mes", 2);
  loggedGetPlaytestContext(registry, activityLog, "first_mes", 1);
  registry.commitPlaytestRound("first_mes", 1, "你好", "角色點頭。"); // no patch block -> patch_found:false
  loggedGetPlaytestContext(registry, activityLog, "first_mes", 2);
  registry.commitPlaytestRound(
    "first_mes",
    2,
    "再見",
    '角色揮手。<!-- <VariableUpdateLog><JSONPatch>[{"op":"add","path":"/mood","value":"happy"}]</JSONPatch></VariableUpdateLog> -->',
  );

  const result = compare.compareScenarios(["first_mes"]);
  const [scenario] = result.scenarios;
  assert.equal(scenario.rounds_played, 2);
  assert.equal(scenario.patch_miss_count, 1);
  assert.deepEqual(scenario.final_vars, { mood: "happy" });
});
