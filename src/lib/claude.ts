import type { ParsedEvent } from '../types/event';

const API_BASE = '/api';

export interface UploadPage {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
  data: string; // base64
}

export async function parsePaperwork(pages: UploadPage[]): Promise<ParsedEvent> {
  if (pages.length === 0) {
    throw new Error('No pages to parse.');
  }
  // Validate each page size before sending (Anthropic limits per block).
  for (const p of pages) {
    const estimatedSize = p.data.length * 0.75;
    if (estimatedSize > 5 * 1024 * 1024) {
      throw new Error('A page is too large. Use smaller files or fewer pages.');
    }
  }

  const resp = await fetch(`${API_BASE}/parse-paperwork`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payloads: pages }),
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Parsing failed: ${resp.status}`);
  }

  return resp.json();
}
