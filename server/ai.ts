import type Anthropic from '@anthropic-ai/sdk';
import { buildEventContext } from './noteTemplate';

/** A single uploadable page: image (jpeg/png/webp) or PDF. */
export interface UploadPage {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
  data: string; // base64
}

export function detectMediaType(b64: string): UploadPage['mediaType'] {
  if (b64.startsWith('iVBOR')) return 'image/png';
  if (b64.startsWith('UklGR')) return 'image/webp';
  if (b64.startsWith('JVBERi')) return 'application/pdf';
  return 'image/jpeg';
}

/**
 * Extract free-form text/notes from an uploaded page (handwritten notes,
 * a PDF of call notes, etc.) — returns whatever readable text is present.
 */
export async function extractNoteText(anthropic: Anthropic, pages: UploadPage[]): Promise<string> {
  const blocks = pages.map((p) => {
    if (p.mediaType === 'application/pdf') {
      return {
        type: 'document' as const,
        source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: p.data },
      };
    }
    return {
      type: 'image' as const,
      source: { type: 'base64' as const, media_type: p.mediaType, data: p.data },
    };
  });

  const PROMPT =
    'Transcribe the text from this DJ paperwork / notes page(s). It may contain printed text, ' +
    'handwriting, or a mix. Return ONLY the transcribed text, preserving meaning. If there is no ' +
    'readable content, return an empty string. Do not add commentary.';

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: [...blocks, { type: 'text', text: PROMPT }] }],
  });
  const textBlock = response.content.find((c) => c.type === 'text');
  return (textBlock?.type === 'text' ? textBlock.text : '').trim();
}

/**
 * Chat assistant for an event: answers a question grounded in the event
 * record + operator notes + recent chat history (no external context).
 */
export async function answerEventQuestion(
  anthropic: Anthropic,
  event: Record<string, unknown>,
  notes: { title?: string | null; content?: string }[],
  history: { role: 'user' | 'assistant'; content: string }[],
  question: string,
): Promise<string> {
  const eventContext = buildEventContext(event as Record<string, unknown>, notes);
  const SYSTEM =
    'You are the DJ\'s on-the-go assistant for a specific event. Answer questions using ONLY the ' +
    'provided event context and notes. If the answer isn\'t in the context, say you don\'t have that ' +
    'detail and suggest where to check. Be concise and practical for a working DJ — times, names, ' +
    'songs, logistics. Never invent information.';

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content:
        `EVENT CONTEXT (extracted from paperwork + notes):\n\`\`\`\n${eventContext}\n\`\`\`\n\n` +
        (history.length
          ? `RECENT CONVERSATION:\n${history.map((h) => `${h.role.toUpperCase()}: ${h.content}`).join('\n')}\n\n`
          : '') +
        `Your question:\n${question}`,
    },
  ];

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    system: SYSTEM,
    messages,
  });
  const textBlock = response.content.find((c) => c.type === 'text');
  return (textBlock?.type === 'text' ? textBlock.text : 'No response.').trim();
}
