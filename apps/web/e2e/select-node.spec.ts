import { test, expect } from '@playwright/test';
import AdmZip from 'adm-zip';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURE_DIR = join(__dirname, '..', '..', '..', 'tests', 'fixtures', '17V000000498771C_2026-04-17T21_27_17Z');
const EXCLUDED = new Set(['local_key_store.csv', 'registration_store.csv']);

function buildFixtureZip(): Buffer {
  const zip = new AdmZip();
  for (const f of readdirSync(FIXTURE_DIR)) {
    if (EXCLUDED.has(f) || f.startsWith('.')) continue;
    zip.addFile(f, readFileSync(join(FIXTURE_DIR, f)));
  }
  return zip.toBuffer();
}

test('click a map marker opens the detail panel with EIC info', async ({ page }) => {
  // Upload first so there's a graph to click on
  await page.goto('/upload');
  await page.setInputFiles('input[type=file]', {
    name: 'endpoint.zip',
    mimeType: 'application/zip',
    buffer: buildFixtureZip(),
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
