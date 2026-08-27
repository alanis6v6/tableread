import { test } from "node:test";
import assert from "node:assert/strict";
import { createDraftStore } from "../../src/tools/draftStore.js";

test("draftStore starts with every checklist aspect pending_ideation and empty fields", () => {
  const store = createDraftStore();
  const checklist = store.getChecklistStatus();
  assert.equal(Object.keys(checklist).length, 8);
  for (const key of Object.keys(checklist)) {
    assert.deepEqual(checklist[key], { status: "pending_ideation", note: "" });
  }
  assert.equal(store.getSnapshot().fields.description, "");
});

test("updateField writes a scalar card field", () => {
  const store = createDraftStore();
  const res = store.updateField("description", "一段角色介紹");
  assert.equal(res.ok, true);
  assert.equal(store.getSnapshot().fields.description, "一段角色介紹");
});

test("updateField writes an array card field, rejecting non-array values", () => {
  const store = createDraftStore();
  assert.equal(store.updateField("tags", ["a", "b"]).ok, true);
  assert.deepEqual(store.getSnapshot().fields.tags, ["a", "b"]);

  const bad = store.updateField("tags", "not-an-array");
  assert.equal(bad.ok, false);
  assert.match(bad.error, /needs an array/);
});

test("updateField writes checklist status/note for a known aspect key", () => {
  const store = createDraftStore();
  const res = store.updateField("cast", { status: "known", note: "只有主角跟一個NPC" });
  assert.equal(res.ok, true);
  assert.deepEqual(store.getChecklistStatus().cast, { status: "known", note: "只有主角跟一個NPC" });
});

test("updateField rejects an unknown section", () => {
  const store = createDraftStore();
  const res = store.updateField("not_a_real_section", "x");
  assert.equal(res.ok, false);
  assert.match(res.error, /unknown section/);
});

test("subscribe is notified on every write and can unsubscribe", () => {
  const store = createDraftStore();
  let calls = 0;
  const unsubscribe = store.subscribe(() => calls++);
  store.updateField("description", "a");
  store.updateField("personality", "b");
  assert.equal(calls, 2);
  unsubscribe();
  store.updateField("scenario", "c");
  assert.equal(calls, 2);
});

test("getSnapshot returns an independent copy", () => {
  const store = createDraftStore();
  const snap = store.getSnapshot();
  snap.fields.description = "mutated";
  assert.equal(store.getSnapshot().fields.description, "");
});
