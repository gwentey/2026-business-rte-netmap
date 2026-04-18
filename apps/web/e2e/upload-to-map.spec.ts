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

test('upload a backup then see the map rendered', async ({ page }) => {
  await page.goto('/upload');
  await page.setInputFiles('input[type=file]', {
    name: 'endpoint.zip',
    mimeType: 'application/zip',
    buffer: buildFixtureZip(),
  });
  await page.getByPlaceholder(/hebdo/).fill('E2E Endpoint');
  await page.getByRole('button', { name: /^Envoyer/ }).click();
  await expect(page.getByRole('button', { name: /Voir sur la carte/ })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /Voir sur la carte/ }).click();
  await expect(page).toHaveURL(/\/map/);
  await expect(page.locator('.leaflet-container')).toBeVisible();
});
