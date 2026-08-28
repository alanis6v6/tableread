// Cross-scenario QA comparison for game-publisher mode: given a set of
// scenario_ids that have already been run (via run_scenario +
// get_playtest_context/commit_playtest_round), pulls together what each
// scenario's run already produced into a side-by-side comparison. This
// module keeps no state of its own -- every field is derived from
// sessionRegistry.getTranscript(), scenarioStore.findScenario() and
// activityLog.getEntries(), the same already-recorded data (and the same
// "derive, don't track" principle) main.js's renderAutotest() already uses
// for its own QA summary.
//
// Pure, DOM-free logic so it can be unit-tested the same way sessionRegistry
// is; registerTools.js wraps it as the compare_scenarios WebMCP tool.

export function createCompareScenarios(draftStore, scenarioStore, sessionRegistry, activityLog) {
  // Every world-book entry comment that showed up in an active_world_entries
  // list from a get_playtest_context call for this scenario, in first-seen
  // order, deduplicated -- mirrors renderAutotest()'s neverTriggered logic.
  function triggeredWorldEntries(scenarioId) {
    const seen = new Set();
    const comments = [];
    for (const entry of activityLog.getEntries()) {
      if (entry.toolName !== "get_playtest_context") continue;
      if (entry.args?.scenario_id !== scenarioId) continue;
      if (!entry.result?.ok) continue;
      for (const e of entry.result.active_world_entries) {
        if (!seen.has(e.comment)) {
          seen.add(e.comment);
          comments.push(e.comment);
        }
      }
    }
    return comments;
  }

  /**
   * @param {string[]} scenarioIds
   * @returns {{
   *   ok: true,
   *   scenarios: Array<{scenario_id: string, error: string} | {
   *     scenario_id: string, label: string, rounds_played: number,
   *     final_vars: object, warnings_count: number, patch_miss_count: number,
   *     triggered_world_entries: string[],
   *   }>,
   *   world_entries_triggered_in_all: string[],
   *   world_entries_triggered_in_some: string[],
   *   world_entries_never_triggered_in_any: string[],
   * }}
   */
  function compareScenarios(scenarioIds) {
    const scenarios = [];
    const triggeredSets = []; // one Set per successfully-resolved scenario

    for (const scenarioId of scenarioIds) {
      const transcript = sessionRegistry.getTranscript(scenarioId);
      if (!transcript.ok) {
        scenarios.push({ scenario_id: scenarioId, error: "尚未執行" });
        continue;
      }

      const rounds = transcript.rounds;
      const playedRounds = rounds.filter((r) => r.round > 0);
      const lastRound = rounds[rounds.length - 1];
      const triggered = triggeredWorldEntries(scenarioId);
      const scenarioMeta = scenarioStore.findScenario(scenarioId);

      scenarios.push({
        scenario_id: scenarioId,
        label: scenarioMeta?.label ?? scenarioId,
        rounds_played: playedRounds.length,
        final_vars: lastRound.vars_snapshot,
        warnings_count: rounds.reduce((sum, r) => sum + r.warnings.length, 0),
        patch_miss_count: playedRounds.filter((r) => !r.patch_found).length,
        triggered_world_entries: triggered,
      });
      triggeredSets.push(new Set(triggered));
    }

    const union = new Set();
    for (const s of triggeredSets) for (const c of s) union.add(c);

    const intersection = new Set(union);
    for (const s of triggeredSets) {
      for (const c of intersection) {
        if (!s.has(c)) intersection.delete(c);
      }
    }
    if (triggeredSets.length === 0) intersection.clear();

    const inSome = [...union].filter((c) => !intersection.has(c));

    const { fields } = draftStore.getSnapshot();
    const allComments = (fields.character_book_entries || []).map((e) => e.comment || `(id ${e.id})`);
    const neverTriggered = allComments.filter((c) => !union.has(c));

    return {
      ok: true,
      scenarios,
      world_entries_triggered_in_all: [...intersection],
      world_entries_triggered_in_some: inSome,
      world_entries_never_triggered_in_any: neverTriggered,
    };
  }

  return { compareScenarios };
}
