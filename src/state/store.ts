import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type {
  AIOperation, AIOperationType, AdjustmentState, CustomProviderConfig,
  DetectedObject, GenerationResult, HistoryEntry, Layer, SelectionRect,
} from '../types';
import { DEFAULT_ADJUSTMENTS } from '../types';
import { mockProvider, OpenAICompatibleProvider, type AIProvider } from '../ai/providers';

export type RightTab = 'layers' | 'ai' | 'adjust' | 'history';
export type AIToolMode = AIOperationType | null;

interface EditorState {
  projectName: string;
  docId: string;
  canvasWidth: number; canvasHeight: number;
  layers: Layer[];
  activeLayerId?: string;
  selection: SelectionRect | null;
  tool: string;
  aiMode: AIToolMode;
  zoom: number; panX: number; panY: number;
  fitTick: number;
  dirty: boolean; saveStatus: 'saved' | 'saving' | 'unsaved';
  rightTab: RightTab;
  showCommandBar: boolean;
  showSettings: boolean;
  showWelcome: boolean;
  showShortcuts: boolean;
  promptText: string;
  jobs: Record<string, { progress: number; status: string; label: string; error?: string }>;
  activeOperationId?: string;
  operations: AIOperation[];
  results: GenerationResult[];
  selectedResultId?: string;
  compareMode: boolean;
  history: HistoryEntry[];
  historyIndex: number;
  detected: DetectedObject[];
  analyzing: boolean;
  variations: number;
  quality: 'fast' | 'balanced' | 'high';
  preserveStructure: boolean; preserveLighting: boolean;
  activeProviderId: string;
  customProviders: CustomProviderConfig[];
  modelsNote: string;

  set: (p: Partial<EditorState>) => void;
  newProject: (w?: number, h?: number) => void;
  importImage: (src: string, name: string, iw: number, ih: number) => void;
  addLayer: (l: Partial<Layer>) => string;
  updateLayer: (id: string, p: Partial<Layer>) => void;
  deleteLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  reorderLayers: (from: number, to: number) => void;
  setSelection: (s: SelectionRect | null) => void;
  pushHistory: (label: string, operationId?: string) => void;
  undo: () => void; redo: () => void;
  canUndo: () => boolean; canRedo: () => boolean;
  applyAdjustment: (id: string, adj: Partial<AdjustmentState>) => void;
  provider: () => AIProvider;
}

function snap(layers: Layer[]): Layer[] { return JSON.parse(JSON.stringify(layers)); }

const gid = () => uuid();

export const useEditor = create<EditorState>((set, get) => ({
  projectName: 'Untitled Project',
  docId: gid(),
  canvasWidth: 1280, canvasHeight: 800,
  layers: [],
  selection: null,
  tool: 'move',
  aiMode: null,
  zoom: 0.6, panX: 0, panY: 0, fitTick: 0,
  dirty: false, saveStatus: 'saved',
  rightTab: 'layers',
  showCommandBar: false, showSettings: false, showWelcome: false, showShortcuts: false,
  promptText: '',
  jobs: {},
  operations: [], results: [], compareMode: false,
  history: [], historyIndex: -1,
  detected: [], analyzing: false,
  variations: 4, quality: 'balanced',
  preserveStructure: true, preserveLighting: true,
  activeProviderId: 'mock',
  customProviders: [],
  modelsNote: '',

  set: (p) => set(p),

  newProject: (w = 1280, h = 800) => {
    const id = gid();
    set({
      docId: id, projectName: 'Untitled Project', canvasWidth: w, canvasHeight: h,
      layers: [], selection: null, operations: [], results: [], history: [], historyIndex: -1,
      activeLayerId: undefined, detected: [], dirty: false, saveStatus: 'saved',
    });
  },

  importImage: (src, name, iw, ih) => {
    const s = get();
    const scale = Math.min(1, 1600 / Math.max(iw, ih));
    const w = Math.round(iw * scale), h = Math.round(ih * scale);
    const layer: Layer = {
      id: gid(), name, type: 'image', imageSrc: src,
      x: Math.round((s.canvasWidth - w) / 2), y: Math.round((s.canvasHeight - h) / 2),
      width: w, height: h, opacity: 1, blendMode: 'normal',
      visible: true, locked: false, isAI: false, adjustments: { ...DEFAULT_ADJUSTMENTS },
    };
    const layers = [...s.layers, layer];
    set({ layers, activeLayerId: layer.id, dirty: true, saveStatus: 'unsaved' });
    get().pushHistory(`Import ${name}`);
  },

  addLayer: (l) => {
    const s = get();
    const id = gid();
    const layer: Layer = {
      id, name: l.name ?? 'Layer', type: l.type ?? 'ai',
      x: l.x ?? 0, y: l.y ?? 0,
      width: l.width ?? s.canvasWidth, height: l.height ?? s.canvasHeight,
      opacity: l.opacity ?? 1, blendMode: l.blendMode ?? 'normal',
      visible: true, locked: false, isAI: l.isAI ?? true,
      imageSrc: l.imageSrc, aiOperationId: l.aiOperationId, adjustments: { ...DEFAULT_ADJUSTMENTS },
    };
    set({ layers: [...s.layers, layer], activeLayerId: id, dirty: true, saveStatus: 'unsaved' });
    return id;
  },

  updateLayer: (id, p) => set((s) => ({
    layers: s.layers.map((l) => (l.id === id ? { ...l, ...p } : l)),
    dirty: true, saveStatus: 'unsaved',
  })),

  deleteLayer: (id) => {
    const s = get();
    const layers = s.layers.filter((l) => l.id !== id);
    set({ layers, activeLayerId: layers[0]?.id, dirty: true, saveStatus: 'unsaved' });
    get().pushHistory('Delete layer');
  },

  duplicateLayer: (id) => {
    const s = get();
    const src = s.layers.find((l) => l.id === id);
    if (!src) return;
    const copy: Layer = { ...JSON.parse(JSON.stringify(src)), id: gid(), name: src.name + ' copy', x: src.x + 24, y: src.y + 24 };
    set({ layers: [...s.layers, copy], activeLayerId: copy.id });
    get().pushHistory('Duplicate layer');
  },

  reorderLayers: (from, to) => {
    const s = get();
    const arr = [...s.layers];
    const [m] = arr.splice(from, 1);
    arr.splice(to, 0, m);
    set({ layers: arr, dirty: true, saveStatus: 'unsaved' });
  },

  setSelection: (selection) => set({ selection }),

  pushHistory: (label, operationId) => {
    const s = get();
    const entry: HistoryEntry = {
      id: gid(), label, createdAt: Date.now(),
      layersSnapshot: snap(s.layers),
      canvasSnapshot: { width: s.canvasWidth, height: s.canvasHeight },
      operationId,
    };
    const hist = s.history.slice(0, s.historyIndex + 1);
    hist.push(entry);
    set({ history: hist.slice(-60), historyIndex: Math.min(hist.length - 1, 59) });
  },

  undo: () => {
    const s = get();
    if (s.historyIndex <= 0) return;
    const idx = s.historyIndex - 1;
    const e = s.history[idx];
    set({ layers: snap(e.layersSnapshot), canvasWidth: e.canvasSnapshot.width, canvasHeight: e.canvasSnapshot.height, historyIndex: idx, saveStatus: 'unsaved', dirty: true });
  },
  redo: () => {
    const s = get();
    if (s.historyIndex >= s.history.length - 1) return;
    const idx = s.historyIndex + 1;
    const e = s.history[idx];
    set({ layers: snap(e.layersSnapshot), canvasWidth: e.canvasSnapshot.width, canvasHeight: e.canvasSnapshot.height, historyIndex: idx, saveStatus: 'unsaved', dirty: true });
  },
  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  applyAdjustment: (id, adj) => set((s) => ({
    layers: s.layers.map((l) => (l.id === id ? { ...l, adjustments: { ...l.adjustments!, ...adj } } : l)),
    saveStatus: 'unsaved', dirty: true,
  })),

  provider: () => {
    const s = get();
    if (s.activeProviderId === 'mock') return mockProvider;
    const cfg = s.customProviders.find((c) => `custom-${c.name}` === s.activeProviderId || c.id === s.activeProviderId);
    if (cfg) return new OpenAICompatibleProvider({ baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, model: cfg.model, name: cfg.name });
    return mockProvider;
  },
}));

