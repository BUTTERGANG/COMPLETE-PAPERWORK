import type { ParsedEvent } from '../types/event';

const API_BASE = '/api';

export async function parsePaperwork(base64Image: string): Promise<ParsedEvent> {
  // Validate image size before sending (Anthropic limit ~5MB per image)
  const estimatedSize = base64Image.length * 0.75; // base64 is ~1.33x raw
  if (estimatedSize > 5 * 1024 * 1024) {
    throw new Error('Image too large. Please use a smaller image or reduce quality.');
  }

  const resp = await fetch(`${API_BASE}/parse-paperwork`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Image }),
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Parsing failed: ${resp.status}`);
  }

  return resp.json();
}
