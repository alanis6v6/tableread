// Builds the list of playtestable scenarios for a draft: one for first_mes,
// one for each alternate_greetings entry, plus any creator-authored custom
// scenarios. Shared by both creator mode (one scenario at a time) and the
// eventual game-publisher mode (many scenarios compared side by side) --
// this store doesn't need to change for that, only the UI consuming it does.

import { t } from "../i18n.js";

export function createScenarioStore(draftStore) {
  const custom = []; // { id, text } -- label is resolved per current language

  function listScenarios() {
    const snapshot = draftStore.getSnapshot();
    const scenarios = [];

    if (snapshot.fields.first_mes) {
      scenarios.push({ id: "first_mes", label: t("scenario.firstMes"), text: snapshot.fields.first_mes });
    }
    snapshot.fields.alternate_greetings.forEach((text, i) => {
      scenarios.push({ id: `alt_${i}`, label: t("scenario.altGreeting", i + 1), text });
    });
    for (const c of custom) scenarios.push({ id: c.id, label: t("scenario.custom"), text: c.text });

    return scenarios;
  }

  function addScenario(description) {
    const id = `custom_${custom.length}`;
    const scenario = { id, text: String(description ?? "") };
    custom.push(scenario);
    return { id, label: t("scenario.custom"), text: scenario.text };
  }

  function findScenario(scenarioId) {
    return listScenarios().find((s) => s.id === scenarioId) ?? null;
  }

  return { listScenarios, addScenario, findScenario };
}
