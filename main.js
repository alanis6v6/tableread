import {
  registerAllTools,
  draftStore,
  scenarioStore,
  sessionRegistry,
  activityLog,
  compareScenariosLogic,
} from "./src/tools/registerTools.js";
import { CHECKLIST_ASPECTS, CHECKLIST_STATUS_ICON } from "./src/tools/checklist.js";
import { ARRAY_FIELD_KEYS } from "./src/tools/draftStore.js";

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

// Splits the flat card-field list into the draft preview's two loose
// key-value quadrants (a UI grouping only -- draftStore itself has no
// notion of "quadrants").
const DRAFT_LEFT_KEYS = ["name", "world_name", "description", "personality", "character_book_entries"];
const DRAFT_RIGHT_KEYS = ["scenario", "first_mes", "mes_example", "alternate_greetings", "system_prompt", "creator_notes", "tags", "regex_scripts"];

// Groups the 8 checklist aspects for the checklist-dialogue section. Order
// matches CHECKLIST_ASPECTS exactly (see src/tools/checklist.js) -- this is
// purely a presentation grouping, not a change to that data.
const CHECKLIST_GROUPS = [
  { label: "角色核心", desc: "先把會反覆用到的人物、世界觀與關鍵事件釘住。", keys: ["cast", "world_rules", "special_events"] },
  { label: "情感與故事", desc: "確認情感／親密偏好、背景故事與 NPC 關係網。", keys: ["intimacy_preferences", "backstory", "npc_network"] },
  { label: "技術設定", desc: "確認角色心理狀態進展脈絡，並決定要不要上 MVU 動態變量卡。", keys: ["psych_arc", "mvu"] },
];

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
  const checklist = draftStore.getChecklistStatus();
  const aspectByKey = Object.fromEntries(CHECKLIST_ASPECTS.map((a, i) => [a.key, { ...a, index: i }]));
  const statusOf = (key) => checklist[key]?.status ?? "pending_ideation";

  const doneCount = CHECKLIST_ASPECTS.filter((a) => statusOf(a.key) === "known").length;
  document.getElementById("checklist-fraction").textContent = `${doneCount}/${CHECKLIST_ASPECTS.length}`;

  const activeGroup = CHECKLIST_GROUPS.find((g) => g.keys.some((k) => statusOf(k) !== "known"));
  document.getElementById("checklist-anchor-desc").textContent = activeGroup
    ? activeGroup.desc
    : "八個面向都已確認，可以進入草稿撰寫。";

  const groupsContainer = document.getElementById("checklist-groups");
  groupsContainer.innerHTML = "";
  for (const group of CHECKLIST_GROUPS) {
    const list = el("ol", { class: "group-list" });
    for (const key of group.keys) {
      const aspect = aspectByKey[key];
      const entry = checklist[key] ?? { status: "pending_ideation", note: "" };
      const isDone = entry.status === "known";
      const row = el("li", { class: isDone ? "checklist-row is-done" : "checklist-row" }, [
        el("span", { class: "checklist-index", text: String(aspect.index + 1).padStart(2, "0") }),
        el("span", { class: "checklist-icon", text: CHECKLIST_STATUS_ICON[entry.status] ?? "⬜" }),
        el("span", { class: "checklist-label", text: aspect.label }),
        el("span", { class: "checklist-note", text: entry.note || "" }),
      ]);
      list.appendChild(row);
    }
    groupsContainer.appendChild(
      el("div", { class: "checklist-group panel-card" }, [el("div", { class: "group-label", text: group.label }), list]),
    );
  }
}

/** Purely presentational data-quality checks -- derived only from fields
 * already in draftStore, no new validation logic added to the store. */
