import { useEffect, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { useEditor, parseIntent } from '../state/store';
import { runGeneration } from '../ai/runGeneration';
import { Icon, type IconName } from './icons';

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
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (open) { setText(''); setErr(''); } }, [open ]);
  if (!open) return null;
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
    <div className="fixed inset-0 z-50 grid place-items-start pt-28 bg-black/60 backdrop-blur-[2px]"
      onClick={() => useEditor.setState({ showCommandBar: false })}>
      <div className="w-[min(620px,92vw)] bg-[#141823] border border-white/15 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
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
      </div>
    </div>
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60" onClick={() => useEditor.setState({ showSettings: false })}>
      <div className="w-[min(520px,92vw)] bg-[#141823] border border-white/15 rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
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
        <label className="block text-[12px] text-white/60 mb-3">API Type
          <select className="mt-1 w-full bg-[#1a1f2b] rounded-lg px-2.5 py-2 text-[13px]"><option>OpenAI Compatible</option></select>
        </label>
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
        <p className="text-[11px] text-white/35 mt-2 leading-snug">Demo note: the key is stored only in this browser. A production app should call AI from a backend (Browser → your API → provider) so keys and billing stay server-side.</p>
        {customs.length > 0 && (
          <div className="mt-3 text-[12px] space-y-1">
            {customs.map((c) => (
              <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/[.04] border border-white/10">
                <span className="flex-1 truncate">{c.name} · <span className="text-white/40">{c.model}</span></span>
                <button title="Use this provider" className="text-white/50 hover:text-white transition-colors" onClick={() => useEditor.setState({ activeProviderId: c.id, showSettings: false })}>
                  <Icon name="check" size={14} />
                </button>
                <button title="Remove provider" className="text-red-400/70 hover:text-red-300 transition-colors" onClick={() => useEditor.setState({ customProviders: customs.filter((x) => x.id !== c.id) })}>
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function StatusBar() {
  const s = useEditor();
  const setZoom = (z: number) => {
    const nz = Math.max(0.05, Math.min(8, z));
    useEditor.setState({ zoom: nz });
  };
  return (
    <footer className="h-7 shrink-0 flex items-center gap-3 px-3 bg-[#10131a] border-t border-white/10 text-[11px] text-white/50">
      <span>{Math.round(s.canvasWidth)} × {Math.round(s.canvasHeight)} px</span>
      <span className="text-white/20">|</span>
      <span>{s.layers.filter((l) => l.visible).length}/{s.layers.length} layers</span>
      {s.selection && <span className="text-violet-300">▭ {Math.round(s.selection.width)}×{Math.round(s.selection.height)} @ {Math.round(s.selection.x)},{Math.round(s.selection.y)}</span>}
      <div className="flex-1" />
      <button onClick={() => setZoom(s.zoom - 0.1)} className="px-1.5 hover:text-white">−</button>
      <button onClick={() => useEditor.setState({ fitTick: s.fitTick + 1 })} className="hover:text-white tabular-nums">{Math.round(s.zoom * 100)}%</button>
      <button onClick={() => setZoom(s.zoom + 0.1)} className="px-1.5 hover:text-white">+</button>
      <button onClick={() => useEditor.setState({ fitTick: s.fitTick + 1 })} className="hover:text-white">Fit</button>
      <span className="text-white/20">|</span>
      <span className="hidden md:inline-flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${s.activeProviderId === 'mock' ? 'bg-violet-400' : 'bg-emerald-400'}`} />
        {s.activeProviderId === 'mock' ? 'Mock AI' : 'Custom AI'}
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4" onClick={close}>
      <div className="w-[min(560px,94vw)] bg-[#141823] border border-white/15 rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
    </div>
  );
}
