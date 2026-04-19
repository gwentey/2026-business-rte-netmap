export type DumpType = 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER';

type ComponentDirectoryRow = { xml?: string | null | undefined };

export function detectDumpType(
  componentDirectoryRows: ReadonlyArray<ComponentDirectoryRow>,
  explicitOverride: DumpType | undefined,
): DumpType {
  if (explicitOverride) return explicitOverride;
  const hasXmlBlob = componentDirectoryRows.some(
    (row) => typeof row.xml === 'string' && row.xml.includes('<?xml'),
  );
  return hasXmlBlob ? 'ENDPOINT' : 'COMPONENT_DIRECTORY';
}
