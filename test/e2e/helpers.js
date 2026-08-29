// Shared helpers for driving the page's WebMCP tools the same way an Agent
// (or the DevTools WebMCP panel) would, via window.__tableread.tools --
// the same debug hook main.js's boot() sets up, not a test-only shortcut.

/** Waits for boot() to finish and expose window.__tableread.tools, then
 * calls one tool by name and returns its parsed JSON payload. */
export async function callTool(page, name, args) {
  return page.evaluate(
    async ({ name, args }) => {
      const tool = window.__tableread.tools.find((t) => t.name === name);
      if (!tool) throw new Error(`no such tool: ${name}`);
      const result = await tool.execute(args);
      return JSON.parse(result.content[0].text);
    },
    { name, args },
  );
}

export async function waitForTools(page) {
  await page.waitForFunction(() => Array.isArray(window.__tableread?.tools) && window.__tableread.tools.length === 10);
}

/**
 * Drives the full authoring -> playtest -> compare pipeline through the
 * WebMCP tools, exactly the sequence registerTools.js's own tool
 * descriptions prescribe:
 *   update_card_field (draft) -> list_scenarios/add_scenario -> run_scenario
 *   -> get_playtest_context/commit_playtest_round per round -> compare_scenarios.
 *
 * Produces two scenarios deliberately left in different states so the
 * comparison UI has something to distinguish:
 *   - "first_mes": full loop (get_playtest_context + commit), so its
 *     constant world-book entry shows up as triggered.
 *   - "custom_0": run_scenario + commit only (get_playtest_context skipped),
 *     so the same entry never shows as triggered for it -- exercising
 *     world_entries_triggered_in_some. Its commit also omits the JSON
 *     Patch block, so patch_miss_count > 0 for it too.
 */
export async function setupComparableScenarios(page) {
  await callTool(page, "update_card_field", { section: "name", value: "測試角色" });
  await callTool(page, "update_card_field", { section: "first_mes", value: "你推開老宅的門。" });
  await callTool(page, "update_card_field", {
    section: "character_book_entries",
    value: [{ id: 1, comment: "老宅設定", content: "老宅裡總是很安靜。", constant: true, key: [] }],
  });
  await callTool(page, "update_card_field", { section: "cast", value: { status: "known", note: "主角＋馬提亞斯" } });

  await callTool(page, "add_scenario", { description: "半夜有人敲門。" });

  await callTool(page, "run_scenario", { scenario_id: "first_mes", rounds: 1 });
  await callTool(page, "get_playtest_context", { scenario_id: "first_mes", round: 1 });
  await callTool(page, "commit_playtest_round", {
    scenario_id: "first_mes",
    round: 1,
    player_text: "我四處看看。",
    char_text: '[BODY]\n屋內比想像中乾淨。\n[/BODY]\n\n<!-- <VariableUpdateLog><JSONPatch>\n[{"op":"add","path":"/好感度","value":1}]\n</JSONPatch></VariableUpdateLog> -->',
  });

  await callTool(page, "run_scenario", { scenario_id: "custom_0", rounds: 1 });
  await callTool(page, "commit_playtest_round", {
    scenario_id: "custom_0",
    round: 1,
    player_text: "我不太敢開門。",
    char_text: "[BODY]\n敲門聲又響了一次。\n[/BODY]",
  });

  return callTool(page, "compare_scenarios", { scenario_ids: ["first_mes", "custom_0"] });
}

export async function expandTaskbar(page) {
  await page.click("#taskbar-toggle");
  await page.waitForSelector("#taskbar.expanded");
}
