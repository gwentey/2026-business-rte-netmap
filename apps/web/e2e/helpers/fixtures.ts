import AdmZip from 'adm-zip';
import { join } from 'node:path';

/**
 * CSVs sensibles contenus dans les dumps ECP bruts (clés privées + inventaires).
 * Jamais remis dans les zips envoyés aux tests e2e.
 */
const SENSITIVE = new Set([
  'local_key_store.csv',
  'registration_store.csv',
  'registration_requests.csv',
]);

/**
 * Nom canonique d'un dump ECP (même contrat que `apps/api/test/fixtures-loader.ts`).
 * La valeur est le nom de fichier `<EIC>_<timestamp>` sans extension.
 */
export const ENDPOINT_FIXTURE = '17V000000498771C_2026-04-21T14_33_05Z';
export const CD_FIXTURE = '17V000002014106G_2026-04-22T08_16_46Z';

const FIXTURE_SUBDIRS: Record<string, string> = {
  [ENDPOINT_FIXTURE]: join('EXPORT', 'PRFRI-EP2'),
  [CD_FIXTURE]: join('EXPORT', 'PRFRI-CD1'),
};

/**
 * Construit en mémoire un zip de test à partir du dump ECP brut stocké dans
 * `tests/fixtures/EXPORT/PRFRI-*/`. Les CSVs sensibles sont exclus.
 *
 * @param baseFromE2e chemin absolu du dossier `apps/web/e2e/` (résolu par l'appelant
 *   via `fileURLToPath(import.meta.url)` + `dirname`).
 */
export function buildFixtureZipBuffer(
  baseFromE2e: string,
  fixtureName: string,
): Buffer {
  const subdir = FIXTURE_SUBDIRS[fixtureName];
  if (!subdir) {
    throw new Error(
      `Unknown fixture: ${fixtureName}. Known: ${Object.keys(FIXTURE_SUBDIRS).join(', ')}`,
    );
  }
  const zipPath = join(baseFromE2e, '..', '..', '..', 'tests', 'fixtures', subdir, `${fixtureName}.zip`);
  const source = new AdmZip(zipPath);
  const output = new AdmZip();
  for (const entry of source.getEntries()) {
    if (SENSITIVE.has(entry.entryName)) continue;
    output.addFile(entry.entryName, entry.getData());
  }
  return output.toBuffer();
}
