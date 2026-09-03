import {
  registerAllTools,
  draftStore,
  scenarioStore,
  sessionRegistry,
  activityLog,
  compareScenariosLogic,
} from "./src/tools/registerTools.js";
import { getLocalizedAspects, CHECKLIST_STATUS_ICON } from "./src/tools/checklist.js";
import { t, getLang, setLang, otherLang } from "./src/i18n.js";

// Field-fill-rate grouping for the creator-mode KPI dashboard (option 1a).
// "必填" is the minimum set a card needs to actually run in SillyTavern;
// everything else scalar/array is "選填". character_book_entries and
// regex_scripts get their own dedicated bars instead of folding into either
// group, since their "fill rate" means something different (fraction of
// entries/scripts that are actually usable, not fraction of fields typed).
const REQUIRED_FIELD_KEYS = ["name", "description", "personality", "first_mes"];
const OPTIONAL_SCALAR_KEYS = ["world_name", "scenario", "mes_example", "system_prompt", "creator_notes"];
const OPTIONAL_ARRAY_KEYS = ["tags", "alternate_greetings"];

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) node.appendChild(c);
  return node;
}

// ---- WebMCP registration ------------------------------------------------

const STATUS_BADGE = {
  ok: { className: "badge-ok", text: (r) => t("badge.ok", r.registered.length) },
  partial: { className: "badge-warn", text: (r) => t("badge.partial", r.registered.length, r.tools.length) },
  error: { className: "badge-fail", text: (r) => t("badge.error", r.tools.length) },
  timeout: { className: "badge-fail", text: () => t("badge.timeout") },
  unsupported: { className: "badge-fail", text: () => t("badge.unsupported") },
};

async function boot() {
  const badge = document.getElementById("webmcp-status");
  const result = await registerAllTools({ lang: getLang() });

  const spec = STATUS_BADGE[result.status] ?? STATUS_BADGE.error;
  badge.textContent = spec.text(result);
  badge.className = `badge ${spec.className}`;

  if (result.failures.length > 0) {
    console.warn("[tableread] some WebMCP tools failed to register:", result.failures);
  }
  if (result.status === "timeout") {
    console.warn("[tableread] WebMCP registration timed out:", result.timeoutError);
  }

  // Debug/manual-test hook: lets you drive the tools from the DevTools
  // Console (window.__tableread.tools) the same way the WebMCP panel would,
  // useful on Chromium builds that don't yet expose document.modelContext.
  window.__tableread.tools = result.tools;
}

// ---- Panel: writing checklist + card-field fill rate ---------------------
// Compact by design (option 1a's "reduce clutter" goal) -- just icon + label,
// no per-item notes; the fuller checklist detail still lives in the raw
// draftStore state (window.__tableread.draftStore) for anyone who needs it.

function renderChecklistCompact() {
  const container = document.getElementById("checklist-compact");
  const checklist = draftStore.getChecklistStatus();
  container.innerHTML = "";
  for (const aspect of getLocalizedAspects(getLang())) {
    const entry = checklist[aspect.key] ?? { status: "pending_ideation" };
    container.appendChild(
      el("div", { class: "checklist-compact-row" }, [
        el("span", { class: "icon", text: CHECKLIST_STATUS_ICON[entry.status] ?? "⬜" }),
        el("span", { class: "label", text: aspect.label }),
      ]),
    );
  }
}

function pctFilledScalar(keys, fields) {
  if (keys.length === 0) return 0;
  const filled = keys.filter((k) => String(fields[k] ?? "").trim() !== "").length;
  return Math.round((filled / keys.length) * 100);
}

function pctFilledMixed(scalarKeys, arrayKeys, fields) {
  const total = scalarKeys.length + arrayKeys.length;
  if (total === 0) return 0;
  const filledScalar = scalarKeys.filter((k) => String(fields[k] ?? "").trim() !== "").length;
  const filledArray = arrayKeys.filter((k) => (fields[k] ?? []).length > 0).length;
  return Math.round(((filledScalar + filledArray) / total) * 100);
}

// A world-book entry counts as "usable" once it can actually match (has
// keys, or is constant) and has content to inject -- not just "exists".
function worldbookFillPct(entries) {
  if (!entries || entries.length === 0) return 0;
  const usable = entries.filter((e) => {
    const hasKeys = (e.keys && e.keys.length > 0) || (e.key && e.key.length > 0) || e.constant === true;
    return hasKeys && String(e.content ?? "").trim() !== "";
  }).length;
  return Math.round((usable / entries.length) * 100);
}

