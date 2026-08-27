import { test } from "node:test";
import assert from "node:assert/strict";
import { createDraftStore } from "../../src/tools/draftStore.js";
import { assembleCard } from "../../src/tools/cardAssembler.js";
import { loadCard } from "../../src/engine/card.js";

test("assembleCard keeps top-level V2 fields in sync with data.* V3 fields", () => {
  const store = createDraftStore();
  store.updateField("name", "測試角色");
  store.updateField("description", "描述文字");
  store.updateField("first_mes", "開場白");
  store.updateField("system_prompt", "系統提示詞");
  store.updateField("world_name", "測試世界書");
  store.updateField("character_book_entries", [{ id: 0, constant: true, content: "常駐內容" }]);
  store.updateField("regex_scripts", [{ scriptName: "t", findRegex: "X", replaceString: "Y" }]);

  const card = assembleCard(store.getSnapshot().fields);

  assert.equal(card.name, "測試角色");
  assert.equal(card.data.name, "測試角色");
  assert.equal(card.description, "描述文字");
  assert.equal(card.data.description, "描述文字");
  assert.equal(card.data.system_prompt, "系統提示詞");
  assert.equal(card.spec, "chara_card_v3");
  assert.equal(card.spec_version, "3.0");
  assert.equal(card.data.character_book.name, "測試世界書");
  assert.equal(card.data.character_book.entries.length, 1);
  assert.equal(card.data.extensions.regex_scripts.length, 1);
  assert.equal(card.data.extensions.world, "測試世界書");
});

test("assembleCard output loads correctly through the engine's own loadCard", () => {
  const store = createDraftStore();
  store.updateField("character_book_entries", [{ id: 0, constant: true, content: "x" }]);
  store.updateField("regex_scripts", [{ scriptName: "t", findRegex: "a", replaceString: "b" }]);
  const card = assembleCard(store.getSnapshot().fields);

  const { entries, regexScripts } = loadCard(card);
  assert.equal(entries.length, 1);
  assert.equal(regexScripts.length, 1);
});

test("assembleCard defaults missing fields to empty strings/arrays, not undefined", () => {
  const store = createDraftStore();
  const card = assembleCard(store.getSnapshot().fields);
  assert.equal(card.name, "");
  assert.deepEqual(card.tags, []);
  assert.deepEqual(card.data.alternate_greetings, []);
  assert.deepEqual(card.data.character_book.entries, []);
});
