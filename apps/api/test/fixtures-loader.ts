import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import AdmZip from 'adm-zip';

const REPO_ROOT = join(process.cwd(), '..', '..');
const FIXTURES_ROOT = join(REPO_ROOT, 'tests', 'fixtures');

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

export function buildZipFromFixture(folderName: string): Buffer {
  const dir = join(FIXTURES_ROOT, folderName);
  const zip = new AdmZip();
  for (const entry of readdirSync(dir)) {
    if (!INGESTED_FILES.has(entry)) continue;
    zip.addFile(entry, readFileSync(join(dir, entry)));
  }
  return zip.toBuffer();
}

export const ENDPOINT_FIXTURE = '17V000000498771C_2026-04-17T21_27_17Z';
export const CD_FIXTURE = '17V000002014106G_2026-04-17T22_11_50Z';