// A regex script counts as "usable" once it has a pattern to match against;
// an empty replaceString is a legitimate "delete the match" script, not an
// incomplete one.
function regexFillPct(scripts) {
  if (!scripts || scripts.length === 0) return 0;
  const usable = scripts.filter((s) => String(s.findRegex ?? "").trim() !== "").length;
  return Math.round((usable / scripts.length) * 100);
}

function renderFieldFillBars() {
  const container = document.getElementById("field-fill-bars");
  const { fields } = draftStore.getSnapshot();
  const bars = [
    { label: t("bar.required"), pct: pctFilledScalar(REQUIRED_FIELD_KEYS, fields) },
    { label: t("bar.optional"), pct: pctFilledMixed(OPTIONAL_SCALAR_KEYS, OPTIONAL_ARRAY_KEYS, fields) },
    { label: t("bar.worldbook"), pct: worldbookFillPct(fields.character_book_entries) },
    { label: t("bar.regex"), pct: regexFillPct(fields.regex_scripts) },
  ];
  container.innerHTML = "";
  for (const bar of bars) {
    const fill = el("div", { class: "field-bar-fill" });
    fill.style.width = `${bar.pct}%`;
    container.appendChild(
      el("div", { class: "field-bar" }, [
        el("div", { class: "field-bar-head" }, [
          el("span", { text: bar.label }),
          el("span", { class: "pct", text: `${bar.pct}%` }),
        ]),
        el("div", { class: "field-bar-track" }, [fill]),
      ]),
    );
  }
}

// ---- Panel: QA / Agent activity (compact) -------------------------------
// Same activity feed as before, just rendered compact (tool name + time,
// error rows in red) to match option 1a's density; click a row to expand its
// full args/result JSON in place, so the "verify tool calls" use case from
// the original panel isn't lost, just collapsed by default.

const expandedLogKeys = new Set();

function logKey(entry) {
  return `${entry.at}-${entry.toolName}`;
}

function renderActivityLogCompact() {
  const container = document.getElementById("activity-log-compact");
  const entries = activityLog.getEntries();
  container.innerHTML = "";
  if (entries.length === 0) {
    container.appendChild(el("div", { class: "hint", text: t("hint.noActivity") }));
    return;
  }
  for (const entry of entries.slice().reverse()) {
    const key = logKey(entry);
    const isError = entry.result && entry.result.ok === false;
    const time = new Date(entry.at).toLocaleTimeString();
    const row = el("div", {
      class: `log-compact-row${isError ? " log-compact-error" : ""}`,
      text: `${entry.toolName} · ${time}`,
    });
    row.addEventListener("click", () => {
      if (expandedLogKeys.has(key)) expandedLogKeys.delete(key);
      else expandedLogKeys.add(key);
      renderActivityLogCompact();
    });
    container.appendChild(row);
    if (expandedLogKeys.has(key)) {
      container.appendChild(
        el("pre", {
          class: "log-compact-detail",
          text: `args: ${JSON.stringify(entry.args)}\nresult: ${JSON.stringify(entry.result)}`,
        }),
      );
    }
  }
}

// ---- Panel: auto card-test (transcript replay + QA summary) -------------

function currentScenarioIds() {
  const listed = scenarioStore.listScenarios().map((s) => s.id);
  const active = sessionRegistry.activeScenarioIds();
  return [...new Set([...listed, ...active])];
}

function renderScenarioSelect() {
  const select = document.getElementById("scenario-select");
  const ids = currentScenarioIds();
  const previous = select.value;
  select.innerHTML = "";
  if (ids.length === 0) {
    select.appendChild(el("option", { text: t("select.noScenarios"), value: "" }));
    select.disabled = true;
    return;
  }
  select.disabled = false;
  for (const id of ids) {
    select.appendChild(el("option", { value: id, text: id }));
  }
  if (ids.includes(previous)) select.value = previous;
}

