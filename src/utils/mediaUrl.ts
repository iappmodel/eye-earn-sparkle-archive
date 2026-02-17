/**
 * Parse media_url from DB (single URL or JSON array for carousel).
 */
export function parseMediaUrl(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  if (value.startsWith('[')) {
    try {
      const arr = JSON.parse(value) as unknown;
      return Array.isArray(arr) ? arr.filter((u): u is string => typeof u === 'string') : [value];
    } catch {
      return [value];
    }
  }
  return [value];
}

/** First URL for thumbnail/display. */
export function getPrimaryMediaUrl(value: string | null | undefined): string | null {
  const urls = parseMediaUrl(value);
  return urls[0] ?? null;
}
