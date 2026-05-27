// 1568px is Claude's optimal long-edge cap (~1.15MP) — larger costs no extra
// tokens but improves OCR accuracy on dense paperwork.
const DEFAULT_MAX_WIDTH = 1568;
const DEFAULT_QUALITY = 0.8;

// Hard caps so a single bad/huge file can never hang the "Preparing…" step
// forever. HEIC decoding is the slowest step, so it gets the most.
const HEIC_CONVERT_TIMEOUT_MS = 45_000;
const IMAGE_LOAD_TIMEOUT_MS = 20_000;
const FILE_READ_TIMEOUT_MS = 20_000;

/** A file the user picked is HEIC/HEIF (iPhone default). */
function isHeic(file: File): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

/** Decode a base64 string into a Blob of the given MIME type. */
function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

/**
 * iPhone photos are often HEIC/HEIF, which browsers can't draw to a canvas and
 * Anthropic can't read. Browser-side libheif decoders fail to load under our
 * Vite bundle, so convert on the server. Anything else passes through untouched.
 */
async function toCanvasReadable(file: File): Promise<Blob> {
  if (!isHeic(file)) return file;
  const base64 = (await readFileAsDataURL(file)).split(',')[1];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEIC_CONVERT_TIMEOUT_MS);
  try {
    const resp = await fetch('/api/convert-heic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Image: base64 }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const body = (await resp.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || `HEIC conversion failed (${resp.status})`);
    }
    const { base64Jpeg } = (await resp.json()) as { base64Jpeg: string };
    return base64ToBlob(base64Jpeg, 'image/jpeg');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Load an image from a data URL and return an HTMLImageElement.
 */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      reject(new Error('Image load timed out'));
    }, IMAGE_LOAD_TIMEOUT_MS);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Failed to load image for compression'));
    };
    img.src = dataUrl;
  });
}

/**
 * Read a File/Blob as a data URL string.
 */
function readFileAsDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const timer = setTimeout(() => {
      reader.abort();
      reject(new Error('Reading file timed out'));
    }, FILE_READ_TIMEOUT_MS);
    reader.onload = () => {
      clearTimeout(timer);
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Compress an image file by scaling it down to a maximum width/height
 * and converting to JPEG at the specified quality.
 *
 * @param file - The original image file (e.g. from an <input type="file">)
 * @param maxWidth - Maximum pixel length on the longest side (default 1568)
 * @param quality - JPEG quality 0-1 (default 0.8)
 * @returns Base64 data URL string of the compressed image
 */
export async function compressImage(
  file: File,
  maxWidth: number = DEFAULT_MAX_WIDTH,
  quality: number = DEFAULT_QUALITY,
): Promise<string> {
  try {
    // Convert HEIC/HEIF to JPEG so it can be drawn to a canvas, then read it
    const readable = await toCanvasReadable(file);
    const dataUrl = await readFileAsDataURL(readable);
    const img = await loadImage(dataUrl);

    // Calculate scaled dimensions that fit within maxWidth on the longest side
    let { width, height } = img;
    if (width > maxWidth || height > maxWidth) {
      if (width >= height) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      } else {
        width = Math.round((width * maxWidth) / height);
        height = maxWidth;
      }
    }

    // Draw the scaled image to an off-screen canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable');
    }
    ctx.drawImage(img, 0, 0, width, height);

    // Export as JPEG data URL
    return canvas.toDataURL('image/jpeg', quality);
  } catch (err) {
    // HEIC can't be drawn by the browser or read by Anthropic, so falling back
    // to the original bytes would just fail later at the "Analyzing" step.
    // Surface a clear, actionable error instead.
    if (isHeic(file)) {
      throw new Error(
        'Could not process this iPhone photo (HEIC). Try again, or switch the camera to "Most Compatible" (JPEG) in iPhone Settings → Camera → Formats.',
      );
    }
    // For ordinary images, the original is still a valid image Anthropic can
    // read — fall back to it uncompressed rather than failing the whole upload.
    console.warn('Image compression failed, using original file:', err);
    return readFileAsDataURL(file);
  }
}