// QA data for a scenario, derived entirely from data already returned by the
// tools (transcript + the assembled card's world-book entries) -- no extra
// state. Shared by the QA panel and the KPI strip above it so both agree.
function getQaData(scenarioId) {
  const empty = { ok: false, error: null, rounds: [], totalRounds: 0, patchMisses: 0, neverTriggeredText: "", neverTriggeredCount: 0, warnings: [] };
  if (!scenarioId) return empty;

  const result = sessionRegistry.getTranscript(scenarioId);
  if (!result.ok) return { ...empty, error: result.error };

  const totalRounds = result.rounds.filter((r) => r.round > 0).length;
  const warnings = result.rounds.flatMap((r) => r.warnings.map((w) => ({ round: r.round, warning: w })));
  const patchMisses = result.rounds.filter((r) => r.round > 0 && !r.patch_found).length;

  const triggeredComments = new Set();
  for (const entry of activityLog.getEntries()) {
    if (entry.toolName === "get_playtest_context" && entry.args.scenario_id === scenarioId && entry.result?.ok) {
      for (const e of entry.result.active_world_entries) triggeredComments.add(e.comment);
    }
  }
  const { fields } = draftStore.getSnapshot();
  const allComments = (fields.character_book_entries || []).map((e) => e.comment || `(id ${e.id})`);
  const neverTriggered = allComments.filter((c) => !triggeredComments.has(c));
  const neverTriggeredText = allComments.length === 0 ? t("qa.noWorldbook") : neverTriggered.length ? neverTriggered.join("、") : t("qa.none");

  return {
    ok: true,
    error: null,
    rounds: result.rounds,
    totalRounds,
    patchMisses,
    neverTriggeredText,
    neverTriggeredCount: neverTriggered.length,
    warnings,
  };
}

function renderAutotest() {
  const select = document.getElementById("scenario-select");
  const scenarioId = select.value;
  const transcriptEl = document.getElementById("transcript");
  const qaEl = document.getElementById("qa-summary");

  if (!scenarioId) {
    transcriptEl.innerHTML = `<div class="hint">${escapeHtml(t("hint.pickScenario"))}</div>`;
    qaEl.innerHTML = "";
    return;
  }

  const qa = getQaData(scenarioId);
  if (!qa.ok) {
    transcriptEl.innerHTML = `<div class="hint">${escapeHtml(qa.error)}</div>`;
    qaEl.innerHTML = "";
    return;
  }

  transcriptEl.innerHTML = "";
  for (const round of qa.rounds) {
    const block = el("div", { class: "round-block" });
    block.appendChild(el("div", { class: "round-label", text: t("round.page", round.round) }));
    if (round.player_raw !== null) {
      block.appendChild(el("div", { class: "bubble-player", text: round.player_raw }));
    }
    block.appendChild(el("div", { class: "bubble-char", html: round.char_html }));
    transcriptEl.appendChild(block);
  }

  qaEl.innerHTML = "";
  qaEl.appendChild(el("div", { class: "qa-row" }, [el("span", { text: t("qa.rounds") }), el("span", { text: String(qa.totalRounds) })]));
  qaEl.appendChild(
    el("div", { class: "qa-row" }, [el("span", { text: t("qa.patchMisses") }), el("span", { text: String(qa.patchMisses) })]),
  );
  qaEl.appendChild(
    el("div", { class: "qa-row" }, [
      el("span", { text: t("qa.neverTriggered") }),
      el("span", { text: qa.neverTriggeredText }),
    ]),
  );
  if (qa.warnings.length === 0) {
    qaEl.appendChild(el("div", { class: "qa-row" }, [el("span", { text: t("qa.warnings") }), el("span", { text: t("qa.none") })]));
  } else {
    for (const w of qa.warnings) {
      qaEl.appendChild(
        el("div", { class: "qa-row qa-warning" }, [el("span", { text: t("round.page", w.round) }), el("span", { text: w.warning })]),
      );
    }
  }
}

// ---- KPI strip -------------------------------------------------------------
// Top-of-dashboard summary (option 1a): checklist completion, rounds run for
// the currently selected scenario, world-book entry count + never-triggered
// warning, and total agent tool calls + error count.

