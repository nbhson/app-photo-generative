import { beforeEach, describe, expect, it } from 'vitest';
import { useEditor, parseIntent, enhancePrompt, buildAIContext } from './store';

/** Reset the singleton store between tests — tests must not leak state. */
function resetStore() {
  useEditor.setState({
    layers: [], activeLayerId: undefined, selection: null, history: [], historyIndex: -1,
    canvasWidth: 1280, canvasHeight: 800, operations: [], results: [],
    dirty: false, saveStatus: 'saved', toast: undefined,
  });
}

beforeEach(resetStore);

/** Helper: luôn đọc state mới nhất (getState() snapshot bị stale sau action). */
const S = () => useEditor.getState();

describe('editor store — history', () => {
  it('pushHistory snapshots layers and advances the index', () => {
    S().importImage('data:,a', 'a.png', 100, 100);
    S().pushHistory('op');
    const st = S();
    expect(st.history).toHaveLength(2); // import push + explicit push
    expect(st.historyIndex).toBe(1);
    expect(st.history[1].layersSnapshot).toHaveLength(1);
  });

  it('undo/redo restore snapshots and respect bounds', () => {
    S().importImage('data:,a', 'a.png', 100, 100);
    const id = S().layers[0].id;
    const xAfterImport = S().layers[0].x;
    S().updateLayer(id, { x: 50 });
    S().pushHistory('moved');
    expect(S().historyIndex).toBe(1);
    expect(S().canRedo()).toBe(false);
    S().undo();
    const afterUndo = S();
    expect(afterUndo.historyIndex).toBe(0);
    expect(afterUndo.layers[0].x).toBe(xAfterImport); // snapshot lúc import
    expect(afterUndo.canRedo()).toBe(true);
    // undo về entry đầu — không undo được nữa
    S().undo();
    expect(S().canUndo()).toBe(false);
    S().redo();
    expect(S().historyIndex).toBe(1);
    expect(S().layers[0].x).toBe(50);
  });

  it('undo past the first entry is a no-op (does not corrupt state)', () => {
    S().undo();
    expect(S().layers).toHaveLength(0);
  });

  it('pushHistory after undo truncates the redo branch', () => {
    const s = S();
    s.importImage('data:,a', 'a.png', 100, 100);
    s.pushHistory('second');
    s.pushHistory('third');
    S().undo();
    S().undo();
    s.pushHistory('branched');
    const st = S();
    expect(st.history).toHaveLength(2);
    expect(st.historyIndex).toBe(1);
    expect(st.canRedo()).toBe(false);
  });

  it('history is capped at 60 entries', () => {
    const s = S();
    for (let i = 0; i < 70; i++) s.pushHistory(`op ${i}`);
    const st = S();
    expect(st.history).toHaveLength(60);
    expect(st.historyIndex).toBe(59);
    expect(st.history.at(-1)!.label).toBe('op 69');
  });
});

describe('editor store — layers', () => {
  it('reorderLayers moves elements within bounds', () => {
    const s = S();
    s.importImage('data:,a', 'a.png', 10, 10);
    s.importImage('data:,b', 'b.png', 10, 10);
    s.importImage('data:,c', 'c.png', 10, 10);
    s.reorderLayers(2, 0); // c → đầu mảng
    expect(S().layers.map((l) => l.name)).toEqual(['c.png', 'a.png', 'b.png']);
  });

  it('deleteLayer removes it and moves the active layer', () => {
    const s = S();
    s.importImage('data:,a', 'a.png', 10, 10);
    const second = s.addLayer({ name: 'second' });
    expect(S().activeLayerId).toBe(second);
    s.deleteLayer(second);
    const st = S();
    expect(st.layers).toHaveLength(1);
    expect(st.activeLayerId).toBe(st.layers[0].id);
  });

  it('duplicateLayer copies properties under a new id', () => {
    S().importImage('data:,a', 'a.png', 10, 10);
    const id = S().layers[0].id;
    S().duplicateLayer(id);
    const st = S();
    expect(st.layers).toHaveLength(2);
    expect(st.layers[1].id).not.toBe(id);
    expect(st.layers[1].name).toBe('a.png copy');
    expect(st.layers[1].width).toBe(st.layers[0].width);
    expect(st.activeLayerId).toBe(st.layers[1].id);
  });

  it('updateLayer flags dirty + unsaved', () => {
    const s = S();
    const id = s.addLayer({ name: 'x' });
    useEditor.setState({ dirty: false, saveStatus: 'saved' });
    s.updateLayer(id, { opacity: 0.5 });
    expect(S().dirty).toBe(true);
    expect(S().saveStatus).toBe('unsaved');
  });

  it('duplicate of missing layer is a no-op', () => {
    S().duplicateLayer('nope');
    expect(S().layers).toHaveLength(0);
    expect(S().history).toHaveLength(0);
  });
});