function fieldWarning(key, fields) {
  if (key === "character_book_entries") {
    const missing = (fields.character_book_entries || []).filter((e) => !e.content);
    if (missing.length > 0) return `有 ${missing.length} 筆條目沒有 content，不會產生任何效果`;
  }
  if (key === "regex_scripts") {
    const missing = (fields.regex_scripts || []).filter((s) => !s.findRegex);
    if (missing.length > 0) return `有 ${missing.length} 個腳本缺少 findRegex，套用時會被忽略`;
  }
  return null;
}

function renderKvBlock(containerId, keys, fields) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  for (const key of keys) {
    const item = el("div", { class: "kv-item" }, [el("div", { class: "kv-label", text: FIELD_LABELS[key] ?? key })]);
    if (ARRAY_FIELD_KEYS.includes(key)) {
      const arr = fields[key] ?? [];
      item.appendChild(
        arr.length ? el("div", { class: "kv-value", text: `${arr.length} 項` }) : el("div", { class: "kv-value empty", text: "（空）" }),
      );
    } else {
      const val = fields[key] ?? "";
      item.appendChild(val ? el("div", { class: "kv-value", text: val }) : el("div", { class: "kv-value empty", text: "（尚未填寫）" }));
    }
    const warning = fieldWarning(key, fields);
    // Only fields that actually have something wrong grow a warning card --
    // everything else takes up no extra space.
    if (warning) item.appendChild(el("div", { class: "kv-warning-card", text: `⚠ ${warning}` }));
    container.appendChild(item);
  }
}