function renderKpis() {
  const aspects = getLocalizedAspects(getLang());
  const checklist = draftStore.getChecklistStatus();
  const knownCount = aspects.filter((a) => checklist[a.key]?.status === "known").length;
  document.getElementById("kpi-checklist-value").textContent = `${knownCount}/${aspects.length}`;
  document.getElementById("kpi-checklist-fill").style.width = `${Math.round((knownCount / aspects.length) * 100)}%`;

  const scenarioId = document.getElementById("scenario-select").value;
  const qa = getQaData(scenarioId);
  document.getElementById("kpi-rounds-value").textContent = String(qa.totalRounds);
  document.getElementById("kpi-rounds-sub").textContent = scenarioId ? t("kpi.rounds.scenario", scenarioId) : t("kpi.rounds.none");

  const { fields } = draftStore.getSnapshot();
  const entries = fields.character_book_entries || [];
  document.getElementById("kpi-worldbook-value").textContent = String(entries.length);
  const wbSub = document.getElementById("kpi-worldbook-sub");
  wbSub.textContent = qa.neverTriggeredCount > 0 ? t("kpi.worldbook.never", qa.neverTriggeredCount) : entries.length > 0 ? t("kpi.worldbook.allTriggered") : "";
  wbSub.classList.toggle("kpi-sub-warn", qa.neverTriggeredCount > 0);

  const logEntries = activityLog.getEntries();
  const errorCount = logEntries.filter((e) => e.result && e.result.ok === false).length;
  document.getElementById("kpi-calls-value").textContent = String(logEntries.length);
  const callsSub = document.getElementById("kpi-calls-sub");
  callsSub.textContent = errorCount > 0 ? t("kpi.calls.errors", errorCount) : logEntries.length > 0 ? t("kpi.calls.noErrors") : "";
  callsSub.classList.toggle("kpi-sub-warn", errorCount > 0);
}

// ---- Panel: game-publisher mode (multi-scenario compare) ----------------
// Same draftStore/scenarioStore/sessionRegistry/activityLog as creator mode --
// this is a second set of panels reading the same in-memory stores, not a
// second page (a second HTML document would reset all that in-memory state
// on navigation).

const compareSelected = new Set(); // scenario ids currently checked for comparison

function renderScenarioList() {
  const container = document.getElementById("scenario-list");
  const ids = currentScenarioIds();
  container.innerHTML = "";
  if (ids.length === 0) {
    container.appendChild(el("div", { class: "hint", text: t("hint.noScenariosMerchant") }));
    return;
  }
  for (const id of ids) {
    const scenario = scenarioStore.findScenario(id);
    const label = scenario ? scenario.label : id;
    const transcript = sessionRegistry.getTranscript(id);
    const status = transcript.ok
      ? t("scenario.ran", transcript.rounds.filter((r) => r.round > 0).length)
      : t("scenario.notRun");

    const checkbox = el("input", { type: "checkbox" });
    checkbox.checked = compareSelected.has(id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) compareSelected.add(id);
      else compareSelected.delete(id);
      renderCompareCards();
      renderCompareSummary();
    });

    container.appendChild(
      el("label", { class: "scenario-row" }, [
        checkbox,
        el("span", { class: "scenario-label", text: t("scenario.rowLabel", label, id) }),
        el("span", { class: "scenario-status", text: status }),
      ]),
    );
  }
}

function renderCompareCards() {
  const container = document.getElementById("compare-cards");
  container.innerHTML = "";
  const ids = [...compareSelected];
  if (ids.length === 0) {
    container.appendChild(el("div", { class: "hint", text: t("hint.pickToCompare") }));
    return;
  }
  for (const id of ids) {
    const scenario = scenarioStore.findScenario(id);
    const label = scenario ? scenario.label : id;
    const card = el("div", { class: "compare-card" }, [el("h4", { text: t("scenario.rowLabel", label, id) })]);

    // Same source as renderAutotest(): sessionRegistry.getTranscript(id).
    const transcript = sessionRegistry.getTranscript(id);
    if (!transcript.ok) {
      card.appendChild(el("div", { class: "hint", text: transcript.error }));
      container.appendChild(card);
      continue;
    }

    const lastRound = transcript.rounds[transcript.rounds.length - 1];
    card.appendChild(el("div", { class: "round-label", text: t("round.charFragment", lastRound.round) }));
    card.appendChild(el("div", { class: "compare-char", html: lastRound.char_html }));
    card.appendChild(el("h4", { text: t("compare.currentVars") }));
    card.appendChild(el("pre", { class: "compare-vars", text: JSON.stringify(lastRound.vars_snapshot, null, 2) }));
    container.appendChild(card);
  }
}

