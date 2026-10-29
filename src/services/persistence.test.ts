import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildProjectFile, compositeLayers, sanitizeProject, downloadDataUrl } from './persistence';
import { DEFAULT_ADJUSTMENTS, type Layer, type ProjectFile } from '../types';

function makeLayer(over: Partial<Layer> = {}): Layer {
  return {
    id: 'l1', name: 'L', type: 'image', imageSrc: 'data:,', x: 0, y: 0,
    width: 10, height: 10, opacity: 1, blendMode: 'normal',
    visible: true, locked: false, isAI: false, adjustments: { ...DEFAULT_ADJUSTMENTS },
    ...over,
  };
}

function validProject(): ProjectFile {
  return {
    version: '1.0',
    document: { id: 'doc1', name: 'Test', width: 640, height: 480 },
    layers: [makeLayer()],
    operations: [],
    history: [],
  };
}

describe('sanitizeProject', () => {
  it('accepts a valid project', () => {
    const out = sanitizeProject(validProject());
    expect(out).not.toBeNull();
    expect(out!.document.name).toBe('Test');
    expect(out!.layers).toHaveLength(1);
  });

  it('rejects null / non-object / missing document', () => {
    expect(sanitizeProject(null)).toBeNull();
    expect(sanitizeProject('str')).toBeNull();
    expect(sanitizeProject(42)).toBeNull();
    expect(sanitizeProject({})).toBeNull(); // thiếu document
    expect(sanitizeProject({ document: { id: 'x' } })).toBeNull(); // layers không phải mảng
  });

  it('drops layers without a string id / imageSrc (corrupt IndexedDB)', () => {
    const p = sanitizeProject({
      version: '1.0', document: { id: 'd', name: 'n', width: 10, height: 10 },
      layers: [{ id: 'ok', imageSrc: 'data:,' }, { id: 42 }, { nope: true }, null, { id: 'ok2', imageSrc: 'data:,2' }],
      operations: 'not-array', history: null,
    });
    expect(p!.layers.map((l) => l.id)).toEqual(['ok', 'ok2']);
    expect(p!.operations).toEqual([]);
    expect(p!.history).toEqual([]);
  });

  it('fills missing document fields with defaults', () => {
    const p = sanitizeProject({ document: { id: 'd' }, layers: [] });
    expect(p!.document.name).toBe('Untitled Project');
    expect(p!.document.width).toBe(1280);
    expect(p!.document.height).toBe(800);
    expect(p!.version).toBe('1.0');
  });
});

describe('buildProjectFile', () => {
  it('serializes editor state into a ProjectFile', () => {
    const f = buildProjectFile({
      docId: 'doc-1', projectName: 'P', canvasWidth: 640, canvasHeight: 480,
      layers: [makeLayer()], operations: [], history: [],
    });
    expect(f.version).toBe('1.0');
    expect(f.document).toEqual({ id: 'doc-1', name: 'P', width: 640, height: 480 });
    expect(f.layers).toHaveLength(1);
    expect(f.operations).toEqual([]);
  });
});

/** document/canvas/Image stub — compositeLayers/downloadDataUrl cần DOM, node env không có. */
function stubCanvasEnv() {
  const drawImage = vi.fn();
  const fillRect = vi.fn();
  const ctx = {
    fillStyle: '', filter: '', globalAlpha: 1, globalCompositeOperation: 'source-over',
    save: vi.fn(), restore: vi.fn(), drawImage, fillRect,
  };
  const canvases: { width: number; height: number }[] = [];
  const makeCanvas = () => {
    const c = {
      width: 0, height: 0,
      getContext: () => ctx,
      toDataURL: () => `data:image/png,size=${c.width}x${c.height}`,
    };
    canvases.push(c);
    return c;
  };
  const anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
  vi.stubGlobal('document', {
    createElement: (tag: string) => (tag === 'canvas' ? makeCanvas() : { ...anchor }),
    body: { appendChild: vi.fn(), removeChild: vi.fn() },
  });
  // Image stub: fire onload ngay (loadImage chỉ cần onload)
  vi.stubGlobal('Image', class {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_s: string) { queueMicrotask(() => this.onload?.()); }
  });
  return { ctx, drawImage, fillRect, canvases, anchor };
}

describe('compositeLayers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('clamps absurd dimensions to 8192 (corrupt state → không cấp phát canvas hàng GB)', async () => {
    const { canvases } = stubCanvasEnv();
    await compositeLayers([makeLayer()], 1e9, 1e9);
    expect(canvases[0].width).toBe(8192);
    expect(canvases[0].height).toBe(8192);
  });

  it('clamps non-positive / NaN dimensions to 1', async () => {
    const { canvases } = stubCanvasEnv();
    await compositeLayers([makeLayer()], 0, Number.NaN);
    expect(canvases[0].width).toBe(1);
    expect(canvases[0].height).toBe(1);
  });

  it('only composites visible layers', async () => {
    const { drawImage } = stubCanvasEnv();
    await compositeLayers([{ ...makeLayer(), id: 'h', visible: false }, makeLayer()], 100, 100);
    expect(drawImage).toHaveBeenCalledTimes(1);
  });

  it('fills a white background for formats without alpha', async () => {
    const { fillRect } = stubCanvasEnv();
    await compositeLayers([makeLayer()], 100, 100, 'jpeg', 0.8);
    expect(fillRect).toHaveBeenCalledTimes(1);
  });

  it('no background fill for png (alpha preserved)', async () => {
    const { fillRect } = stubCanvasEnv();
    await compositeLayers([makeLayer()], 100, 100, 'png');
    expect(fillRect).not.toHaveBeenCalled();
  });

  it('maps unknown blend modes to source-over (whitelist)', async () => {
    const { ctx } = stubCanvasEnv();
    await compositeLayers([{ ...makeLayer(), blendMode: 'weird-mode' as never }], 100, 100);
    expect(ctx.globalCompositeOperation).toBe('source-over');
  });

  it('passes whitelisted blend modes through', async () => {
    const { ctx } = stubCanvasEnv();
    await compositeLayers([{ ...makeLayer(), blendMode: 'multiply' }], 100, 100);
    expect(ctx.globalCompositeOperation).toBe('multiply');
  });

  it('rejects when an image fails to load (onerror → promise rejection)', async () => {
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({}) }) });
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_s: string) { queueMicrotask(() => this.onerror?.()); }
    });
    let failed = false;
    try { await compositeLayers([makeLayer()], 100, 100); } catch { failed = true; }
    expect(failed).toBe(true); // onerror → rej() (reject với undefined)
  });
});

describe('downloadDataUrl', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('creates a temporary anchor, clicks and removes it', () => {
    const { anchor } = stubCanvasEnv();
    const appended: HTMLAnchorElement[] = [];
    (globalThis.document.body.appendChild as ReturnType<typeof vi.fn>).mockImplementation((el: HTMLAnchorElement) => { appended.push(el); });
    downloadDataUrl('data:image/png,x', 'out.png');
    expect(appended[0].href).toBe('data:image/png,x');
    expect(appended[0].download).toBe('out.png');
    expect(anchor.click).toHaveBeenCalled();
    expect(anchor.remove).toHaveBeenCalled();
  });
});
