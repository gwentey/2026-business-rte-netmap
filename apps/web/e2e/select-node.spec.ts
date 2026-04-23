import { test, expect } from '@playwright/test';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENDPOINT_FIXTURE, buildFixtureZipBuffer } from './helpers/fixtures.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test('click a map marker opens the detail panel with EIC info', async ({ page }) => {
  // Upload first so there's a graph to click on
  await page.goto('/upload');
  await page.setInputFiles('input[type=file]', {
    name: `${ENDPOINT_FIXTURE}.zip`,
    mimeType: 'application/zip',
    buffer: buildFixtureZipBuffer(__dirname, ENDPOINT_FIXTURE),
  });
  await page.getByPlaceholder(/hebdo/).fill('E2E Select Node');
  await page.getByRole('button', { name: /^Envoyer/ }).click();
  await expect(page.getByRole('button', { name: /Voir sur la carte/ })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /Voir sur la carte/ }).click();

  // Wait for leaflet markers to appear
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await page.waitForSelector('path.leaflet-interactive, .leaflet-interactive', { timeout: 10_000 });

  // Click the first interactive marker (use force to bypass SVG overlap intercepts)
  await page.locator('.leaflet-interactive').first().click({ force: true });

  // Detail panel should appear with an EIC (17V..., 10X..., or 26X... pattern)
  await expect(page.locator('aside h2')).toBeVisible();
  await expect(page.locator('aside').getByText(/17V|10X|26X/).first()).toBeVisible();
});
