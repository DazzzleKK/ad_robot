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

  await page.mouse.move(box.x + 690, box.y + 210);
  await expect(tooltip).toHaveCSS('opacity', '1');
  await expect(activeHoverPoints).toHaveCount(1);
  await expect(tooltip).toContainText('13.06.2026');
  await expect(splineMarker).toHaveAttribute('points', /,/);

  await page.screenshot({ path: 'playwright-report-screens/chart-hover.png', fullPage: true });

  await page.mouse.move(box.x + 870, box.y + 132);
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

  await page.mouse.move(box.x + 504, box.y + 235);
  await expect(tooltip).toHaveCSS('opacity', '1');
  await expect(tooltip).toContainText('12.06.2026');

  await page.mouse.move(box.x + 145, box.y + 120);
  await page.waitForTimeout(550);
  await expect(spline).toHaveCSS('stroke-width', '2px');

  await page.mouse.move(box.x + 145, box.y + 20);
  await page.waitForTimeout(550);
  await expect(spline).toHaveCSS('stroke-width', '6px');

  await page.mouse.move(box.x + box.width + 30, box.y + box.height + 30);
  await expect(tooltip).toHaveCSS('opacity', '0');
  await expect(activeHoverPoints).toHaveCount(0);
});

test('chart can be initialized from JSON editor', async ({ page }) => {
  await page.goto('/');

  await page.locator('.data-editor summary').click();

  const textarea = page.locator('.data-editor__textarea');
  await expect(textarea).toBeVisible();

  await textarea.fill(JSON.stringify({
    area: [{ date: '01.07.2026', value: 10 }],
    spline: [{ date: '01.07.2026', value: 20 }],
    line: [{ date: '01.07.2026', value: 30 }],
    bar: [{ date: '01.07.2026', value: 0.5 }],
  }, null, 2));
  await page.locator('.data-editor__button').click();

  const chart = page.locator('.chart-shell');
  const box = await chart.boundingBox();
  expect(box).not.toBeNull();

  if (!box) {
    return;
  }

  await page.mouse.move(box.x + 150, box.y + 180);
  await expect(page.locator('.chart-tooltip')).toContainText('01.07.2026');
});

test('chart point form skips empty series values', async ({ page }) => {
  await page.goto('/');

  await page.locator('.point-editor summary').click();
  await page.locator('.point-editor__field').filter({ hasText: 'Date' }).locator('input').fill('2026-06-15');
  await page.locator('.point-editor__field').filter({ hasText: 'Cost' }).locator('input').fill('72.4');
  await page.locator('.point-editor__field').filter({ hasText: 'ROI confirmed' }).locator('input').fill('410.2');
  await page.locator('.point-editor__field').filter({ hasText: 'Conversions' }).locator('input').fill('96');
  await page.locator('.point-editor__button').click();

  await page.locator('.data-editor summary').click();
  const jsonValue = await page.locator('.data-editor__textarea').inputValue();
  const data = JSON.parse(jsonValue);

  expect(data.area).toContainEqual({ date: '15.06.2026', value: 72.4 });
  expect(data.spline).toContainEqual({ date: '15.06.2026', value: 410.2 });
  expect(data.line).toContainEqual({ date: '15.06.2026', value: 96 });
  expect(data.bar).not.toContainEqual(expect.objectContaining({ date: '15.06.2026' }));
});

test('chart can zoom and move through the minimap', async ({ page }) => {
  await page.goto('/');

  const longData = {
    area: Array.from({ length: 12 }, (_, index) => ({ date: `${String(index + 1).padStart(2, '0')}.07.2026`, value: 20 + index * 4 })),
    spline: Array.from({ length: 12 }, (_, index) => ({ date: `${String(index + 1).padStart(2, '0')}.07.2026`, value: 300 - index * 12 })),
    line: Array.from({ length: 12 }, (_, index) => ({ date: `${String(index + 1).padStart(2, '0')}.07.2026`, value: 10 + index * 8 })),
    bar: Array.from({ length: 12 }, (_, index) => ({ date: `${String(index + 1).padStart(2, '0')}.07.2026`, value: 0.4 + index * 0.05 })),
  };

  await page.locator('.data-editor summary').click();
  await page.locator('.data-editor__textarea').fill(JSON.stringify(longData, null, 2));
  await page.locator('.data-editor__button').click();
  await page.locator('.zoom-control input').fill('4');

  const chart = page.locator('.chart-shell');
  const box = await chart.boundingBox();
  expect(box).not.toBeNull();

  if (!box) {
    return;
  }

  await page.mouse.click(box.x + 720, box.y + 355);
  await page.mouse.move(box.x + 145, box.y + 180);
  await expect(page.locator('.chart-tooltip')).toContainText('01.07.2026');
});
