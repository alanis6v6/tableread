// Wires the shared tool logic (draftStore/scenarioStore/sessionRegistry) up
// to document.modelContext.registerTool(), per the WebMCP imperative API
// (https://github.com/webmachinelearning/webmcp). Tool *logic* lives in the
// sibling modules and is plain, DOM-free, and unit-tested on its own;
// buildToolDefinitions() below only adds the name/description/inputSchema
// wrapping and is itself DOM-free too, so it can be tested without a
// browser. Only registerAllTools() actually touches document.modelContext,
// and is exercised in-browser (see test/browser/).
import { createDraftStore } from "./draftStore.js";
import { assembleCard } from "./cardAssembler.js";
import { createScenarioStore } from "./scenarioStore.js";
import { createSessionRegistry } from "./sessionRegistry.js";
import { createActivityLog } from "./activityLog.js";
import { createCompareScenarios } from "./compareScenarios.js";
import { CHECKLIST_ASPECTS, CHECKLIST_ASPECT_KEYS } from "./checklist.js";

export const draftStore = createDraftStore();
export const scenarioStore = createScenarioStore(draftStore);
export const sessionRegistry = createSessionRegistry(draftStore, scenarioStore);
export const activityLog = createActivityLog();
export const compareScenariosLogic = createCompareScenarios(draftStore, scenarioStore, sessionRegistry, activityLog);

