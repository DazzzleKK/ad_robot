import { expect, test } from '@playwright/test';

test('chart hover interactions match expected behavior', async ({ page }) => {
  await page.goto('/');

  const chart = page.locator('.chart-shell');
  const tooltip = page.locator('.chart-tooltip');
  const activeHoverPoints = page.locator('.hover-point-set--visible');
  const spline = page.locator('.spline-line');
  const splineMarker = page.locator('.hover-point-set--visible .spline-point');

  await expect(chart).toBeVisible();
  await expect(tooltip).toHaveCSS('opacity', '0');

  await page.screenshot({ path: 'playwright-report-screens/chart-default.png', fullPage: true });

  const box = await chart.boundingBox();
  expect(box).not.toBeNull();

  if (!box) {
    return;
  }

  await page.mouse.move(box.x + 475, box.y + 210);
  await expect(tooltip).toHaveCSS('opacity', '1');
  await expect(activeHoverPoints).toHaveCount(1);
  await expect(tooltip).toContainText('13.06.2026');
  await expect(splineMarker).toHaveAttribute('points', /,/);

  await page.screenshot({ path: 'playwright-report-screens/chart-hover.png', fullPage: true });

  await page.mouse.move(box.x + 595, box.y + 132);
  await expect(tooltip).toContainText('14.06.2026');
  await expect(activeHoverPoints).toHaveCount(1);

  const tooltipBox = await tooltip.boundingBox();
  const markerBox = await splineMarker.boundingBox();

  expect(tooltipBox).not.toBeNull();
  expect(markerBox).not.toBeNull();

  if (tooltipBox && markerBox) {
    const separated =
      tooltipBox.x > markerBox.x + markerBox.width ||
      tooltipBox.x + tooltipBox.width < markerBox.x ||
      tooltipBox.y > markerBox.y + markerBox.height ||
      tooltipBox.y + tooltipBox.height < markerBox.y;

    expect(separated).toBe(true);
  }

  await page.mouse.move(box.x + 145, box.y + 72);
  await page.waitForTimeout(550);
  await expect(spline).toHaveCSS('stroke-width', '2px');

  await page.mouse.move(box.x + 145, box.y + 20);
  await page.waitForTimeout(550);
  await expect(spline).toHaveCSS('stroke-width', '6px');

  await page.mouse.move(box.x + box.width + 30, box.y + box.height + 30);
  await expect(tooltip).toHaveCSS('opacity', '0');
  await expect(activeHoverPoints).toHaveCount(0);
});
