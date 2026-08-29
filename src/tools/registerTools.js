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
      "Reads the current draft character card's completion status across the seven richness aspects (cast / world-building rules / special events / emotional & intimacy preferences / backstory / NPC relationship network / psychological-state progression arc) plus the \"does this need an MVU dynamic-variable card\" decision (known / pending_confirm / pending_ideation). Read-only, does not modify anything. Call this once before asking the user the next question, so you don't re-ask something already known and don't skip an aspect still stuck at pending_ideation.",
      { type: "object", properties: {}, additionalProperties: false },
      () => ({ ok: true, aspects: CHECKLIST_ASPECTS, checklist: draftStore.getChecklistStatus() }),
    ),

    defineTool(
      "update_card_field",
      "Writes one piece of content or one judgment call into the draft state. Call this every time the user confirms a decision, or you've drafted a passage and gotten the user's approval on it — don't stockpile everything and write it all at once at the end." +
        " `section` must be one of two kinds:" +
        ` (a) a checklist aspect key (${CHECKLIST_ASPECT_KEYS.join("/")}) — in which case \`value\` must be {status, note?}, recording the current judgment call for that aspect;` +
        " (b) a card content field key — string fields: name/world_name/description/personality/scenario/first_mes/mes_example/system_prompt/creator_notes;" +
        " array fields: tags/alternate_greetings/character_book_entries/regex_scripts (character_book_entries follows chara_card_v3's character_book.entries[] schema, regex_scripts follows data.extensions.regex_scripts[] schema — both documented in reference/st-writer-src's card-format.md).",
      {
        type: "object",
        properties: {
          section: { type: "string", description: "A checklist aspect key, or a card field key (see the description above)." },
          value: {
            description: "Depends on `section`: a checklist aspect takes {status, note?}; a string field takes a string; an array field takes an array.",
          },
        },
        required: ["section", "value"],
      },
      ({ section, value }) => draftStore.updateField(section, value),
    ),

    defineTool(
      "assemble_card",
      "Assembles every field of the current draft (including the character_book_entries world-book and regex_scripts) into a complete chara_card_v3-compliant character card JSON. Call this before exporting the card, or before starting a playtest simulation (run_scenario also calls this assembly logic internally). Purely reads the current state and assembles the output — it does not check whether the draft is \"complete\"; whether any field is still missing is something you and the user track together via get_checklist_status.",
      { type: "object", properties: {}, additionalProperties: false },
      () => ({ ok: true, card: assembleCard(draftStore.getSnapshot().fields) }),
    ),

    defineTool(
      "list_scenarios",
      "Lists the scenarios currently available to playtest: one for the draft's first_mes, one for each alternate_greetings entry, plus any custom scenarios previously added with add_scenario. Each scenario is returned as {id, label, text} (text is that scenario's opening line). Call this before run_scenario to get the id of the scenario you want to test.",
      { type: "object", properties: {}, additionalProperties: false },
      () => ({ ok: true, scenarios: scenarioStore.listScenarios() }),
    ),

    defineTool(
      "add_scenario",
      "Adds a custom playtest scenario that isn't part of the card's first_mes/alternate_greetings (e.g. \"the player is hostile from the start\", \"a message arrives in the middle of the night\") — useful for testing how the card behaves outside its default openings, or when game-publisher comparison mode needs to test several scenarios at once. `description` becomes that scenario's opening line (equivalent to a temporary first_mes). Returns the new scenario's id; call run_scenario with that id afterward.",
      {
        type: "object",
        properties: { description: { type: "string", description: "This custom scenario's opening line / scenario description." } },
        required: ["description"],
      },
      ({ description }) => ({ ok: true, scenario: scenarioStore.addScenario(description) }),
    ),

    defineTool(
      "run_scenario",
      "Starts a brand-new playtest simulation for a given scenario: assembles a card from the draft's *current* latest content, creates a fresh session (overwriting any prior run recorded under this scenario_id), and declares how many rounds you intend to run. Call order: list_scenarios (or add_scenario) to get a scenario_id → run_scenario → for round = 1..rounds, repeat \"get_playtest_context(scenario_id, round) → write that round's player line and character performance from its output → commit_playtest_round(scenario_id, round, ...)\". `rounds` is only the target round count reported back to you — this tool does not run any round for you; you must actually call get_playtest_context/commit_playtest_round for every single round.",
      {
        type: "object",
        properties: {
          scenario_id: { type: "string" },
          rounds: { type: "integer", minimum: 1, description: "The target number of rounds (pages) you intend to run." },
        },
        required: ["scenario_id", "rounds"],
      },
      ({ scenario_id, rounds }) => sessionRegistry.runScenario(scenario_id, rounds),
    ),

    defineTool(
      "get_playtest_context",
      "You MUST call this before writing round `round`'s player line and character performance — never skip it, and never call it once and reuse its output for every later round. Returns the world-book content actually injected this round (active_world_entries, each with comment/content) and the current variable state (current_vars) — computed precisely from keyword scanning plus constant/sticky/cooldown/delay rules, not guessed from memory." +
        " [MANDATORY RULE] Only use the world-book content and variables returned by this call to write the character's performance this round — do not rely on entries you recall from earlier rounds that were not returned here, and do not use character settings or plot details you remember yourself but that weren't actually listed for this round. If some detail you assumed was a given wasn't listed this round, the character's performance should reflect \"doesn't know / hasn't come up\" — that gap is itself a valuable QA finding, not a hole for you to quietly patch over." +
        " `round` must be this scenario's current \"next\" round number, starting at 1 (the opening line created by run_scenario counts as round 0 — you do not need to, and must not, call this for round 0).",
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
      "Call this only after you've already called get_playtest_context(scenario_id, round) and written this round's player line (player_text) and the character's complete raw output (char_text) based on it — the order cannot be reversed. char_text must fully comply with the format the card's system_prompt specifies — including every plain-text marker (like [HEAD]/[BODY]) and the <!-- <VariableUpdateLog>...--> variable-update block, with nothing dropped, because this raw text is about to be actually parsed and have regex actually applied to it; a non-compliant format will show up in the returned warnings. This tool: parses and applies the JSON Patch variable update in char_text, strips HTML comments, renders through the card's regex_scripts into the final HTML, and stores this round into that scenario's round-by-round record. Returns patch_found (whether a variable-update block was successfully parsed), vars_after (the resulting variable state), and warnings (regex compile failures, no match found, JSON Patch parse failures, etc.) — warnings must be reported to the user honestly, never dropped or glossed over.",
      {
        type: "object",
        properties: {
          scenario_id: { type: "string" },
          round: { type: "integer", minimum: 1 },
          player_text: { type: "string", description: "This round's raw player line/action description; may be left as an empty string." },
          char_text: { type: "string", description: "The character's complete raw output for this round, which must fully comply with the card's format rules." },
        },
        required: ["scenario_id", "round", "char_text"],
      },
      ({ scenario_id, round, player_text, char_text }) =>
        sessionRegistry.commitPlaytestRound(scenario_id, round, player_text ?? "", char_text),
    ),

    defineTool(
      "get_transcript",
      "Fetches a scenario's round-by-round record accumulated so far (including the opening line as round 0), for you or the front-end UI to render directly — no HTML file is produced. Each round includes player_raw/char_raw (raw text), char_html (the result after applying regex), vars_snapshot (variable state after that round), patch_found, and warnings. Call this when the user wants to review how far a scenario has progressed, or when putting together a QA summary.",
      {
        type: "object",
        properties: { scenario_id: { type: "string" } },
        required: ["scenario_id"],
      },
      ({ scenario_id }) => sessionRegistry.getTranscript(scenario_id),
    ),

    defineTool(
      "compare_scenarios",
      "A read-only tool for game-publisher mode (multi-scenario comparison): lays out a batch of already-run scenario_ids as a side-by-side comparison and computes cross-scenario world-book trigger discrepancies. This tool only reads — it never runs any scenario for you; call it after several scenarios have each already been fully run once via run_scenario → get_playtest_context/commit_playtest_round, so there's something to compare. A scenario_id that hasn't been run via run_scenario doesn't fail the whole call — it's simply marked as {scenario_id, error} in its slot. The returned world_entries_triggered_in_some (triggered in some scenarios but not others) is the most important QA signal — it means the same world-book entry fires inconsistently across scenarios, worth checking whether its keywords/constant setting behave as intended.",
      {
        type: "object",
        properties: {
          scenario_ids: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            description: "The list of scenario ids to compare, from the ids returned by list_scenarios/add_scenario.",
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
