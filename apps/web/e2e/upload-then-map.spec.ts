/**
 * T27 — Upload then map
 *
 * Vérifie le flux complet : upload d'un dump ENDPOINT → succès → redirection
 * vers "/" (MapPage) → carte Leaflet peuplée avec au moins un marker interactif.
 *
 * Le zip est construit en mémoire depuis la fixture réelle
 * `tests/fixtures/EXPORT/PRFRI-EP2/` (fichiers sensibles exclus).
 *
 * Sélecteurs vérifiés contre UploadPage.tsx :
 *   - placeholder label  : "ex: Semaine 15 RTE"
 *   - placeholder envName: "OPF / PROD / PFRFI"
 *   - bouton submit      : "Importer"
 *   - bouton post-import : "Voir sur la carte →"
 */
import { test, expect } from '@playwright/test';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENDPOINT_FIXTURE, buildFixtureZipBuffer } from './helpers/fixtures.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test('upload un dump ENDPOINT puis atterrit sur la carte peuplée', async ({ page }) => {
  await page.goto('/upload');

  // Sélectionne le fichier via setInputFiles (bypass dropzone)
  await page.setInputFiles('input[type=file]', {
    name: `${ENDPOINT_FIXTURE}.zip`,
    mimeType: 'application/zip',
    buffer: buildFixtureZipBuffer(__dirname, ENDPOINT_FIXTURE),
  });

  // Renseigne le label (placeholder "ex: Semaine 15 RTE")
  await page.getByPlaceholder('ex: Semaine 15 RTE').fill('E2E upload-then-map');

  // L'env est pré-rempli "OPF" mais on peut le laisser tel quel
  // ou le vider/ré-écrire si on veut un env dédié E2E
  const envInput = page.getByPlaceholder('OPF / PROD / PFRFI');
  await envInput.clear();
  await envInput.fill('E2E_SMOKE');

  // Soumet le formulaire
  await page.getByRole('button', { name: /^Importer$/ }).click();

  // Attend le bouton "Voir sur la carte →" (timeout 30 s pour l'ingestion)
  const viewBtn = page.getByRole('button', { name: /Voir sur la carte/ });
  await expect(viewBtn).toBeVisible({ timeout: 30_000 });
  await viewBtn.click();

  // Après click, navigue vers "/" (cf. openMap() dans UploadPage.tsx)
  await expect(page).toHaveURL(/^\//);

  // La carte Leaflet doit être visible
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15_000 });

  // Au moins un élément interactif Leaflet (marker ou edge) doit être présent
  await expect(
    page.locator('.leaflet-interactive').first(),
  ).toBeVisible({ timeout: 15_000 });
});
