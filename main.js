import {
  registerAllTools,
  draftStore,
  scenarioStore,
  sessionRegistry,
  activityLog,
  compareScenariosLogic,
} from "./src/tools/registerTools.js";
import { CHECKLIST_ASPECTS, CHECKLIST_STATUS_ICON } from "./src/tools/checklist.js";
import { SCALAR_FIELD_KEYS, ARRAY_FIELD_KEYS } from "./src/tools/draftStore.js";

const FIELD_LABELS = {
  name: "name",
  world_name: "world_name（世界書名稱）",
  description: "description",
  personality: "personality",
  scenario: "scenario",
  first_mes: "first_mes",
  mes_example: "mes_example",
  system_prompt: "system_prompt",
  creator_notes: "creator_notes",
  tags: "tags",
  alternate_greetings: "alternate_greetings",
  character_book_entries: "character_book_entries（世界書條目數）",
  regex_scripts: "regex_scripts（美化腳本數）",
};

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

/** {已執行 N 輪 -> verified tag} / {尚未執行 -> neutral tag}, shared by the
 * sidebar scenario nav and the compare-section scenario list. */
function scenarioStatusTag(scenarioId) {
  const transcript = sessionRegistry.getTranscript(scenarioId);
  if (transcript.ok) {
    const rounds = transcript.rounds.filter((r) => r.round > 0).length;
    return el("span", { class: "status-tag tag-verified", text: `已執行 ${rounds} 輪` });
  }
  return el("span", { class: "status-tag tag-neutral", text: "尚未執行" });
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

// ---- Panel: 草稿即時預覽 --------------------------------------------------

function renderChecklist() {
  const list = document.getElementById("checklist-list");
  const checklist = draftStore.getChecklistStatus();
  list.innerHTML = "";
  CHECKLIST_ASPECTS.forEach((aspect, i) => {
    const entry = checklist[aspect.key] ?? { status: "pending_ideation", note: "" };
    const row = el("li", { class: "checklist-row" }, [
      el("span", { class: "checklist-index", text: String(i + 1).padStart(2, "0") }),
      el("span", { class: "checklist-icon", text: CHECKLIST_STATUS_ICON[entry.status] ?? "⬜" }),
      el("span", { class: "checklist-label", text: aspect.label }),
      el("span", { class: "checklist-note", text: entry.note || "" }),
    ]);
    list.appendChild(row);
  });
}

function renderDraftFields() {
  const container = document.getElementById("draft-fields");
  const { fields } = draftStore.getSnapshot();
  container.innerHTML = "";
  const dl = el("dl");
  for (const key of [...SCALAR_FIELD_KEYS, ...ARRAY_FIELD_KEYS]) {
    const label = FIELD_LABELS[key] ?? key;
    dl.appendChild(el("dt", { text: label }));
    if (ARRAY_FIELD_KEYS.includes(key)) {
      const arr = fields[key] ?? [];
      dl.appendChild(el("dd", arr.length ? { text: `${arr.length} 項` } : { class: "empty", text: "（空）" }));
    } else {
      const val = fields[key] ?? "";
      dl.appendChild(val ? el("dd", { text: val }) : el("dd", { class: "empty", text: "（尚未填寫）" }));
    }
  }
  container.appendChild(dl);
}

// ---- Panel: Agent 呼叫紀錄 ------------------------------------------------

function renderActivityLog() {
  const container = document.getElementById("activity-log");
  const entries = activityLog.getEntries();
  container.innerHTML = "";
  if (entries.length === 0) {
    container.appendChild(el("div", { class: "hint", text: "尚未有任何工具呼叫。" }));
    return;
  }
  for (const entry of entries.slice().reverse()) {
    const time = new Date(entry.at).toLocaleTimeString();
    const isError = entry.result && entry.result.ok === false;
    const block = el("div", { class: "log-entry" }, [
      el("span", { class: "log-name", text: entry.toolName }),
      el("span", { text: ` · ${time}` }),
      isError ? el("span", { class: "log-error", text: " · 錯誤" }) : document.createTextNode(""),
      el("pre", { text: `args: ${JSON.stringify(entry.args)}\nresult: ${JSON.stringify(entry.result)}` }),
    ]);
    container.appendChild(block);
  }
  container.scrollTop = 0;
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

  const result = sessionRegistry.getTranscript(scenarioId);
  if (!result.ok) {
    transcriptEl.innerHTML = `<div class="hint">${escapeHtml(result.error)}</div>`;
    qaEl.innerHTML = "";
    return;
  }

  transcriptEl.innerHTML = "";
  for (const round of result.rounds) {
    const block = el("div", { class: "round-block" });
    block.appendChild(el("div", { class: "round-label", text: `第 ${round.round} 頁` }));
    if (round.player_raw !== null) {
      block.appendChild(el("div", { class: "bubble-player", text: round.player_raw }));
    }
    block.appendChild(el("div", { class: "bubble-char", html: round.char_html }));
    transcriptEl.appendChild(block);
  }

  // QA summary: derived entirely from data already returned by the tools
  // (transcript + the assembled card's world-book entries), no extra state.
  qaEl.innerHTML = "";
  const totalRounds = result.rounds.filter((r) => r.round > 0).length;
  const allWarnings = result.rounds.flatMap((r) => r.warnings.map((w) => ({ round: r.round, warning: w })));
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

  qaEl.appendChild(el("div", { class: "qa-row" }, [el("span", { text: "已跑輪數" }), el("span", { text: String(totalRounds) })]));
  qaEl.appendChild(
    el("div", { class: "qa-row" }, [el("span", { text: "JSON Patch 缺失次數" }), el("span", { text: String(patchMisses) })]),
  );
  qaEl.appendChild(
    el("div", { class: "qa-row" }, [
      el("span", { text: "從未觸發的世界書條目" }),
      el("span", { text: neverTriggeredText }),
    ]),
  );
  if (allWarnings.length === 0) {
    qaEl.appendChild(el("div", { class: "qa-row" }, [el("span", { text: "regex/patch 警告" }), el("span", { text: "無" })]));
  } else {
    for (const w of allWarnings) {
      qaEl.appendChild(
        el("div", { class: "qa-row qa-warning" }, [el("span", { text: `第 ${w.round} 頁` }), el("span", { text: w.warning })]),
      );
    }
  }
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
        el("span", { class: "scenario-label", text: `${label}（${id}）` }),
        el("span", { class: "scenario-status" }, [scenarioStatusTag(id)]),
        checkbox,
      ]),
    );
  }
}

