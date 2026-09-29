import { useEffect, useRef, useState } from 'react';
import { Stage, Layer as KLayer, Image as KImage, Rect, Transformer } from 'react-konva';
import useImage from 'use-image';
import type Konva from 'konva';
import { useEditor } from '../state/store';
import type { Layer } from '../types';

const SELECTION_TOOLS = new Set(['marquee', 'generative-fill', 'remove-object', 'replace-object', 'ai-select']);

function LayerNode({ layer, draggable }: { layer: Layer; isActive: boolean; draggable: boolean }) {
  const [img] = useImage(layer.imageSrc ?? '', 'anonymous');
  if (!layer.visible || !img) return null;
  return (
    <KImage
      image={img} name={layer.id}
      x={layer.x} y={layer.y} width={layer.width} height={layer.height}
      opacity={layer.opacity}
      globalCompositeOperation={layer.blendMode === 'normal' ? 'source-over' : (layer.blendMode as never)}
      draggable={draggable && !layer.locked}
      onDragEnd={(e) => useEditor.getState().updateLayer(layer.id, { x: Math.round(e.target.x()), y: Math.round(e.target.y()) })}
      onClick={() => useEditor.setState({ activeLayerId: layer.id })}
      filters={[]}
    />
  );
}

export default function CanvasStage() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const drawing = useRef<{ x: number; y: number } | null>(null);
  const panning = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);

  const layers = useEditor((s) => s.layers);
  const selection = useEditor((s) => s.selection);
  const tool = useEditor((s) => s.tool);
  const zoom = useEditor((s) => s.zoom);
  const panX = useEditor((s) => s.panX);
  const panY = useEditor((s) => s.panY);
  const fitTick = useEditor((s) => s.fitTick);
  const canvasWidth = useEditor((s) => s.canvasWidth);
  const canvasHeight = useEditor((s) => s.canvasHeight);
  const activeLayerId = useEditor((s) => s.activeLayerId);

  useEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const fit = () => {
    const pad = 80;
    const z = Math.min((size.w - pad) / canvasWidth, (size.h - pad) / canvasHeight);
    useEditor.setState({
      zoom: Math.max(0.05, Math.min(4, z)),
      panX: (size.w - canvasWidth * z) / 2,
      panY: (size.h - canvasHeight * z) / 2,
    });
  };
  useEffect(() => { if (size.w > 0) fit(); }, [fitTick, canvasWidth, canvasHeight]); // eslint-disable-line
  useEffect(() => { fit(); }, []); // eslint-disable-line

  // transformer attach
  useEffect(() => {
    const tr = trRef.current; const stage = stageRef.current;
    if (!tr || !stage) return;
    // find by name
    const found = activeLayerId ? stage.findOne((n: Konva.Node) => n.name() === activeLayerId) : null;
    if (found && tool === 'move') tr.nodes([found as never]);
    else tr.nodes([]);
    tr.getLayer()?.batchDraw();
  });

  const toDoc = (px: number, py: number) => ({ x: (px - panX) / zoom, y: (py - panY) / zoom });

  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const st = stageRef.current!;
    const old = useEditor.getState().zoom;
    const dir = e.evt.deltaY > 0 ? -1 : 1;
    const nz = Math.max(0.05, Math.min(8, old * (dir > 0 ? 1.1 : 0.9)));
    const mouse = st.getPointerPosition()!;
    const nx = mouse.x - ((mouse.x - panX) / old) * nz;
    const ny = mouse.y - ((mouse.y - panY) / old) * nz;
    useEditor.setState({ zoom: nz, panX: nx, panY: ny });
  };

  const isSelectionTool = SELECTION_TOOLS.has(tool);
  const isPan = tool === 'hand';

  return (
    <div ref={wrapRef} className="relative flex-1 min-w-0 bg-[#08090d] overflow-hidden"
      style={{ backgroundImage: 'radial-gradient(#1a1f2b 1px, transparent 1px)', backgroundSize: '22px 22px' }}>
      {/* rulers */}
      <div className="absolute top-0 left-0 right-0 h-5 bg-[#10131a] border-b border-white/10 text-[9px] text-white/30 flex items-center px-8 z-10 select-none">
        {Math.round(canvasWidth)} px · {Math.round(zoom * 100)}%
      </div>
      <Stage
        ref={stageRef}
        width={size.w} height={size.h}
        scaleX={zoom} scaleY={zoom} x={panX} y={panY}
        onWheel={onWheel}
        onMouseDown={(e) => {
          const pos = e.target.getStage()!.getPointerPosition()!;
          if (isPan || e.evt.button === 1) { panning.current = { sx: pos.x, sy: pos.y, px: panX, py: panY }; return; }
          if (isSelectionTool) { const d = toDoc(pos.x, pos.y); drawing.current = d; setMarquee({ x: d.x, y: d.y, w: 0, h: 0 }); }
        }}
        onMouseMove={(e) => {
          const pos = e.target.getStage()!.getPointerPosition()!;
          if (panning.current) {
            useEditor.setState({ panX: panning.current.px + (pos.x - panning.current.sx), panY: panning.current.py + (pos.y - panning.current.sy) });
            return;
          }
          if (drawing.current) {
            const d = toDoc(pos.x, pos.y);
            const x0 = drawing.current.x, y0 = drawing.current.y;
            setMarquee({ x: Math.min(x0, d.x), y: Math.min(y0, d.y), w: Math.abs(d.x - x0), h: Math.abs(d.y - y0) });
          }
        }}
        onMouseUp={() => {
          panning.current = null;
          if (drawing.current && marquee && marquee.w > 8 && marquee.h > 8) {
            useEditor.getState().setSelection({
              x: Math.round(marquee.x), y: Math.round(marquee.y),
              width: Math.round(marquee.w), height: Math.round(marquee.h),
            });
          } else if (drawing.current) {
            // click (no drag) with AI Select = smart-select the subject
            if (tool === 'ai-select') { void smartSelectSubject(); }
            else useEditor.getState().setSelection(null);
          }
          drawing.current = null; setMarquee(null);
        }}
      >
        <KLayer>
          {/* completely empty canvas — no document paper at all; layers define the visuals */}
          {layers.map((l) => (
            <LayerNode key={l.id} layer={l} isActive={l.id === activeLayerId} draggable={tool === 'move'} />
          ))}
          {/* committed selection */}
          {selection && (
            <Rect x={selection.x} y={selection.y} width={selection.width} height={selection.height}
              stroke="#7c5cff" strokeWidth={1.5 / zoom} dash={[8 / zoom, 5 / zoom]}
              fill="rgba(124,92,255,0.08)" listening={false} />
          )}
          {/* live marquee */}
          {marquee && (
            <Rect x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h}
              stroke="#22d3ee" strokeWidth={1.5 / zoom} dash={[8 / zoom, 5 / zoom]}
              fill="rgba(34,211,238,0.10)" listening={false} />
          )}
          <Transformer ref={trRef} rotateEnabled enabledAnchors={['top-left','top-right','bottom-left','bottom-right','middle-left','middle-right','top-center','bottom-center']} />
        </KLayer>
      </Stage>

      {/* floating hint */}
      {!layers.length && (
        <EmptyState onFit={fit} />
      )}
      {/* selection floating AI bar */}
      {selection && layers.length > 0 && <FloatingPrompt />}
    </div>
  );
}

import FloatingPrompt from './FloatingPrompt';
import { smartSelectSubject } from '../ai/runGeneration';
import { Icon } from './icons';

function EmptyState({ onFit }: { onFit: () => void }) {
  void onFit;
  return (
    <div className="absolute inset-0 grid place-items-center pointer-events-none">
      <div className="text-center pointer-events-auto bg-[#10131a]/95 border border-white/10 rounded-2xl px-10 py-8 shadow-2xl max-w-sm">
        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-violet-500/25 to-sky-500/25 border border-white/10 grid place-items-center text-violet-300">
          <Icon name="image" size={22} />
        </div>
        <h2 className="text-lg font-semibold tracking-tight">Start your canvas</h2>
        <p className="text-[13px] text-white/50 mt-1">Import an image — then select an area, describe the change, and generate.</p>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('gs:import'))}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium transition-colors">
          <Icon name="upload" size={15} /> Import image
        </button>
        <p className="text-[11px] text-white/30 mt-3">or drag &amp; drop · PNG JPEG WebP SVG</p>
      </div>
    </div>
  );
}
