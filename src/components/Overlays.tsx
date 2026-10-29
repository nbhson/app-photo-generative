import { useEffect, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { useEditor, parseIntent } from '../state/store';
import { runGeneration } from '../ai/runGeneration';
import { Icon, type IconName } from './icons';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/** Shared modal shell: backdrop click + Escape to close, dialog semantics, focus trap. */
export function Modal({ onClose, width, labelledBy, children, align = 'center' }: {
  onClose: () => void; width: string; labelledBy?: string;
  children: React.ReactNode; align?: 'center' | 'top';
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      // focus trap: Tab/Shift+Tab vòng trong dialog, không thoát ra nền
      if (e.key === 'Tab' && boxRef.current) {
        const box = boxRef.current;
        const focusables = Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (focusables.length === 0) return;
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !box.contains(active))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (active === last || !box.contains(active))) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  // focus vào dialog khi mở — ưu tiên [data-autofocus] (vd confirm button);
  // nếu input trong dialog đã tự focus (autoFocus attr) thì không giật focus
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const target = box.querySelector<HTMLElement>('[data-autofocus]');
    if (target) { target.focus(); return; }
    if (!box.contains(document.activeElement)) box.focus();
  }, []);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby={labelledBy}
      className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] ${align === 'top' ? 'grid place-items-start pt-28' : 'grid place-items-center p-4'}`}
      onClick={onClose}>
      <div ref={boxRef} tabIndex={-1}
        className={`${width} bg-[#141823] border border-white/15 rounded-2xl shadow-2xl overflow-hidden outline-none`}
        onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  'Remove the person in the background',
  'Change the background to a luxury office at sunset',
  'Make the selected object blue',
  'Extend the scene with mountains and sky',
  'Make this more cinematic',
  'Sharpen and enhance details',
];

export function CommandBar() {
  const open = useEditor((s) => s.showCommandBar);
  // render command shell chỉ khi mở — CommandBarInner mount fresh mỗi lần,
  // state text/err tự reset lúc mount (không cần effect sync — eslint set-state-in-effect)
  if (!open) return null;
  return (
    <Modal width="w-[min(620px,92vw)]" align="top" onClose={() => useEditor.setState({ showCommandBar: false })}>
      <CommandBarInner />
    </Modal>
  );
}

function CommandBarInner() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async (t: string) => {
    const { type, prompt } = parseIntent(t || 'enhance');
    setBusy(true); setErr('');
    try {
      await runGeneration(type, prompt);
      useEditor.setState({ showCommandBar: false, rightTab: 'ai' });
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(false); }
  };
  return (
    <>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
          <Icon name="sparkles" size={16} className="text-violet-300 shrink-0" />
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') go(text); if (e.key === 'Escape') useEditor.setState({ showCommandBar: false }); }}
            placeholder="What would you like to do? e.g. remove the person in the background…"
            className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-white/30" />
          <kbd className="text-[11px] text-white/30 border border-white/10 rounded px-1.5 py-0.5">esc</kbd>
        </div>
        <div className="p-2">
          <div className="text-[11px] uppercase tracking-wide text-white/35 px-2 py-1">Suggestions</div>
          {SUGGESTIONS.map((sg) => (
            <button key={sg} onClick={() => go(sg)} disabled={busy}
              className="group flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg hover:bg-violet-600/20 text-[13px] text-white/80 disabled:opacity-50 transition-colors">
              <span className="flex-1">{sg}</span>
              <Icon name="arrowRight" size={13} className="opacity-0 group-hover:opacity-60 transition-opacity" />
            </button>
          ))}
        </div>
        {busy && <div className="flex items-center gap-2 px-4 py-2 text-[13px] text-violet-300"><span className="w-2 h-2 rounded-full bg-violet-400 gen-pulse" /> Working — watch the AI panel for progress…</div>}
        {err && <div className="px-4 py-2 text-[13px] text-red-400">{err}</div>}
    </>
  );
}

