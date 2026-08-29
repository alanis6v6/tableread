import { test, expect } from "@playwright/test";
import { callTool, waitForTools } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await waitForTools(page);
});

test("checklist renders three distinctly-spaced groups instead of one flat list", async ({ page }) => {
  await expect(page.locator("#checklist-groups .checklist-group")).toHaveCount(3);

  const gap = await page.locator("#checklist-groups").evaluate((el) => getComputedStyle(el).rowGap || getComputedStyle(el).gap);
  expect(parseFloat(gap)).toBeGreaterThan(10);

  // Each group is its own bordered card, not a bare row.
  const firstGroupBorder = await page
    .locator("#checklist-groups .checklist-group")
    .first()
    .evaluate((el) => getComputedStyle(el).borderWidth);
  expect(firstGroupBorder).toBe("3px");
});

test("a completed checklist item gets a verified fill, not just a checkmark icon", async ({ page }) => {
  const row = page.locator("#checklist-groups .checklist-row").first();
  const bgBefore = await row.evaluate((el) => getComputedStyle(el).backgroundColor);

  await callTool(page, "update_card_field", { section: "cast", value: { status: "known", note: "" } });

  await expect(row).toHaveClass(/is-done/);
  const bgAfter = await row.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bgAfter).not.toBe(bgBefore);
  expect(bgAfter).toBe("rgba(47, 158, 107, 0.14)"); // --color-verified-tint
});

test("draft preview warning cards only appear next to fields that actually have a problem", async ({ page }) => {
  await expect(page.locator(".kv-warning-card")).toHaveCount(0);

  await callTool(page, "update_card_field", {
    section: "character_book_entries",
    value: [{ id: 1, comment: "缺內容條目", content: "", constant: true, key: [] }],
  });

  await expect(page.locator(".kv-warning-card")).toHaveCount(1);
  await expect(page.locator(".kv-warning-card").first()).toContainText("content");

  // Fixing it makes the warning card disappear again (no permanent placeholder).
  await callTool(page, "update_card_field", {
    section: "character_book_entries",
    value: [{ id: 1, comment: "缺內容條目", content: "有內容了", constant: true, key: [] }],
  });
  await expect(page.locator(".kv-warning-card")).toHaveCount(0);
});
