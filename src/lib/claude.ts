import type { ParsedEvent } from '../types/event';

const API_BASE = '/api';

export async function parsePaperwork(base64Images: string[]): Promise<ParsedEvent> {
  if (base64Images.length === 0) {
    throw new Error('No images to parse.');
  }
  // Validate each image size before sending (Anthropic limit ~5MB per image)
  for (const img of base64Images) {
    const estimatedSize = img.length * 0.75; // base64 is ~1.33x raw
    if (estimatedSize > 5 * 1024 * 1024) {
      throw new Error('An image is too large. Please use smaller images or reduce quality.');
    }
  }

  const resp = await fetch(`${API_BASE}/parse-paperwork`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Images }),
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Parsing failed: ${resp.status}`);
  }

  return resp.json();
}
