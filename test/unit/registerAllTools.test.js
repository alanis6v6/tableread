import { test } from "node:test";
import assert from "node:assert/strict";
import { registerAllTools } from "../../src/tools/registerTools.js";

// registerAllTools() feature-detects `document`, which doesn't exist in
// Node's test environment by default -- these tests install a fake
// `document.modelContext` on globalThis to simulate each outcome a real,
// still-experimental browser implementation could produce, then remove it
// so it doesn't leak into other test files.
function withFakeModelContext(registerToolImpl, fn) {
  const previous = globalThis.document;
  globalThis.document = { modelContext: { registerTool: registerToolImpl } };
  return fn().finally(() => {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  });
}

test("status is 'unsupported' when document.modelContext doesn't exist", async () => {
  assert.equal(typeof document, "undefined");
  const result = await registerAllTools();
  assert.equal(result.status, "unsupported");
  assert.equal(result.tools.length, 10);
  assert.deepEqual(result.registered, []);
  assert.deepEqual(result.failures, []);
});

test("status is 'ok' when every tool registers successfully", async () => {
  await withFakeModelContext(
    async () => {},
    async () => {
      const result = await registerAllTools();
      assert.equal(result.status, "ok");
      assert.equal(result.registered.length, 10);
      assert.deepEqual(result.failures, []);
    },
  );
});

test("status is 'partial' when one tool's registerTool() throws but the rest still register", async () => {
  await withFakeModelContext(
    async (tool) => {
      if (tool.name === "assemble_card") throw new Error("boom");
    },
    async () => {
      const result = await registerAllTools();
      assert.equal(result.status, "partial");
      assert.equal(result.registered.length, 9);
      assert.equal(result.failures.length, 1);
      assert.equal(result.failures[0].name, "assemble_card");
      assert.match(result.failures[0].error, /boom/);
      assert.ok(!result.registered.includes("assemble_card"));
    },
  );
});

test("status is 'error' when every registerTool() call throws", async () => {
  await withFakeModelContext(
    async () => {
      throw new Error("nope");
    },
    async () => {
      const result = await registerAllTools();
      assert.equal(result.status, "error");
      assert.deepEqual(result.registered, []);
      assert.equal(result.failures.length, 10);
    },
  );
});

test("status is 'timeout' when a registerTool() call never resolves, and doesn't hang the caller", async () => {
  await withFakeModelContext(
    () => new Promise(() => {}), // never settles
    async () => {
      const start = Date.now();
      const result = await registerAllTools({ timeoutMs: 50 });
      assert.equal(result.status, "timeout");
      assert.match(result.timeoutError, /did not finish within 50ms/);
      assert.ok(Date.now() - start < 2000, "should not have waited anywhere near as long as a hung call would");
    },
  );
});
