import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Spinner } from './Spinner';
import { PlusIcon, XIcon, UploadIcon, SendIcon, MicIcon, TrashIcon, FileTextIcon } from './icons/Icons';

type NoteSource = 'typed' | 'image' | 'pdf' | 'audio';

interface EventNote {
  id: string;
  source: NoteSource;
  title: string | null;
  content: string;
  created_at: string;
}
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

const SOURCE_LABEL: Record<NoteSource, string> = {
  typed: 'Typed',
  image: 'Photo',
  pdf: 'PDF',
  audio: 'Call/audio',
};

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Request failed: ${resp.status}`);
  }
  if (resp.status === 204) return undefined as T;
  return resp.json() as Promise<T>;
}

export default function EventAssistant({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const notesQuery = useQuery<EventNote[]>({
    queryKey: ['notes', eventId],
    queryFn: () => api(`/api/events/${eventId}/notes`),
  });
  const chatQuery = useQuery<ChatMessage[]>({
    queryKey: ['chat', eventId],
    queryFn: () => api(`/api/events/${eventId}/chat`),
  });

  const [typedTitle, setTypedTitle] = useState('');
  const [typedContent, setTypedContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const scrollChat = () =>
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

  const runNote = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/events/${eventId}/notes`, { method: 'POST', body: JSON.stringify(body) });
      setTypedTitle('');
      setTypedContent('');
      await qc.invalidateQueries({ queryKey: ['notes', eventId] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add note');
    } finally {
      setBusy(false);
    }
  };

  const handleTypedNote = () => {
    if (!typedContent.trim()) return;
    runNote({ content: typedContent, title: typedTitle || null });
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const isAudio = file.type.startsWith('audio/') || /\.(m4a|mp3|wav|ogg|mov|mp4)$/i.test(file.name);
    setBusy(true);
    setError(null);
    try {
      const data = await readAsBase64(file);
      const body = isPdf
        ? { pdfBase64: data }
        : isAudio
          ? { audioBase64: data }
          : { imageBase64: data };
      await api(`/api/events/${eventId}/notes`, { method: 'POST', body: JSON.stringify(body) });
      await qc.invalidateQueries({ queryKey: ['notes', eventId] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to process file');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await api(`/api/events/${eventId}/notes/${noteId}`, { method: 'DELETE' });
      await qc.invalidateQueries({ queryKey: ['notes', eventId] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete note');
    }
  };

  const handleAsk = async () => {
    const msg = question.trim();
    if (!msg || asking) return;
    setAsking(true);
    setError(null);
    setQuestion('');
    try {
      // Optimistically append the user's question.
      qc.setQueryData<ChatMessage[]>(['chat', eventId], (old) => [
        ...(old ?? []),
        { id: `tmp-${Date.now()}`, role: 'user', content: msg, created_at: new Date().toISOString() },
      ]);
      scrollChat();
      const res = await api<{ assistantMessage: ChatMessage }>(
        `/api/events/${eventId}/chat`,
        { method: 'POST', body: JSON.stringify({ message: msg }) },
      );
      await qc.invalidateQueries({ queryKey: ['chat', eventId] });
      void res;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to get answer');
      setQuestion(msg);
    } finally {
      setAsking(false);
    }
  };

  const notes = notesQuery.data ?? [];
  const chat = chatQuery.data ?? [];

  return (
    <div className="space-y-4">
      {/* ---------- Notes ---------- */}
      <div className="card-elevated">
        <div className="flex items-center gap-2 mb-3">
          <FileTextIcon size={14} className="text-accent" />
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
            Notes & Uploads
          </h3>
        </div>

        {/* Add typed note */}
        <div className="space-y-2 mb-3">
          <input
            value={typedTitle}
            onChange={(e) => setTypedTitle(e.target.value)}
            placeholder="Title (optional)"
            className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-surface-2 border border-border-subtle focus:outline-none focus:border-accent text-text-primary"
          />
          <textarea
            value={typedContent}
            onChange={(e) => setTypedContent(e.target.value)}
            placeholder="Type or paste your notes… (e.g. call transcript, client requests)"
            rows={3}
            className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-surface-2 border border-border-subtle focus:outline-none focus:border-accent text-text-primary resize-none"
          />
          <div className="flex gap-2">
            <button onClick={handleTypedNote} disabled={busy || !typedContent.trim()} className="btn-secondary flex-1 !py-2 text-sm disabled:opacity-50">
              <PlusIcon size={15} /> Add Note
            </button>
            <label className="btn-primary flex-1 !py-2 text-sm justify-center cursor-pointer disabled:opacity-50">
              <UploadIcon size={15} /> Upload PDF / Photo / Call Audio
              <input
                type="file"
                accept="image/*,application/pdf,audio/*"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileUpload(f);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          <p className="text-[11px] text-text-tertiary">
            Photos & PDFs are read by AI; call audio is transcribed to text. Everything feeds the assistant below.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-danger/10 border border-danger/20 mb-2">
            <XIcon size={14} className="text-danger shrink-0" />
            <p className="text-xs text-danger">{error}</p>
          </div>
        )}

        {busy && <div className="py-3 flex justify-center"><Spinner size="sm" /></div>}

        {notes.length > 0 ? (
          <div className="space-y-1.5 mt-1">
            {notes.map((note) => (
              <div key={note.id} className="flex gap-2.5 p-3 rounded-xl bg-surface-2 border border-border-subtle">
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className="text-text-quaternary hover:text-danger self-start mt-0.5"
                  aria-label="Delete note"
                >
                  <TrashIcon size={14} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`badge !text-[10px] px-1.5 py-0.5 ${note.source === 'audio' ? 'badge-completed' : note.source === 'pdf' ? 'badge-upcoming' : 'badge'}`}>
                      {SOURCE_LABEL[note.source]}
                    </span>
                    {note.title && (
                      <span className="text-xs font-semibold text-text-primary truncate">{note.title}</span>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary whitespace-pre-line leading-relaxed break-words">
                    {note.content || '—'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : !notesQuery.isLoading ? (
          <p className="text-xs text-text-tertiary text-center py-3">No notes yet.</p>
        ) : null}
      </div>

      {/* ---------- AI Assistant ---------- */}
      <div className="card-elevated">
        <div className="flex items-center gap-2 mb-3">
          <MicIcon size={14} className="text-accent" />
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
            AI Assistant
          </h3>
        </div>

        <div className="max-h-72 overflow-y-auto space-y-2 mb-3 pr-1">
          {chat.length === 0 && !chatQuery.isLoading ? (
            <p className="text-xs text-text-tertiary text-center py-4">
              Ask anything about this event — it answers from the paperwork + your notes.
            </p>
          ) : (
            chat.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                    m.role === 'user'
                      ? 'bg-accent/15 border border-accent/20 text-text-primary'
                      : 'bg-surface-2 border border-border-subtle text-text-secondary'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))
          )}
          {asking && (
            <div className="flex justify-start">
              <div className="bg-surface-2 border border-border-subtle rounded-2xl px-3.5 py-2.5">
                <Spinner size="sm" />
              </div>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        <div className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
            placeholder="e.g. What time should I be on property? Who gives toasts?"
            className="flex-1 text-sm px-3.5 py-2.5 rounded-xl bg-surface-2 border border-border-subtle focus:outline-none focus:border-accent text-text-primary min-w-0"
          />
          <button
            onClick={handleAsk}
            disabled={asking || !question.trim()}
            className="btn-primary !px-4 disabled:opacity-50"
            aria-label="Send question"
          >
            <SendIcon size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
