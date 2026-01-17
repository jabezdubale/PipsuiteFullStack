// Image utilities: compression + guardrails for DB/network reliability.

export const MAX_SCREENSHOTS_PER_TRADE = 8;
// Approximate cap per image after compression.
export const MAX_SCREENSHOT_BYTES = 750_000; // ~750KB

const isDataImageUrl = (s: string) => typeof s === 'string' && s.startsWith('data:image');

const estimateBase64Bytes = (dataUrl: string): number => {
  const base64 = (dataUrl.split(',')[1] || '').replace(/\s/g, '');
  if (!base64) return 0;
  let padding = 0;
  if (base64.endsWith('==')) padding = 2;
  else if (base64.endsWith('=')) padding = 1;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
};

/**
 * Adds a screenshot to the existing list with guardrails.
 * - Caps screenshot count
 * - Caps base64 payload size (URLs are allowed but still count towards the cap)
 */
export const addScreenshot = (existing: string[] = [], screenshot: string): string[] => {
  const list = existing || [];
  if (list.length >= MAX_SCREENSHOTS_PER_TRADE) {
    throw new Error(`You can add up to ${MAX_SCREENSHOTS_PER_TRADE} screenshots per trade.`);
  }

  if (isDataImageUrl(screenshot)) {
    const bytes = estimateBase64Bytes(screenshot);
    if (bytes > MAX_SCREENSHOT_BYTES) {
      throw new Error('Screenshot is still too large after compression. Try a smaller crop.');
    }
  }

  return [...list, screenshot];
};

type CompressOptions = {
  maxWidth?: number;
  maxHeight?: number;
  maxBytes?: number;
};

/**
 * Compresses an image Blob into a JPEG data URL, trying to stay under maxBytes.
 * The function progressively reduces quality, then scales down if needed.
 */
export const compressImage = (file: Blob, opts: CompressOptions = {}): Promise<string> => {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    maxBytes = MAX_SCREENSHOT_BYTES,
  } = opts;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        // First pass: resize to max bounds while keeping aspect ratio.
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round(height * (maxWidth / width));
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round(width * (maxHeight / height));
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback to original if canvas isn't available.
          resolve(event.target?.result as string);
          return;
        }

        let scale = 1;
        let quality = 0.82;
        let lastDataUrl = '';

        for (let attempt = 0; attempt < 8; attempt++) {
          const w = Math.max(1, Math.round(width * scale));
          const h = Math.max(1, Math.round(height * scale));
          canvas.width = w;
          canvas.height = h;
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);

          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          lastDataUrl = dataUrl;

          const bytes = estimateBase64Bytes(dataUrl);
          if (bytes <= maxBytes) {
            resolve(dataUrl);
            return;
          }

          // Adjust for next attempt
          if (quality > 0.55) {
            quality = Math.max(0.55, quality - 0.08);
          } else {
            scale = Math.max(0.5, scale * 0.85);
          }
        }

        // If we couldn't reach the target size, still return the best we have.
        resolve(lastDataUrl || (event.target?.result as string));
      };

      img.onerror = (err) => reject(err);
    };

    reader.onerror = (err) => reject(err);
  });
};