function textResult(payload, isError) {
  const result = { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
  if (isError) result.isError = true;
  return result;
}

/** Wraps a plain handler(params) -> payload (where payload may be
 * { ok: false, error } on failure) into a WebMCP execute() callback: logs
 * every call to activityLog (for the Agent-activity panel) and formats the
 * result/error as { content: [{ type: "text", text }] }. */
function defineTool(name, description, inputSchema, handler) {
  return {
    name,
    description,
    inputSchema,
    async execute(params) {
      const args = params ?? {};
      let payload;
      let isError = false;
      try {
        payload = await handler(args);
        if (payload && payload.ok === false) isError = true;
      } catch (ex) {
        payload = { ok: false, error: String(ex?.message ?? ex) };
        isError = true;
      }
      activityLog.record(name, args, payload);
      return textResult(payload, isError);
    },
  };
}

/** Pure, DOM-free tool descriptors: { name, description, inputSchema, execute }. */
export function buildToolDefinitions() {
  return [
    defineTool(
      "get_checklist_status",
      "讀取目前角色卡草稿在七個豐富度面向（登場人物/世界觀規則/特殊事件/情感親密偏好/背景故事/NPC關係網/心理狀態進展脈絡）加上「是否需要MVU動態變量卡」這項決策上的完成狀態（known=已知/pending_confirm=待確認/pending_ideation=待發想）。純讀取，不修改任何東西。建議在每次要向使用者提出下一個問題之前先呼叫一次，確保不會重複問已經 known 的項目，也不會漏掉還沒討論到（pending_ideation）的面向。",
      { type: "object", properties: {}, additionalProperties: false },
      () => ({ ok: true, aspects: CHECKLIST_ASPECTS, checklist: draftStore.getChecklistStatus() }),
    ),

    defineTool(
      "update_card_field",
      "把一段內容或一個判斷結果寫進草稿狀態。每次使用者確認了一個決定、或你擴寫出一段內容並得到使用者認可後就呼叫一次，不要囤積到最後才一次寫入。" +
        " section 只能是以下兩類之一：" +
        ` (a) 檢核表面向 key（${CHECKLIST_ASPECT_KEYS.join("/")}）——此時 value 必須是 {status, note?}，用來記錄這個面向目前的判斷結果；` +
        " (b) 卡片內容欄位 key —— 字串欄位：name/world_name/description/personality/scenario/first_mes/mes_example/system_prompt/creator_notes；" +
        " 陣列欄位：tags/alternate_greetings/character_book_entries/regex_scripts（character_book_entries 依 chara_card_v3 的 character_book.entries[] schema，regex_scripts 依 data.extensions.regex_scripts[] schema，兩者皆可參考 reference/st-writer-src 的 card-format.md）。",
      {
        type: "object",
        properties: {
          section: { type: "string", description: "檢核表面向 key，或卡片欄位 key（見上方 description）。" },
          value: {
            description: "依 section 而定：checklist 面向傳 {status, note?}；字串欄位傳字串；陣列欄位傳陣列。",
          },
        },
        required: ["section", "value"],
      },
      ({ section, value }) => draftStore.updateField(section, value),
    ),

    defineTool(
      "assemble_card",
      "把目前草稿的所有欄位（含世界書 character_book_entries 與 regex_scripts）組裝成一份完整、符合 chara_card_v3 規格的角色卡 JSON。要匯出卡片、或準備開始試玩模擬（run_scenario 內部也會呼叫這個組裝邏輯）之前呼叫。純讀取目前狀態組裝輸出，不檢查草稿『完不完整』——欄位有沒有漏是你跟使用者透過 get_checklist_status 一起把關的事。",
      { type: "object", properties: {}, additionalProperties: false },
      () => ({ ok: true, card: assembleCard(draftStore.getSnapshot().fields) }),
    ),

    defineTool(
      "list_scenarios",
      "列出目前可以拿來試玩的情境：草稿的 first_mes 一個、每個 alternate_greetings 各一個，加上先前用 add_scenario 手動加過的自訂情境。每個情境回傳 {id, label, text}（text 是這個情境的起手文字）。呼叫 run_scenario 之前，先呼叫這個工具拿到你要測試的 scenario 的 id。",
      { type: "object", properties: {}, additionalProperties: false },
      () => ({ ok: true, scenarios: scenarioStore.listScenarios() }),
    ),

    defineTool(
      "add_scenario",
      "新增一個不屬於卡片 first_mes/alternate_greetings 的自訂試玩情境（例如「玩家一開始就很兇」「半夜傳訊息」），適合想測試卡片在非預設起手情境下的反應、或遊戲商比較模式一次測多種情境時使用。description 會被當成這個情境的起手文字（等同一個臨時的 first_mes）。回傳新情境的 id，之後用這個 id 呼叫 run_scenario。",
      {
        type: "object",
        properties: { description: { type: "string", description: "這個自訂情境的起手文字/情境描述。" } },
        required: ["description"],
      },
      ({ description }) => ({ ok: true, scenario: scenarioStore.addScenario(description) }),
    ),

    defineTool(
      "run_scenario",
      "針對某個情境開始一次全新的試玩模擬：用草稿『目前最新』的內容組裝一張卡，建立一個全新的 session（會蓋掉這個 scenario_id 之前跑過的紀錄），並宣告打算跑幾輪。呼叫順序：list_scenarios（或 add_scenario）拿到 scenario_id → run_scenario → 對 round=1..rounds 依序重複「get_playtest_context(scenario_id, round) → 依輸出寫這一輪的玩家台詞與角色演出 → commit_playtest_round(scenario_id, round, ...)」。rounds 只是回報給你的目標輪數，這個工具不會自動幫你跑完每一輪，每一輪都要你實際呼叫 get_playtest_context/commit_playtest_round。",
      {
        type: "object",
        properties: {
          scenario_id: { type: "string" },
          rounds: { type: "integer", minimum: 1, description: "打算跑的目標輪數（頁數）。" },
        },
        required: ["scenario_id", "rounds"],
      },
      ({ scenario_id, rounds }) => sessionRegistry.runScenario(scenario_id, rounds),
    ),

    defineTool(
      "get_playtest_context",
      "在你要寫第 round 輪的玩家台詞與角色演出『之前』一定要呼叫這個工具，不能跳過、也不能只呼叫一次就套用到後面所有輪次。回傳這一輪真正會被注入的世界書內容（active_world_entries，每條含 comment/content）與目前的變量狀態（current_vars）——這是用關鍵詞掃描＋常駐/冷卻/延遲規則精確計算出來的，不是憑印象猜的。" +
        "【強制規則】你只能使用這份輸出裡列出的 active_world_entries 內容來寫這一輪的演出，不可以使用你自己記得、但這一輪其實沒有被列出來的角色設定或劇情細節。如果某個你以為理所當然的細節這輪沒被列出來，角色的演出就應該表現得「不知道／沒被提起」——這種落差本身就是有價值的 QA 發現，不是要你偷偷補回去的漏洞。" +
        " round 必須是這個 scenario 目前「下一輪」的編號，從 1 開始（run_scenario 建立時的開場白算第 0 輪，不需要也不能對它呼叫這個工具）。",
      {
        type: "object",
        properties: {
          scenario_id: { type: "string" },
          round: { type: "integer", minimum: 1 },
        },
        required: ["scenario_id", "round"],
      },
      ({ scenario_id, round }) => sessionRegistry.getPlaytestContext(scenario_id, round),
    ),

    defineTool(
      "commit_playtest_round",
      "在你已經呼叫過 get_playtest_context(scenario_id, round)、並依照該輸出寫好這一輪的玩家台詞（player_text）與角色的完整原始輸出（char_text）之後才呼叫這個工具，順序不能顛倒。char_text 必須完整照卡片 system_prompt 規定的格式輸出——包含所有純文字標記（如 [HEAD]/[BODY] 之類）與 <!-- <VariableUpdateLog>...--> 變量更新區塊，一字不能少，因為這段原始文字接下來會被實際解析、實際套用 regex，格式不合規會在回傳的 warnings 裡顯形。這個工具會：解析並套用 char_text 裡的 JSON Patch 變量更新、去除 HTML 註解、套用卡片的 regex_scripts 渲染成最終 HTML、把這一輪存進這個情境的逐輪紀錄。回傳 patch_found（有沒有成功解析到變量更新區塊）、vars_after（套用後的變量狀態）、warnings（regex 編譯失敗、抓不到匹配、JSON Patch 解析失敗等）——warnings 要老實回報給使用者，不要略過或幫忙掩飾。",
      {
        type: "object",
        properties: {
          scenario_id: { type: "string" },
          round: { type: "integer", minimum: 1 },
          player_text: { type: "string", description: "這一輪玩家的原始台詞/動作描述，可留空字串。" },
          char_text: { type: "string", description: "角色這一輪的完整原始輸出，須完整符合卡片格式規定。" },
        },
        required: ["scenario_id", "round", "char_text"],
      },
      ({ scenario_id, round, player_text, char_text }) =>
        sessionRegistry.commitPlaytestRound(scenario_id, round, player_text ?? "", char_text),
    ),

    defineTool(
      "get_transcript",
      "取得某個情境累積到目前為止的逐輪紀錄（含開場白的第 0 輪），供你或前端 UI 直接渲染，不會產生 HTML 檔案。每輪包含 player_raw/char_raw（原始文字）、char_html（套用 regex 之後的渲染結果）、vars_snapshot（該輪之後的變量狀態）、patch_found、warnings。適合在使用者想回顧目前跑到哪一輪、或要整理 QA 摘要時呼叫。",
      {
        type: "object",
        properties: { scenario_id: { type: "string" } },
        required: ["scenario_id"],
      },
      ({ scenario_id }) => sessionRegistry.getTranscript(scenario_id),
    ),

    defineTool(
      "compare_scenarios",
      "遊戲商模式（多情境比較）用的唯讀工具：把一批已經跑過的 scenario_id 攤開成一份逐情境比較，並算出跨情境的世界書觸發差異。這個工具只讀，不會替你執行任何情境——建議在多個情境都已經各自完整跑過一輪 run_scenario → get_playtest_context/commit_playtest_round 之後才呼叫，才有東西可比。對於還沒 run_scenario 過的 scenario_id，不會讓整次呼叫失敗，只會在對應那一筆標記 {scenario_id, error}。回傳的 world_entries_triggered_in_some（有些情境觸發過、有些沒有）是最值得注意的 QA 訊號——代表同一份世界書在不同情境下觸發不一致，值得檢查關鍵詞/常駐設定是否符合預期。",
      {
        type: "object",
        properties: {
          scenario_ids: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            description: "要比較的情境 id 列表，來自 list_scenarios/add_scenario 回傳的 id。",
          },
        },
        required: ["scenario_ids"],
      },
      ({ scenario_ids }) => compareScenariosLogic.compareScenarios(scenario_ids),
    ),
  ];
}

