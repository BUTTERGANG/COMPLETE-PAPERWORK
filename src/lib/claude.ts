import { supabase } from './supabase';
import type { ParsedEvent } from '../types/event';

export async function parsePaperwork(base64Image: string): Promise<ParsedEvent> {
  const { data, error } = await supabase.functions.invoke('parse-paperwork', {
    body: { image: base64Image },
  });

  if (error) {
    // Surface a user-friendly message while logging the real error for debugging
    console.error('Edge function error:', error);
    throw new Error('Failed to parse paperwork. Please try again or enter details manually.');
  }
  return data as ParsedEvent;
}
