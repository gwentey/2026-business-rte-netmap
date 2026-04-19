import { Injectable } from '@nestjs/common';
import type { Warning } from '@carto-ecp/shared';
import type { BuiltImportedComponent } from './types.js';

type LocalCsvRow = {
  eic: string;
  componentCode: string;
  organization?: string | null;
  personName?: string | null;
  email?: string | null;
  phone?: string | null;
  homeCdCode?: string | null;
  networks?: string | null;
  xml?: string | null;
  creationTs?: string | null;
  modificationTs?: string | null;
};

@Injectable()
export class ImportBuilderService {
  buildFromLocalCsv(rows: LocalCsvRow[]): {
    components: BuiltImportedComponent[];
    warnings: Warning[];
  } {
    const components: BuiltImportedComponent[] = [];
    const warnings: Warning[] = [];
    for (const row of rows) {
      if (!row.eic) {
        warnings.push({
          code: 'CSV_ROW_MISSING_EIC',
          message: `Row skipped: ${row.componentCode ?? '<no code>'}`,
        });
        continue;
      }
      components.push({
        eic: row.eic,
        type: this.inferType(row),
        organization: nonEmpty(row.organization),
        personName: nonEmpty(row.personName),
        email: nonEmpty(row.email),
        phone: nonEmpty(row.phone),
        homeCdCode: nonEmpty(row.homeCdCode),
        networksCsv: nonEmpty(row.networks),
        displayName: null,
        country: null,
        lat: null,
        lng: null,
        isDefaultPosition: true,
        sourceType: 'LOCAL_CSV',
        creationTs: parseDateOrNull(row.creationTs),
        modificationTs: parseDateOrNull(row.modificationTs),
        urls: [],
      });
    }
    return { components, warnings };
  }

  private inferType(row: LocalCsvRow): BuiltImportedComponent['type'] {
    if (row.componentCode === row.eic) return 'COMPONENT_DIRECTORY';
    return 'ENDPOINT';
  }
}

function nonEmpty(v: string | null | undefined): string | null {
  if (v == null) return null;
  const s = v.trim();
  return s.length === 0 ? null : s;
}

function parseDateOrNull(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