function renderCompareSummary() {
  const container = document.getElementById("compare-summary");
  container.innerHTML = "";
  const ids = [...compareSelected];
  if (ids.length === 0) {
    container.appendChild(el("div", { class: "hint", text: t("hint.pickForSummary") }));
    return;
  }

  // Calls the compareScenarios logic directly, same as renderAutotest() calls
  // sessionRegistry directly -- no need to go through the WebMCP execute() wrapper.
  const result = compareScenariosLogic.compareScenarios(ids);

  if (result.world_entries_triggered_in_some.length > 0) {
    container.appendChild(
      el("div", { class: "compare-alert", text: t("compare.inconsistent", result.world_entries_triggered_in_some.join("、")) }),
    );
  } else {
    container.appendChild(el("div", { class: "compare-alert compare-alert-ok", text: t("compare.consistent") }));
  }

  const okScenarios = result.scenarios.filter((s) => !s.error);
  const errorScenarios = result.scenarios.filter((s) => s.error);
  if (errorScenarios.length > 0) {
    container.appendChild(
      el("div", { class: "hint", text: t("hint.cannotCompare", errorScenarios.map((s) => s.scenario_id).join("、")) }),
    );
  }

  if (okScenarios.length > 0) {
    const varKeys = [...new Set(okScenarios.flatMap((s) => Object.keys(s.final_vars || {})))];
    const table = el("table", { class: "compare-table" });
    table.appendChild(
      el("thead", {}, [
        el("tr", {}, [el("th", { text: t("compare.varsHeader") }), ...okScenarios.map((s) => el("th", { text: s.label }))]),
      ]),
    );
    const tbody = el("tbody");
    if (varKeys.length === 0) {
      tbody.appendChild(
        el("tr", {}, [el("td", { text: t("compare.noVars"), colspan: String(okScenarios.length + 1) })]),
      );
    }
    for (const key of varKeys) {
      tbody.appendChild(
        el("tr", {}, [
          el("td", { text: key }),
          ...okScenarios.map((s) => el("td", { text: JSON.stringify(s.final_vars?.[key] ?? null) })),
        ]),
      );
    }
    table.appendChild(tbody);
    container.appendChild(table);
  }
}

// ---- Static chrome text (localised) ------------------------------------

function applyStaticText() {
  for (const node of document.querySelectorAll("[data-i18n]")) {
    node.textContent = t(node.dataset.i18n);
  }
  const langBtn = document.getElementById("lang-toggle");
  if (langBtn) langBtn.textContent = t("lang.toggleLabel");
  try {
    document.documentElement.lang = getLang() === "en" ? "en" : "zh-Hant";
  } catch {
    /* noop */
  }
}

// ---- Wiring --------------------------------------------------------------

function renderAll() {
  renderChecklistCompact();
  renderFieldFillBars();
  renderActivityLogCompact();
  renderScenarioSelect();
  renderAutotest();
  renderKpis();
  renderScenarioList();
  renderCompareCards();
  renderCompareSummary();
}

draftStore.subscribe(renderAll);
activityLog.subscribe(renderAll);
document.getElementById("scenario-select").addEventListener("change", () => {
  renderAutotest();
  renderKpis();
});

// ---- Mode switch (creator / game-publisher) ----------------------------
// Both modes are panels within this one page sharing the same WebMCP tool
// registration and the same draftStore/scenarioStore/sessionRegistry state --
// a separate HTML page would reset all of that on navigation.

const modeCreator = document.getElementById("mode-creator");
const modeMerchant = document.getElementById("mode-merchant");
const modeBtnCreator = document.getElementById("mode-btn-creator");
const modeBtnMerchant = document.getElementById("mode-btn-merchant");

function setMode(mode) {
  const isMerchant = mode === "merchant";
  modeCreator.classList.toggle("hidden", isMerchant);
  modeMerchant.classList.toggle("hidden", !isMerchant);
  modeBtnCreator.classList.toggle("active", !isMerchant);
  modeBtnMerchant.classList.toggle("active", isMerchant);
}
modeBtnCreator.addEventListener("click", () => setMode("creator"));
modeBtnMerchant.addEventListener("click", () => setMode("merchant"));

// ---- Language toggle --------------------------------------------------
// Re-registers the WebMCP tools in the chosen language and re-renders. For
// the demo, opening the page with ?lang=en registers in English once at
// boot, so this toggle is a convenience, not the critical path.

const langToggle = document.getElementById("lang-toggle");
if (langToggle) {
  langToggle.addEventListener("click", async () => {
    setLang(otherLang());
    applyStaticText();
    renderAll();
    await boot();
  });
}

window.__tableread = { draftStore, scenarioStore, sessionRegistry, activityLog, compareScenariosLogic };

applyStaticText();
boot();
renderAll();
