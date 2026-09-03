// Tiny UI-string localisation for the page chrome. The WebMCP tool
// descriptions have their own table (src/tools/toolText.js) and the
// checklist aspects carry their own {zh,en} labels (src/tools/checklist.js);
// this file is only the buttons, panel headings, KPI labels and hints.
//
// Language resolution order: ?lang= query param > localStorage > "zh".
// The query param is what the demo recording uses ("...?lang=en") so the
// tools register in English once at boot, with no runtime re-registration.

const VALID = ["zh", "en"];
const STORAGE_KEY = "tableread:lang";

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

let current = (() => {
  let fromQuery = null;
  try {
    fromQuery = new URLSearchParams(location.search).get("lang");
  } catch {
    /* location unavailable (tests) */
  }
  const stored = readStored();
  const pick = [fromQuery, stored, "zh"].find((v) => VALID.includes(v));
  return pick || "zh";
})();

export function getLang() {
  return current;
}

export function setLang(lang) {
  if (!VALID.includes(lang)) return;
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* private mode / storage blocked */
  }
  try {
    document.documentElement.lang = lang === "en" ? "en" : "zh-Hant";
  } catch {
    /* no document (tests) */
  }
}

export function otherLang() {
  return current === "zh" ? "en" : "zh";
}

const STRINGS = {
  zh: {
    "mode.creator": "創作者模式",
    "mode.merchant": "遊戲商模式（多情境比較）",
    "lang.toggleLabel": "EN",
    "badge.checking": "檢查 WebMCP 支援中…",
    "badge.ok": (n) => `WebMCP 已註冊 ${n} 個工具`,
    "badge.partial": (n, total) => `WebMCP 註冊部分失敗：成功 ${n}/${total} 個（詳見主控台）`,
    "badge.error": (total) => `WebMCP 註冊全部失敗（${total} 個工具皆失敗，詳見主控台）`,
    "badge.timeout": "WebMCP 註冊逾時，可能是實驗性 API 尚未完全支援",
    "badge.unsupported": "此瀏覽器/情境不支援 document.modelContext（需要 secure context，localhost 開發即可）",

    "kpi.checklist": "檢核完成度",
    "kpi.rounds": "已跑輪數",
    "kpi.worldbook": "世界書條目",
    "kpi.calls": "Agent 呼叫",
    "kpi.rounds.scenario": (id) => `情境：${id}`,
    "kpi.rounds.none": "情境：（尚無情境）",
    "kpi.worldbook.never": (n) => `${n} 條從未觸發`,
    "kpi.worldbook.allTriggered": "已全數觸發",
    "kpi.calls.errors": (n) => `${n} 次錯誤`,
    "kpi.calls.noErrors": "無錯誤",

    "panel.checklist": "撰寫檢核表",
    "panel.fieldFill": "卡片欄位填寫率",
    "panel.transcript": "對話回放",
    "panel.qa": "QA / Agent 活動",
    "panel.scenarioList": "情境清單管理",
    "panel.compareCards": "多情境並排結果",
    "panel.compareSummary": "跨情境比較摘要",

    "bar.required": "必填欄位",
    "bar.optional": "選填欄位",
    "bar.worldbook": "世界書",
    "bar.regex": "regex 腳本",

    "hint.noActivity": "尚未有任何工具呼叫。",
    "hint.scenarioListIntro": "勾選要拿去比較的情境，狀態欄顯示這個情境目前是否已經 run_scenario 過。",
    "hint.pickScenario": "選一個已經 run_scenario 過的情境來查看回放。",
    "hint.noScenariosMerchant": "（尚無情境，先在創作者模式寫 first_mes，或呼叫 add_scenario。）",
    "hint.pickToCompare": "在左邊「情境清單管理」勾選至少一個情境來並排比較。",
    "hint.pickForSummary": "勾選情境後才能算跨情境比較摘要。",
    "hint.cannotCompare": (ids) => `尚未執行、無法比較：${ids}`,

    "list.sep": "、",
    "select.noScenarios": "（尚無情境）",
    "scenario.firstMes": "開場白",
    "scenario.altGreeting": (n) => `替代開場 ${n}`,
    "scenario.custom": "自訂情境",
    "scenario.ran": (n) => `已執行 ${n} 輪`,
    "scenario.notRun": "尚未執行",
    "scenario.rowLabel": (label, id) => `${label}（${id}）`,

    "round.page": (n) => `第 ${n} 頁`,
    "round.charFragment": (n) => `第 ${n} 頁角色回應片段`,
    "compare.currentVars": "目前變量",
    "compare.inconsistent": (list) =>
      `⚠ 觸發不一致的世界書條目（部分情境觸發、部分沒有，QA 重點）：${list}`,
    "compare.consistent": "沒有偵測到跨情境觸發不一致的世界書條目。",
    "compare.varsHeader": "變量",
    "compare.noVars": "（尚無變量）",

    "qa.rounds": "已跑輪數",
    "qa.patchMisses": "JSON Patch 缺失次數",
    "qa.neverTriggered": "從未觸發的世界書條目",
    "qa.warnings": "regex/patch 警告",
    "qa.none": "無",
    "qa.noWorldbook": "（尚無世界書條目）",
  },
  en: {
    "mode.creator": "Creator mode",
    "mode.merchant": "Game-publisher mode (compare scenarios)",
    "lang.toggleLabel": "中",
    "badge.checking": "Checking for WebMCP support…",
    "badge.ok": (n) => `WebMCP: ${n} tools registered`,
    "badge.partial": (n, total) => `WebMCP: partial registration — ${n}/${total} succeeded (see console)`,
    "badge.error": (total) => `WebMCP: registration failed (all ${total} tools failed, see console)`,
    "badge.timeout": "WebMCP registration timed out — the experimental API may not be fully supported here",
    "badge.unsupported": "This browser/context has no document.modelContext (a secure context is required; localhost is fine for dev)",

    "kpi.checklist": "Checklist complete",
    "kpi.rounds": "Rounds run",
    "kpi.worldbook": "World-book entries",
    "kpi.calls": "Agent calls",
    "kpi.rounds.scenario": (id) => `Scenario: ${id}`,
    "kpi.rounds.none": "Scenario: (none yet)",
    "kpi.worldbook.never": (n) => `${n} never triggered`,
    "kpi.worldbook.allTriggered": "all triggered",
    "kpi.calls.errors": (n) => `${n} error${n === 1 ? "" : "s"}`,
    "kpi.calls.noErrors": "no errors",

    "panel.checklist": "Writing checklist",
    "panel.fieldFill": "Card field fill rate",
    "panel.transcript": "Transcript replay",
    "panel.qa": "QA / Agent activity",
    "panel.scenarioList": "Scenario list",
    "panel.compareCards": "Scenarios side by side",
    "panel.compareSummary": "Cross-scenario comparison",

    "bar.required": "Required fields",
    "bar.optional": "Optional fields",
    "bar.worldbook": "World-book",
    "bar.regex": "Regex scripts",

    "hint.noActivity": "No tool calls yet.",
    "hint.scenarioListIntro": "Check the scenarios you want to compare; the status column shows whether each has been through run_scenario yet.",
    "hint.pickScenario": "Pick a scenario that has been through run_scenario to see its replay.",
    "hint.noScenariosMerchant": "(No scenarios yet — write a first_mes in creator mode, or call add_scenario.)",
    "hint.pickToCompare": "Check at least one scenario in \"Scenario list\" on the left to compare side by side.",
    "hint.pickForSummary": "Check some scenarios to compute the cross-scenario comparison.",
    "hint.cannotCompare": (ids) => `Not run yet, can't compare: ${ids}`,

    "list.sep": ", ",
    "select.noScenarios": "(No scenarios yet)",
    "scenario.firstMes": "Opening line",
    "scenario.altGreeting": (n) => `Alternate greeting ${n}`,
    "scenario.custom": "Custom scenario",
    "scenario.ran": (n) => `${n} round${n === 1 ? "" : "s"} run`,
    "scenario.notRun": "not run yet",
    "scenario.rowLabel": (label, id) => `${label} (${id})`,

    "round.page": (n) => `Page ${n}`,
    "round.charFragment": (n) => `Page ${n} — character response excerpt`,
    "compare.currentVars": "Current variables",
    "compare.inconsistent": (list) =>
      `⚠ World-book entries that fire inconsistently (some scenarios, not others — the QA signal): ${list}`,
    "compare.consistent": "No cross-scenario trigger inconsistencies detected.",
    "compare.varsHeader": "Variable",
    "compare.noVars": "(No variables yet)",

    "qa.rounds": "Rounds run",
    "qa.patchMisses": "JSON Patch misses",
    "qa.neverTriggered": "World-book entries never triggered",
    "qa.warnings": "regex/patch warnings",
    "qa.none": "none",
    "qa.noWorldbook": "(No world-book entries yet)",
  },
};

export function t(key, ...args) {
  const table = STRINGS[current] || STRINGS.zh;
  const val = table[key] ?? STRINGS.zh[key] ?? key;
  return typeof val === "function" ? val(...args) : val;
}
