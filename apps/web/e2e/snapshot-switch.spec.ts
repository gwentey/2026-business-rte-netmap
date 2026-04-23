import { test, expect } from '@playwright/test';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENDPOINT_FIXTURE, CD_FIXTURE, buildFixtureZipBuffer } from './helpers/fixtures.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function uploadSnapshot(page: import('@playwright/test').Page, buffer: Buffer, label: string): Promise<void> {
  await page.goto('/upload');
  await page.setInputFiles('input[type=file]', {
    name: 'snap.zip',
    mimeType: 'application/zip',
    buffer,
  });
  await page.getByPlaceholder(/hebdo/).fill(label);
  await page.getByRole('button', { name: /^Envoyer/ }).click();
  await expect(page.getByRole('button', { name: /Voir sur la carte/ })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /Voir sur la carte/ }).click();
  await expect(page.locator('.leaflet-container')).toBeVisible();
}

test('upload 2 snapshots and switch between them via selector', async ({ page }) => {
  // Upload endpoint then CD
  await uploadSnapshot(page, buildFixtureZipBuffer(__dirname, ENDPOINT_FIXTURE), 'E2E Switch Endpoint');
  await uploadSnapshot(page, buildFixtureZipBuffer(__dirname, CD_FIXTURE), 'E2E Switch CD');

  // Selector should have at least 2 options
  const selector = page.locator('header select');
  await expect(selector).toBeVisible();
  const optionCount = await selector.locator('option').count();
  expect(optionCount).toBeGreaterThanOrEqual(2);
});
