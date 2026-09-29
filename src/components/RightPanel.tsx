import { useMemo, useState } from 'react';
import { useEditor, enhancePrompt } from '../state/store';
import { runAIAction, runGeneration, acceptResult, mockAnalyze } from '../ai/runGeneration';
import { Icon, type IconName } from './icons';
import type { AIOperationType } from '../types';

const TABS = [
  { id: 'layers', label: 'Layers', icon: 'layers' },
  { id: 'ai', label: 'AI', icon: 'sparkles' },
  { id: 'adjust', label: 'Adjust', icon: 'sliders' },
  { id: 'history', label: 'History', icon: 'history' },
] as const;

const AI_ACTIONS: { type: AIOperationType; label: string; desc: string; icon: IconName }[] = [
  { type: 'GENERATIVE_FILL', label: 'Generative Fill', desc: 'Fill selection from prompt', icon: 'fill' },
  { type: 'REMOVE_OBJECT', label: 'Remove Object', desc: 'Erase & reconstruct background', icon: 'eraser' },
  { type: 'REPLACE_OBJECT', label: 'Replace Object', desc: 'Swap selection, keep perspective', icon: 'replace' },
  { type: 'BACKGROUND_GENERATION', label: 'Generate Background', desc: 'New scene behind subject', icon: 'image' },
  { type: 'GENERATIVE_EXPAND', label: 'Generative Expand', desc: 'Outpaint beyond canvas', icon: 'expand' },
  { type: 'RETOUCH', label: 'AI Retouch', desc: 'Skin, light, detail', icon: 'sparkles' },
  { type: 'UPSCALE', label: 'AI Upscale', desc: 'Enhance & sharpen', icon: 'zoomIn' },
];

export default function RightPanel() {
  const tab = useEditor((s) => s.rightTab);
  return (
    <aside className="w-72 shrink-0 bg-[#10131a] border-l border-white/10 flex flex-col min-h-0">
      <div className="flex gap-1 p-2 border-b border-white/10">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => useEditor.setState({ rightTab: t.id as never })}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 text-[12px] py-1.5 rounded-md transition-colors ${tab === t.id ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'}`}>
            <Icon name={t.icon} size={13} className={t.id === 'ai' && tab !== 'ai' ? 'text-violet-300/70' : ''} />
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto gs-scroll min-h-0">
        {tab === 'layers' && <LayersTab />}
        {tab === 'ai' && <AITab />}
        {tab === 'adjust' && <AdjustTab />}
        {tab === 'history' && <HistoryTab />}
      </div>
    </aside>
  );
}

