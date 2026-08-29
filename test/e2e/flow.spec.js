import { test, expect } from "@playwright/test";
import { callTool, waitForTools, setupComparableScenarios } from "./helpers.js";

// Exercises the same 草稿 -> run_scenario -> 比較 pipeline the WebMCP tools
// are designed for, end to end through the redesigned UI, to confirm the
// visual/structural rework didn't disturb any of the underlying
// draftStore/scenarioStore/sessionRegistry/activityLog wiring.

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await waitForTools(page);
});

test("all 10 tools are registered and drivable via window.__tableread.tools", async ({ page }) => {
  const names = await page.evaluate(() => window.__tableread.tools.map((t) => t.name));
  expect(names.sort()).toEqual(
    [
      "get_checklist_status",
      "update_card_field",
      "assemble_card",
      "list_scenarios",
      "add_scenario",
      "run_scenario",
      "get_playtest_context",
      "commit_playtest_round",
      "get_transcript",
      "compare_scenarios",
    ].sort(),
  );
});

test("draft edits, checklist updates, and activity log render live", async ({ page }) => {
  await callTool(page, "update_card_field", { section: "name", value: "測試角色" });
  await callTool(page, "update_card_field", { section: "cast", value: { status: "known", note: "主角＋馬提亞斯" } });

  await expect(page.locator("#draft-fields dd").first()).toHaveText("測試角色");

  const firstRow = page.locator("#checklist-list .checklist-row").first();
  await expect(firstRow.locator(".checklist-icon")).toHaveText("✅");
  await expect(firstRow.locator(".checklist-note")).toHaveText("主角＋馬提亞斯");

  await expect(page.locator("#activity-log .log-entry")).toHaveCount(2);
});

test("running a scenario renders its transcript and QA summary in autotest", async ({ page }) => {
  await callTool(page, "update_card_field", { section: "first_mes", value: "你推開老宅的門。" });
  await callTool(page, "run_scenario", { scenario_id: "first_mes", rounds: 1 });
  await callTool(page, "get_playtest_context", { scenario_id: "first_mes", round: 1 });
  await callTool(page, "commit_playtest_round", {
    scenario_id: "first_mes",
    round: 1,
    player_text: "我四處看看。",
    char_text: "[BODY]\n屋內比想像中乾淨。\n[/BODY]",
  });

  await page.selectOption("#scenario-select", "first_mes");
  await expect(page.locator("#transcript .round-block")).toHaveCount(2); // round 0 (opening) + round 1
  await expect(page.locator("#qa-summary .qa-row").first()).toContainText("已跑輪數");
});

test("comparing two scenarios shows an inconsistency alert and a warning-tagged card", async ({ page }) => {
  const compareResult = await setupComparableScenarios(page);
  expect(compareResult.world_entries_triggered_in_some).toContain("老宅設定");

  await page.locator("#section-compare").scrollIntoViewIfNeeded();
  const checkboxes = page.locator("#scenario-list .scenario-row input[type=checkbox]");
  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();

  await expect(page.locator("#compare-cards .compare-card")).toHaveCount(2);
  await expect(page.locator("#compare-cards .compare-card.has-warning")).toHaveCount(1);
  await expect(page.locator("#compare-summary .compare-alert")).not.toHaveClass(/compare-alert-ok/);
  await expect(page.locator("#compare-summary .compare-alert")).toContainText("老宅設定");
});