/** Build the AI context object (spec §15) — only relevant fields. */
export function buildAIContext(): Record<string, unknown> {
  const s = useEditor.getState();
  return {
    documentId: s.docId,
    activeLayerId: s.activeLayerId,
    selectedLayerIds: s.activeLayerId ? [s.activeLayerId] : [],
    selectionMask: s.selection,
    canvasSize: { width: s.canvasWidth, height: s.canvasHeight },
    viewport: { zoom: s.zoom, x: s.panX, y: s.panY },
    previousOperations: s.operations.slice(-10).map((o) => ({ id: o.id, type: o.type, prompt: o.prompt, status: o.status })),
  };
}

/** Prompt enhancement (spec §22). */
export function enhancePrompt(prompt: string, style: string): string {
  const base = prompt.trim() || 'this image';
  const styles: Record<string, string> = {
    realistic: `Photorealistic, natural lighting, high detail, 85mm photography of ${base}, realistic textures, accurate shadows and reflections`,
    cinematic: `Cinematic film still of ${base}, dramatic lighting, teal-and-orange grade, shallow depth of field, anamorphic, 35mm grain`,
    product: `Professional product photography of ${base}, studio softbox lighting, seamless background, ultra sharp, commercial retouch`,
    editorial: `Editorial magazine photography of ${base}, art-directed composition, refined color grade, premium fashion aesthetic`,
    artistic: `Painterly artistic reinterpretation of ${base}, expressive brushwork, rich color harmony, gallery composition`,
    detailed: `Create ${base} with refined materials, coherent geometry, consistent perspective, soft global illumination, physically plausible shadows, ultra-detailed`,
  };
  return styles[style] ?? styles.detailed;
}

/** Parse natural-language command into an operation type (spec §37). */
export function parseIntent(text: string): { type: AIOperationType; prompt: string } {
  const t = text.toLowerCase();
  if (/remove|erase|delete|take out|get rid/.test(t)) return { type: 'REMOVE_OBJECT', prompt: text };
  if (/background|backdrop|scene behind/.test(t)) return { type: 'BACKGROUND_GENERATION', prompt: text };
  if (/replace|swap|change .* (to|into|with)/.test(t)) return { type: 'REPLACE_OBJECT', prompt: text };
  if (/expand|extend|outpaint|wider|bigger canvas/.test(t)) return { type: 'GENERATIVE_EXPAND', prompt: text };
  if (/upscale|sharper|enhance|higher res|4k|8k/.test(t)) return { type: 'UPSCALE', prompt: text };
  if (/retouch|skin|blemish|wrinkle|beautif|face/.test(t)) return { type: 'RETOUCH', prompt: text };
  if (/variation|another version|different/.test(t)) return { type: 'VARIATION', prompt: text };
  return { type: 'GENERATIVE_FILL', prompt: text };
}
