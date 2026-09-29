import { useEffect } from 'react';
import TopBar from './components/TopBar';
import Toolbar, { TOOL_SHORTCUTS, TOOL_META } from './components/Toolbar';
import CanvasStage from './components/CanvasStage';
import RightPanel from './components/RightPanel';
import { CommandBar, SettingsModal, StatusBar, WelcomeModal } from './components/Overlays';
import { useEditor } from './state/store';
import { saveProjectLocal } from './services/persistence';

export default function App() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); useEditor.setState({ showCommandBar: !useEditor.getState().showCommandBar }); return; }
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); useEditor.getState().undo(); return; }
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const st = useEditor.getState();
        useEditor.setState({ saveStatus: 'saving' });
        void saveProjectLocal('autosave', {
          version: '1.0',
          document: { id: st.docId, name: st.projectName, width: st.canvasWidth, height: st.canvasHeight },
          layers: st.layers, operations: st.operations, history: st.history,
        }).then(() => useEditor.setState({ saveStatus: 'saved', dirty: false }));
        return;
      }
      if ((mod && e.key.toLowerCase() === 'y') || (mod && e.shiftKey && e.key.toLowerCase() === 'z')) { e.preventDefault(); useEditor.getState().redo(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const t = e.target as HTMLElement;
        if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
        const id = useEditor.getState().activeLayerId;
        if (id) useEditor.getState().deleteLayer(id);
        return;
      }
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || mod) return;
      const tool = TOOL_SHORTCUTS[e.key.toLowerCase()];
      if (tool) useEditor.setState({ tool });
      if (e.key === '[') useEditor.setState({ rightTab: 'layers' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onImport = (f: File) => {
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      // SVG has no natural size until rendered — default to canvas size
      const iw = img.naturalWidth || 1280, ih = img.naturalHeight || 800;
      if (f.type === 'image/svg+xml') {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(iw, 1600); canvas.height = Math.min(ih, 1600);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        useEditor.getState().importImage(canvas.toDataURL('image/png'), f.name, canvas.width, canvas.height);
      } else {
        const reader = new FileReader();
        reader.onload = () => useEditor.getState().importImage(reader.result as string, f.name, iw, ih);
        reader.readAsDataURL(f);
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  // drag & drop import
  useEffect(() => {
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer?.files?.[0];
      if (f && f.type.startsWith('image/')) onImport(f);
    };
    const onDrag = (e: DragEvent) => e.preventDefault();
    window.addEventListener('drop', onDrop);
    window.addEventListener('dragover', onDrag);
    return () => { window.removeEventListener('drop', onDrop); window.removeEventListener('dragover', onDrag); };
  }, []);

  return (
    <div className="h-full flex flex-col select-none"
      onDragOver={(e) => e.preventDefault()}>
      <TopBar onImport={onImport} />
      {/* contextual options strip */}
      <OptionsStrip />
      <div className="flex-1 flex min-h-0">
        <Toolbar />
        <CanvasStage />
        <RightPanel />
      </div>
      <StatusBar />
      <CommandBar />
      <SettingsModal />
      <WelcomeModal />
    </div>
  );
}

function OptionsStrip() {
  const tool = useEditor((s) => s.tool);
  const sel = useEditor((s) => s.selection);
  const meta = TOOL_META[tool] ?? { label: tool, hint: '' };
  return (
    <div className="h-9 shrink-0 flex items-center gap-2 px-3 bg-[#0d1017] border-b border-white/10 text-[12px] text-white/60">
      <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">{meta.label}</span>
      {sel
        ? <span>Selection {Math.round(sel.width)}×{Math.round(sel.height)} — draw again to change, <b className="text-white/80">enter prompt below</b>, Esc to clear</span>
        : <span className="hidden md:inline">{meta.hint} · Ctrl+scroll to zoom</span>}
      <div className="flex-1" />
      {sel && (
        <button onClick={() => useEditor.getState().setSelection(null)} className="hover:text-white">Clear selection</button>
      )}
      <button onClick={() => useEditor.setState({ fitTick: useEditor.getState().fitTick + 1 })} className="hover:text-white">Fit to screen</button>
    </div>
  );
}
