import { test } from "node:test";
import assert from "node:assert/strict";
import { createActivityLog } from "../../src/tools/activityLog.js";

test("record appends an entry with a timestamp and notifies subscribers", () => {
  const log = createActivityLog();
  let notified = 0;
  log.subscribe(() => notified++);

  log.record("get_checklist_status", {}, { ok: true });
  assert.equal(notified, 1);
  const entries = log.getEntries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].toolName, "get_checklist_status");
  assert.equal(typeof entries[0].at, "number");
});

test("record caps the log at the given limit, dropping the oldest entries", () => {
  const log = createActivityLog(3);
  for (let i = 0; i < 5; i++) log.record(`tool_${i}`, {}, { ok: true });
  const entries = log.getEntries();
  assert.equal(entries.length, 3);
  assert.deepEqual(
    entries.map((e) => e.toolName),
    ["tool_2", "tool_3", "tool_4"],
  );
});

test("getEntries returns a copy, not the live array", () => {
  const log = createActivityLog();
  log.record("t", {}, {});
  const entries = log.getEntries();
  entries.pop();
  assert.equal(log.getEntries().length, 1);
});