const REGISTER_TIMEOUT_MS = 4000;

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`registration did not finish within ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Registers every tool with document.modelContext.registerTool(), if the
 * API is present (secure context required -- localhost is fine for dev,
 * otherwise HTTPS).
 *
 * This is calling a brand-new, still-experimental browser API, so it's
 * treated as unreliable on purpose: a single tool's registerTool() call
 * throwing doesn't stop the rest from registering, and the whole batch is
 * capped by a timeout so a call that never resolves can't leave the caller
 * (the page's status badge) hanging forever with no way to tell "still
 * checking" apart from "silently broken".
 *
 * Returns { status, tools, registered, failures, controller, timeoutError? }:
 *   - status: "unsupported" (no document.modelContext at all), "ok" (every
 *     tool registered), "partial" (some registered, some failed), "error"
 *     (all failed), or "timeout" (didn't finish within REGISTER_TIMEOUT_MS).
 *   - tools: the full DOM-free tool descriptor list (always populated, even
 *     when unsupported/timed out, so callers like the debug console hook
 *     can still exercise the underlying logic directly).
 *   - registered / failures: tool names that succeeded / {name, error} that
 *     didn't (best-effort on "timeout" -- reflects whatever completed before
 *     the timeout fired).
 *
 * `timeoutMs` defaults to REGISTER_TIMEOUT_MS; it's an explicit parameter
 * only so tests can use a short timeout instead of waiting out the real one.
 */
export async function registerAllTools({ timeoutMs = REGISTER_TIMEOUT_MS } = {}) {
  const tools = buildToolDefinitions();

  if (typeof document === "undefined" || !document.modelContext?.registerTool) {
    return { status: "unsupported", controller: null, tools, registered: [], failures: [] };
  }

  const controller = new AbortController();
  const registered = [];
  const failures = [];

  async function registerSequentially() {
    for (const tool of tools) {
      try {
        await document.modelContext.registerTool(tool, { signal: controller.signal });
        registered.push(tool.name);
      } catch (ex) {
        failures.push({ name: tool.name, error: String(ex?.message ?? ex) });
      }
    }
  }

  try {
    await withTimeout(registerSequentially(), timeoutMs);
  } catch (ex) {
    return {
      status: "timeout",
      controller,
      tools,
      registered,
      failures,
      timeoutError: String(ex?.message ?? ex),
    };
  }

  const status = failures.length === 0 ? "ok" : registered.length === 0 ? "error" : "partial";
  return { status, controller, tools, registered, failures };
}
