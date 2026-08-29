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
  // Collapsed: no distinct gutter shade at all -- content-wrap is unstyled
  // (transparent), so it just shows through to the page background.
  expect(wrapBg).toBe("rgba(0, 0, 0, 0)");
});

test("expanding the taskbar frames the content in a bordered, gutter-wrapped area", async ({ page }) => {
  await expandTaskbar(page);
  await expect(page.locator("body")).toHaveClass(/taskbar-expanded/);

  const scrollMainBorder = await page
    .locator("#scroll-main")
    .evaluate((el) => getComputedStyle(el).borderWidth);
  expect(scrollMainBorder).toBe("2px");

  // The gutter is a neutral shade distinct from the page background (--gutter-bg,
  // a derived neutral) -- NOT a solid neon accent fill (per the hard "no large
  // semantic background fill" rule: the wrapped look comes from --scroll-main's
  // edge glow, not from painting the gutter itself in an accent color).
  const wrapBg = await page.locator("#content-wrap").evaluate((el) => getComputedStyle(el).backgroundColor);
  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(wrapBg).not.toBe(bodyBg);
  for (const neon of ["rgb(61, 220, 255)", "rgb(57, 255, 136)", "rgb(255, 67, 101)", "rgb(255, 210, 61)"]) {
    expect(wrapBg).not.toBe(neon);
  }

  const contentBox = await page.locator("#content-wrap").boundingBox();
  expect(contentBox.x).toBeGreaterThan(200); // pushed right by the taskbar width
});

test("taskbar is non-modal: clicking inside main content never collapses it", async ({ page }) => {
  await expandTaskbar(page);

  // Click several different kinds of controls inside the main content area.
  await page.locator("#mode-btn-merchant").click();
  await expect(page.locator("#taskbar")).toHaveClass(/expanded/);

  await page.locator("#section-draft").scrollIntoViewIfNeeded();
  await page.locator(".draft-banner").click();
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
