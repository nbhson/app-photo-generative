import { Suspense, lazy, useEffect } from 'react';
import TopBar from './components/TopBar';
import Toolbar, { TOOL_SHORTCUTS, TOOL_META } from './components/Toolbar';
import RightPanel from './components/RightPanel';
import { CommandBar, SettingsModal, ShortcutsModal, StatusBar, Toast, WelcomeModal } from './components/Overlays';
import ExportDialog from './components/ExportDialog';
import CanvasSizeDialog from './components/CanvasSizeDialog';
import { useEditor } from './state/store';
import { saveProjectLocal, buildProjectFile, loadProjectLocal, sanitizeProject } from './services/persistence';
import { importImageFile } from './services/imageImport';

// Konva/react-konva chỉ dùng ở đây — lazy-load để tách khỏi main chunk
// (bundle 623 kB → main chunk nhỏ, canvas load sau khi shell render).
const CanvasStage = lazy(() => import('./components/CanvasStage'));

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
        void saveProjectLocal('autosave', buildProjectFile(st))
          .then(() => useEditor.setState({ saveStatus: 'saved', dirty: false }))
          // IndexedDB fail (private mode / quota) — không kẹt 'saving' mãi
          .catch(() => useEditor.setState({ saveStatus: 'unsaved' }));
        return;
      }
      if ((mod && e.key.toLowerCase() === 'y') || (mod && e.shiftKey && e.key.toLowerCase() === 'z')) { e.preventDefault(); useEditor.getState().redo(); return; }
      if (mod && e.key.toLowerCase() === 'e') { e.preventDefault(); useEditor.setState({ showExport: true }); return; }
      if (e.key === 'Escape') {
        // Modal đang mở → Modal shell tự đóng bằng Escape; không thêm clear selection
        const s = useEditor.getState();
        if (s.showCommandBar || s.showSettings || s.showExport || s.showShortcuts || s.showWelcome || s.showCanvasSize) return;
        useEditor.getState().setSelection(null);
        return;
      }
      if (e.key === '?' || (e.shiftKey && e.key === '/')) { useEditor.setState({ showShortcuts: true }); return; }
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

  // Session restore: khôi phục autosave từ IndexedDB lúc khởi động (trước đây
  // loadProjectLocal là dead code). Restore im lặng nếu có layers; "New Project"
  // vẫn xóa sạch. Lịch sử cũ không restore (historyIndex không còn khớp) —
  // snapshot khôi phục được push thành entry đầu tiên.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const saved = await loadProjectLocal('autosave');
        if (cancelled) return;
        const p = sanitizeProject(saved);
        if (!p || !p.layers.length) return;
        const st = useEditor.getState();
        if (st.layers.length) return; // user đã thao tác trước khi restore xong
        useEditor.setState({
          docId: p.document.id, projectName: p.document.name,
          canvasWidth: p.document.width, canvasHeight: p.document.height,
          layers: p.layers, operations: p.operations,
          activeLayerId: p.layers[p.layers.length - 1]?.id,
          saveStatus: 'saved', dirty: false,
        });
        useEditor.getState().pushHistory('Restore session');
      } catch { /* corrupt autosave → start fresh */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const onImport = (f: File) => {
    void importImageFile(f).catch((e) => {
      useEditor.setState({ toast: e instanceof Error ? e.message : 'Import failed' });
    });
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
        <Suspense fallback={<div className="flex-1 grid place-items-center text-[12px] text-white/40 bg-[#08090d]"><span className="w-5 h-5 rounded-full border-2 border-violet-400/40 border-t-violet-300 animate-spin" /></div>}>
          <CanvasStage />
        </Suspense>
        <RightPanel />
      </div>
      <StatusBar />
      <CommandBar />
      <SettingsModal />
      <ShortcutsModal />
      <ExportDialog />
      <CanvasSizeDialog />
      <WelcomeModal />
      <Toast />
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
