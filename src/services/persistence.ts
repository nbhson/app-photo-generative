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
export async function compositeLayers(
  layers: import('../types').Layer[],
  width: number, height: number,
  format: 'png' | 'jpeg' | 'webp' = 'png', quality = 0.92,
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  if (format !== 'png') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height); }
  const visible = layers.filter((l) => l.visible);
  for (const l of visible) {
    if (!l.imageSrc) continue;
    const img = await loadImage(l.imageSrc);
    ctx.save();
    ctx.globalAlpha = l.opacity;
    ctx.globalCompositeOperation = l.blendMode === 'normal' ? 'source-over' : (l.blendMode as GlobalCompositeOperation);
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