export function SettingsModal() {
  const open = useEditor((s) => s.showSettings);
  const customs = useEditor((s) => s.customProviders);
  const [f, setF] = useState({ name: 'My OpenAI Compatible Provider', baseUrl: 'https://api.example.com/v1', apiKey: '', model: 'image-model-1' });
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState('');
  const [testOk, setTestOk] = useState<boolean | null>(null);
  if (!open) return null;
  const testConn = async () => {
    setTesting(true); setTestMsg(''); setTestOk(null);
    try {
      const base = f.baseUrl.replace(/\/$/, '');
      if (!/^https?:\/\//.test(base)) throw new Error('Base URL must start with http(s)://');
      const r = await fetch(`${base}/models`, { headers: f.apiKey ? { Authorization: `Bearer ${f.apiKey}` } : {} });
      if (!r.ok) throw new Error(`HTTP ${r.status} — check Base URL / API key`);
      const j = (await r.json().catch(() => null)) as { data?: unknown[] } | null;
      const n = Array.isArray(j?.data) ? ` — ${j.data.length} models listed` : '';
      setTestOk(true);
      setTestMsg(`Connected${n}. Press Save, then pick this provider in the AI panel.`);
    } catch (e) { setTestOk(false); setTestMsg(`Connection failed: ${e instanceof Error ? e.message : 'network error'}`); }
    finally { setTesting(false); }
  };
  return (
    <Modal width="w-[min(520px,92vw)]" onClose={() => useEditor.setState({ showSettings: false })}>
      <div className="p-5">
        <h2 className="flex items-center gap-2 font-semibold mb-1"><Icon name="sliders" size={16} className="text-white/60" /> AI Provider settings</h2>
        <div className="text-[12px] text-white/55 leading-relaxed mb-4 rounded-lg bg-white/[.03] border border-white/10 p-2.5">
          <b className="text-white/85">How this works</b>
          <ol className="list-decimal ml-4 mt-1 space-y-0.5">
            <li><b className="text-white/80">Mock (Demo)</b> is selected by default — the full workflow runs with zero setup.</li>
            <li>To use a real model: fill the fields below → <b className="text-white/80">Test connection</b> → <b className="text-white/80">Save</b> → pick it in the AI panel's Model dropdown.</li>
            <li>Any <b className="text-white/80">OpenAI-compatible</b> endpoint works: OpenAI, Azure, Together, OpenRouter, a local server…</li>
          </ol>
          <div className="mt-1.5 text-white/40">Base URL e.g. <code className="text-white/60">https://api.openai.com/v1</code> · Model must be an image model, e.g. <code className="text-white/60">gpt-image-1</code>.</div>
        </div>
        {(['name', 'baseUrl', 'apiKey', 'model'] as const).map((k) => (
          <label key={k} className="block text-[12px] text-white/60 mb-2">
            {k === 'name' ? 'Provider Name' : k === 'baseUrl' ? 'Base URL' : k === 'apiKey' ? 'API Key' : 'Model'}
            <input type={k === 'apiKey' ? 'password' : 'text'} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}
              placeholder={k === 'baseUrl' ? 'https://api.example.com/v1' : k === 'apiKey' ? 'sk-xxxxxxxx' : ''}
              className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-[13px] text-white outline-none focus:border-violet-500" />
          </label>
        ))}
        {/* "API Type" select đã bỏ — chỉ có duy nhất 1 option cứng
            'OpenAI Compatible' không đọc/ghi state nào (dead control). */}
        {testMsg && (
          <div className={`text-[12px] mb-2 px-2.5 py-1.5 rounded-lg border ${testOk ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : 'text-red-300 border-red-500/30 bg-red-500/10'}`}>
            {testMsg}
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={testConn} disabled={testing}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm disabled:opacity-50">
            {testing ? 'Testing…' : 'Test connection'}</button>
          <button onClick={() => {
            const id = uuid();
            useEditor.setState({
              customProviders: [...customs, { id, name: f.name, baseUrl: f.baseUrl, apiKey: f.apiKey, model: f.model, apiType: 'openai-compatible' }],
              activeProviderId: id,
              rightTab: 'ai',
              showSettings: false,
            });
          }} className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium">Save & use provider</button>
          <button onClick={() => useEditor.setState({ showSettings: false })} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm">Close</button>
        </div>
        <p className="text-[11px] text-white/35 mt-2 leading-snug">Saved in this browser's localStorage, so providers survive reloads — delete one anytime with its remove button. Only use keys you can rotate: any script on this page could read them. A production app should call AI from a backend (Browser → your API → provider) so keys and billing stay server-side.</p>
        {customs.length > 0 && (
          <div className="mt-3 text-[12px] space-y-1">
            {customs.map((c) => (
              <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/[.04] border border-white/10">
                <span className="flex-1 truncate">{c.name} · <span className="text-white/40">{c.model}</span></span>
                <button title="Use this provider" aria-label={`Use provider ${c.name}`} className="text-white/50 hover:text-white transition-colors" onClick={() => useEditor.setState({ activeProviderId: c.id, showSettings: false })}>
                  <Icon name="check" size={14} />
                </button>
                <button title="Remove provider" aria-label={`Remove provider ${c.name}`} className="text-red-400/70 hover:text-red-300 transition-colors" onClick={() => useEditor.setState({ customProviders: customs.filter((x) => x.id !== c.id) })}>
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function StatusBar() {
  // selector hẹp — full-store subscribe trước đây re-render footer mỗi wheel tick
  const canvasWidth = useEditor((s) => s.canvasWidth);
  const canvasHeight = useEditor((s) => s.canvasHeight);
  const layerCount = useEditor((s) => s.layers.length);
  const visibleCount = useEditor((s) => s.layers.reduce((n, l) => n + (l.visible ? 1 : 0), 0));
  const selection = useEditor((s) => s.selection);
  const zoom = useEditor((s) => s.zoom);
  const fitTick = useEditor((s) => s.fitTick);
  const activeProviderId = useEditor((s) => s.activeProviderId);
  const setZoom = (z: number) => {
    const nz = Math.max(0.05, Math.min(8, z));
    useEditor.setState({ zoom: nz });
  };
  return (
    <footer className="h-7 shrink-0 flex items-center gap-3 px-3 bg-[#10131a] border-t border-white/10 text-[11px] text-white/50">
      <span className="tabular-nums">{Math.round(canvasWidth)} × {Math.round(canvasHeight)} px</span>
      <span className="text-white/20">|</span>
      <span>{visibleCount}/{layerCount} layers</span>
      {selection && <span className="text-violet-300">▭ {Math.round(selection.width)}×{Math.round(selection.height)} @ {Math.round(selection.x)},{Math.round(selection.y)}</span>}
      <div className="flex-1" />
      <button aria-label="Zoom out" onClick={() => setZoom(zoom - 0.1)} className="px-1.5 hover:text-white">−</button>
      <button aria-label={`Zoom ${Math.round(zoom * 100)} percent — click to fit`} onClick={() => useEditor.setState({ fitTick: fitTick + 1 })} className="hover:text-white tabular-nums">{Math.round(zoom * 100)}%</button>
      <button aria-label="Zoom in" onClick={() => setZoom(zoom + 0.1)} className="px-1.5 hover:text-white">+</button>
      <button onClick={() => useEditor.setState({ fitTick: fitTick + 1 })} className="hover:text-white">Fit</button>
      <span className="text-white/20">|</span>
      <span className="hidden md:inline-flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${activeProviderId === 'mock' ? 'bg-violet-400' : 'bg-emerald-400'}`} />
        {activeProviderId === 'mock' ? 'Mock AI' : 'Custom AI'}
      </span>
    </footer>
  );
}

export function WelcomeModal() {
  const forced = useEditor((s) => s.showWelcome);
  const [seen, setSeen] = useState(() => {
    try { return localStorage.getItem('gs-welcomed') === '1'; } catch { return true; }
  });
  if (!forced && seen) return null;
  const close = () => {
    try { localStorage.setItem('gs-welcomed', '1'); } catch { /* noop */ }
    setSeen(true);
    useEditor.setState({ showWelcome: false });
  };
  const steps: { icon: IconName; title: string; text: string }[] = [
    { icon: 'upload', title: '1 · Import', text: 'Drag & drop an image anywhere, or press Import. PNG, JPEG, WebP, SVG.' },
    { icon: 'select', title: '2 · Select', text: 'Press M and drag an area — or press S for AI Select to auto-detect the subject.' },
    { icon: 'sparkles', title: '3 · Describe & Generate', text: 'Type what should change and hit Generate. You get 4 variations.' },
    { icon: 'layers', title: '4 · Apply & Continue', text: 'Apply a result as its own layer. Everything is non-destructive — undo anytime.' },
  ];
  return (
    <Modal width="w-[min(560px,94vw)]" onClose={close}>
      <div className="p-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-sky-500 grid place-items-center text-white">
            <Icon name="sparkles" size={16} />
          </div>
          <h2 className="text-lg font-semibold tracking-tight">Welcome to Generative Studio</h2>
        </div>
        <p className="text-[13px] text-white/50 mb-4">A generative image editor: select anything, describe the change, keep editing.</p>
        <div className="grid sm:grid-cols-2 gap-2 mb-4">
          {steps.map((st) => (
            <div key={st.title} className="rounded-xl bg-white/[.03] border border-white/10 p-3">
              <div className="mb-1.5 text-violet-300"><Icon name={st.icon} size={19} /></div>
              <div className="text-[13px] font-medium mb-0.5">{st.title}</div>
              <div className="text-[12px] text-white/50 leading-snug">{st.text}</div>
            </div>
          ))}
        </div>
        <div className="text-[12px] text-white/50 rounded-lg bg-violet-500/10 border border-violet-500/30 p-2.5 mb-4">
          No API key needed to start — <b className="text-white/80">Mock (Demo)</b> generates instantly.
          Connect a real model later via <b className="text-white/80">AI → AI Provider Settings</b> (any OpenAI-compatible endpoint).
        </div>
        <div className="flex gap-2">
          <button onClick={close} className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium">Start creating</button>
          <button onClick={() => { close(); useEditor.setState({ showSettings: true }); }}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm">Connect AI provider</button>
        </div>
      </div>
    </Modal>
  );
}

const SHORTCUT_SECTIONS: { title: string; items: [string, string][] }[] = [
  {
    title: 'General',
    items: [
      ['⌘ / Ctrl + K', 'Command bar'],
      ['⌘ / Ctrl + Z', 'Undo'],
      ['⌘ / Ctrl + Shift + Z', 'Redo'],
      ['⌘ / Ctrl + S', 'Save to browser'],
      ['⌘ / Ctrl + E', 'Export…'],
      ['?', 'Keyboard shortcuts'],
      ['Esc', 'Close dialog / clear selection'],
      ['Delete', 'Delete active layer'],
    ],
  },
  {
    title: 'Tools',
    items: [
      ['V', 'Move'],
      ['M', 'Select area'],
      ['H', 'Pan'],
      ['S', 'AI Select'],
      ['G', 'Generative Fill'],
      ['R', 'Remove object'],
      ['W', 'Replace object'],
      ['D', 'Background'],
      ['X', 'Generative Expand'],
      ['Ctrl / ⌘ + scroll', 'Zoom · plain scroll to pan'],
    ],
  },
  {
    title: 'Layers',
    items: [
      ['[', 'Focus Layers panel'],
      ['Enter / double-click', 'Rename layer'],
      ['Ctrl + scroll on canvas', 'Zoom viewport'],
    ],
  },
];

export function ShortcutsModal() {
  const open = useEditor((s) => s.showShortcuts);
  if (!open) return null;
  return (
    <Modal width="w-[min(640px,94vw)]" onClose={() => useEditor.setState({ showShortcuts: false })}>
      <div className="p-5">
        <h2 className="flex items-center gap-2 font-semibold mb-4"><Icon name="command" size={16} className="text-white/60" /> Keyboard shortcuts</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {SHORTCUT_SECTIONS.map((sec) => (
            <div key={sec.title}>
              <div className="text-[11px] uppercase tracking-wide text-white/35 mb-1.5">{sec.title}</div>
              <dl className="space-y-1">
                {sec.items.map(([keys, desc]) => (
                  <div key={keys} className="flex items-center justify-between gap-2 text-[12px]">
                    <dt className="text-white/60 truncate">{desc}</dt>
                    <dd><kbd className="text-[10.5px] text-white/70 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 whitespace-nowrap">{keys}</kbd></dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
        <button onClick={() => useEditor.setState({ showShortcuts: false })}
          className="mt-5 w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm">Close</button>
      </div>
    </Modal>
  );
}

/** Transient toast (import/export/save errors). Auto-dismisses; timer cleaned up. */
export function Toast() {
  const toast = useEditor((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => useEditor.setState({ toast: undefined }), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  return (
    <div role="status" aria-live="polite"
      className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] max-w-[80vw] px-3.5 py-2 rounded-lg bg-[#141823] border border-white/15 text-[13px] text-white/85 shadow-2xl flex items-center gap-2">
      <Icon name="alert" size={14} className="text-amber-300 shrink-0" />
      <span className="truncate">{toast}</span>
    </div>
  );
}