describe('editor store — snapshot isolation', () => {
  it('snapshots are deep copies — mutating a stored snapshot does not touch live layers', () => {
    S().addLayer({ name: 'a' });
    S().pushHistory('snap');
    (S().history[0].layersSnapshot[0] as { name: string }).name = 'hacked';
    expect(S().layers[0].name).toBe('a');
  });

  it('undo restores the layer state from the previous entry', () => {
    const s = S();
    const id = s.addLayer({ name: 'a' });
    s.pushHistory('base');
    s.updateLayer(id, { name: 'renamed' });
    s.pushHistory('renamed');
    S().undo();
    expect(S().layers[0].name).toBe('a');
  });
});

describe('parseIntent', () => {
  it.each([
    ['remove the person', 'REMOVE_OBJECT'],
    ['erase this spot', 'REMOVE_OBJECT'],
    ['change the background to a beach', 'BACKGROUND_GENERATION'],
    ['replace the sky with clouds', 'REPLACE_OBJECT'],
    ['swap background for studio', 'BACKGROUND_GENERATION'], // 'background' match trước 'replace'? — thứ tự regex quyết định
    ['expand the canvas to the left', 'GENERATIVE_EXPAND'],
    ['upscale to 4k', 'UPSCALE'],
    ['retouch the skin', 'RETOUCH'],
    ['another version please', 'VARIATION'],
    ['a red hat', 'GENERATIVE_FILL'],
  ])('"%s" → %s', (text, expected) => {
    expect(parseIntent(text).type).toBe(expected);
  });

  it('keeps the original prompt text', () => {
    expect(parseIntent('Remove the background noise').prompt).toBe('Remove the background noise');
  });
});

describe('enhancePrompt', () => {
  it('wraps the prompt in the chosen style template', () => {
    expect(enhancePrompt('a cat', 'cinematic')).toContain('Cinematic film still of a cat');
  });

  it('falls back to "detailed" for unknown styles', () => {
    expect(enhancePrompt('a cat', 'nonexistent-style')).toBe(enhancePrompt('a cat', 'detailed'));
  });

  it('uses a default base for empty prompts', () => {
    expect(enhancePrompt('   ', 'realistic')).toContain('this image');
  });
});

describe('buildAIContext', () => {
  it('exposes only the relevant fields', () => {
    const s = useEditor.getState();
    s.setSelection({ x: 1, y: 2, width: 3, height: 4 });
    const ctx = buildAIContext();
    expect(ctx.canvasSize).toEqual({ width: 1280, height: 800 });
    expect(ctx.selectionMask).toEqual({ x: 1, y: 2, width: 3, height: 4 });
    expect(ctx.previousOperations).toEqual([]);
    expect(ctx.documentId).toBe(s.docId);
    expect(ctx.selectedLayerIds).toEqual([]);
    expect(ctx.viewport).toEqual({ zoom: 0.6, x: 0, y: 0 });
  });
});
