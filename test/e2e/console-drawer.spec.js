import { test, expect } from "@playwright/test";
import { callTool, waitForTools, expandTaskbar } from "./helpers.js";

// The bottom console drawer (Agent 呼叫紀錄) is a second, independent drawer
// alongside the left taskbar -- separate element, separate toggle, separate
// state. Neither should affect the other.

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await waitForTools(page);
});

test("console drawer is collapsed by default, showing only the tab", async ({ page }) => {
  await expect(page.locator("#console-drawer")).toHaveClass(/collapsed/);
  await expect(page.locator("#console-drawer .console-body")).not.toBeVisible();
  await expect(page.locator("#console-toggle")).toBeVisible();
  await expect(page.locator("#console-toggle")).toContainText("▲");
});

test("opening the drawer reveals the activity log", async ({ page }) => {
  await callTool(page, "update_card_field", { section: "name", value: "測試角色" });

  await page.click("#console-toggle");
  await expect(page.locator("#console-drawer")).toHaveClass(/expanded/);
  await expect(page.locator("#console-drawer .console-body")).toBeVisible();
  await expect(page.locator("#console-toggle")).toContainText("▼");
  await expect(page.locator("#activity-log .log-entry")).toHaveCount(1);

  // Collapsing it again hides the body but the log itself is untouched.
  await page.click("#console-toggle");
  await expect(page.locator("#console-drawer")).toHaveClass(/collapsed/);
  await expect(page.locator("#console-drawer .console-body")).not.toBeVisible();
});

test("the console drawer and the left taskbar toggle independently", async ({ page }) => {
  // Opening the taskbar must not open the console drawer.
  await expandTaskbar(page);
  await expect(page.locator("#taskbar")).toHaveClass(/expanded/);
  await expect(page.locator("#console-drawer")).toHaveClass(/collapsed/);

  // Opening the console drawer must not close (or otherwise affect) the taskbar.
  await page.click("#console-toggle");
  await expect(page.locator("#console-drawer")).toHaveClass(/expanded/);
  await expect(page.locator("#taskbar")).toHaveClass(/expanded/);
  await expect(page.locator("body")).toHaveClass(/taskbar-expanded/);

  // Collapsing the taskbar must not close the console drawer.
  await page.click("#taskbar-toggle");
  await expect(page.locator("#taskbar")).toHaveClass(/collapsed/);
  await expect(page.locator("#console-drawer")).toHaveClass(/expanded/);
});
