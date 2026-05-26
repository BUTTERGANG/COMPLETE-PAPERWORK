import Anthropic from 'npm:@anthropic-ai/sdk@0.27.3';
import { createClient } from 'npm:@supabase/supabase-js';

const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
});

const PROMPT = `You are parsing a DJ event worksheet or run-of-show document. These forms contain event details, timeline, client info, pay, and critically — music selections for key moments.

Extract ALL available information and return ONLY a JSON object with these fields:

{
  "event_date": "YYYY-MM-DD or null",
  "event_type": "wedding|corporate|birthday|club|prom|school|holiday|anniversary|other or null",
  "venue_name": "string or null",
  "venue_address": "string or null",
  "venue_phone": "venue's phone number or null",
  "venue_contact": "venue coordinator/contact person name or null",
  "venue_notes": "parking instructions, load-in details, entrance info, curfew, noise restrictions, or any other venue-specific notes or null",
  "bride_name": "bride's full name (include maiden name in parentheses if listed) or null",
  "groom_name": "groom's full name or null",
  "client_name": "primary contact name (if different from bride/groom, e.g. parent or planner; if same as bride/groom, leave null) or null",
  "client_phone": "string or null",
  "client_email": "string or null",
  "secondary_contact": "planner/coordinator name and phone or null",
  "guest_count": number or null,
  "load_in_time": "HH:MM or null",
  "start_time": "HH:MM or null",
  "end_time": "HH:MM or null",
  "base_pay": number or null,
  "pay_type": "flat|hourly|negotiable|TBD or null",
  "compliance_bonus": 40 if mentioned otherwise null,
  "mileage_miles": number or null,

  "timeline": [
    {"time": "HH:MM", "activity": "description of what happens"}
  ],

  "music_selections": {
    "first_dance": "song title – artist or null",
    "father_daughter_dance": "song title – artist or null",
    "mother_son_dance": "song title – artist or null",
    "cake_cutting": "song title – artist or null",
    "bouquet_toss": "song title – artist or null",
    "garter_toss": "song title – artist or null",
    "grand_entrance": "song title – artist or null",
    "last_dance": "song title – artist or null",
    "send_off_exit": "song title – artist or null",
    "ceremony_processional": "song title – artist or null",
    "ceremony_recessional": "song title – artist or null",
    "ceremony_interlude": "song title – artist or null",
    "must_play": ["song 1", "song 2"],
    "do_not_play": ["song 1", "song 2"],
    "music_preferences": "genres, eras, vibe notes, do-not-play genres, or null"
  },

  "special_instructions": "pronunciation names, equipment needs, special announcements, dress code, or null",
  "notes": "any other relevant details or null"
}

CRITICAL — Music Selections extraction rules:
- Music selections are the MOST IMPORTANT part of this document. Read the form carefully for every music field.
- For each music field, extract BOTH the song title AND artist when both are written (e.g., "Thinking Out Loud – Ed Sheeran"). If only a song title is given, use just that. If blank or not mentioned for that event, use null.
- Look for these labeled sections on the form: "First Dance", "Father/Daughter Dance", "Mother/Son Dance", "Cake Cutting", "Bouquet Toss", "Garter Toss", "Grand Entrance", "Intro Song", "Last Dance", "Send Off", "Exit Song", and any ceremony music fields.
- For "must_play": extract every specific song the client requests. These may be listed under headings like "Must Play", "Special Songs", "Important Songs", or similar.
- For "do_not_play": extract every song the client explicitly does NOT want. Look for sections labeled "Do Not Play", "Absolutely Not", "No List", or similar.
- For "music_preferences": capture general music direction like "no country", "80s/90s hits", "keep it classy", "top 40 only", "no line dances", genre preferences, etc.

Couple name extraction rules:
- For weddings, the bride and groom names are typically the PRIMARY contact. Look for fields labeled "Bride", "Groom", "Partner 1", "Partner 2", or similar.
- Extract the bride's full name including maiden name if listed in parentheses (e.g., "Sarah Johnson (Williams)").
- Extract the groom's full name.
- For non-wedding events where there is no couple, set both to null.
- For the "client_name" field: only fill this if there is a DIFFERENT primary contact (e.g., a parent, wedding planner, or coordinator who is the main point of contact). If the bride/groom IS the contact, leave client_name as null.

Other rules:
- For timeline: extract every schedule entry. These often list times like "5:30 PM - Grand Entrance" or "6:15 - First Dance". Convert times to 24-hour HH:MM format.
- For event_type: use the specific type marked on the form (check boxes, underlined, or written in).
- For base_pay: extract only the numeric value. If "$400" → 400. If "2 hours @ $150/hr" → 300. If unclear or TBD → null.
- Return ONLY the JSON object, no markdown, no explanation.`;

// Detect media type from base64 header or fall back to jpeg
function detectMediaType(base64: string): string {
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('iVBOR')) return 'image/png';
  if (base64.startsWith('UklGR')) return 'image/webp';
  if (base64.startsWith('R0lGOD')) return 'image/gif';
  return 'image/jpeg'; // default
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // Authenticate the request via Supabase JWT
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const token = authHeader.replace('Bearer ', '');

  const supabaseClient = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  let image: string;
  try {
    const body = await req.json();
    image = body.image;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  if (!image || typeof image !== 'string') {
    return new Response(JSON.stringify({ error: 'Image data is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const mediaType = detectMediaType(image);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: image },
            },
            {
              type: 'text',
              text: PROMPT,
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';

    // Robust JSON extraction from AI response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ error: 'Failed to parse paperwork: AI could not extract event details. Try a clearer photo.' }),
        { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    console.error('Error calling Anthropic API:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to analyze paperwork. Please try again.' }),
      { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
});
