import { test, expect } from "@playwright/test";
import { callTool, waitForTools } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await waitForTools(page);
  await callTool(page, "update_card_field", { section: "first_mes", value: "開場白。" });

  // Enough scenarios that the compare-card strip overflows the viewport
  // horizontally, so we have something real to scroll through.
  for (let i = 0; i < 6; i++) {
    await callTool(page, "add_scenario", { description: `情境 ${i}` });
  }
  const ids = ["first_mes", "custom_0", "custom_1", "custom_2", "custom_3", "custom_4", "custom_5"];
  for (const id of ids) {
    await callTool(page, "run_scenario", { scenario_id: id, rounds: 1 });
    await callTool(page, "commit_playtest_round", { scenario_id: id, round: 1, player_text: "", char_text: "[BODY]測試[/BODY]" });
  }

  // Select every scenario for comparison via the actual UI checkboxes.
  await page.locator("#section-compare").scrollIntoViewIfNeeded();
  const checkboxes = page.locator("#scenario-list .scenario-row input[type=checkbox]");
  const count = await checkboxes.count();
  for (let i = 0; i < count; i++) await checkboxes.nth(i).check();

  await expect(page.locator("#compare-cards .compare-card")).toHaveCount(count);
});

test("the compare section is not sub-divided by vertical snap-scroll", async ({ page }) => {
  await expect(page.locator(".snap-section")).toHaveCount(4);
  await expect(page.locator("#section-compare .snap-section")).toHaveCount(0);

  await page.locator("#section-compare").scrollIntoViewIfNeeded();
  const sectionBox = await page.locator("#section-compare").boundingBox();
  const mainBox = await page.locator("#scroll-main").boundingBox();
  // A single snap section fills the scroller's viewport -- it isn't chopped
  // into several smaller vertically-snapped pieces.
  expect(sectionBox.height).toBeGreaterThanOrEqual(mainBox.height - 2);
});

test("the compare-card strip scrolls horizontally to reveal cards beyond the viewport", async ({ page }) => {
  const scroller = page.locator(".compare-cards-scroller");

  const { scrollWidth, clientWidth } = await scroller.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(scrollWidth).toBeGreaterThan(clientWidth);

  const lastCard = page.locator("#compare-cards .compare-card").last();
  const before = await lastCard.evaluate((el, root) => {
    const r = el.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    return r.left >= rootRect.left && r.right <= rootRect.right + 1;
  }, await scroller.elementHandle());
  expect(before).toBe(false); // not fully visible before scrolling

  await scroller.evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });

  const after = await lastCard.evaluate((el, root) => {
    const r = el.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    return r.left >= rootRect.left - 1 && r.right <= rootRect.right + 1;
  }, await scroller.elementHandle());
  expect(after).toBe(true); // fully visible after scrolling right
});