// ---- Sidebar (taskbar): scenario library navigation --------------------
// Read-only view onto the same scenario/session data as the compare-section
// list above; its action jumps to the autotest section with that scenario
// preselected, it does not affect compareSelected.

function renderTaskbarScenarios() {
  const container = document.getElementById("taskbar-scenario-list");
  const ids = currentScenarioIds();
  container.innerHTML = "";
  if (ids.length === 0) {
    container.appendChild(el("div", { class: "scenario-nav-empty", text: "尚無情境" }));
    return;
  }
  for (const id of ids) {
    const scenario = scenarioStore.findScenario(id);
    const label = scenario ? scenario.label : id;

    const jumpBtn = el("button", { type: "button", class: "pill-btn pill-structure" }, [
      document.createTextNode("查看"),
      el("span", { class: "arrow", text: "→" }),
    ]);
    jumpBtn.addEventListener("click", () => {
      const select = document.getElementById("scenario-select");
      if ([...select.options].some((o) => o.value === id)) {
        select.value = id;
        renderAutotest();
      }
      document.getElementById("section-autotest").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    container.appendChild(
      el("div", { class: "scenario-nav-row" }, [
        el("span", { class: "nav-name", text: label }),
        el("div", { class: "nav-footer" }, [scenarioStatusTag(id), jumpBtn]),
      ]),
    );
  }
}

function renderCompareCards() {
  const container = document.getElementById("compare-cards");
  container.innerHTML = "";
  const ids = [...compareSelected];
  if (ids.length === 0) {
    container.appendChild(el("div", { class: "hint", text: "在上方「情境清單管理」勾選至少一個情境來並排比較（可左右滑動查看更多張）。" }));
    return;
  }

  // Same compare logic renderCompareSummary() below calls -- used here only
  // to classify each card's triggered world-book entries as consistent
  // (in_all) vs inconsistent (in_some) for coloring, no extra state.
  const compare = compareScenariosLogic.compareScenarios(ids);
  const inAll = new Set(compare.world_entries_triggered_in_all);
  const inSome = new Set(compare.world_entries_triggered_in_some);

  for (const id of ids) {
    const scenario = scenarioStore.findScenario(id);
    const label = scenario ? scenario.label : id;
    const meta = compare.scenarios.find((s) => s.scenario_id === id);
    const hasWarning = Boolean(meta && !meta.error && meta.patch_miss_count > 0);
    const card = el("div", { class: hasWarning ? "compare-card has-warning" : "compare-card" }, [
      el("h4", { text: `${label}（${id}）` }),
    ]);

    // Same source as renderAutotest(): sessionRegistry.getTranscript(id).
    const transcript = sessionRegistry.getTranscript(id);
    if (!transcript.ok) {
      card.appendChild(el("div", { class: "hint", text: transcript.error }));
      container.appendChild(card);
      continue;
    }

    if (meta && meta.patch_miss_count > 0) {
      card.appendChild(
        el("span", { class: "status-tag tag-warning", text: `⚠ JSON Patch 缺失 ${meta.patch_miss_count} 次` }),
      );
    }
    if (meta && meta.triggered_world_entries.length > 0) {
      const tags = el("div", { class: "compare-tags" });
      for (const comment of meta.triggered_world_entries) {
        const cls = inSome.has(comment) ? "status-tag tag-warning" : inAll.has(comment) ? "status-tag tag-verified" : "status-tag tag-neutral";
        tags.appendChild(el("span", { class: cls, text: comment }));
      }
      card.appendChild(tags);
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
  renderChecklist();
  renderDraftFields();
  renderActivityLog();
  renderScenarioSelect();
  renderAutotest();
  renderScenarioList();
  renderTaskbarScenarios();
  renderCompareCards();
  renderCompareSummary();
}

draftStore.subscribe(renderAll);
activityLog.subscribe(renderAll);
document.getElementById("scenario-select").addEventListener("change", renderAutotest);

// ---- Taskbar collapse/expand --------------------------------------------
// Non-modal by design: the ONLY thing that toggles the taskbar is this one
// button. Clicking anywhere in the main content area must never close it.

const taskbar = document.getElementById("taskbar");
const taskbarToggle = document.getElementById("taskbar-toggle");

function setTaskbarExpanded(expanded) {
  taskbar.classList.toggle("expanded", expanded);
  taskbar.classList.toggle("collapsed", !expanded);
  document.body.classList.toggle("taskbar-expanded", expanded);
}
taskbarToggle.addEventListener("click", () => {
  setTaskbarExpanded(!taskbar.classList.contains("expanded"));
});

// ---- Mode switch (創作者｜遊戲商) -----------------------------------------
// All four sections (checklist dialogue / draft / autotest / compare) are
// always rendered in one continuous vertical scroll, sharing the same
// draftStore/scenarioStore/sessionRegistry state. The mode pill no longer
// hides/shows panels -- it's a quick-jump between the "writing" end and the
// "comparing" end of that same scroll.

const modeBtnCreator = document.getElementById("mode-btn-creator");
const modeBtnMerchant = document.getElementById("mode-btn-merchant");
const scrollMain = document.getElementById("scroll-main");

function setMode(mode) {
  const isMerchant = mode === "merchant";
  modeBtnCreator.classList.toggle("active", !isMerchant);
  modeBtnMerchant.classList.toggle("active", isMerchant);
  const target = document.getElementById(isMerchant ? "section-compare" : "section-checklist");
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}
modeBtnCreator.addEventListener("click", () => setMode("creator"));
modeBtnMerchant.addEventListener("click", () => setMode("merchant"));

// ---- Scroll position dots (purely visual) --------------------------------

const dots = [...document.querySelectorAll("#scroll-dots .dot")];
const sections = [...document.querySelectorAll(".snap-section")];
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const index = Number(entry.target.dataset.sectionIndex);
        dots.forEach((dot, i) => dot.classList.toggle("active", i === index));
      }
    },
    { root: scrollMain, threshold: 0.5 },
  );
  for (const section of sections) observer.observe(section);
}

window.__tableread = { draftStore, scenarioStore, sessionRegistry, activityLog, compareScenariosLogic };

boot();
renderAll();
