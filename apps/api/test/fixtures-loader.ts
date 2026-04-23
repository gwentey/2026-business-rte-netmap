import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AdmZip from 'adm-zip';

const REPO_ROOT = join(process.cwd(), '..', '..');
const FIXTURES_ROOT = join(REPO_ROOT, 'tests', 'fixtures');

/**
 * CSVs conservés dans le zip de test, réputés non-sensibles.
 * Les trois CSVs écartés (`local_key_store.csv`, `registration_store.csv`,
 * `registration_requests.csv`) contiennent des clés privées et des demandes
 * d'enregistrement ECP — ils ne doivent jamais être exposés aux tests.
 */
const INGESTED_FILES = new Set([
  'application_property.csv',
  'component_directory.csv',
  'message_path.csv',
  'messaging_statistics.csv',
  'message_type.csv',
  'message_upload_route.csv',
  'component_statistics.csv',
  'synchronized_directories.csv',
  'pending_edit_directories.csv',
  'pending_removal_directories.csv',
]);

/**
 * Dumps de référence utilisés par la suite de tests.
 * Les valeurs correspondent au nom canonique ECP EIC_timestamp du fichier zip
 * livré par l'administrateur (Export Configuration). Chaque dump vit dans
 * tests/fixtures/EXPORT/PRFRI-* avec son fichier EIC-configuration.properties.
 */
export const ENDPOINT_FIXTURE = '17V000000498771C_2026-04-21T14_33_05Z';
export const CD_FIXTURE = '17V000002014106G_2026-04-22T08_16_46Z';

const FIXTURE_SUBDIRS: Record<string, string> = {
  [ENDPOINT_FIXTURE]: join('EXPORT', 'PRFRI-EP2'),
  [CD_FIXTURE]: join('EXPORT', 'PRFRI-CD1'),
};

/**
 * Construit un Buffer zip contenant uniquement les CSVs non-sensibles du dump
 * fourni. Le zip source est lu depuis tests/fixtures/EXPORT/PRFRI-* et
 * dépaquetté en mémoire ; aucun fichier temporaire n'est créé sur disque.
 *
 * Lance une exception si fixtureName ne correspond à aucune fixture connue ou
 * si le zip de référence est absent (non versionné, voir .gitignore).
 */
export function buildZipFromFixture(fixtureName: string): Buffer {
  const subdir = FIXTURE_SUBDIRS[fixtureName];
  if (!subdir) {
    throw new Error(
      `Unknown fixture: ${fixtureName}. Known: ${Object.keys(FIXTURE_SUBDIRS).join(', ')}`,
    );
  }
  const zipPath = join(FIXTURES_ROOT, subdir, `${fixtureName}.zip`);
  const source = new AdmZip(zipPath);
  const output = new AdmZip();
  for (const entry of source.getEntries()) {
    if (!INGESTED_FILES.has(entry.entryName)) continue;
    output.addFile(entry.entryName, entry.getData());
  }
  return output.toBuffer();
}

/**
 * Lit le fichier EIC-configuration.properties associé à une fixture.
 * Utile pour les tests qui valideront le couplage zip + properties attendu
 * par les slices futurs.
 */
export function readFixtureProperties(fixtureName: string): Buffer {
  const subdir = FIXTURE_SUBDIRS[fixtureName];
  if (!subdir) {
    throw new Error(
      `Unknown fixture: ${fixtureName}. Known: ${Object.keys(FIXTURE_SUBDIRS).join(', ')}`,
    );
  }
  const eic = fixtureName.split('_')[0]!;
  const propertiesPath = join(FIXTURES_ROOT, subdir, `${eic}-configuration.properties`);
  return readFileSync(propertiesPath);
}
