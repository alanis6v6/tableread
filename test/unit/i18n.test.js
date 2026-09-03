import { test } from "node:test";
import assert from "node:assert/strict";
import { getLocalizedAspects } from "../../src/tools/checklist.js";
import { TOOL_TEXT } from "../../src/tools/toolText.js";

test("every aspect has a zh and en label / axis / feeds", () => {
  for (const lang of ["zh", "en"]) {
    const aspects = getLocalizedAspects(lang);
    assert.equal(aspects.length, 9);
    for (const a of aspects) {
      assert.ok(a.label && a.label.length > 1, `${a.key}.label (${lang})`);
      assert.ok(a.axis && a.axis.length > 15, `${a.key}.axis (${lang})`);
      assert.ok(a.feeds && a.feeds.length > 10, `${a.key}.feeds (${lang})`);
    }
  }
});

test("getLocalizedAspects falls back to zh for an unknown language", () => {
  const zh = getLocalizedAspects("zh");
  const bogus = getLocalizedAspects("fr");
  assert.deepEqual(bogus, zh);
});

test("TOOL_TEXT has the same tool keys in zh and en", () => {
  assert.deepEqual(Object.keys(TOOL_TEXT.zh).sort(), Object.keys(TOOL_TEXT.en).sort());
});

test("the en tool text is actually English (no CJK in the descriptions)", () => {
  for (const [key, value] of Object.entries(TOOL_TEXT.en)) {
    assert.doesNotMatch(value, /[一-鿿]/, `TOOL_TEXT.en.${key} still contains CJK`);
  }
});
