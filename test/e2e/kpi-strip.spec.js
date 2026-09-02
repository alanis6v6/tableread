import { test, expect } from "@playwright/test";
import { callTool, waitForTools } from "./helpers.js";

// The KPI strip (checklist completion / rounds run / world-book entries /
// agent calls) and the field-fill bars (卡片欄位填寫率) are both absorbed
// from the earlier KPI-dashboard design into this dark-neon layout -- the
// strip as a persistent bar above the snap-scroll sections, the fill bars
// as a card inside the draft section. Both read the same draftStore/
// sessionRegistry/activityLog state as the rest of the page, no new state.

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await waitForTools(page);
});

test("KPI strip lives outside the 4 snap-scrolled sections and starts at zero", async ({ page }) => {
  await expect(page.locator(".snap-section")).toHaveCount(4);
  await expect(page.locator("#kpi-strip .snap-section")).toHaveCount(0);

  await expect(page.locator("#kpi-checklist-value")).toHaveText("0/8");
  await expect(page.locator("#kpi-rounds-value")).toHaveText("0");
  await expect(page.locator("#kpi-rounds-sub")).toHaveText("情境：（尚無情境）");
  await expect(page.locator("#kpi-worldbook-value")).toHaveText("0");
  await expect(page.locator("#kpi-calls-value")).toHaveText("0");
});

test("checklist KPI cell tracks the same known-count as the checklist section", async ({ page }) => {
  await callTool(page, "update_card_field", { section: "cast", value: { status: "known", note: "主角" } });
  await expect(page.locator("#kpi-checklist-value")).toHaveText("1/8");
  await expect(page.locator("#checklist-fraction")).toHaveText("1/8");

  const fillWidth = await page.locator("#kpi-checklist-fill").evaluate((el) => el.style.width);
  expect(fillWidth).toBe("13%"); // round(1/8 * 100)
});

test("rounds/world-book KPI cells update after running a scenario", async ({ page }) => {
  await callTool(page, "update_card_field", { section: "first_mes", value: "開場白。" });
  await callTool(page, "update_card_field", {
    section: "character_book_entries",
    value: [{ id: 1, comment: "設定", content: "常駐內容。", constant: true, key: [] }],
  });
  await callTool(page, "run_scenario", { scenario_id: "first_mes", rounds: 1 });
  await callTool(page, "get_playtest_context", { scenario_id: "first_mes", round: 1 });
  await callTool(page, "commit_playtest_round", {
    scenario_id: "first_mes",
    round: 1,
    player_text: "測試。",
    char_text: "[BODY]測試回應。[/BODY]",
  });

  await page.selectOption("#scenario-select", "first_mes");

  await expect(page.locator("#kpi-rounds-value")).toHaveText("1");
  await expect(page.locator("#kpi-rounds-sub")).toHaveText("情境：first_mes");
  await expect(page.locator("#kpi-worldbook-value")).toHaveText("1");
  await expect(page.locator("#kpi-worldbook-sub")).toHaveText("已全數觸發");

  // Every WebMCP call so far (update_card_field x2, run_scenario,
  // get_playtest_context, commit_playtest_round) is counted, none failed.
  await expect(page.locator("#kpi-calls-value")).toHaveText("5");
  await expect(page.locator("#kpi-calls-sub")).toHaveText("無錯誤");
  await expect(page.locator("#kpi-calls-sub")).not.toHaveClass(/kpi-sub-warn/);
});

test("卡片欄位填寫率 bars reflect required/optional/world-book/regex fill state", async ({ page }) => {
  await page.locator("#section-draft").scrollIntoViewIfNeeded();
  const bars = page.locator("#field-fill-bars .field-bar");
  await expect(bars).toHaveCount(4);

  // All four bars start at 0% with nothing filled in yet.
  for (const pct of await bars.locator(".field-bar-head .pct").allTextContents()) {
    expect(pct).toBe("0%");
  }

  // Fill all 4 required fields (name/description/personality/first_mes) ->
  // the "必填欄位" bar should read 100%.
  for (const section of ["name", "description", "personality", "first_mes"]) {
    await callTool(page, "update_card_field", { section, value: "填好了" });
  }
  await expect(bars.nth(0).locator(".pct")).toHaveText("100%");

  const fillWidth = await bars.nth(0).locator(".field-bar-fill").evaluate((el) => el.style.width);
  expect(fillWidth).toBe("100%");
});
