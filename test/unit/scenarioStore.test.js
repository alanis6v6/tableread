import { test } from "node:test";
import assert from "node:assert/strict";
import { createDraftStore } from "../../src/tools/draftStore.js";
import { createScenarioStore } from "../../src/tools/scenarioStore.js";

test("listScenarios is empty until first_mes/alternate_greetings/custom scenarios exist", () => {
  const draft = createDraftStore();
  const scenarios = createScenarioStore(draft);
  assert.deepEqual(scenarios.listScenarios(), []);
});

test("listScenarios builds one entry for first_mes and one per alternate_greeting", () => {
  const draft = createDraftStore();
  draft.updateField("first_mes", "開場白文字");
  draft.updateField("alternate_greetings", ["開局A", "開局B"]);
  const scenarios = createScenarioStore(draft);

  const list = scenarios.listScenarios();
  assert.deepEqual(
    list.map((s) => [s.id, s.text]),
    [
      ["first_mes", "開場白文字"],
      ["alt_0", "開局A"],
      ["alt_1", "開局B"],
    ],
  );
});

test("addScenario appends a custom scenario with a distinct id", () => {
  const draft = createDraftStore();
  const scenarios = createScenarioStore(draft);
  const s1 = scenarios.addScenario("玩家一開始就很兇的情境");
  const s2 = scenarios.addScenario("玩家很被動的情境");
  assert.notEqual(s1.id, s2.id);
  assert.equal(scenarios.listScenarios().length, 2);
  assert.equal(scenarios.findScenario(s1.id).text, "玩家一開始就很兇的情境");
});

test("listScenarios reflects the draft's current state, not a stale snapshot", () => {
  const draft = createDraftStore();
  const scenarios = createScenarioStore(draft);
  assert.equal(scenarios.listScenarios().length, 0);
  draft.updateField("first_mes", "後來才寫的開場白");
  assert.equal(scenarios.listScenarios().length, 1);
});

test("findScenario returns null for an unknown id", () => {
  const draft = createDraftStore();
  const scenarios = createScenarioStore(draft);
  assert.equal(scenarios.findScenario("nope"), null);
});
