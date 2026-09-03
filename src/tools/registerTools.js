// Wires the shared tool logic (draftStore/scenarioStore/sessionRegistry) up
// to document.modelContext.registerTool(), per the WebMCP imperative API
// (https://github.com/webmachinelearning/webmcp). Tool *logic* lives in the
// sibling modules and is plain, DOM-free, and unit-tested on its own;
// buildToolDefinitions() below only adds the name/description/inputSchema
// wrapping and is itself DOM-free too, so it can be tested without a
// browser. Only registerAllTools() actually touches document.modelContext,
// and is exercised in-browser (see test/browser/).
//
// Tool descriptions come from src/tools/toolText.js in the page's current
// language; buildToolDefinitions(lang) / registerAllTools({ lang }) take it.
import { createDraftStore } from "./draftStore.js";
import { assembleCard } from "./cardAssembler.js";
import { createScenarioStore } from "./scenarioStore.js";
import { createSessionRegistry } from "./sessionRegistry.js";
import { createActivityLog } from "./activityLog.js";
import { createCompareScenarios } from "./compareScenarios.js";
import { CHECKLIST_ASPECT_KEYS, getLocalizedAspects } from "./checklist.js";
import { TOOL_TEXT } from "./toolText.js";

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

/** Pure, DOM-free tool descriptors: { name, description, inputSchema, execute }.
 * `lang` selects the description language (zh default). */
export function buildToolDefinitions(lang = "zh") {
  const tx = TOOL_TEXT[lang] ?? TOOL_TEXT.zh;
  const updateFieldDesc = tx.update_card_field.replace("{ASPECT_KEYS}", CHECKLIST_ASPECT_KEYS.join("/"));

  return [
    defineTool(
      "get_checklist_status",
      tx.get_checklist_status,
      { type: "object", properties: {}, additionalProperties: false },
      () => ({ ok: true, aspects: getLocalizedAspects(lang), checklist: draftStore.getChecklistStatus() }),
    ),

    defineTool(
      "update_card_field",
      updateFieldDesc,
      {
        type: "object",
        properties: {
          section: { type: "string", description: tx.update_card_field_section },
          value: { description: tx.update_card_field_value },
        },
        required: ["section", "value"],
      },
      ({ section, value }) => draftStore.updateField(section, value),
    ),

    defineTool(
      "assemble_card",
      tx.assemble_card,
      { type: "object", properties: {}, additionalProperties: false },
      () => ({ ok: true, card: assembleCard(draftStore.getSnapshot().fields) }),
    ),

    defineTool(
      "list_scenarios",
      tx.list_scenarios,
      { type: "object", properties: {}, additionalProperties: false },
      () => ({ ok: true, scenarios: scenarioStore.listScenarios() }),
    ),

    defineTool(
      "add_scenario",
      tx.add_scenario,
      {
        type: "object",
        properties: { description: { type: "string", description: tx.add_scenario_description } },
        required: ["description"],
      },
      ({ description }) => ({ ok: true, scenario: scenarioStore.addScenario(description) }),
    ),

    defineTool(
      "run_scenario",
      tx.run_scenario,
      {
        type: "object",
        properties: {
          scenario_id: { type: "string" },
          rounds: { type: "integer", minimum: 1, description: tx.run_scenario_rounds },
        },
        required: ["scenario_id", "rounds"],
      },
      ({ scenario_id, rounds }) => sessionRegistry.runScenario(scenario_id, rounds),
    ),

    defineTool(
      "get_playtest_context",
      tx.get_playtest_context,
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
      tx.commit_playtest_round,
      {
        type: "object",
        properties: {
          scenario_id: { type: "string" },
          round: { type: "integer", minimum: 1 },
          player_text: { type: "string", description: tx.commit_playtest_round_player_text },
          char_text: { type: "string", description: tx.commit_playtest_round_char_text },
        },
        required: ["scenario_id", "round", "char_text"],
      },
      ({ scenario_id, round, player_text, char_text }) =>
        sessionRegistry.commitPlaytestRound(scenario_id, round, player_text ?? "", char_text),
    ),

    defineTool(
      "get_transcript",
      tx.get_transcript,
      {
        type: "object",
        properties: { scenario_id: { type: "string" } },
        required: ["scenario_id"],
      },
      ({ scenario_id }) => sessionRegistry.getTranscript(scenario_id),
    ),

    defineTool(
      "compare_scenarios",
      tx.compare_scenarios,
      {
        type: "object",
        properties: {
          scenario_ids: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            description: tx.compare_scenarios_ids,
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

// The AbortController from the last successful registration. Aborting it
// tells a spec-compliant document.modelContext to drop those tools, so a
// language switch can re-register cleanly instead of stacking a second set.
let activeController = null;

function looksLikeAlreadyRegistered(message) {
  return /already|exist|registered|duplicat/i.test(String(message || ""));
}

/**
 * Registers every tool with document.modelContext, if the API is present
 * (secure context required -- localhost is fine for dev, otherwise HTTPS).
 *
 * `lang` picks the description language. Calling this again (e.g. after a
 * language toggle) first aborts the previous registration; where the impl
 * exposes provideContext() the whole set is replaced in one call, otherwise
 * each tool is re-registered and a "already registered" rejection from a
 * shim without unregisterTool is treated as success.
 *
 * This is a brand-new, still-experimental browser API, so it's treated as
 * unreliable on purpose: one tool's registerTool() throwing doesn't stop the
 * rest, and the whole batch is capped by a timeout.
 *
 * Returns { status, tools, registered, failures, controller, timeoutError? }:
 *   status: "unsupported" | "ok" | "partial" | "error" | "timeout".
 *
 * `timeoutMs` is an explicit parameter only so tests can use a short timeout.
 */
export async function registerAllTools({ lang = "zh", timeoutMs = REGISTER_TIMEOUT_MS } = {}) {
  const tools = buildToolDefinitions(lang);

  const mc = typeof document !== "undefined" ? document.modelContext : undefined;
  if (!mc || (!mc.registerTool && !mc.provideContext)) {
    return { status: "unsupported", controller: null, tools, registered: [], failures: [] };
  }

  try {
    activeController?.abort();
  } catch {
    /* ignore */
  }

  const controller = new AbortController();
  const registered = [];
  const failures = [];

  async function doRegister() {
    if (typeof mc.provideContext === "function") {
      await mc.provideContext({ tools });
      registered.push(...tools.map((t) => t.name));
      return;
    }
    for (const tool of tools) {
      try {
        await mc.registerTool(tool, { signal: controller.signal });
        registered.push(tool.name);
      } catch (ex) {
        const msg = String(ex?.message ?? ex);
        if (looksLikeAlreadyRegistered(msg)) registered.push(tool.name);
        else failures.push({ name: tool.name, error: msg });
      }
    }
  }

  try {
    await withTimeout(doRegister(), timeoutMs);
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

  activeController = controller;
  const status = failures.length === 0 ? "ok" : registered.length === 0 ? "error" : "partial";
  return { status, controller, tools, registered, failures };
}
