import { test, expect } from '@playwright/test';
import AdmZip from 'adm-zip';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ENDPOINT_DIR = join(__dirname, '..', '..', '..', 'tests', 'fixtures', '17V000000498771C_2026-04-17T21_27_17Z');
const CD_DIR = join(__dirname, '..', '..', '..', 'tests', 'fixtures', '17V000002014106G_2026-04-17T22_11_50Z');
const EXCLUDED = new Set(['local_key_store.csv', 'registration_store.csv', 'registration_requests.csv']);

function buildZip(dir: string): Buffer {
  const zip = new AdmZip();
  for (const f of readdirSync(dir)) {
    if (EXCLUDED.has(f) || f.startsWith('.')) continue;
    zip.addFile(f, readFileSync(join(dir, f)));
  }
  return zip.toBuffer();
}

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
  await uploadSnapshot(page, buildZip(ENDPOINT_DIR), 'E2E Switch Endpoint');
  await uploadSnapshot(page, buildZip(CD_DIR), 'E2E Switch CD');

  // Selector should have at least 2 options
  const selector = page.locator('header select');
  await expect(selector).toBeVisible();
  const optionCount = await selector.locator('option').count();
  expect(optionCount).toBeGreaterThanOrEqual(2);
});
