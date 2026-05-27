import { useState, useRef } from 'react';
import { parsePaperwork } from '../lib/claude';
import { compressImage } from '../lib/imageCompress';
import type { ParsedEvent } from '../types/event';
import { CameraIcon, UploadIcon, ImageIcon, XIcon, PlusIcon } from './icons/Icons';
import { Spinner } from './Spinner';

interface PaperworkScannerProps {
  onParsed: (data: ParsedEvent, base64Images: string[], previews: string[]) => void;
}

interface PendingImage {
  id: string;
  file: File;
  preview: string;
}

export function EmptyScannerState({ onCapture, onUpload }: { onCapture: () => void; onUpload: () => void }) {
  return (
    <div className="card-elevated border-dashed border-2 border-border text-center py-14 animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-5">
        <ImageIcon size={28} className="text-accent" />
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-2">Scan Your Paperwork</h3>
      <p className="text-sm text-text-tertiary mb-8 max-w-56 mx-auto">
        Capture or upload one or more worksheet pages and let AI extract the details
      </p>
      <div className="flex gap-3 justify-center">
        <button onClick={onCapture} className="btn-primary">
          <CameraIcon size={18} />
          Camera
        </button>
        <button onClick={onUpload} className="btn-secondary">
          <UploadIcon size={18} />
          Upload
        </button>
      </div>
    </div>
  );
}

export default function PaperworkScanner({ onParsed }: PaperworkScannerProps) {
  const [images, setImages] = useState<PendingImage[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList) => {
    setError('');
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), file, preview: e.target?.result as string },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = '';
  };

  const removeImage = (id: string) => setImages((prev) => prev.filter((img) => img.id !== id));

  const handleParse = async () => {
    if (images.length === 0) return;
    setCompressing(true);
    setParsing(true);
    setProcessed(0);
    setError('');
    try {
      let done = 0;
      const compressed = await Promise.all(
        images.map(async (img) => {
          const result = await compressImage(img.file);
          done += 1;
          setProcessed(done);
          return result;
        }),
      );
      const base64Images = compressed.map((dataUrl) => dataUrl.split(',')[1]);
      setCompressing(false);
      const parsed = await parsePaperwork(base64Images);
      onParsed(parsed, base64Images, images.map((img) => img.preview));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to parse images');
    } finally {
      setCompressing(false);
      setParsing(false);
      setProcessed(0);
    }
  };

  return (
    <div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleInputChange}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />

      {images.length === 0 ? (
        <EmptyScannerState
          onCapture={() => cameraRef.current?.click()}
          onUpload={() => fileRef.current?.click()}
        />
      ) : (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text-secondary">
              {images.length} {images.length === 1 ? 'page' : 'pages'}
            </span>
            <span className="text-xs text-text-tertiary">Tap a page to remove</span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {images.map((img) => (
              <button
                key={img.id}
                type="button"
                onClick={() => removeImage(img.id)}
                className="group relative aspect-square rounded-xl overflow-hidden border border-border bg-surface-2"
                aria-label="Remove page"
              >
                <img src={img.preview} alt="Paperwork page" className="w-full h-full object-cover" />
                <span className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-full bg-danger flex items-center justify-center">
                    <XIcon size={15} className="text-white" />
                  </span>
                </span>
              </button>
            ))}

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-text-tertiary hover:text-accent hover:border-accent transition-colors"
              aria-label="Add more pages"
            >
              <PlusIcon size={22} />
              <span className="text-xs font-medium">Add</span>
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-danger/10 border border-danger/20">
              <XIcon size={16} className="text-danger shrink-0" />
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          {parsing && (
            <div className="space-y-2" role="status" aria-live="polite">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-text-secondary">
                  {compressing
                    ? `Preparing pages… ${processed}/${images.length}`
                    : 'Analyzing with AI…'}
                </span>
                {compressing && (
                  <span className="text-text-tertiary tabular-nums">
                    {Math.round((processed / images.length) * 100)}%
                  </span>
                )}
              </div>
              <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                <div
                  className={`h-full rounded-full bg-accent transition-all duration-300 ${compressing ? '' : 'animate-pulse-soft'}`}
                  style={{ width: compressing ? `${(processed / images.length) * 100}%` : '100%' }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleParse}
              disabled={parsing}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {parsing ? (
                <>
                  <Spinner size="sm" />
                  {compressing ? 'Preparing…' : 'Analyzing…'}
                </>
              ) : (
                `Extract with AI`
              )}
            </button>
            <button
              onClick={() => {
                setImages([]);
                setError('');
              }}
              disabled={parsing}
              className="btn-secondary !px-4 disabled:opacity-50"
              aria-label="Clear all pages"
            >
              <XIcon size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
