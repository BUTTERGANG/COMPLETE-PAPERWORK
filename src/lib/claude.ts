import Anthropic from '@anthropic-ai/sdk';
import type { ParsedEvent } from '../types/event';

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  // In Replit, we use a proxy or allow dangerous browser access
  dangerouslyAllowBrowser: true,
});

const PROMPT = `You are parsing a DJ event worksheet or run-of-show document. Extract ALL available information and return ONLY a JSON object with these fields:

{
  "event_date": "YYYY-MM-DD or null",
  "event_type": "wedding|corporate|birthday|club|prom|school|holiday|anniversary|other or null",
  "venue_name": "string or null",
  "venue_address": "string or null",
  "venue_phone": "venue phone or null",
  "venue_contact": "venue coordinator name or null",
  "venue_notes": "parking/load-in/noise restrictions or null",
  "bride_name": "bride full name or null",
  "groom_name": "groom full name or null",
  "client_name": "primary contact or null",
  "client_phone": "string or null",
  "client_email": "string or null",
  "secondary_contact": "planner/coordinator or null",
  "guest_count": number or null,
  "load_in_time": "HH:MM or null",
  "start_time": "HH:MM or null",
  "end_time": "HH:MM or null",
  "base_pay": number or null,
  "pay_type": "flat|hourly|negotiable or null",
  "compliance_bonus": 40 if mentioned otherwise null,
  "mileage_miles": number or null,
  "timeline": [{"time": "HH:MM", "activity": "description"}],
  "music_selections": {
    "first_dance": "song – artist or null",
    "father_daughter_dance": "song – artist or null",
    "mother_son_dance": "song – artist or null",
    "cake_cutting": "song – artist or null",
    "bouquet_toss": "song – artist or null",
    "garter_toss": "song – artist or null",
    "grand_entrance": "song – artist or null",
    "last_dance": "song – artist or null",
    "send_off_exit": "song – artist or null",
    "ceremony_processional": "song – artist or null",
    "ceremony_recessional": "song – artist or null",
    "ceremony_interlude": "song – artist or null",
    "must_play": ["song 1"],
    "do_not_play": ["song 1"],
    "music_preferences": "genre/vibe notes or null"
  },
  "special_instructions": "equipment/dress code/announcements or null",
  "notes": "any other details or null"
}

Return ONLY the JSON object, no markdown.`;

function detectMediaType(base64: string): string {
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('iVBOR')) return 'image/png';
  if (base64.startsWith('UklGR')) return 'image/webp';
  return 'image/jpeg';
}

export async function parsePaperwork(base64Image: string): Promise<ParsedEvent> {
  const mediaType = detectMediaType(base64Image);
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: base64Image } },
        { type: 'text', text: PROMPT }
      ]
    }]
  });

  const text = (response.content[0] as { type: 'text'; text: string }).text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI could not extract event details. Try a clearer photo.');

  return JSON.parse(jsonMatch[0]);
}