function LayersTab() {
  const layers = useEditor((s) => s.layers);
  const active = useEditor((s) => s.activeLayerId);
  const st = useEditor.getState();
  const [rename, setRename] = useState<string | null>(null);
  const rev = [...layers].reverse();
  return (
    <div className="p-2">
      <div className="flex gap-1 mb-2">
        <button onClick={() => { st.addLayer({ name: 'New layer' }); st.pushHistory('New layer'); }}
          className="flex-1 inline-flex items-center justify-center gap-1.5 text-[12px] py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors">
          <Icon name="plus" size={13} /> New layer</button>
      </div>
      {rev.map((l) => (
        <div key={l.id} onClick={() => useEditor.setState({ activeLayerId: l.id })}
          className={`group flex items-center gap-2 p-1.5 rounded-lg cursor-pointer border ${active === l.id ? 'bg-violet-600/15 border-violet-500/50' : 'border-transparent hover:bg-white/5'}`}>
          <div className="w-10 h-10 rounded bg-check shrink-0 overflow-hidden border border-white/10 grid place-items-center text-[10px] text-white/40">
            {l.imageSrc ? <img src={l.imageSrc} className="w-full h-full object-cover" alt="" /> : '—'}
          </div>
          <div className="flex-1 min-w-0">
            {rename === l.id ? (
              <input autoFocus defaultValue={l.name} onBlur={(e) => { st.updateLayer(l.id, { name: e.target.value }); setRename(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} className="w-full bg-white/10 rounded px-1 text-[12px] outline-none" />
            ) : (
              <div className="text-[12px] truncate" onDoubleClick={() => setRename(l.id)} title="Double-click to rename">
                {l.name}
                {l.isAI && (
                  <span className="inline-flex items-center gap-0.5 ml-1.5 px-1 py-px rounded bg-violet-500/25 text-violet-200 text-[9px] font-semibold tracking-wide align-middle">
                    <Icon name="sparkles" size={9} />AI
                  </span>
                )}
              </div>
            )}
            <div className="text-[10px] text-white/35">{l.type} · {Math.round(l.opacity * 100)}%</div>
          </div>
          <button title={l.visible ? 'Hide layer' : 'Show layer'} onClick={(e) => { e.stopPropagation(); st.updateLayer(l.id, { visible: !l.visible }); }}
            className="p-1 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors">
            <Icon name={l.visible ? 'eye' : 'eyeOff'} size={14} />
          </button>
          <button title={l.locked ? 'Unlock layer' : 'Lock layer'} onClick={(e) => { e.stopPropagation(); st.updateLayer(l.id, { locked: !l.locked }); }}
            className="p-1 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors">
            <Icon name={l.locked ? 'lock' : 'unlock'} size={14} />
          </button>
        </div>
      ))}
      {active && <LayerProps id={active} />}
      {layers.length === 0 && <p className="text-[12px] text-white/35 text-center mt-6">No layers yet.<br />Import an image to begin.</p>}
    </div>
  );
}

function LayerProps({ id }: { id: string }) {
  const l = useEditor((s) => s.layers.find((x) => x.id === id));
  if (!l) return null;
  const st = useEditor.getState();
  return (
    <div className="mt-2 p-2 rounded-lg bg-white/[.03] border border-white/10 text-[12px] space-y-2">
      <div className="font-medium text-white/70">Properties</div>
      <label className="flex items-center gap-2">Opacity
        <input type="range" min={0} max={100} value={Math.round(l.opacity * 100)} className="gs-range flex-1"
          onChange={(e) => st.updateLayer(id, { opacity: Number(e.target.value) / 100 })} />
        <span className="w-8 text-right">{Math.round(l.opacity * 100)}</span>
      </label>
      <label className="flex items-center gap-2">Blend
        <select value={l.blendMode} onChange={(e) => st.updateLayer(id, { blendMode: e.target.value as never })}
          className="flex-1 bg-[#1a1f2b] rounded px-1 py-1 text-[12px]">
          {['normal','multiply','screen','overlay','darken','lighten','soft-light','difference'].map((b) => (
            <option key={b} value={b}>{b}</option>))}
        </select>
      </label>
      <div className="flex gap-1">
        <button onClick={() => st.duplicateLayer(id)} className="flex-1 inline-flex items-center justify-center gap-1 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors">
          <Icon name="copy" size={12} /> Duplicate</button>
        <button onClick={() => st.deleteLayer(id)} className="flex-1 inline-flex items-center justify-center gap-1 py-1 rounded-md bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 transition-colors">
          <Icon name="trash" size={12} /> Delete</button>
      </div>
    </div>
  );
}

function AITab() {
  const s = useEditor();
  const [busy, setBusy] = useState<AIOperationType | null>(null);
  const [err, setErr] = useState('');
  const go = async (t: AIOperationType) => {
    setBusy(t); setErr('');
    try { await runAIAction(t); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Generation failed'); }
    finally { setBusy(null); }
  };
  const jobs = Object.entries(s.jobs).slice(-4).reverse();
  return (
    <div className="p-3 space-y-3 text-[13px]">
      <div>
        <div className="text-[12px] text-white/60 mb-1">Prompt</div>
        <textarea value={s.promptText} rows={3}
          onChange={(e) => useEditor.setState({ promptText: e.target.value })}
          placeholder="Describe what you want to generate…"
          className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-[13px] outline-none focus:border-violet-500 placeholder:text-white/30" />
        <div className="flex flex-wrap gap-1 mt-1.5">
          {['realistic', 'cinematic', 'product', 'editorial', 'artistic', 'detailed'].map((k) => (
            <button key={k} title="Improve prompt"
              onClick={() => useEditor.setState({ promptText: enhancePrompt(s.promptText, k) })}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-white/5 hover:bg-violet-600/40 border border-white/10 transition-colors"><Icon name="sparkles" size={10} /> {k}</button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        {AI_ACTIONS.map((a) => (
          <button key={a.type} onClick={() => go(a.type)} disabled={busy !== null}
            className="w-full text-left px-2.5 py-2 rounded-lg bg-white/[.04] hover:bg-violet-600/20 border border-white/10 hover:border-violet-500/50 disabled:opacity-50 transition-colors">
            <span className="flex items-center gap-2.5">
              <span className="w-7 h-7 grid place-items-center rounded-md bg-violet-500/15 text-violet-300 shrink-0">
                {busy === a.type
                  ? <span className="w-3.5 h-3.5 rounded-full border-2 border-violet-300/40 border-t-violet-200 animate-spin" />
                  : <Icon name={a.icon} size={15} />}
              </span>
              <span className="min-w-0">
                <span className="block font-medium truncate">{a.label}</span>
                <span className="block text-[11px] text-white/40 truncate">{a.desc}</span>
              </span>
            </span>
          </button>
        ))}
      </div>
      {err && <div className="text-red-400 text-[12px]">{err}</div>}
      {/* queue */}
      {jobs.length > 0 && (
        <div>
          <div className="text-[12px] text-white/60 mb-1">AI Tasks</div>
          {jobs.map(([id, j]) => (
            <div key={id} className="mb-1.5 text-[12px]">
              <div className="flex justify-between items-center gap-2">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${j.status === 'failed' ? 'bg-red-400' : j.status === 'done' ? 'bg-emerald-400' : 'bg-violet-400 gen-pulse'}`} />
                  <span className="truncate">{j.label}</span>
                </span>
                <span className="tabular-nums text-white/50">{Math.round(j.progress)}%</span>
              </div>
              <div className="h-1 rounded bg-white/10 overflow-hidden"><div className="h-full bg-violet-500 transition-all" style={{ width: `${j.progress}%` }} /></div>
              {j.error && <div className="text-red-400">{j.error}</div>}
            </div>
          ))}
        </div>
      )}
      <ResultsPanel />
      {/* analysis */}
      <div className="pt-1 border-t border-white/10">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[12px] text-white/60">Image analysis</span>
          <button onClick={mockAnalyze} className="text-[11px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10">
            {s.analyzing ? 'Analyzing…' : 'Analyze'}</button>
        </div>
        {s.detected.map((d) => (
          <button key={d.id} onClick={() => useEditor.getState().setSelection({ ...d.boundingBox })}
            className="flex items-center gap-1.5 w-full text-left text-[12px] px-2 py-1 rounded hover:bg-white/5 transition-colors">
            <Icon name="select" size={12} className="text-white/40 shrink-0" /> {d.label} <span className="text-white/35">{Math.round(d.confidence * 100)}%</span>
          </button>
        ))}
      </div>
      {/* model settings */}
      <div className="pt-1 border-t border-white/10 text-[12px] space-y-1.5">
        <div className="text-white/60">Model</div>
        <select value={s.activeProviderId} onChange={(e) => useEditor.setState({ activeProviderId: e.target.value })}
          className="w-full bg-[#1a1f2b] rounded px-2 py-1.5">
          <option value="mock">Mock (Demo) — no API needed</option>
          {s.customProviders.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.model}</option>)}
        </select>
        <label className="flex items-center gap-2">Variations
          <input type="number" min={1} max={8} value={s.variations}
            onChange={(e) => useEditor.setState({ variations: Math.max(1, Math.min(8, Number(e.target.value))) })}
            className="w-14 bg-white/5 border border-white/10 rounded px-1 py-0.5" /></label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={s.preserveStructure} onChange={(e) => useEditor.setState({ preserveStructure: e.target.checked })} /> Preserve structure</label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={s.preserveLighting} onChange={(e) => useEditor.setState({ preserveLighting: e.target.checked })} /> Preserve lighting</label>
        <button onClick={() => useEditor.setState({ showSettings: true })}
          className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-[12px] transition-colors">
          <Icon name="sliders" size={13} /> AI provider settings…</button>
        <p className="text-[11px] text-white/40 leading-snug">
          {s.activeProviderId === 'mock'
            ? <>Using <b className="text-white/70">Mock (Demo)</b> — full workflow, zero setup. </>
            : <>Using your custom provider. </>}
          <button onClick={() => useEditor.setState({ showSettings: true })}
            className="underline text-violet-300/90 hover:text-violet-200">How to connect a real model →</button>
        </p>
      </div>
    </div>
  );
}

function ResultsPanel() {
  const allResults = useEditor((s) => s.results);
  const results = useMemo(() => allResults.slice(-8).reverse(), [allResults]);
  const selected = useEditor((s) => s.selectedResultId);
  const compare = useEditor((s) => s.compareMode);
  const [regenBusy, setRegenBusy] = useState(false);
  if (!results.length) return null;
  const sel = results.find((r) => r.id === selected) ?? results[0];
  const op = useEditor.getState().operations.find((o) => o.id === sel.operationId);
  return (
    <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-2">
      <div className="flex items-center gap-1.5 text-[12px] font-medium mb-1 text-violet-200">
        <Icon name="sparkles" size={13} /> Generation results</div>
      <div className="text-[11px] text-white/45 mb-1.5 truncate">“{sel.prompt}”</div>
      <div className="grid grid-cols-2 gap-1.5">
        {results.map((r) => (
          <button key={r.id} onClick={() => useEditor.setState({ selectedResultId: r.id })}
            className={`rounded overflow-hidden border-2 ${selected === r.id || (!selected && r === results[0]) ? 'border-violet-500' : 'border-transparent'}`}>
            <img src={r.imageSrc} className="w-full aspect-square object-cover" alt="" />
          </button>
        ))}
      </div>
      <div className="flex gap-1 mt-2">
        <button onClick={() => acceptResult(sel.id)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-[12px] font-medium transition-colors">
          <Icon name="check" size={13} /> Apply as layer</button>
        <button title="Toggle before/after hint" onClick={() => useEditor.setState({ compareMode: !compare })}
          className={`px-2 py-1.5 rounded-md border text-[12px] transition-colors ${compare ? 'bg-violet-600/25 border-violet-500/50 text-violet-200' : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70'}`}>
          <Icon name="replace" size={13} />
        </button>
      </div>
      <button disabled={regenBusy} onClick={async () => {
        setRegenBusy(true);
        try { await runGeneration(op?.type ?? 'VARIATION', sel.prompt + ' — variation'); } finally { setRegenBusy(false); }
      }} className="w-full mt-1 inline-flex items-center justify-center gap-1 py-1 rounded-md text-[12px] bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 transition-colors">
        <Icon name="plus" size={12} /> {regenBusy ? 'Generating…' : 'Generate more variations'}
      </button>
      {compare && <p className="text-[11px] text-white/40 mt-1">Compare: toggle layer visibility to see before/after.</p>}
    </div>
  );
}

function AdjustTab() {
  const active = useEditor((s) => s.activeLayerId);
  const l = useEditor((s) => s.layers.find((x) => x.id === active));
  if (!l) return <p className="text-[12px] text-white/35 text-center mt-6">Select a layer to adjust.</p>;
  const rows: [string, keyof import('../types').AdjustmentState][] = [
    ['Exposure', 'exposure'], ['Brightness', 'brightness'], ['Contrast', 'contrast'],
    ['Temperature', 'temperature'], ['Tint', 'tint'], ['Saturation', 'saturation'],
    ['Vibrance', 'vibrance'], ['Sharpness', 'sharpness'], ['Blur', 'blur'],
  ];
  return (
    <div className="p-3 space-y-2.5 text-[12px]">
      <div className="text-white/60">Adjusting: <b className="text-white">{l.name}</b> (non-destructive)</div>
      {rows.map(([label, k]) => (
        <label key={k} className="flex items-center gap-2">
          <span className="w-20 text-white/60">{label}</span>
          <input type="range" min={-100} max={100} value={l.adjustments?.[k] ?? 0} className="gs-range flex-1"
            onChange={(e) => useEditor.getState().applyAdjustment(l.id, { [k]: Number(e.target.value) } as never)} />
          <span className="w-9 text-right tabular-nums">{l.adjustments?.[k] ?? 0}</span>
        </label>
      ))}
      <button onClick={() => useEditor.getState().applyAdjustment(l.id, {
        exposure: 0, brightness: 0, contrast: 0, highlights: 0, shadows: 0,
        temperature: 0, tint: 0, saturation: 0, vibrance: 0, sharpness: 0, blur: 0,
      })} className="w-full py-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10">Reset</button>
    </div>
  );
}

function HistoryTab() {
  const h = useEditor((s) => s.history);
  const idx = useEditor((s) => s.historyIndex);
  return (
    <div className="p-2">
      {[...h].reverse().map((e, ri) => {
        const i = h.length - 1 - ri;
        return (
          <button key={e.id} onClick={() => useEditor.setState({
            layers: JSON.parse(JSON.stringify(e.layersSnapshot)),
            canvasWidth: e.canvasSnapshot.width, canvasHeight: e.canvasSnapshot.height,
            historyIndex: i, saveStatus: 'unsaved' as const,
          })} className={`w-full text-left px-2 py-1.5 rounded-lg text-[12px] flex items-center gap-2 transition-colors ${i === idx ? 'bg-violet-600/20 text-white' : 'text-white/60 hover:bg-white/5'}`}>
            {e.operationId
              ? <Icon name="sparkles" size={11} className="text-violet-300 shrink-0" />
              : <span className="w-[11px] text-center text-white/25 shrink-0">•</span>}
            <span className="text-white/30 tabular-nums">{new Date(e.createdAt).toTimeString().slice(0, 5)}</span>
            <span className="truncate">{e.label}</span>
          </button>
        );
      })}
      {h.length === 0 && <p className="text-[12px] text-white/35 text-center mt-6">History is empty.</p>}
    </div>
  );
}
