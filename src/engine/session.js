// In-memory equivalent of playtest_engine.py's `context`/`commit` subcommands.
// The Python CLI persisted state.json/transcript.json to disk between
// invocations; a browser tab has no such disk, and doesn't need one -- one
// session already lives exactly as long as one page/tab does, so all of that
// bookkeeping (tracked vars, world-book trigger state, the round-by-round
// transcript) just lives in closures here instead.
//
// One session == one playtest run of one scenario (one opening). Running
// several scenarios side by side (the eventual "game-publisher mode"
// comparison view) is just creating several sessions -- this module doesn't
// need to know anything about that.

import { loadCard } from "./card.js";
import { activeEntries } from "./worldbook.js";
import { applyRegexScripts } from "./regex.js";
import { extractAndApplyPatch, stripComments } from "./jsonpatch.js";

const DEFAULT_SCAN_DEPTH = 4;

/**
 * @param {object} cardJson - a chara_card_v3 (or V2-compatible) JSON object.
 * @param {{ id?: string, text: string }} opening - the scenario's starting
 *   text: the card's `first_mes`, one of its `alternate_greetings`, or a
 *   creator-authored custom opening. Seeded as round 0 (a character turn
 *   with no preceding player turn) so its content is scannable by
 *   world-book entries from round 1 onward, same as any other character
 *   turn would be.
 */
export function createPlaytestSession(cardJson, opening) {
  const { entries, regexScripts } = loadCard(cardJson);

  let vars = {};
  const triggers = {};
  const rounds = []; // committed turns, round 0 (opening) upward

  function messagesSoFar() {
    const msgs = [];
    for (const r of rounds) {
      if (r.player_raw !== null) msgs.push(r.player_raw);
      msgs.push(r.char_raw);
    }
    return msgs;
  }

  function commitTurn(round, playerRaw, charRaw) {
    const patchResult = extractAndApplyPatch(charRaw, vars);
    vars = patchResult.vars;
    const visibleRaw = stripComments(charRaw);
    const { text: charHtml, warnings } = applyRegexScripts(visibleRaw, regexScripts);
    if (patchResult.warning) warnings.push(patchResult.warning);

    const record = {
      round,
      player_raw: playerRaw,
      char_raw: charRaw,
      char_html: charHtml,
      vars_snapshot: structuredClone(vars),
      patch_found: patchResult.patchFound,
      warnings,
    };
    rounds.push(record);
    return record;
  }

  commitTurn(0, null, opening?.text ?? "");

  return {
    /**
     * Mirrors the `context` subcommand: which world-book entries are active
     * given every message committed so far, plus the current tracked
     * variables. Call this before writing `round`'s turn, not after.
     */
    getContext(round) {
      const active = activeEntries(entries, messagesSoFar(), round, triggers, DEFAULT_SCAN_DEPTH);
      return {
        round,
        current_vars: structuredClone(vars),
        active_world_entries: active.map((e) => ({
          comment: e.comment || "",
          content: e.content || "",
        })),
      };
    },

    /**
     * Mirrors the `commit` subcommand: applies charText's JSON Patch block
     * (if any), strips HTML-comment blocks, renders charText through the
     * card's regex_scripts, and appends the round to the transcript.
     */
    commitRound(round, playerText, charText) {
      const record = commitTurn(round, playerText, charText);
      return {
        round,
        patch_found: record.patch_found,
        vars_after: record.vars_snapshot,
        warnings: record.warnings,
      };
    },

    /** The full round-by-round record accumulated so far (round 0 upward), for the UI to render directly -- no HTML file generation needed. */
    getTranscript() {
      return rounds.map((r) => ({ ...r }));
    },
  };
}
