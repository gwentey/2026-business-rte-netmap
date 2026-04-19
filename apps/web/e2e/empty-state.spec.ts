/**
 * T26 — Empty state
 *
 * Vérifie que la page d'accueil affiche un empty state avec un CTA
 * "Importer un dump" quand aucun import n'est présent dans la base.
 *
 * Précondition : l'API tourne sur http://localhost:3000 (géré par webServer).
 * Le beforeEach purge tous les imports via DELETE /api/imports/:id pour
 * garantir un état vierge, quel que soit l'état initial de la DB.
 */
import { test, expect } from '@playwright/test';

const API = 'http://localhost:3000';

test.describe('Empty state', () => {
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
        await request.delete(`${API}/api/imports/${encodeURIComponent(imp.id)}`);
      }
    }
  });

  test('affiche un empty state avec CTA quand la base est vide', async ({ page }) => {
    await page.goto('/');

    // L'empty state doit contenir l'un de ces deux messages (cf. MapPage.tsx)
    await expect(
      page.getByText(/Aucun import dans la base|Aucun composant connu/),
    ).toBeVisible({ timeout: 10_000 });

    // Le CTA "Importer un dump" doit être visible et pointer vers /upload
    const cta = page.getByRole('link', { name: /Importer un dump/ });
    await expect(cta).toBeVisible();

    // Vérifier que le lien navigue vers la page d'upload
    await cta.click();
    await expect(page).toHaveURL(/\/upload/);
  });
});
