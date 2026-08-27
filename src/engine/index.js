// Deterministic playtest engine, ported from
// reference/st-writer-src/.claude/skills/sillytavern-card-generator/scripts/playtest_engine.py.
//
// Division of labor (kept intact from the Python original, load-bearing for
// the WebMCP architecture): this module only does the parts of a playtest
// round that should be *computed* -- which world-book entries actually fire
// given the running conversation, how a card's regex_scripts actually render
// a raw model turn into HTML, and how a JSON Patch variable-update block
// actually mutates tracked state. Writing the player's line and the
// character's in-character response is judgment/creative work and belongs
// to whichever LLM is driving the calling browser agent -- this module never
// calls an LLM itself, it only keeps that generation honest to what the
// assembled card would really inject and really render.

export { loadCard } from "./card.js";
export { entryMatches, secondaryOk, activeEntries } from "./worldbook.js";
export { parseFindRegex, applyRegexScripts } from "./regex.js";
export {
  PATCH_BLOCK_RE,
  COMMENT_RE,
  applyJsonPatch,
  extractAndApplyPatch,
  stripComments,
} from "./jsonpatch.js";
