const DEFAULT_MAX_WIDTH = 1024;
const DEFAULT_QUALITY = 0.8;

/**
 * Load an image from a data URL and return an HTMLImageElement.
 */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for compression'));
    img.src = dataUrl;
  });
}

/**
 * Read a File as a data URL string.
 */
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Compress an image file by scaling it down to a maximum width/height
 * and converting to JPEG at the specified quality.
 *
 * @param file - The original image file (e.g. from an <input type="file">)
 * @param maxWidth - Maximum pixel length on the longest side (default 1024)
 * @param quality - JPEG quality 0-1 (default 0.8)
 * @returns Base64 data URL string of the compressed image
 */
export async function compressImage(
  file: File,
  maxWidth: number = DEFAULT_MAX_WIDTH,
  quality: number = DEFAULT_QUALITY,
): Promise<string> {
  try {
    // Read the file into a data URL so we can load it into an Image element
    const dataUrl = await readFileAsDataURL(file);
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
    // Fallback: return the original file as a data URL uncompressed
    console.warn('Image compression failed, using original file:', err);
    return readFileAsDataURL(file);
  }
}
