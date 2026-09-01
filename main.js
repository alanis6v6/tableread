import {
  registerAllTools,
  draftStore,
  scenarioStore,
  sessionRegistry,
  activityLog,
  compareScenariosLogic,
} from "./src/tools/registerTools.js";
import { CHECKLIST_ASPECTS, CHECKLIST_STATUS_ICON } from "./src/tools/checklist.js";

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
  ok: { className: "badge-ok", text: (r) => `WebMCP 已註冊 ${r.registered.length} 個工具` },
  partial: {
    className: "badge-warn",
    text: (r) => `WebMCP 註冊部分失敗：成功 ${r.registered.length}/${r.tools.length} 個（詳見主控台）`,
  },
  error: {
    className: "badge-fail",
    text: (r) => `WebMCP 註冊全部失敗（${r.tools.length} 個工具皆失敗，詳見主控台）`,
  },
  timeout: {
    className: "badge-fail",
    text: () => "WebMCP 註冊逾時，可能是實驗性 API 尚未完全支援",
  },
  unsupported: {
    className: "badge-fail",
    text: () => "此瀏覽器/情境不支援 document.modelContext（需要 secure context，localhost 開發即可）",
  },
};

async function boot() {
  const badge = document.getElementById("webmcp-status");
  const result = await registerAllTools();

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

// ---- Panel: 撰寫檢核表 + 卡片欄位填寫率 -----------------------------------
// Compact by design (option 1a's "reduce clutter" goal) -- just icon + label,
// no per-item notes; the fuller checklist detail still lives in the raw
// draftStore state (window.__tableread.draftStore) for anyone who needs it.

function renderChecklistCompact() {
  const container = document.getElementById("checklist-compact");
  const checklist = draftStore.getChecklistStatus();
  container.innerHTML = "";
  for (const aspect of CHECKLIST_ASPECTS) {
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
    { label: "必填欄位", pct: pctFilledScalar(REQUIRED_FIELD_KEYS, fields) },
    { label: "選填欄位", pct: pctFilledMixed(OPTIONAL_SCALAR_KEYS, OPTIONAL_ARRAY_KEYS, fields) },
    { label: "世界書", pct: worldbookFillPct(fields.character_book_entries) },
    { label: "regex 腳本", pct: regexFillPct(fields.regex_scripts) },
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

// ---- Panel: QA / Agent 活動 (compact) -------------------------------------
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
    container.appendChild(el("div", { class: "hint", text: "尚未有任何工具呼叫。" }));
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

// ---- Panel: 自動測卡（對話回放 + QA 摘要） --------------------------------

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
    select.appendChild(el("option", { text: "（尚無情境）", value: "" }));
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
  const neverTriggeredText = allComments.length === 0 ? "（尚無世界書條目）" : neverTriggered.length ? neverTriggered.join("、") : "無";

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
    transcriptEl.innerHTML = '<div class="hint">選一個已經 run_scenario 過的情境來查看回放。</div>';
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
    block.appendChild(el("div", { class: "round-label", text: `第 ${round.round} 頁` }));
    if (round.player_raw !== null) {
      block.appendChild(el("div", { class: "bubble-player", text: round.player_raw }));
    }
    block.appendChild(el("div", { class: "bubble-char", html: round.char_html }));
    transcriptEl.appendChild(block);
  }

  qaEl.innerHTML = "";
  qaEl.appendChild(el("div", { class: "qa-row" }, [el("span", { text: "已跑輪數" }), el("span", { text: String(qa.totalRounds) })]));
  qaEl.appendChild(
    el("div", { class: "qa-row" }, [el("span", { text: "JSON Patch 缺失次數" }), el("span", { text: String(qa.patchMisses) })]),
  );
  qaEl.appendChild(
    el("div", { class: "qa-row" }, [
      el("span", { text: "從未觸發的世界書條目" }),
      el("span", { text: qa.neverTriggeredText }),
    ]),
  );
  if (qa.warnings.length === 0) {
    qaEl.appendChild(el("div", { class: "qa-row" }, [el("span", { text: "regex/patch 警告" }), el("span", { text: "無" })]));
  } else {
    for (const w of qa.warnings) {
      qaEl.appendChild(
        el("div", { class: "qa-row qa-warning" }, [el("span", { text: `第 ${w.round} 頁` }), el("span", { text: w.warning })]),
      );
    }
  }
}

// ---- KPI strip -------------------------------------------------------------
// Top-of-dashboard summary (option 1a): checklist completion, rounds run for
// the currently selected scenario, world-book entry count + never-triggered
// warning, and total agent tool calls + error count.

function renderKpis() {
  const checklist = draftStore.getChecklistStatus();
  const knownCount = CHECKLIST_ASPECTS.filter((a) => checklist[a.key]?.status === "known").length;
  document.getElementById("kpi-checklist-value").textContent = `${knownCount}/${CHECKLIST_ASPECTS.length}`;
  document.getElementById("kpi-checklist-fill").style.width = `${Math.round((knownCount / CHECKLIST_ASPECTS.length) * 100)}%`;

  const scenarioId = document.getElementById("scenario-select").value;
  const qa = getQaData(scenarioId);
  document.getElementById("kpi-rounds-value").textContent = String(qa.totalRounds);
  document.getElementById("kpi-rounds-sub").textContent = scenarioId ? `情境：${scenarioId}` : "情境：（尚無情境）";

  const { fields } = draftStore.getSnapshot();
  const entries = fields.character_book_entries || [];
  document.getElementById("kpi-worldbook-value").textContent = String(entries.length);
  const wbSub = document.getElementById("kpi-worldbook-sub");
  wbSub.textContent = qa.neverTriggeredCount > 0 ? `${qa.neverTriggeredCount} 條從未觸發` : entries.length > 0 ? "已全數觸發" : "";
  wbSub.classList.toggle("kpi-sub-warn", qa.neverTriggeredCount > 0);

  const logEntries = activityLog.getEntries();
  const errorCount = logEntries.filter((e) => e.result && e.result.ok === false).length;
  document.getElementById("kpi-calls-value").textContent = String(logEntries.length);
  const callsSub = document.getElementById("kpi-calls-sub");
  callsSub.textContent = errorCount > 0 ? `${errorCount} 次錯誤` : logEntries.length > 0 ? "無錯誤" : "";
  callsSub.classList.toggle("kpi-sub-warn", errorCount > 0);
}

// ---- Panel: 遊戲商模式（多情境比較） --------------------------------------
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
    container.appendChild(
      el("div", { class: "hint", text: "（尚無情境，先在創作者模式寫 first_mes，或呼叫 add_scenario。）" }),
    );
    return;
  }
  for (const id of ids) {
    const scenario = scenarioStore.findScenario(id);
    const label = scenario ? scenario.label : id;
    const transcript = sessionRegistry.getTranscript(id);
    const status = transcript.ok
      ? `已執行 ${transcript.rounds.filter((r) => r.round > 0).length} 輪`
      : "尚未執行";

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
        el("span", { class: "scenario-label", text: `${label}（${id}）` }),
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
    container.appendChild(el("div", { class: "hint", text: "在左邊「情境清單管理」勾選至少一個情境來並排比較。" }));
    return;
  }
  for (const id of ids) {
    const scenario = scenarioStore.findScenario(id);
    const label = scenario ? scenario.label : id;
    const card = el("div", { class: "compare-card" }, [el("h4", { text: `${label}（${id}）` })]);

    // Same source as renderAutotest(): sessionRegistry.getTranscript(id).
    const transcript = sessionRegistry.getTranscript(id);
    if (!transcript.ok) {
      card.appendChild(el("div", { class: "hint", text: transcript.error }));
      container.appendChild(card);
      continue;
    }

    const lastRound = transcript.rounds[transcript.rounds.length - 1];
    card.appendChild(el("div", { class: "round-label", text: `第 ${lastRound.round} 頁角色回應片段` }));
    card.appendChild(el("div", { class: "compare-char", html: lastRound.char_html }));
    card.appendChild(el("h4", { text: "目前變量" }));
    card.appendChild(el("pre", { class: "compare-vars", text: JSON.stringify(lastRound.vars_snapshot, null, 2) }));
    container.appendChild(card);
  }
}

