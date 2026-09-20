// Shared, Drive-friendly filename for exported event documents.
// Format: <YYYYMMDD>-<couple-key>[-<type>].<ext>
// Date comes first so files sort chronologically in Google Drive / a folder.

interface EventNaming {
  event_date?: string | null;
  client_name?: string | null;
  bride_name?: string | null;
  groom_name?: string | null;
}

function lastName(n?: string | null): string | null {
  if (!n) return null;
  const parts = n.trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Couple key derived from surnames where possible, else client/bride/groom. */
export function coupleKey(e: EventNaming): string {
  const b = lastName(e.bride_name);
  const g = lastName(e.groom_name);
  if (b && g && b.toLowerCase() !== g.toLowerCase()) return `${b}-${g}`;
  return b || g || lastName(e.client_name) || e.client_name || '';
}

export function eventFileName(
  e: EventNaming,
  opts: { ext?: string; suffix?: string } = {},
): string {
  const { ext = 'docx', suffix } = opts;
  const date = (e.event_date || '').replace(/[^0-9]/g, '') || 'nodate';
  const key = slugify(coupleKey(e) || 'event');
  return `${date}-${key}${suffix ? '-' + suffix : ''}.${ext}`;
}