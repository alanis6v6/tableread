// Keyed store of one live playtest session per scenarioId. run_scenario
// (re)creates the session for a scenario from the draft's *current* state --
// so a playtest run always reflects the latest edits, not whatever the draft
// looked like the first time that scenario was run -- and the other tools
// just look the session up by scenarioId and delegate to it.
import { createPlaytestSession } from "../engine/session.js";
import { assembleCard } from "./cardAssembler.js";

export function createSessionRegistry(draftStore, scenarioStore) {
  const sessions = new Map(); // scenarioId -> { session, targetRounds }

  function runScenario(scenarioId, rounds) {
    const scenario = scenarioStore.findScenario(scenarioId);
    if (!scenario) {
      return { ok: false, error: `unknown scenario_id "${scenarioId}". Call list_scenarios first.` };
    }
    const card = assembleCard(draftStore.getSnapshot().fields);
    const session = createPlaytestSession(card, scenario);
    sessions.set(scenarioId, { session, targetRounds: rounds });
    return {
      ok: true,
      scenario_id: scenarioId,
      opening_text: scenario.text,
      target_rounds: rounds,
    };
  }

  function requireSession(scenarioId) {
    const entry = sessions.get(scenarioId);
    if (!entry) {
      return { ok: false, error: `no active session for scenario_id "${scenarioId}". Call run_scenario first.` };
    }
    return { ok: true, entry };
  }

  function getPlaytestContext(scenarioId, round) {
    const found = requireSession(scenarioId);
    if (!found.ok) return found;
    return { ok: true, ...found.entry.session.getContext(round) };
  }

  function commitPlaytestRound(scenarioId, round, playerText, charText) {
    const found = requireSession(scenarioId);
    if (!found.ok) return found;
    return { ok: true, ...found.entry.session.commitRound(round, playerText, charText) };
  }

  function getTranscript(scenarioId) {
    const found = requireSession(scenarioId);
    if (!found.ok) return found;
    return { ok: true, scenario_id: scenarioId, rounds: found.entry.session.getTranscript() };
  }

  function activeScenarioIds() {
    return [...sessions.keys()];
  }

  return { runScenario, getPlaytestContext, commitPlaytestRound, getTranscript, activeScenarioIds };
}
