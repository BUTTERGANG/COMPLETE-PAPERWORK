import { useState, useRef } from 'react';
import { parsePaperwork } from '../lib/claude';
import { compressImage } from '../lib/imageCompress';
import type { ParsedEvent } from '../types/event';
import { CameraIcon, UploadIcon, ImageIcon, XIcon } from './icons/Icons';
import { Spinner } from './Spinner';

interface PaperworkScannerProps {
  onParsed: (data: ParsedEvent, base64Data: string, previewUrl: string) => void;
}

export function EmptyScannerState({ onCapture, onUpload }: { onCapture: () => void; onUpload: () => void }) {
  return (
    <div className="card-elevated border-dashed border-2 border-border text-center py-14 animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-5">
        <ImageIcon size={28} className="text-accent" />
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-2">Scan Your Paperwork</h3>
      <p className="text-sm text-text-tertiary mb-8 max-w-48 mx-auto">
        Capture or upload a DJ worksheet and let AI extract the details
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
  const [preview, setPreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setImageFile(file);
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleParse = async () => {
    if (!imageFile || !preview) return;
    setCompressing(true);
    setParsing(true);
    setError('');
    try {
      // Compress the image to reduce bandwidth / token usage
      const compressedDataUrl = await compressImage(imageFile);
      const base64 = compressedDataUrl.split(',')[1];
      const parsed = await parsePaperwork(base64);
      // Pass the base64 data for storage in the database
      onParsed(parsed, base64, preview);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to parse image');
    } finally {
      setCompressing(false);
      setParsing(false);
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
        className="hidden"
        onChange={handleInputChange}
      />

      {!preview ? (
        <EmptyScannerState
          onCapture={() => cameraRef.current?.click()}
          onUpload={() => fileRef.current?.click()}
        />
      ) : (
        <div className="space-y-4 animate-fade-in">
          <div className="card-elevated p-2 overflow-hidden">
            <img
              src={preview}
              alt="Paperwork preview"
              className="w-full h-auto max-h-72 object-contain rounded-xl"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-danger/10 border border-danger/20">
              <XIcon size={16} className="text-danger shrink-0" />
              <p className="text-sm text-danger">{error}</p>
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
                  {compressing ? 'Compressing...' : 'Analyzing...'}
                </>
              ) : (
                'Extract with AI'
              )}
            </button>
            <button
              onClick={() => {
                setPreview(null);
                setImageFile(null);
              }}
              className="btn-secondary !px-4"
            >
              <XIcon size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
