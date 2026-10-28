import { openDB } from 'idb';
import type { ProjectFile } from '../types';

const DB = 'generative-studio';
const STORE = 'projects';

async function db() {
  return openDB(DB, 1, { upgrade(d) { d.createObjectStore(STORE); } });
}

export async function saveProjectLocal(key: string, project: ProjectFile) {
  const d = await db();
  await d.put(STORE, project, key);
}

export async function loadProjectLocal(key: string): Promise<ProjectFile | undefined> {
  const d = await db();
  return d.get(STORE, key);
}

/** Composite layers to a single canvas at document resolution for export. */
const EXPORT_MAX_DIM = 8192; // browser canvas limit an toàn (Safari ~16k, nhưng 8k đủ dùng)
const VALID_BLEND_MODES = new Set<GlobalCompositeOperation>([
  'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge',
  'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion',
]);

export async function compositeLayers(
  layers: import('../types').Layer[],
  width: number, height: number,
  format: 'png' | 'jpeg' | 'webp' = 'png', quality = 0.92,
): Promise<string> {
  // Clamp kích thước export — state hỏng (corrupt IndexedDB) với width khổng lồ
  // trước đây cấp phát canvas hàng GB rồi toDataURL fail ngầm.
  const w = Math.max(1, Math.min(Math.round(width) || 1, EXPORT_MAX_DIM));
  const h = Math.max(1, Math.min(Math.round(height) || 1, EXPORT_MAX_DIM));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  if (format !== 'png') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
  const visible = layers.filter((l) => l.visible);
  for (const l of visible) {
    if (!l.imageSrc) continue;
    const img = await loadImage(l.imageSrc);
    ctx.save();
    ctx.globalAlpha = l.opacity;
    // Whitelist GlobalCompositeOperation — blendMode load từ IndexedDB có thể
    // là giá trị lạ (schema drift), canvas nhận giá trị không hợp lệ ngầm
    // đặt lại 'source-over' hay không tùy trình duyệt.
    ctx.globalCompositeOperation = l.blendMode === 'normal' || !VALID_BLEND_MODES.has(l.blendMode as GlobalCompositeOperation)
      ? 'source-over'
      : (l.blendMode as GlobalCompositeOperation);
    applyAdjustFilter(ctx, l.adjustments);
    ctx.drawImage(img, l.x, l.y, l.width, l.height);
    ctx.restore();
  }
  return canvas.toDataURL(`image/${format}`, quality);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

function applyAdjustFilter(ctx: CanvasRenderingContext2D, a?: import('../types').AdjustmentState) {
  if (!a) return;
  const f: string[] = [];
  if (a.brightness) f.push(`brightness(${100 + a.brightness}%)`);
  if (a.contrast) f.push(`contrast(${100 + a.contrast}%)`);
  if (a.saturation) f.push(`saturate(${100 + a.saturation}%)`);
  if (a.blur) f.push(`blur(${a.blur}px)`);
  ctx.filter = f.join(' ') || 'none';
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
}
