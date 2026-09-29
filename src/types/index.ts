export type ToolId =
  | 'move' | 'marquee' | 'lasso' | 'brush' | 'eraser' | 'crop'
  | 'gradient' | 'text' | 'shape' | 'eyedropper' | 'clone'
  | 'healing' | 'blur' | 'smudge' | 'hand' | 'zoom'
  | 'ai-select' | 'generative-fill' | 'generative-expand'
  | 'remove-object' | 'replace-object' | 'background-gen'
  | 'ai-retouch' | 'ai-upscale';

export type BlendMode =
  | 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken'
  | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light'
  | 'soft-light' | 'difference' | 'exclusion';

export interface Layer {
  id: string;
  name: string;
  type: 'image' | 'ai' | 'text' | 'shape' | 'adjustment';
  imageSrc?: string;
  x: number; y: number;
  width: number; height: number;
  opacity: number;
  blendMode: BlendMode;
  visible: boolean;
  locked: boolean;
  isAI: boolean;
  aiOperationId?: string;
  mask?: string;
  text?: string;
  color?: string;
  adjustments?: AdjustmentState;
}

export interface AdjustmentState {
  exposure: number; brightness: number; contrast: number;
  highlights: number; shadows: number; temperature: number;
  tint: number; saturation: number; vibrance: number;
  sharpness: number; blur: number;
}

export const DEFAULT_ADJUSTMENTS: AdjustmentState = {
  exposure: 0, brightness: 0, contrast: 0, highlights: 0,
  shadows: 0, temperature: 0, tint: 0, saturation: 0,
  vibrance: 0, sharpness: 0, blur: 0,
};

export interface SelectionRect { x: number; y: number; width: number; height: number; }

export type AIOperationType =
  | 'GENERATIVE_FILL' | 'GENERATIVE_EXPAND' | 'REMOVE_OBJECT'
  | 'REPLACE_OBJECT' | 'BACKGROUND_GENERATION' | 'RETOUCH' | 'UPSCALE'
  | 'VARIATION';

export interface AIOperation {
  id: string;
  type: AIOperationType;
  prompt: string;
  inputLayerIds: string[];
  resultLayerIds: string[];
  provider: string;
  model: string;
  createdAt: number;
  status: 'queued' | 'running' | 'done' | 'failed';
}

export interface GenerationResult {
  id: string;
  operationId: string;
  imageSrc: string;
  seed: number;
  prompt: string;
}

export interface AIJob {
  id: string;
  operationId: string;
  type: AIOperationType;
  prompt: string;
  progress: number;
  status: 'waiting' | 'running' | 'done' | 'failed';
  error?: string;
}

export interface HistoryEntry {
  id: string;
  label: string;
  createdAt: number;
  layersSnapshot: Layer[];
  canvasSnapshot: { width: number; height: number };
  operationId?: string;
}

export interface DetectedObject {
  id: string; label: string; confidence: number;
  boundingBox: SelectionRect;
}

export interface AIEditorContext {
  documentId: string;
  activeLayerId?: string;
  selectedLayerIds: string[];
  selectionMask?: SelectionRect | null;
  canvasSize: { width: number; height: number };
  viewport: { zoom: number; x: number; y: number };
  previousOperations: AIOperation[];
}

export interface CustomProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  apiType: 'openai-compatible' | 'stability' | 'local';
}

export interface ProjectFile {
  version: string;
  document: { id: string; name: string; width: number; height: number };
  layers: Layer[];
  operations: AIOperation[];
  history: HistoryEntry[];
}
