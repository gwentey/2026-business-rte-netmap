/**
 * T28 — Multi-upload
 *
 * Vérifie le flux complet multi-fichiers :
 * - Drag de 2 fixtures ZIP (ENDPOINT + CD)
 * - Apparition des deux lignes dans la preview table (état "Prêt")
 * - Submit "Importer tout"
 * - Résumé "Batch terminé : 2 créés"
 * - Navigation vers la carte et vérification d'au moins un élément Leaflet interactif
 *
 * Les zips sont construits en mémoire depuis les fixtures réelles
 * `tests/fixtures/17V.../` (fichiers sensibles exclus).
 *
 * Précondition : l'API tourne sur http://localhost:3000 (géré par webServer).
 * Le beforeEach purge tous les imports existants pour éviter les doublons sur
 * des runs répétés (state "skipped" au lieu de "done").
 */
import { test, expect } from '@playwright/test';
import AdmZip from 'adm-zip';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API = 'http://localhost:3000';

/** Fichiers sensibles à ne jamais lire ni uploader */
const EXCLUDED = new Set([
  'local_key_store.csv',
  'registration_store.csv',
  'registration_requests.csv',
]);

/** Fichiers CSV attendus dans un dump ECP (whitelist) */
const CANDIDATES = [
  'application_property.csv',
  'component_directory.csv',
  'messaging_statistics.csv',
  'message_path.csv',
  'message_type.csv',
  'message_upload_route.csv',
  'component_statistics.csv',
  'synchronized_directories.csv',
  'pending_edit_directories.csv',
  'pending_removal_directories.csv',
];

/**
 * Construit un Buffer ZIP depuis un dossier fixture, en excluant les fichiers
 * sensibles et en se limitant à la whitelist des fichiers attendus.
 */
function buildFixtureZipBuffer(fixtureName: string): Buffer {
  const zip = new AdmZip();
  const base = join(
    __dirname,
    '..',
    '..',
    '..',
    'tests',
    'fixtures',
    fixtureName,
  );
  for (const f of CANDIDATES) {
    if (EXCLUDED.has(f)) continue;
    const p = join(base, f);
    if (existsSync(p)) {
      zip.addFile(f, readFileSync(p));
    }
  }
  return zip.toBuffer();
}

test.describe('Multi-upload', () => {
  test.beforeEach(async ({ request }) => {
    // Récupère la liste des envs disponibles
    const envsRes = await request.get(`${API}/api/envs`);
    if (!envsRes.ok()) return; // DB vide, rien à purger

    const envs: string[] = await envsRes.json();

    // Pour chaque env, supprime tous les imports
    for (const env of envs) {
      const importsRes = await request.get(
        `${API}/api/imports?env=${encodeURIComponent(env)}`,
      );
      if (!importsRes.ok()) continue;
      const list: Array<{ id: string }> = await importsRes.json();
      for (const imp of list) {
        await request.delete(
          `${API}/api/imports/${encodeURIComponent(imp.id)}`,
        );
      }
    }
  });

  test('drag 2 fixtures, preview visible, submit, résumé 2 créés, carte peuplée', async ({
    page,
  }) => {
    await page.goto('/upload');

    // Renseigne l'environnement
    const envInput = page.getByLabel(/Environnement/i);
    await envInput.clear();
    await envInput.fill('E2E_MULTI');

    // Sélectionne les 2 fichiers via setInputFiles (bypass dropzone natif)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([
      {
        name: '17V000000498771C_2026-04-17T21_27_17Z.zip',
        mimeType: 'application/zip',
        buffer: buildFixtureZipBuffer('17V000000498771C_2026-04-17T21_27_17Z'),
      },
      {
        name: '17V000002014106G_2026-04-17T22_11_50Z.zip',
        mimeType: 'application/zip',
        buffer: buildFixtureZipBuffer('17V000002014106G_2026-04-17T22_11_50Z'),
      },
    ]);

    // Attend que les deux noms de fichiers apparaissent dans la table de preview
    // (état "pending-inspect" → "inspected" = "🟢 Prêt")
    await expect(
      page.getByText('17V000000498771C_2026-04-17T21_27_17Z.zip'),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText('17V000002014106G_2026-04-17T22_11_50Z.zip'),
    ).toBeVisible({ timeout: 20_000 });

    // Attend que les 2 fichiers passent à l'état "Prêt" avant de soumettre
    // Le bouton est activé dès qu'au moins 1 fichier est "actionable"
    const submitBtn = page.getByRole('button', { name: /Importer tout/i });
    await expect(submitBtn).toBeEnabled({ timeout: 20_000 });

    await submitBtn.click();

    // Attend le résumé "Batch terminé"
    await expect(page.getByText(/Batch terminé/)).toBeVisible({
      timeout: 30_000,
    });

    // Vérifie que 2 imports ont été créés
    await expect(page.getByText(/2 créés/i)).toBeVisible();

    // Clique sur "Voir sur la carte →"
    const voirCarteLink = page.getByRole('link', { name: /Voir sur la carte/i });
    await expect(voirCarteLink).toBeVisible();
    await voirCarteLink.click();

    // Vérifie la navigation vers la page carte avec l'env E2E_MULTI
    await expect(page).toHaveURL(/\/(\?env=E2E_MULTI)?$/, { timeout: 10_000 });

    // La carte Leaflet doit être visible
    await expect(page.locator('.leaflet-container')).toBeVisible({
      timeout: 15_000,
    });

    // Au moins un élément interactif Leaflet (marker ou edge) doit être présent
    await expect(page.locator('.leaflet-interactive').first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
