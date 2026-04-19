export type ImportedPathWithImport = {
  receiverEic: string;
  senderEic: string;
  messageType: string;
  transportPattern: string;
  intermediateBrokerEic: string | null;
  validFrom: Date | null;
  validTo: Date | null;
  isExpired: boolean;
  _effectiveDate: Date;
};

export type MergedPath = Omit<ImportedPathWithImport, '_effectiveDate'>;

function identityKey(p: ImportedPathWithImport): string {
  return [
    p.receiverEic,
    p.senderEic,
    p.messageType,
    p.transportPattern,
    p.intermediateBrokerEic ?? '',
  ].join('||');
}

export function mergePathsLatestWins(
  rows: ImportedPathWithImport[],
): Map<string, MergedPath> {
  const byKey = new Map<string, ImportedPathWithImport[]>();
  for (const r of rows) {
    const k = identityKey(r);
    const list = byKey.get(k) ?? [];
    list.push(r);
    byKey.set(k, list);
  }

  const out = new Map<string, MergedPath>();
  for (const [k, list] of byKey) {
    list.sort((a, b) => a._effectiveDate.getTime() - b._effectiveDate.getTime());
    const latest = list[list.length - 1]!;
    const merged: MergedPath = {
      receiverEic: latest.receiverEic,
      senderEic: latest.senderEic,
      messageType: latest.messageType,
      transportPattern: latest.transportPattern,
      intermediateBrokerEic: latest.intermediateBrokerEic,
      validFrom: latest.validFrom,
      validTo: latest.validTo,
      isExpired: latest.isExpired,
    };
    out.set(k, merged);
  }
  return out;
}
