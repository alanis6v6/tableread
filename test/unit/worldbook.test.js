import { test } from "node:test";
import assert from "node:assert/strict";
import { entryMatches, secondaryOk, activeEntries } from "../../src/engine/worldbook.js";

test("entryMatches: matches on keys or legacy key, case-insensitively", () => {
  assert.equal(entryMatches({ keys: ["Matthias", "馬提亞斯"] }, "talking to matthias today"), true);
  assert.equal(entryMatches({ key: ["阿霆"] }, "遇到阿霆了"), true);
  assert.equal(entryMatches({ keys: ["陸昀霆"] }, "不相關的句子"), false);
  assert.equal(entryMatches({}, "任何句子"), false);
});

test("secondaryOk: non-selective entries always pass", () => {
  assert.equal(secondaryOk({ selective: false, secondary_keys: ["x"] }, "no x here"), true);
});

test("secondaryOk: selective with no secondary_keys always passes", () => {
  assert.equal(secondaryOk({ selective: true, secondary_keys: [] }, "anything"), true);
});

test("secondaryOk: AND_ANY (default / logic 0)", () => {
  const entry = { selective: true, secondary_keys: ["辦公室", "加班"] };
  assert.equal(secondaryOk(entry, "今天在辦公室"), true);
  assert.equal(secondaryOk(entry, "今天休假在家"), false);
});

test("secondaryOk: AND_ALL (logic 3)", () => {
  const entry = { selective: true, secondary_keys: ["辦公室", "加班"], extensions: { selectiveLogic: 3 } };
  assert.equal(secondaryOk(entry, "今天在辦公室加班"), true);
  assert.equal(secondaryOk(entry, "今天在辦公室，還沒下班"), false);
});

test("secondaryOk: NOT_ANY (logic 2)", () => {
  const entry = { selective: true, secondary_keys: ["下雨"], extensions: { selectiveLogic: 2 } };
  assert.equal(secondaryOk(entry, "今天出太陽"), true);
  assert.equal(secondaryOk(entry, "今天下雨"), false);
});

test("secondaryOk: NOT_ALL (logic 1)", () => {
  const entry = { selective: true, secondary_keys: ["晴天", "微風"], extensions: { selectiveLogic: 1 } };
  assert.equal(secondaryOk(entry, "今天晴天但沒風"), true); // not both hit
  assert.equal(secondaryOk(entry, "今天晴天有微風"), false); // both hit -> NOT_ALL fails
});

test("activeEntries: skips disabled entries, constant entries always active", () => {
  const entries = [
    { id: 0, constant: true, enabled: true },
    { id: 1, constant: true, enabled: false },
  ];
  const triggers = {};
  const active = activeEntries(entries, [], 1, triggers, 4);
  assert.deepEqual(active.map((e) => e.id), [0]);
});

test("activeEntries: keyword must be within the scan_depth trailing window", () => {
  const entries = [{ id: 5, keys: ["彩蛋"], enabled: true, extensions: { scan_depth: 2 } }];
  const messages = ["彩蛋出現在這裡", "後面第二句", "後面第三句", "後面第四句"];
  const triggers = {};
  // window = last 2 messages, which no longer contain "彩蛋"
  assert.deepEqual(activeEntries(entries, messages, 3, triggers, 4), []);
});

test("activeEntries: scan_depth 0 falls back to defaultScanDepth (falsy-or quirk preserved)", () => {
  const entries = [{ id: 6, keys: ["久遠"], enabled: true, extensions: { scan_depth: 0 } }];
  // "久遠" is only in the oldest message, outside a defaultScanDepth=1 window,
  // so with the quirk preserved (0 -> falls back to default) it should NOT match.
  const messages = ["很久遠的事情提到久遠兩個字", "最近的事"];
  const triggers = {};
  assert.deepEqual(activeEntries(entries, messages, 2, triggers, 1), []);
});

test("activeEntries: delay suppresses the entry entirely before the given round, without recording state", () => {
  const entries = [{ id: 7, constant: true, enabled: true, extensions: { delay: 3 } }];
  const triggers = {};
  assert.deepEqual(activeEntries(entries, [], 2, triggers, 4), []);
  assert.equal(triggers["7"], undefined);
  assert.deepEqual(activeEntries(entries, [], 3, triggers, 4).map((e) => e.id), [7]);
});

test("activeEntries: sticky keeps a non-matching entry active within its window", () => {
  // Note a quirk inherited verbatim from the Python original: last_round is
  // refreshed on *every* hit, including a sticky-carried one -- so as long as
  // the entry is evaluated every consecutive round, a sticky hit keeps
  // refreshing its own window and never lapses. It only lapses if the gap
  // since the last hit (in round numbers) exceeds `sticky`.
  const entries = [{ id: 8, keys: ["觸發詞"], enabled: true, extensions: { sticky: 2 } }];

  let triggers = { 8: { last_round: 1 } };
  // round 3: gap is 3-1=2 <= sticky(2) -> still active via sticky even though absent
  assert.deepEqual(activeEntries(entries, ["別的句子"], 3, triggers, 4).map((e) => e.id), [8]);

  triggers = { 8: { last_round: 1 } };
  // round 4: gap is 4-1=3 > sticky(2) -> sticky window elapsed, keyword absent -> inactive
  assert.deepEqual(activeEntries(entries, ["別的句子"], 4, triggers, 4).map((e) => e.id), []);
});

test("activeEntries: cooldown suppresses a re-trigger, but is ignored for constant entries", () => {
  const nonConstant = { id: 9, keys: ["事件"], enabled: true, extensions: { cooldown: 3 } };
  const constant = { id: 10, constant: true, enabled: true, extensions: { cooldown: 3 } };
  const triggers = {};
  assert.deepEqual(
    activeEntries([nonConstant, constant], ["事件發生了"], 1, triggers, 4).map((e) => e.id),
    [9, 10],
  );
  // round 2: keyword present again, but cooldown(3) blocks the non-constant entry;
  // the constant entry is exempt from cooldown entirely (quirk preserved from the Python original).
  assert.deepEqual(
    activeEntries([nonConstant, constant], ["事件又發生了"], 2, triggers, 4).map((e) => e.id),
    [10],
  );
  // round 4: 4 - 1 = 3, no longer < cooldown(3) -> non-constant entry can fire again
  assert.deepEqual(
    activeEntries([nonConstant, constant], ["事件又發生了"], 4, triggers, 4).map((e) => e.id),
    [9, 10],
  );
});
