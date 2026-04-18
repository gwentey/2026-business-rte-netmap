const ISO_WITH_NANOS = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})?$/;

export function parseEcpDate(input: string | null | undefined): Date | null {
  if (input == null) return null;
  if (input === '' || input === 'NULL_VALUE_PLACEHOLDER') return null;

  const match = ISO_WITH_NANOS.exec(input);
  if (!match) return null;

  const [, basePart, fractionalRaw, tzPart] = match;
  const fractional = fractionalRaw ? fractionalRaw.slice(0, 3).padEnd(3, '0') : '000';
  const tz = tzPart ?? 'Z';
  const iso = `${basePart}.${fractional}${tz}`;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return null;
  return new Date(time);
}
