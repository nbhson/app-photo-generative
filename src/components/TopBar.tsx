import { useEffect, useRef, useState } from 'react';
import { useEditor } from '../state/store';
import { runAIAction } from '../ai/runGeneration';
import { Icon } from './icons';
import { compositeLayers, downloadDataUrl, saveProjectLocal } from '../services/persistence';
import type { AIOperationType } from '../types';

interface MenuItem { label?: string; shortcut?: string; disabled?: boolean; divider?: boolean; action?: () => void }

const AI_MENU_ACTIONS: { type: AIOperationType; label: string }[] = [
  { type: 'GENERATIVE_FILL', label: 'Generative Fill' },
  { type: 'REMOVE_OBJECT', label: 'Remove Object' },
  { type: 'REPLACE_OBJECT', label: 'Replace Object' },
  { type: 'BACKGROUND_GENERATION', label: 'Generate Background' },
  { type: 'GENERATIVE_EXPAND', label: 'Generative Expand' },
  { type: 'RETOUCH', label: 'AI Retouch' },
  { type: 'UPSCALE', label: 'AI Upscale' },
];

export default function TopBar({ onImport }: { onImport: (f: File) => void }) {
  const s = useEditor();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(null);
    };
    const onImportEvent = () => fileRef.current?.click();
    window.addEventListener('mousedown', close);
    window.addEventListener('gs:import', onImportEvent);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('gs:import', onImportEvent);
    };
  }, []);

  const doExport = async (format: 'png' | 'jpeg' | 'webp') => {
    const st = useEditor.getState();
    const url = await compositeLayers(st.layers, st.canvasWidth, st.canvasHeight, format);
    downloadDataUrl(url, `${st.projectName}.${format}`);
  };
  const doSave = async () => {
    const st = useEditor.getState();
    useEditor.setState({ saveStatus: 'saving' });
    await saveProjectLocal('autosave', {
      version: '1.0',
      document: { id: st.docId, name: st.projectName, width: st.canvasWidth, height: st.canvasHeight },
      layers: st.layers, operations: st.operations, history: st.history,
    });
    useEditor.setState({ saveStatus: 'saved', dirty: false });
  };
  const saveFile = () => {
    const st = useEditor.getState();
    const blob = new Blob([JSON.stringify({
      version: '1.0',
      document: { id: st.docId, name: st.projectName, width: st.canvasWidth, height: st.canvasHeight },
      layers: st.layers, operations: st.operations, history: st.history,
    }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `${st.projectName}.gstudio`; a.click();
    URL.revokeObjectURL(a.href);
  };
  const aiAction = (t: AIOperationType) => {
    // empty canvas → offer import first instead of failing silently
    if (!useEditor.getState().layers.length) { fileRef.current?.click(); return; }
    useEditor.setState({ rightTab: 'ai' });
    void runAIAction(t).catch(() => { /* error surfaces in the AI Tasks queue */ });
  };
  const zoomBy = (f: number) => {
    const z = useEditor.getState().zoom;
    useEditor.setState({ zoom: Math.max(0.05, Math.min(8, z * f)) });
  };

  const menus: Record<string, MenuItem[]> = {
    File: [
      { label: 'New Project', action: () => useEditor.getState().newProject() },
      { label: 'Import Image…', action: () => fileRef.current?.click() },
      { divider: true },
      { label: 'Save Project (.gstudio)', shortcut: 'Ctrl+S', action: saveFile },
      { label: 'Export PNG', action: () => void doExport('png') },
      { label: 'Export JPEG', action: () => void doExport('jpeg') },
      { label: 'Export WebP', action: () => void doExport('webp') },
    ],
    Edit: [
      { label: 'Undo', shortcut: 'Ctrl+Z', disabled: !s.canUndo(), action: () => useEditor.getState().undo() },
      { label: 'Redo', shortcut: 'Ctrl+Shift+Z', disabled: !s.canRedo(), action: () => useEditor.getState().redo() },
    ],
    AI: [
      { label: 'Command Bar…', shortcut: '⌘K', action: () => useEditor.setState({ showCommandBar: true }) },
      { divider: true },
      ...AI_MENU_ACTIONS.map((a): MenuItem => ({ label: a.label, action: () => aiAction(a.type) })),
      { divider: true },
      { label: 'AI Provider Settings…', action: () => useEditor.setState({ showSettings: true }) },
    ],
    View: [
      { label: 'Fit to Screen', action: () => useEditor.setState({ fitTick: useEditor.getState().fitTick + 1 }) },
      { label: 'Zoom In', shortcut: '+', action: () => zoomBy(1.2) },
      { label: 'Zoom Out', shortcut: '−', action: () => zoomBy(1 / 1.2) },
    ],
  };

  return (
    <header className="h-12 shrink-0 flex items-center gap-3 px-3 bg-[#10131a] border-b border-white/10 text-[13px]">
      <div className="flex items-center gap-2 font-semibold tracking-tight">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-sky-500 grid place-items-center text-white shrink-0">
          <Icon name="sparkles" size={15} />
        </div>
        <span className="hidden sm:inline">Generative Studio</span>
        <span className="text-white/30 font-normal hidden sm:inline">/</span>
        <input
          value={s.projectName}
          onChange={(e) => useEditor.setState({ projectName: e.target.value, saveStatus: 'unsaved' })}
          className="bg-transparent outline-none border border-transparent hover:border-white/15 focus:border-violet-500 rounded px-1 w-36 text-white/90"
        />
        <span className="text-[11px] font-normal text-white/40 whitespace-nowrap">
          {s.saveStatus === 'saved' ? '● Saved' : s.saveStatus === 'saving' ? '○ Saving…' : '● Unsaved'}
        </span>
      </div>
      <nav ref={navRef} className="hidden md:flex items-center gap-0.5 text-white/70 ml-1">
        {Object.entries(menus).map(([name, items]) => (
          <div key={name} className="relative">
            <button
              onClick={() => setOpen(open === name ? null : name)}
              onMouseEnter={() => { if (open) setOpen(name); }}
              className={`px-2 py-1 rounded ${open === name ? 'bg-white/10 text-white' : 'hover:bg-white/10 hover:text-white'}`}>
              {name}
            </button>
            {open === name && (
              <div className="absolute left-0 top-full pt-1 z-50">
                <div className="bg-[#171b24] border border-white/10 rounded-lg p-1 w-64 shadow-2xl">
                  {items.map((it, i) => it.divider ? (
                    <div key={i} className="h-px bg-white/10 my-1" />
                  ) : (
                    <button key={i} disabled={it.disabled}
                      onClick={() => { setOpen(null); it.action?.(); }}
                      className="flex items-center gap-2 w-full text-left px-2.5 py-1.5 rounded hover:bg-violet-600/25 text-[12.5px] text-white/85 disabled:opacity-35 disabled:hover:bg-transparent">
                      <span className="flex-1">{it.label}</span>
                      {it.shortcut && <span className="text-white/30 text-[11px]">{it.shortcut}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </nav>
      <div className="flex-1" />
      <div className="flex items-center gap-1">
        <ToolBtn title="Undo (Ctrl+Z)" onClick={() => useEditor.getState().undo()} disabled={!s.canUndo()}>
          <Icon name="undo" size={15} />
        </ToolBtn>
        <ToolBtn title="Redo (Ctrl+Shift+Z)" onClick={() => useEditor.getState().redo()} disabled={!s.canRedo()}>
          <Icon name="redo" size={15} />
        </ToolBtn>
        <ToolBtn title="Save to browser (Ctrl+S)" onClick={() => void doSave()}>
          <Icon name="save" size={15} />
        </ToolBtn>
        <button onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/15 text-white/85">
          <Icon name="upload" size={14} /> Import</button>
        <button
          onClick={() => useEditor.setState({ showCommandBar: true, rightTab: 'ai' })}
          className="ml-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 font-medium text-white shadow-[0_0_18px_rgba(124,92,255,.35)]">
          <Icon name="sparkles" size={14} /> Generative AI <span className="opacity-60 text-[11px]">⌘K</span>
        </button>
        <ToolBtn title="Help / getting started" onClick={() => useEditor.setState({ showWelcome: true })}>
          <Icon name="help" size={15} />
        </ToolBtn>
      </div>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; }} />
    </header>
  );
}

function ToolBtn({ children, title, onClick, disabled }: { children: React.ReactNode; title: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button title={title} onClick={onClick} disabled={disabled}
      className="px-2 py-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent text-white/80">
      {children}
    </button>
  );
}
