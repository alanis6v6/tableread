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
  expect(firstGroupBorder).toBe("2px");
});

test("a completed checklist item gets a verified accent edge, not just a checkmark icon", async ({ page }) => {
  const row = page.locator("#checklist-groups .checklist-row").first();
  const borderBefore = await row.evaluate((el) => getComputedStyle(el).borderLeftWidth);

  await callTool(page, "update_card_field", { section: "cast", value: { status: "known", note: "" } });

  await expect(row).toHaveClass(/is-done/);
  const style = await row.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { width: cs.borderLeftWidth, color: cs.borderLeftColor };
  });
  expect(style.width).not.toBe(borderBefore);
  expect(style.width).toBe("3px");
  expect(style.color).toBe("rgb(57, 255, 136)"); // --color-verified
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
