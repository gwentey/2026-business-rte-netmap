export type DumpType = 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER';

export type DumpTypeDetection = {
  dumpType: DumpType;
  confidence: 'HIGH' | 'FALLBACK';
  reason: string;
};

export function detectDumpType(
  zipEntries: ReadonlyArray<{ entryName: string }>,
  explicitOverride?: DumpType,
): DumpTypeDetection {
  if (explicitOverride) {
    return { dumpType: explicitOverride, confidence: 'HIGH', reason: 'user override' };
  }

  const names = new Set(zipEntries.map((e) => e.entryName.toLowerCase()));
  const has = (f: string): boolean => names.has(f);

  // CD — signatures exclusives prioritaires (une seule suffit)
  if (has('synchronized_directories.csv')) {
    return { dumpType: 'COMPONENT_DIRECTORY', confidence: 'HIGH', reason: 'synchronized_directories.csv (CD exclusive)' };
  }
  if (has('component_statistics.csv')) {
    return { dumpType: 'COMPONENT_DIRECTORY', confidence: 'HIGH', reason: 'component_statistics.csv (CD exclusive)' };
  }
  if (has('pending_edit_directories.csv') || has('pending_removal_directories.csv')) {
    return { dumpType: 'COMPONENT_DIRECTORY', confidence: 'HIGH', reason: 'pending_*_directories.csv (CD exclusive)' };
  }

  // ENDPOINT — signatures exclusives
  if (has('messaging_statistics.csv')) {
    return { dumpType: 'ENDPOINT', confidence: 'HIGH', reason: 'messaging_statistics.csv (ENDPOINT exclusive)' };
  }
  if (has('message_upload_route.csv')) {
    return { dumpType: 'ENDPOINT', confidence: 'HIGH', reason: 'message_upload_route.csv (ENDPOINT exclusive)' };
  }

  // BROKER — absence totale de CSV + présence de config Artemis
  if (has('broker.xml') || has('bootstrap.xml')) {
    return { dumpType: 'BROKER', confidence: 'HIGH', reason: 'broker.xml/bootstrap.xml (BROKER file-system backup)' };
  }

  // Fallback : si component_directory.csv seul, on suppose CD
  if (has('component_directory.csv')) {
    return { dumpType: 'COMPONENT_DIRECTORY', confidence: 'FALLBACK', reason: 'component_directory.csv seul — défaut CD' };
  }

  // Aucune signature reconnue
  return { dumpType: 'COMPONENT_DIRECTORY', confidence: 'FALLBACK', reason: 'aucune signature ECP reconnue — défaut CD' };
}