function renderDraftFields() {
  const { fields } = draftStore.getSnapshot();

  document.getElementById("draft-banner-name").textContent = fields.name || "尚未命名的角色";
  document.getElementById("draft-banner-desc").textContent = fields.description || fields.personality || "尚未填寫 description。";

  renderKvBlock("draft-quadrant-cast", DRAFT_LEFT_KEYS, fields);
  renderKvBlock("draft-quadrant-tech", DRAFT_RIGHT_KEYS, fields);
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
  const chipsEl = document.getElementById("autotest-chips");

  if (!scenarioId) {
    transcriptEl.innerHTML = '<div class="hint">選一個已經 run_scenario 過的情境來查看回放。</div>';
    chipsEl.innerHTML = "";
    return;
  }

  const result = sessionRegistry.getTranscript(scenarioId);
  if (!result.ok) {
    transcriptEl.innerHTML = `<div class="hint">${escapeHtml(result.error)}</div>`;
    chipsEl.innerHTML = "";
    return;
  }

  transcriptEl.innerHTML = "";
  for (const round of result.rounds) {
    transcriptEl.appendChild(el("div", { class: "chat-round-label", text: `第 ${round.round} 頁` }));
    if (round.player_raw !== null) {
      transcriptEl.appendChild(el("div", { class: "chat-row player" }, [el("div", { class: "chat-bubble player", text: round.player_raw })]));
    }
    transcriptEl.appendChild(el("div", { class: "chat-row char" }, [el("div", { class: "chat-bubble char", html: round.char_html })]));
  }

  // QA chips: derived entirely from data already returned by the tools
  // (transcript + the assembled card's world-book entries), no extra state.
  // Each chip only renders when its condition actually holds -- no
  // always-on placeholder chips.
  chipsEl.innerHTML = "";
  const allWarnings = result.rounds.flatMap((r) => r.warnings);
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

  if (allComments.length > 0 && neverTriggered.length === 0) {
    chipsEl.appendChild(el("span", { class: "status-tag tag-verified qa-chip", text: "世界書 ✓" }));
  }
  if (allWarnings.length > 0) {
    chipsEl.appendChild(el("span", { class: "status-tag tag-warning qa-chip", text: "regex ⚠" }));
  }
  if (patchMisses > 0) {
    chipsEl.appendChild(el("span", { class: "status-tag tag-structure qa-chip", text: "節奏 ◐" }));
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
      renderCompareAnchor();
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

// The left anchor card: the compare section's conclusion, visible the
// instant you scroll in, before touching the horizontal card strip at all.
function renderCompareAnchor() {
  const anchor = document.getElementById("compare-anchor");
  const body = document.getElementById("compare-anchor-body");
  const ids = [...compareSelected];
  body.innerHTML = "";

  if (ids.length === 0) {
    anchor.className = "compare-anchor anchor-empty";
    body.appendChild(el("div", { class: "hint", text: "在右側「情境清單管理」勾選至少一個情境，這裡會立刻顯示跨情境的不一致摘要。" }));
    return;
  }

  // Calls the compareScenarios logic directly, same as renderCompareCards()/
  // renderCompareSummary() do -- pure and cheap, no extra state to keep in sync.
  const result = compareScenariosLogic.compareScenarios(ids);

  if (result.world_entries_triggered_in_some.length > 0) {
    anchor.className = "compare-anchor anchor-warning";
    body.appendChild(
      el("div", {}, [
        el("strong", { text: "⚠ 觸發不一致" }),
        el("span", { text: `部分情境觸發、部分沒有（QA 重點）：${result.world_entries_triggered_in_some.join("、")}` }),
      ]),
    );
  } else {
    anchor.className = "compare-anchor anchor-ok";
    body.appendChild(
      el("div", {}, [el("strong", { text: "✓ 觸發一致" }), el("span", { text: "沒有偵測到跨情境觸發不一致的世界書條目。" })]),
    );
  }

  const errorScenarios = result.scenarios.filter((s) => s.error);
  if (errorScenarios.length > 0) {
    body.appendChild(
      el("div", { class: "hint", text: `尚未執行、無法比較：${errorScenarios.map((s) => s.scenario_id).join("、")}` }),
    );
  }
}

function renderCompareSummary() {
  const container = document.getElementById("compare-summary");
  container.innerHTML = "";
  const ids = [...compareSelected];
  if (ids.length === 0) {
    container.appendChild(el("div", { class: "hint", text: "勾選情境後才能列出跨情境變量比較表。" }));
    return;
  }

  const result = compareScenariosLogic.compareScenarios(ids);
  const okScenarios = result.scenarios.filter((s) => !s.error);
  if (okScenarios.length === 0) {
    container.appendChild(el("div", { class: "hint", text: "勾選的情境都還沒 run_scenario 過，沒有變量可比較。" }));
    return;
  }

  const varKeys = [...new Set(okScenarios.flatMap((s) => Object.keys(s.final_vars || {})))];
  const table = el("table", { class: "compare-table" });
  table.appendChild(
    el("thead", {}, [el("tr", {}, [el("th", { text: "變量" }), ...okScenarios.map((s) => el("th", { text: s.label }))])]),
  );
  const tbody = el("tbody");
  if (varKeys.length === 0) {
    tbody.appendChild(el("tr", {}, [el("td", { text: "（尚無變量）", colspan: String(okScenarios.length + 1) })]));
  }
  for (const key of varKeys) {
    tbody.appendChild(
      el("tr", {}, [el("td", { text: key }), ...okScenarios.map((s) => el("td", { text: JSON.stringify(s.final_vars?.[key] ?? null) }))]),
    );
  }
  table.appendChild(tbody);
  container.appendChild(table);
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
  renderCompareAnchor();
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

// ---- Bottom console drawer (Agent 呼叫紀錄) ------------------------------
// A separate drawer with its own toggle/state, independent of the taskbar --
// opening one never touches the other.

const consoleDrawer = document.getElementById("console-drawer");
const consoleToggle = document.getElementById("console-toggle");
const consoleTabArrow = document.getElementById("console-tab-arrow");

function setConsoleExpanded(expanded) {
  consoleDrawer.classList.toggle("expanded", expanded);
  consoleDrawer.classList.toggle("collapsed", !expanded);
  consoleTabArrow.textContent = expanded ? "▼" : "▲";
}
consoleToggle.addEventListener("click", () => {
  setConsoleExpanded(!consoleDrawer.classList.contains("expanded"));
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
