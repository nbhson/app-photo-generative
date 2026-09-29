import type { AIOperationType } from '../types';

export interface GenerateRequest {
  prompt: string;
  type: AIOperationType;
  width: number;
  height: number;
  sourceImageSrc?: string;
  maskRect?: { x: number; y: number; width: number; height: number } | null;
  variations?: number;
  signal?: AbortSignal;
  onProgress?: (p: number) => void;
  seed?: number;
}

export interface GenerateResponse {
  images: { src: string; seed: number }[];
}

export interface AIProvider {
  id: string;
  displayName: string;
  generate(req: GenerateRequest): Promise<GenerateResponse>;
}

/** Deterministic hash of a string -> uint32 */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTES = [
  ['#1e293b', '#0ea5e9', '#38bdf8', '#e0f2fe'],
  ['#3b0764', '#a855f7', '#f0abfc', '#fdf4ff'],
  ['#052e16', '#16a34a', '#86efac', '#f0fdf4'],
  ['#431407', '#ea580c', '#fdba74', '#fff7ed'],
  ['#0c0a09', '#57534e', '#d6d3d1', '#fafaf9'],
  ['#082f49', '#0891b2', '#67e8f9', '#ecfeff'],
];

/** Procedural "generated" image: gradient + blobs + grain, seeded by prompt+seed. */
export function proceduralImage(prompt: string, seed: number, w: number, h: number, sourceSrc?: string): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(2, Math.round(w));
    canvas.height = Math.max(2, Math.round(h));
    const ctx = canvas.getContext('2d')!;
    const rnd = mulberry32((hashStr(prompt) ^ Math.imul(seed + 1, 2654435761)) >>> 0);
    const pal = PALETTES[Math.floor(rnd() * PALETTES.length)];
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, pal[0]); g.addColorStop(0.55, pal[1]); g.addColorStop(1, pal[3]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    const drawScene = () => {
      // soft blobs
      for (let i = 0; i < 14; i++) {
        const bx = rnd() * w, by = rnd() * h, br = (0.08 + rnd() * 0.28) * Math.max(w, h);
        const rg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        const c = pal[Math.floor(rnd() * pal.length)];
        rg.addColorStop(0, c + 'cc'); rg.addColorStop(1, c + '00');
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
      }
      // light streaks
      ctx.globalAlpha = 0.25;
      for (let i = 0; i < 5; i++) {
        ctx.strokeStyle = pal[3]; ctx.lineWidth = 1 + rnd() * 3;
        ctx.beginPath();
        ctx.moveTo(rnd() * w, rnd() * h);
        ctx.bezierCurveTo(rnd() * w, rnd() * h, rnd() * w, rnd() * h, rnd() * w, rnd() * h);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // grain
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const n = (rnd() - 0.5) * 22;
        d[i] += n; d[i + 1] += n; d[i + 2] += n;
      }
      ctx.putImageData(img, 0, 0);
      // vignette
      const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
      resolve(canvas.toDataURL('image/png'));
    };

    if (sourceSrc) {
      const img = new Image();
      img.onload = () => {
        // draw source blended, then stylize per seed so each variation differs
        ctx.globalAlpha = 0.85;
        ctx.drawImage(img, 0, 0, w, h);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'overlay';
        const tint = ctx.createLinearGradient(0, 0, w, h);
        tint.addColorStop(0, pal[1] + '55'); tint.addColorStop(1, pal[0] + '55');
        ctx.fillStyle = tint; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
        drawSceneOverSource();
      };
      img.onerror = () => drawScene();
      const drawSceneOverSource = () => {
        for (let i = 0; i < 6; i++) {
          const bx = rnd() * w, by = rnd() * h, br = (0.05 + rnd() * 0.15) * Math.max(w, h);
          const rg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
          rg.addColorStop(0, pal[2] + '44'); rg.addColorStop(1, pal[2] + '00');
          ctx.fillStyle = rg;
          ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
        }
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = sourceSrc;
    } else {
      drawScene();
    }
  });
}

export function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

export class MockAIProvider implements AIProvider {
  id = 'mock';
  displayName = 'Mock (Demo)';
  async generate(req: GenerateRequest): Promise<GenerateResponse> {
    const n = req.variations ?? 4;
    const steps = [12, 32, 55, 78, 94];
    for (const p of steps) {
      if (req.signal?.aborted) throw new Error('aborted');
      req.onProgress?.(p);
      await sleep(260 + Math.random() * 260);
    }
    let sourceCropped: string | undefined;
    if (req.sourceImageSrc) sourceCropped = req.sourceImageSrc;
    const images: { src: string; seed: number }[] = [];
    for (let i = 0; i < n; i++) {
      const seed = (req.seed ?? Math.floor(Math.random() * 1e9)) + i * 7919;
      const src = await proceduralImage(req.prompt, seed, Math.min(req.width, 768), Math.min(req.height, 768), sourceCropped);
      images.push({ src, seed });
      req.onProgress?.(95 + Math.round((i + 1) / n * 5));
    }
    req.onProgress?.(100);
    return { images };
  }
}

/** OpenAI-compatible image provider (BYO baseUrl/key/model). Calls backend-or-direct /v1/images/generations. */
export class OpenAICompatibleProvider implements AIProvider {
  id: string; displayName: string;
  private cfg: { baseUrl: string; apiKey: string; model: string; name?: string };
  constructor(cfg: { baseUrl: string; apiKey: string; model: string; name?: string }) {
    this.cfg = cfg;
    this.id = 'custom-' + (cfg.name ?? cfg.model);
    this.displayName = cfg.name ?? 'Custom Provider';
  }
  async generate(req: GenerateRequest): Promise<GenerateResponse> {
    const base = this.cfg.baseUrl.replace(/\/$/, '');
    const res = await fetch(`${base}/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.cfg.apiKey}` },
      body: JSON.stringify({ model: this.cfg.model, prompt: req.prompt, n: req.variations ?? 2, size: '1024x1024', response_format: 'b64_json' }),
      signal: req.signal,
    });
    if (!res.ok) throw new Error(`Provider error ${res.status}: ${await res.text().catch(() => '')}`);
    const json = await res.json();
    const images = (json.data ?? []).map((d: { b64_json?: string; url?: string }, i: number) => ({
      src: d.b64_json ? `data:image/png;base64,${d.b64_json}` : d.url,
      seed: Date.now() + i,
    }));
    if (!images.length) throw new Error('Provider returned no images');
    return { images };
  }
}

export const mockProvider = new MockAIProvider();
