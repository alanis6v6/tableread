// Parity test: replays the same round-by-round context/commit loop that
// playtest_engine.py's `context` and `commit` subcommands perform, using the
// ported JS engine, against the real gender-is-not-the-limit card. The
// expected output (expected.json) was generated once by calling the actual
// Python functions directly (see reference/st-writer-src's playtest_engine.py)
// on the same rounds.json fixture -- see the comment at the bottom of this
// file for how to regenerate it if the engine intentionally changes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { loadCard, activeEntries, applyRegexScripts, extractAndApplyPatch, stripComments } from "../../src/engine/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

const CARD_PATH = path.join(
  repoRoot,
  "reference/st-writer-src/cards/gender-is-not-the-limit/gender_is_not_the_limit.json",
);
const ROUNDS_PATH = path.join(here, "rounds.json");
const EXPECTED_PATH = path.join(here, "expected.json");

const DEFAULT_SCAN_DEPTH = 4;

function runEngine(cardJson, roundsIn) {
  const { entries, regexScripts } = loadCard(cardJson);

  let vars = {};
  const triggers = {};
  const committedRounds = [];
  const outRounds = [];

  for (const r of roundsIn) {
    const roundNum = r.round;
    const messages = [];
    for (const prev of committedRounds) {
      messages.push(prev.player_raw || "");
      messages.push(prev.char_raw || "");
    }

    const active = activeEntries(entries, messages, roundNum, triggers, DEFAULT_SCAN_DEPTH);
    const context = {
      round: roundNum,
      current_vars: structuredClone(vars),
      active_ids: active.map((e) => String(e.id)),
    };

    const charRaw = r.char_raw;
    const patchResult = extractAndApplyPatch(charRaw, vars);
    vars = patchResult.vars;
    const visibleRaw = stripComments(charRaw);
    const { text: charHtml, warnings } = applyRegexScripts(visibleRaw, regexScripts);
    if (patchResult.warning) warnings.push(patchResult.warning);

    const commit = {
      round: roundNum,
      patch_found: patchResult.patchFound,
      vars_after: structuredClone(vars),
      warnings,
      char_html: charHtml,
    };

    committedRounds.push({ round: roundNum, player_raw: r.player_raw || "", char_raw: charRaw });
    outRounds.push({ context, commit });
  }

  return outRounds;
}

test("JS engine reproduces playtest_engine.py output round-by-round on gender-is-not-the-limit", () => {
  const cardJson = JSON.parse(readFileSync(CARD_PATH, "utf-8"));
  const roundsIn = JSON.parse(readFileSync(ROUNDS_PATH, "utf-8"));
  const expected = JSON.parse(readFileSync(EXPECTED_PATH, "utf-8"));

  const actual = runEngine(cardJson, roundsIn);

  assert.equal(actual.length, expected.rounds.length);

  for (let i = 0; i < actual.length; i++) {
    const got = actual[i];
    const want = expected.rounds[i];

    assert.deepEqual(
      got.context.active_ids,
      want.context.active_ids,
      `round ${got.context.round}: active world-book entry ids differ`,
    );
    assert.deepEqual(
      got.context.current_vars,
      want.context.current_vars,
      `round ${got.context.round}: vars snapshot before commit differs`,
    );
    assert.equal(
      got.commit.patch_found,
      want.commit.patch_found,
      `round ${got.commit.round}: patch_found differs`,
    );
    assert.deepEqual(
      got.commit.vars_after,
      want.commit.vars_after,
      `round ${got.commit.round}: vars after patch differ`,
    );
    // Warning *shape* must match (same count, same "could not parse JSON Patch
    // block: ..." template on the same rounds); the underlying JSON parser's
    // own error text is language-specific (Python's json vs JS's JSON.parse)
    // and isn't part of the ported contract.
    assert.equal(
      got.commit.warnings.length,
      want.commit.warnings.length,
      `round ${got.commit.round}: warning count differs`,
    );
    for (let w = 0; w < got.commit.warnings.length; w++) {
      const gotPrefix = got.commit.warnings[w].split(":")[0];
      const wantPrefix = want.commit.warnings[w].split(":")[0];
      assert.equal(
        gotPrefix,
        wantPrefix,
        `round ${got.commit.round}: warning ${w} template differs`,
      );
    }
    assert.equal(
      got.commit.char_html,
      want.commit.char_html,
      `round ${got.commit.round}: rendered HTML differs`,
    );
  }
});

// To regenerate expected.json after an intentional change to the reference
// Python engine: run reference/st-writer-src's playtest_engine.py functions
// (load_card, active_entries, extract_and_apply_patch, apply_regex_scripts)
// directly against this same rounds.json, in the same context-then-commit
// order as runEngine() above, and dump the results as JSON.
