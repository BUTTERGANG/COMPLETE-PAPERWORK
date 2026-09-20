import fs from 'fs';
import os from 'os';
import path from 'path';

const HOSTED_URL = process.env.STT_BASE_URL; // OpenAI-compatible /v1/audio/transcriptions
const HOSTED_KEY = process.env.STT_API_KEY;
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'base.en';
const WHISPER_MODEL_ROOT = process.env.WHISPER_MODEL_ROOT || path.join(os.homedir(), 'whisper', 'models');

/**
 * Transcribe audio (base64) to text.
 */
export async function transcribeAudio(base64Audio: string): Promise<string> {
  if (!base64Audio) throw new Error('Audio data is required');

  const buf = Buffer.from(base64Audio, 'base64');
  if (buf.length === 0) throw new Error('Audio data is empty');

  // Preferred: hosted OpenAI-compatible whisper endpoint (Groq/OpenAI/tunnel).
  if (HOSTED_URL) {
    return transcribeHosted(buf);
  }

  // Local whisper.cpp via nodejs-whisper (keyless, private, free).
  return transcribeLocal(buf);
}

async function transcribeHosted(buf: Buffer): Promise<string> {
  const base = HOSTED_URL!.replace(/\/+$/, '');
  const url = base.includes('/audio/transcriptions') ? base : `${base}/v1/audio/transcriptions`;
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buf)]), 'audio.m4a');
  form.append('model', 'whisper-1');
  form.append('response_format', 'text');

  const headers: Record<string, string> = {};
  if (HOSTED_KEY) headers.Authorization = `Bearer ${HOSTED_KEY}`;

  const resp = await fetch(url, { method: 'POST', body: form, headers });
  if (!resp.ok) {
    throw new Error(`Transcription failed (${resp.status}): ${(await resp.text()).slice(0, 200)}`);
  }
  return (await resp.text()).trim();
}

async function transcribeLocal(buf: Buffer): Promise<string> {
  // nodejs-whisper is required at runtime only when the local engine is used.
  const { nodewhisper } = await import('nodejs-whisper');
  const tmp: fs.PathLike = path.join(os.tmpdir(), `dj-note-${Date.now()}.m4a`);
  try {
    fs.writeFileSync(tmp, buf);
    const transcript = await nodewhisper(String(tmp), {
      modelName: WHISPER_MODEL,
      modelRootPath: WHISPER_MODEL_ROOT,
      autoDownloadModelName: WHISPER_MODEL,
      removeWavFileAfterTranscription: false,
      whisperOptions: { language: 'english' },
    });
    const text = Array.isArray(transcript) ? transcript.join(' ') : String(transcript);
    // Strip whisper.cpp timestamp markers ([00:00:00.000 --> 00:00:02.880]).
    return text
      .replace(/\[\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}\]\s*/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    try { fs.unlinkSync(`${tmp}.txt`); } catch { /* ignore */ }
    try { fs.unlinkSync(path.join(path.dirname(tmp), `${path.basename(tmp, '.m4a')}.wav`)); } catch { /* ignore */ }
  }
}

// Helper used by the notes endpoint to decide availability without importing whisper.
export function transcriptionEngineAvailable(): { local: boolean; hosted: boolean } {
  return { local: !HOSTED_URL, hosted: !!HOSTED_URL };
}
