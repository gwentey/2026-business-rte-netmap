export const NULL_VALUE_PLACEHOLDER = 'NULL_VALUE_PLACEHOLDER';

export function normalizeNull<T>(value: T): T | null {
  if (typeof value === 'string' && value === NULL_VALUE_PLACEHOLDER) {
    return null;
  }
  return value;
}
