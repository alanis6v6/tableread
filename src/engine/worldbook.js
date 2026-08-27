// Ported from playtest_engine.py's active_entries()/entry_matches()/secondary_ok().
// This mirrors SillyTavern's keyword-scan world-book activation closely enough
// for deterministic playtest purposes -- it is a documented approximation, not
// a byte-perfect emulation of SillyTavern itself (see the AND_ANY/selectiveLogic
// note below, inherited verbatim from the Python original).

export function entryMatches(entry, textLower) {
  const keys = entry.keys || entry.key || [];
  return keys.some((k) => k && textLower.includes(String(k).toLowerCase()));
}

export function secondaryOk(entry, textLower) {
  if (!entry.selective) return true;
  const sec = entry.secondary_keys || entry.keysecondary || [];
  if (!sec || sec.length === 0) return true;
  const ext = entry.extensions || {};
  const logic = ext.selectiveLogic ?? 0;
  const hits = sec.map((k) => Boolean(k && textLower.includes(String(k).toLowerCase())));
  if (logic === 3) return hits.every(Boolean); // AND_ALL
  if (logic === 2) return !hits.some(Boolean); // NOT_ANY
  if (logic === 1) return !hits.every(Boolean); // NOT_ALL
  return hits.some(Boolean); // AND_ANY (default / logic == 0)
}

/**
 * Returns the entries considered active this round. `messages` is the
 * chronological list of every player/character turn so far (most recent
 * last); each entry only scans its own trailing window of that list
 * (extensions.scan_depth, falling back to defaultScanDepth), mirroring
 * SillyTavern's scan-depth-limited keyword search rather than matching
 * against the entire chat history forever. Mutates triggerState in place
 * (per-entry last-triggered round) so sticky / cooldown / delay behave
 * correctly across repeated calls.
 */
export function activeEntries(entries, messages, roundNum, triggerState, defaultScanDepth = 4) {
  const active = [];
  for (const e of entries) {
    if (e.enabled === false) continue;
    const eid = String(e.id);
    const ext = e.extensions || {};
    const lastRound = triggerState[eid]?.last_round ?? null;
    const sticky = ext.sticky || 0;
    const cooldown = ext.cooldown || 0;
    const delay = ext.delay || 0;
    const scanDepth = ext.scan_depth || defaultScanDepth;

    if (delay && roundNum < delay) continue;

    const window = scanDepth ? messages.slice(-scanDepth) : messages;
    const textLower = window.join("\n").toLowerCase();

    let hit = e.constant ? true : entryMatches(e, textLower) && secondaryOk(e, textLower);

    if (!hit && sticky && lastRound !== null && roundNum - lastRound <= sticky) {
      hit = true; // still within its sticky window
    }

    if (hit && !e.constant && cooldown && lastRound !== null && roundNum - lastRound < cooldown) {
      hit = false; // keyword matched again too soon after last trigger
    }

    if (hit) {
      active.push(e);
      triggerState[eid] = { last_round: roundNum };
    }
  }
  return active;
}
