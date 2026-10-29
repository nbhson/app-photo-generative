import { useEffect, useState } from 'react';
import { useEditor } from '../state/store';
import { Modal } from './Overlays';
import { Icon } from './icons';

const MAX_DIM = 8192;

const PRESETS: { label: string; w: number; h: number }[] = [
  { label: 'HD 1280×720', w: 1280, h: 720 },
  { label: 'FHD 1920×1080', w: 1920, h: 1080 },
  { label: 'Square 1080', w: 1080, h: 1080 },
  { label: 'Portrait 1080×1350', w: 1080, h: 1350 },
  { label: 'A4 300dpi 2480×3508', w: 2480, h: 3508 },
];

const clamp = (n: number) => Math.max(1, Math.min(MAX_DIM, Math.round(n) || 1));

/** Canvas Size dialog — resize document; layers giữ nguyên vị trí (Figma-style). */
export default function CanvasSizeDialog() {
  const open = useEditor((s) => s.showCanvasSize);
  const canvasWidth = useEditor((s) => s.canvasWidth);
  const canvasHeight = useEditor((s) => s.canvasHeight);
  const [w, setW] = useState('1280');
  const [h, setH] = useState('800');
  const [err, setErr] = useState('');

  // sync input mỗi lần mở — không kế thừa draft lần trước
  useEffect(() => {
    if (open) {
      setW(String(Math.round(canvasWidth)));
      setH(String(Math.round(canvasHeight)));
      setErr('');
    }
  }, [open, canvasWidth, canvasHeight]);

  if (!open) return null;
  const nw = clamp(Number(w));
  const nh = clamp(Number(h));
  const changed = nw !== Math.round(canvasWidth) || nh !== Math.round(canvasHeight);

  const apply = () => {
    if (!changed) { useEditor.setState({ showCanvasSize: false }); return; }
    useEditor.setState({
      canvasWidth: nw, canvasHeight: nh,
      // layer ngoài biên mới vẫn còn — user có thể kéo lại hoặc Fit
      dirty: true, saveStatus: 'unsaved',
      showCanvasSize: false,
      fitTick: useEditor.getState().fitTick + 1, // fit lại view sau resize
    });
    useEditor.getState().pushHistory(`Canvas ${nw}×${nh}`);
  };

  return (
    <Modal width="w-[min(420px,94vw)]" labelledBy="canvas-size-title" onClose={() => useEditor.setState({ showCanvasSize: false })}>
      <div className="p-5">
        <h2 id="canvas-size-title" className="flex items-center gap-2 font-semibold mb-4">
          <Icon name="expand" size={16} className="text-white/60" /> Canvas size</h2>

        <div className="flex items-center gap-2 mb-3">
          <label className="flex-1">
            <span className="block text-[12px] text-white/60 mb-1">Width (px)</span>
            <input type="number" min={1} max={MAX_DIM} value={w} aria-label="Canvas width in pixels"
              onChange={(e) => setW(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[13px] outline-none focus:border-violet-500 tabular-nums" />
          </label>
          <span className="text-white/30 mt-5">×</span>
          <label className="flex-1">
            <span className="block text-[12px] text-white/60 mb-1">Height (px)</span>
            <input type="number" min={1} max={MAX_DIM} value={h} aria-label="Canvas height in pixels"
              onChange={(e) => setH(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[13px] outline-none focus:border-violet-500 tabular-nums" />
          </label>
        </div>

        <div className="text-[12px] text-white/60 mb-1">Presets</div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {PRESETS.map((p) => (
            <button key={p.label} onClick={() => { setW(String(p.w)); setH(String(p.h)); }} aria-pressed={nw === p.w && nh === p.h}
              className="px-2 py-1 rounded-md text-[11.5px] bg-white/5 hover:bg-violet-600/25 border border-white/10 hover:border-violet-500/50 transition-colors">
              {p.label}
            </button>
          ))}
        </div>

        <p className="text-[11px] text-white/40 mb-3">
          Layers keep their position — content outside the new bounds stays in the document.
          {changed && <> New size: <b className="text-white/70 tabular-nums">{nw} × {nh} px</b>.</>}
        </p>

        {err && <div role="alert" className="text-[12px] mb-2 px-2.5 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300">{err}</div>}

        <div className="flex gap-2">
          <button onClick={apply} disabled={!changed}
            className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-sm font-medium">
            Apply{changed ? ` · ${nw}×${nh}` : ''}
          </button>
          <button onClick={() => useEditor.setState({ showCanvasSize: false })}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm">Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