function renderCompareSummary() {
  const container = document.getElementById("compare-summary");
  container.innerHTML = "";
  const ids = [...compareSelected];
  if (ids.length === 0) {
    container.appendChild(el("div", { class: "hint", text: "勾選情境後才能算跨情境比較摘要。" }));
    return;
  }

  // Calls the compareScenarios logic directly, same as renderAutotest() calls
  // sessionRegistry directly -- no need to go through the WebMCP execute() wrapper.
  const result = compareScenariosLogic.compareScenarios(ids);

  if (result.world_entries_triggered_in_some.length > 0) {
    container.appendChild(
      el("div", {
        class: "compare-alert",
        text: `⚠ 觸發不一致的世界書條目（部分情境觸發、部分沒有，QA 重點）：${result.world_entries_triggered_in_some.join("、")}`,
      }),
    );
  } else {
    container.appendChild(
      el("div", { class: "compare-alert compare-alert-ok", text: "沒有偵測到跨情境觸發不一致的世界書條目。" }),
    );
  }

  const okScenarios = result.scenarios.filter((s) => !s.error);
  const errorScenarios = result.scenarios.filter((s) => s.error);
  if (errorScenarios.length > 0) {
    container.appendChild(
      el("div", { class: "hint", text: `尚未執行、無法比較：${errorScenarios.map((s) => s.scenario_id).join("、")}` }),
    );
  }

  if (okScenarios.length > 0) {
    const varKeys = [...new Set(okScenarios.flatMap((s) => Object.keys(s.final_vars || {})))];
    const table = el("table", { class: "compare-table" });
    table.appendChild(
      el("thead", {}, [
        el("tr", {}, [el("th", { text: "變量" }), ...okScenarios.map((s) => el("th", { text: s.label }))]),
      ]),
    );
    const tbody = el("tbody");
    if (varKeys.length === 0) {
      tbody.appendChild(
        el("tr", {}, [el("td", { text: "（尚無變量）", colspan: String(okScenarios.length + 1) })]),
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

// ---- Mode switch (創作者模式 / 遊戲商模式) ---------------------------------
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

window.__tableread = { draftStore, scenarioStore, sessionRegistry, activityLog, compareScenariosLogic };

boot();
renderAll();
