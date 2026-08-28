import {
  registerAllTools,
  draftStore,
  scenarioStore,
  sessionRegistry,
  activityLog,
} from "../src/tools/registerTools.js";
import { CHECKLIST_ASPECTS, CHECKLIST_STATUS_ICON } from "../src/tools/checklist.js";
import { SCALAR_FIELD_KEYS, ARRAY_FIELD_KEYS } from "../src/tools/draftStore.js";

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
  const body = document.getElementById("checklist-body");
  const checklist = draftStore.getChecklistStatus();
  body.innerHTML = "";
  for (const aspect of CHECKLIST_ASPECTS) {
    const entry = checklist[aspect.key] ?? { status: "pending_ideation", note: "" };
    const tr = el("tr", {}, [
      el("td", { class: "icon", text: CHECKLIST_STATUS_ICON[entry.status] ?? "⬜" }),
      el("td", { text: aspect.label }),
      el("td", { class: "note", text: entry.note || "" }),
    ]);
    body.appendChild(tr);
  }
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

// ---- Wiring --------------------------------------------------------------

function renderAll() {
  renderChecklist();
  renderDraftFields();
  renderActivityLog();
  renderScenarioSelect();
  renderAutotest();
}

draftStore.subscribe(renderAll);
activityLog.subscribe(renderAll);
document.getElementById("scenario-select").addEventListener("change", renderAutotest);

window.__tableread = { draftStore, scenarioStore, sessionRegistry, activityLog };

boot();
renderAll();
