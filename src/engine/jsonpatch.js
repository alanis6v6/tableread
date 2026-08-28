// Ported from playtest_engine.py's apply_json_patch()/extract_and_apply_patch().
// Applies the RFC 6902-flavored JSON Patch block a card's "variable update
// brain" world-book entry instructs the model to emit after each turn,
// wrapped in <!-- <VariableUpdateLog><JSONPatch>...</JSONPatch></VariableUpdateLog> -->.

export const PATCH_BLOCK_RE =
  /<!--\s*<VariableUpdateLog>[\s\S]*?<JSONPatch>([\s\S]*?)<\/JSONPatch>[\s\S]*?<\/VariableUpdateLog>\s*-->/;

export const COMMENT_RE = /<!--[\s\S]*?-->/g;

/** Mutates and returns varsState by applying each { op, path, value } (only
 * "replace"-style path/value writes are meaningfully used by these cards;
 * op itself is not branched on, matching the Python original). */
export function applyJsonPatch(varsState, patchOps) {
  for (const op of patchOps) {
    const path = op.path || "";
    const segments = path.split("/").filter((s) => s.length > 0);
    if (segments.length === 0) continue;
    let target = varsState;
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      if (!(seg in target)) target[seg] = {};
      target = target[seg];
    }
    target[segments[segments.length - 1]] = op.value;
  }
  return varsState;
}

/**
 * Finds the <VariableUpdateLog><JSONPatch> block in raw model output and
 * applies it to varsState. Returns { vars, patchFound, warning }.
 *
 * patchFound and warning are independent signals, not one derived from the
 * other: no block in rawText at all is the normal "this turn didn't update
 * variables" case -- patchFound: false, warning: null, nothing to report.
 * warning is only ever set when a block IS present but its contents fail to
 * JSON.parse -- that's the actual malformed-output case worth surfacing.
 * Don't read "warnings is empty" as "patch_found was true".
 */
export function extractAndApplyPatch(rawText, varsState) {
  const m = rawText.match(PATCH_BLOCK_RE);
  if (!m) return { vars: varsState, patchFound: false, warning: null };
  try {
    const ops = JSON.parse(m[1]);
    applyJsonPatch(varsState, ops);
    return { vars: varsState, patchFound: true, warning: null };
  } catch (ex) {
    return { vars: varsState, patchFound: false, warning: `could not parse JSON Patch block: ${ex.message}` };
  }
}

/** Strips ALL HTML-comment blocks (not just the patch block) from text,
 * matching commit's "visible_raw = COMMENT_RE.sub('', char_raw)" step. */
export function stripComments(text) {
  return text.replace(COMMENT_RE, "");
}
