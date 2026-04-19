const FILENAME_REGEX = /^(?<eic>[A-Z0-9\-]+)_(?<date>\d{4}-\d{2}-\d{2})T(?<time>\d{2}_\d{2}_\d{2})Z\.zip$/i;

export type FilenameMetadata = {
  sourceComponentEic: string | null;
  sourceDumpTimestamp: Date | null;
};

export function parseDumpFilename(filename: string): FilenameMetadata {
  const match = FILENAME_REGEX.exec(filename);
  if (!match?.groups) {
    return { sourceComponentEic: null, sourceDumpTimestamp: null };
  }
  const { eic, date, time } = match.groups;
  const iso = `${date}T${time!.replace(/_/g, ':')}.000Z`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return { sourceComponentEic: null, sourceDumpTimestamp: null };
  }
  return { sourceComponentEic: eic!, sourceDumpTimestamp: parsed };
}
