import { test } from "node:test";
import assert from "node:assert/strict";
import { applyJsonPatch, extractAndApplyPatch, stripComments } from "../../src/engine/jsonpatch.js";

test("applyJsonPatch: top-level and nested paths, in place", () => {
  const vars = { 好感度: 5, 衣著: { 你: "未記錄" } };
  applyJsonPatch(vars, [
    { op: "replace", path: "/好感度", value: 12 },
    { op: "replace", path: "/衣著/你", value: "家居服" },
    { op: "replace", path: "/衣著/新人物", value: "不在場" },
  ]);
  assert.deepEqual(vars, { 好感度: 12, 衣著: { 你: "家居服", 新人物: "不在場" } });
});

test("applyJsonPatch: creates intermediate objects that don't exist yet", () => {
  const vars = {};
  applyJsonPatch(vars, [{ op: "replace", path: "/筆記本/場景速寫", value: "細節" }]);
  assert.deepEqual(vars, { 筆記本: { 場景速寫: "細節" } });
});

test("applyJsonPatch: an empty/root path is a no-op, not a crash", () => {
  const vars = { a: 1 };
  applyJsonPatch(vars, [{ op: "replace", path: "", value: 99 }]);
  assert.deepEqual(vars, { a: 1 });
});

test("extractAndApplyPatch: finds and applies the VariableUpdateLog/JSONPatch block", () => {
  const raw = [
    "這是正文敘事。",
    "",
    "<!-- <VariableUpdateLog><JSONPatch>",
    '[{ "op": "replace", "path": "/page", "value": 2 }]',
    "</JSONPatch></VariableUpdateLog> -->",
  ].join("\n");
  const { vars, patchFound, warning } = extractAndApplyPatch(raw, { page: 1 });
  assert.equal(patchFound, true);
  assert.equal(warning, null);
  assert.deepEqual(vars, { page: 2 });
});

test("extractAndApplyPatch: no block present -> patchFound false, vars untouched", () => {
  const { vars, patchFound, warning } = extractAndApplyPatch("just plain narrative text", { page: 1 });
  assert.equal(patchFound, false);
  assert.equal(warning, null);
  assert.deepEqual(vars, { page: 1 });
});

test("extractAndApplyPatch: malformed JSON inside the block reports a warning, doesn't throw", () => {
  const raw = [
    "<!-- <VariableUpdateLog><JSONPatch>",
    '[{ "op": "replace", "path": "/page", "value": 2, }]',
    "</JSONPatch></VariableUpdateLog> -->",
  ].join("\n");
  const { vars, patchFound, warning } = extractAndApplyPatch(raw, { page: 1 });
  assert.equal(patchFound, false);
  assert.match(warning, /could not parse JSON Patch block/);
  assert.deepEqual(vars, { page: 1 });
});

test("stripComments: removes every HTML comment block, including multiline ones", () => {
  const raw = "before <!-- hidden\nacross lines --> middle <!-- another --> after";
  assert.equal(stripComments(raw), "before  middle  after");
});
