import { test, expect } from "@playwright/test";
import { waitForTools, expandTaskbar } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await waitForTools(page);
});

test("collapsed taskbar: main content is full width with no frame/gutter", async ({ page }) => {
  await expect(page.locator("#taskbar")).toHaveClass(/collapsed/);
  await expect(page.locator("body")).not.toHaveClass(/taskbar-expanded/);

  const box = await page.locator("#content-wrap").boundingBox();
  const viewport = page.viewportSize();
  expect(box.width).toBeGreaterThanOrEqual(viewport.width - 1);
  expect(box.x).toBeLessThanOrEqual(1);

  const scrollMainBorder = await page
    .locator("#scroll-main")
    .evaluate((el) => getComputedStyle(el).borderWidth);
  expect(scrollMainBorder).toBe("0px");

  const wrapBg = await page.locator("#content-wrap").evaluate((el) => getComputedStyle(el).backgroundColor);
  // Not the pending-color gutter background (rgb(240, 169, 60)).
  expect(wrapBg).not.toBe("rgb(240, 169, 60)");
});

test("expanding the taskbar frames the content in a bordered, gutter-wrapped area", async ({ page }) => {
  await expandTaskbar(page);
  await expect(page.locator("body")).toHaveClass(/taskbar-expanded/);

  const scrollMainBorder = await page
    .locator("#scroll-main")
    .evaluate((el) => getComputedStyle(el).borderWidth);
  expect(scrollMainBorder).toBe("3px");

  const wrapBg = await page.locator("#content-wrap").evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(wrapBg).toBe("rgb(240, 169, 60)");

  const contentBox = await page.locator("#content-wrap").boundingBox();
  expect(contentBox.x).toBeGreaterThan(200); // pushed right by the taskbar width
});

test("taskbar is non-modal: clicking inside main content never collapses it", async ({ page }) => {
  await expandTaskbar(page);

  // Click several different kinds of controls inside the main content area.
  await page.locator("#mode-btn-merchant").click();
  await expect(page.locator("#taskbar")).toHaveClass(/expanded/);

  await page.locator("#section-draft").scrollIntoViewIfNeeded();
  await page.locator("#draft-fields").click({ position: { x: 5, y: 5 } });
  await expect(page.locator("#taskbar")).toHaveClass(/expanded/);

  await page.locator("#section-compare").scrollIntoViewIfNeeded();
  await page.locator("#scenario-list").click();
  await expect(page.locator("#taskbar")).toHaveClass(/expanded/);
  await expect(page.locator("body")).toHaveClass(/taskbar-expanded/);
});

test("clicking the task icon again collapses the taskbar", async ({ page }) => {
  await expandTaskbar(page);
  await page.click("#taskbar-toggle");
  await expect(page.locator("#taskbar")).toHaveClass(/collapsed/);
  await expect(page.locator("body")).not.toHaveClass(/taskbar-expanded/);

  const box = await page.locator("#content-wrap").boundingBox();
  const viewport = page.viewportSize();
  expect(box.width).toBeGreaterThanOrEqual(viewport.width - 1);
});
