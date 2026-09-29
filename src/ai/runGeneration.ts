import { v4 as uuid } from 'uuid';
import { useEditor, buildAIContext } from '../state/store';
import type { AIOperationType } from '../types';

/** Central AI job runner: UI -> queue -> provider -> editor state (spec §18, §37). */
export async function runGeneration(type: AIOperationType, prompt: string, opts?: { resultCount?: number }) {
  const s = useEditor.getState();
  if (!prompt.trim()) throw new Error('Enter a prompt first');
  const opId = uuid();
  const jobId = uuid();
  const w = s.selection?.width ?? s.canvasWidth;
  const h = s.selection?.height ?? s.canvasHeight;
  const active = s.layers.find((l) => l.id === s.activeLayerId);

  useEditor.setState((st) => ({
    jobs: { ...st.jobs, [jobId]: { progress: 2, status: 'running', label: `${labelFor(type)}…` } },
    activeOperationId: opId,
    operations: [...st.operations, {
      id: opId, type, prompt, inputLayerIds: active ? [active.id] : [],
      resultLayerIds: [], provider: st.activeProviderId, model: modelFor(st.activeProviderId),
      createdAt: Date.now(), status: 'running',
    }],
    rightTab: 'ai',
  }));

  // context is attached for future real providers; mock uses prompt/size only
  void buildAIContext();

  const ctrl = new AbortController();
  try {
    const provider = useEditor.getState().provider();
    console.info(`[AI] ${type} via "${provider.displayName}" — prompt:`, prompt);
    useEditor.setState((st) => ({
      jobs: { ...st.jobs, [jobId]: { ...st.jobs[jobId], label: `${labelFor(type)} · ${provider.displayName}…` } },
    }));
    const res = await provider.generate({
      prompt, type,
      width: Math.max(64, Math.round(w)), height: Math.max(64, Math.round(h)),
      sourceImageSrc: active?.imageSrc,
      maskRect: s.selection,
      variations: opts?.resultCount ?? s.variations,
      signal: ctrl.signal,
      onProgress: (p) => useEditor.setState((st) => ({
        jobs: { ...st.jobs, [jobId]: { ...st.jobs[jobId], progress: p } },
      })),
    });
    useEditor.setState((st) => ({
      results: res.images.map((im) => ({ id: uuid(), operationId: opId, imageSrc: im.src, seed: im.seed, prompt })),
      selectedResultId: undefined,
      jobs: { ...st.jobs, [jobId]: { ...st.jobs[jobId], progress: 100, status: 'done' } },
      operations: st.operations.map((o) => (o.id === opId ? { ...o, status: 'done' } : o)),
    }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Generation failed';
    useEditor.setState((st) => ({
      jobs: { ...st.jobs, [jobId]: { ...st.jobs[jobId], status: 'failed', error: msg } },
      operations: st.operations.map((o) => (o.id === opId ? { ...o, status: 'failed' } : o)),
    }));
    throw e;
  }
}

function labelFor(t: AIOperationType) {
  return { GENERATIVE_FILL: 'Generating fill', GENERATIVE_EXPAND: 'Expanding canvas', REMOVE_OBJECT: 'Removing object', REPLACE_OBJECT: 'Replacing object', BACKGROUND_GENERATION: 'Generating background', RETOUCH: 'Retouching', UPSCALE: 'Upscaling', VARIATION: 'Generating variation' }[t];
}
function modelFor(pid: string) { return pid === 'mock' ? 'mock-diffusion-1' : 'custom'; }

/** Accept a result -> non-destructive AI layer (+ mask) per spec §9/§17. */
export function acceptResult(resultId: string) {
  const s = useEditor.getState();
  const r = s.results.find((x) => x.id === resultId);
  if (!(r)) return;
  const op = s.operations.find((o) => o.id === r.operationId);
  const sel = s.selection;
  let layerW = s.canvasWidth, layerH = s.canvasHeight, lx = 0, ly = 0;
  if (sel && (op?.type === 'GENERATIVE_FILL' || op?.type === 'REMOVE_OBJECT' || op?.type === 'REPLACE_OBJECT' || op?.type === 'VARIATION')) {
    lx = sel.x; ly = sel.y; layerW = sel.width; layerH = sel.height;
  }
  if (op?.type === 'GENERATIVE_EXPAND') {
    const nx = Math.round(s.canvasWidth * 1.4), ny = Math.round(s.canvasHeight * 1.4);
    useEditor.setState({ canvasWidth: nx, canvasHeight: ny });
    lx = 0; ly = 0; layerW = nx; layerH = ny;
  }
  const id = s.addLayer({
    name: `AI · ${op?.type.replace(/_/g, ' ').toLowerCase() ?? 'generation'}`,
    imageSrc: r.imageSrc, x: Math.round(lx), y: Math.round(ly),
    width: Math.round(layerW), height: Math.round(layerH),
    isAI: true, aiOperationId: op?.id, type: 'ai',
  });
  useEditor.setState((st) => ({
    operations: st.operations.map((o) => (o.id === r.operationId ? { ...o, resultLayerIds: [...o.resultLayerIds, id] } : o)),
    selectedResultId: resultId,
  }));
  useEditor.getState().pushHistory(`AI ${op?.type.toLowerCase().replace(/_/g, ' ') ?? 'apply'}`, op?.id);
}

export async function mockAnalyze() {
  const s = useEditor.getState();
  if (!s.layers.length) return;
  useEditor.setState({ analyzing: true });
  await new Promise((r) => setTimeout(r, 900));
  const W = s.canvasWidth, H = s.canvasHeight;
  useEditor.setState({
    analyzing: false,
    detected: [
      { id: uuid(), label: 'subject', confidence: 0.94, boundingBox: { x: W * 0.25, y: H * 0.2, width: W * 0.5, height: H * 0.6 } },
      { id: uuid(), label: 'background', confidence: 0.89, boundingBox: { x: 0, y: 0, width: W, height: H } },
      { id: uuid(), label: 'sky', confidence: 0.71, boundingBox: { x: 0, y: 0, width: W, height: H * 0.35 } },
    ],
  });
}

/** Sensible default prompt per operation so menu/panel actions work without typing. */
export function defaultPromptFor(t: AIOperationType): string {
  return {
    GENERATIVE_FILL: 'seamless photorealistic content matching surrounding light and texture',
    REMOVE_OBJECT: 'clean background reconstruction, remove object',
    REPLACE_OBJECT: 'replacement object, same position perspective lighting scale',
    BACKGROUND_GENERATION: 'soft studio background, natural light',
    GENERATIVE_EXPAND: 'extend scene naturally beyond the frame',
    RETOUCH: 'professional retouch, clean skin, balanced light',
    UPSCALE: 'enhance detail, sharp, high resolution',
    VARIATION: 'variation',
  }[t];
}

/** One-click AI action using the panel prompt, or a default. Used by menus + AI panel. */
export async function runAIAction(type: AIOperationType) {
  const s = useEditor.getState();
  if (!s.layers.length) throw new Error('Import an image first');
  const prompt = s.promptText.trim() || defaultPromptFor(type);
  return runGeneration(type, prompt);
}

/** AI Select: analyze the image, then auto-select the main subject bounding box. */
export async function smartSelectSubject(): Promise<boolean> {
  const s = useEditor.getState();
  if (!s.layers.length) return false;
  await mockAnalyze();
  const det = useEditor.getState().detected;
  const subj = det.find((d) => d.label === 'subject') ?? det[0];
  if (!subj) return false;
  useEditor.getState().setSelection({ ...subj.boundingBox });
  return true;
}
