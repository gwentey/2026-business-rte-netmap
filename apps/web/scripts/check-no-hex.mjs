#!/usr/bin/env node
// =============================================================================
// check-no-hex.mjs — Garde-fou anti-hex dans apps/web/src/ (ADR-040)
//
// Usage : node apps/web/scripts/check-no-hex.mjs
// Exit 0 si OK, exit 1 si hex hardcodés trouvés hors exceptions.
//
// Exceptions autorisées (data-driven, source unique de tokens, ou tests) :
// - lib/process-colors.ts                  (palette métier — source TS)
// - components/Map/node-icon.tsx           (couleurs inline SVG markers)
// - components/Map/EdgePath.tsx            (couleurs process Leaflet)
// - components/Map/HomeCdOverlay.tsx       (config carto Leaflet)
// - styles/brand.scss                      (source unique des tokens dark)
// - styles/components.scss                 (primitives globales — overrides leaflet)
// - styles/pages.scss                      (sections page-spécifiques)
// - styles/brand.test.ts                   (tests des tokens)
// - Tous les *.test.ts{,x} et *.spec.ts{,x}  (fixtures de tests)
// =============================================================================

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(__dirname, '..', 'src');

const HEX_REGEX = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g;

const ALLOWED_FILES = new Set([
  'lib/process-colors.ts',
  'components/Map/node-icon.tsx',
  'components/Map/EdgePath.tsx',
  'components/Map/HomeCdOverlay.tsx',
  'styles/brand.scss',
  'styles/components.scss',
  'styles/pages.scss',
  'styles/brand.test.ts',
]);

const ALLOWED_SUFFIXES = ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx'];

function isAllowed(relPath) {
  if (ALLOWED_FILES.has(relPath.replace(/\\/g, '/'))) return true;
  return ALLOWED_SUFFIXES.some((s) => relPath.endsWith(s));
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (
      entry.isFile() &&
      /\.(ts|tsx|scss|css)$/i.test(entry.name)
    ) {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  const files = await walk(SRC_ROOT);
  const violations = [];

  for (const abs of files) {
    const rel = path.relative(SRC_ROOT, abs);
    if (isAllowed(rel)) continue;

    const content = await readFile(abs, 'utf8');
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const matches = line.match(HEX_REGEX);
      if (matches) {
        for (const hex of matches) {
          violations.push({
            file: rel.replace(/\\/g, '/'),
            line: i + 1,
            hex,
            context: line.trim().slice(0, 100),
          });
        }
      }
    }
  }

  if (violations.length === 0) {
    console.log('✓ check:no-hex — aucun hex hardcodé dans apps/web/src/ (hors exceptions data-driven)');
    process.exit(0);
  }

  console.error('✗ check:no-hex — ' + violations.length + ' hex hardcodé(s) trouvé(s) :\n');
  for (const v of violations) {
    console.error('  ' + v.file + ':' + v.line + '  ' + v.hex + '  ← ' + v.context);
  }
  console.error('\nRemplacez par des tokens --cyan-*/--dark-*/--ink-*/--proc-*/--radius-* depuis styles/brand.scss');
  console.error('ou ajoutez le fichier aux exceptions dans scripts/check-no-hex.mjs s\'il est data-driven.');
  process.exit(1);
}

main().catch((err) => {
  console.error('check:no-hex a échoué :', err);
  process.exit(2);
});
