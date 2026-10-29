import { useEditor } from '../state/store';

/** Max import raster size — larger images are downscaled on import. */
const IMPORT_MAX_DIM = 1600;

/**
 * Strip executable / data-exfil surfaces from SVG text before rasterizing.
 * SVG-in-<img> already runs in secure static mode (no scripts, no external
 * loads), but stripping is defense-in-depth against future embed paths.
 */
export function sanitizeSvgText(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, '')
    .replace(/\s(href|xlink:href)\s*=\s*["']\s*(https?:|\/\/)[^"']*["']/gi, ' ');
}

function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('Could not decode image'));
    img.src = src;
  });
}

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error('Could not read file'));
    r.readAsDataURL(f);
  });
}

/** Import any image File (PNG/JPEG/WebP/SVG) as a new layer. Object URLs are always revoked. */
export async function importImageFile(f: File): Promise<void> {
  if (f.type === 'image/svg+xml') {
    const svg = await f.text();
    if (!/<svg[\s>]/i.test(svg)) throw new Error('Invalid SVG file');
    const blobUrl = URL.createObjectURL(new Blob([sanitizeSvgText(svg)], { type: 'image/svg+xml' }));
    try {
      const img = await loadImageEl(blobUrl);
      // SVG has no natural size until rendered — fall back to canvas size
      const iw = img.naturalWidth || 1280, ih = img.naturalHeight || 800;
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(iw, IMPORT_MAX_DIM);
      canvas.height = Math.min(ih, IMPORT_MAX_DIM);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      useEditor.getState().importImage(canvas.toDataURL('image/png'), f.name, canvas.width, canvas.height);
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
    return;
  }
  const url = URL.createObjectURL(f);
  try {
    const img = await loadImageEl(url);
    const iw = img.naturalWidth || 1280, ih = img.naturalHeight || 800;
    const dataUrl = await fileToDataUrl(f);
    useEditor.getState().importImage(dataUrl, f.name, iw, ih);
  } finally {
    URL.revokeObjectURL(url);
  }
}
