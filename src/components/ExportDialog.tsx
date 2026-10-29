import { useState } from 'react';
import { useEditor } from '../state/store';
import { compositeLayers, downloadDataUrl } from '../services/persistence';
import { Modal } from './Overlays';
import { Icon } from './icons';

type Format = 'png' | 'jpeg' | 'webp';
const SCALES = [0.5, 1, 2] as const;
const EXPORT_MAX_DIM = 8192;

const FORMAT_INFO: Record<Format, string> = {
  png: 'Lossless, supports transparency',
  jpeg: 'Smaller files, white background (no alpha)',
  webp: 'Modern format, small files, supports transparency',
};

/** Export presets: format × scale × quality, with output-size preview. */
export default function ExportDialog() {
  const open = useEditor((s) => s.showExport);
  const canvasWidth = useEditor((s) => s.canvasWidth);
  const canvasHeight = useEditor((s) => s.canvasHeight);
  const hasLayers = useEditor((s) => s.layers.length > 0);
  const [format, setFormat] = useState<Format>('png');
  const [scale, setScale] = useState<(typeof SCALES)[number]>(1);
  const [quality, setQuality] = useState(92);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!open) return null;
  // compositeLayers clamps to 8192 — mirror it so the preview is accurate
  const outW = Math.min(EXPORT_MAX_DIM, Math.max(1, Math.round(canvasWidth * scale)));
  const outH = Math.min(EXPORT_MAX_DIM, Math.max(1, Math.round(canvasHeight * scale)));

  const doExport = async () => {
    setBusy(true); setErr('');
    try {
      const st = useEditor.getState();
      if (!st.layers.length) throw new Error('Nothing to export — the canvas has no layers');
      const url = await compositeLayers(st.layers, outW, outH, format, quality / 100);
      downloadDataUrl(url, `${st.projectName || 'Untitled Project'}.${format}`);
      useEditor.setState({ showExport: false });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal width="w-[min(460px,94vw)]" labelledBy="export-title" onClose={() => useEditor.setState({ showExport: false })}>
      <div className="p-5">
        <h2 id="export-title" className="flex items-center gap-2 font-semibold mb-4"><Icon name="download" size={16} className="text-white/60" /> Export image</h2>

        <div className="text-[12px] text-white/60 mb-1">Format</div>
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {(['png', 'jpeg', 'webp'] as Format[]).map((f) => (
            <button key={f} onClick={() => setFormat(f)} aria-pressed={format === f}
              className={`py-2 rounded-lg text-[13px] uppercase border transition-colors ${format === f
                ? 'bg-violet-600/25 border-violet-500/60 text-violet-100'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70'}`}>
              {f.toUpperCase()}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-white/40 mb-3">{FORMAT_INFO[format]}</p>

        <div className="text-[12px] text-white/60 mb-1">Scale</div>
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {SCALES.map((sc) => (
            <button key={sc} onClick={() => setScale(sc)} aria-pressed={scale === sc}
              className={`py-2 rounded-lg border text-[13px] transition-colors ${scale === sc
                ? 'bg-violet-600/25 border-violet-500/60 text-violet-100'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70'}`}>
              {sc}×
            </button>
          ))}
        </div>

        {format !== 'png' && (
          <label className="flex items-center gap-3 text-[12px] text-white/60 mb-3">Quality
            <input type="range" min={30} max={100} value={quality} className="gs-range flex-1"
              onChange={(e) => setQuality(Number(e.target.value))} aria-label="Export quality" />
            <span className="w-8 text-right tabular-nums">{quality}</span>
          </label>
        )}

        <div className="flex items-center justify-between text-[12px] text-white/50 mb-4 px-2.5 py-2 rounded-lg bg-white/[.03] border border-white/10">
          <span className="tabular-nums">{outW} × {outH} px</span>
          {outW >= EXPORT_MAX_DIM || outH >= EXPORT_MAX_DIM
            ? <span className="text-amber-300/80 text-[11px]">clamped to 8192 px max</span>
            : <span className="text-white/40">from {Math.round(canvasWidth)} × {Math.round(canvasHeight)} px</span>}
        </div>

        {err && <div role="alert" className="text-[12px] mb-2 px-2.5 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300">{err}</div>}

        <div className="flex gap-2">
          <button onClick={() => void doExport()} disabled={busy || !hasLayers}
            className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-sm font-medium">
            {busy ? 'Exporting…' : `Export ${format.toUpperCase()}`}
          </button>
          <button onClick={() => useEditor.setState({ showExport: false })}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm">Close</button>
        </div>
      </div>
    </Modal>
  );
}
