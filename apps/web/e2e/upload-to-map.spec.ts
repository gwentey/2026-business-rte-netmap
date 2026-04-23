import { test, expect } from '@playwright/test';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENDPOINT_FIXTURE, buildFixtureZipBuffer } from './helpers/fixtures.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test('upload a backup then see the map rendered', async ({ page }) => {
  await page.goto('/upload');
  await page.setInputFiles('input[type=file]', {
    name: `${ENDPOINT_FIXTURE}.zip`,
    mimeType: 'application/zip',
    buffer: buildFixtureZipBuffer(__dirname, ENDPOINT_FIXTURE),
  });
  await page.getByPlaceholder(/hebdo/).fill('E2E Endpoint');
  await page.getByRole('button', { name: /^Envoyer/ }).click();
  await expect(page.getByRole('button', { name: /Voir sur la carte/ })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /Voir sur la carte/ }).click();
  await expect(page).toHaveURL(/\/map/);
  await expect(page.locator('.leaflet-container')).toBeVisible();
});
