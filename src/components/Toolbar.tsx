import { useState } from 'react';
import { useEditor } from '../state/store';
import { smartSelectSubject } from '../ai/runGeneration';
import { Icon, type IconName } from './icons';
import type { AIOperationType } from '../types';

interface Tool {
  id: string; icon: IconName; label: string; hint: string;
  shortcut: string; ai?: AIOperationType;
}

/** Canvas basics that actually work. */
const CORE_TOOLS: Tool[] = [
  { id: 'move', icon: 'move', label: 'Move', hint: 'Drag layers to reposition', shortcut: 'V' },
  { id: 'marquee', icon: 'select', label: 'Select', hint: 'Drag on canvas to select an area for AI', shortcut: 'M' },
  { id: 'hand', icon: 'hand', label: 'Pan', hint: 'Drag to pan · Ctrl+scroll to zoom', shortcut: 'H' },
];

/** Generative tools — every one is wired to the AI engine. */
const AI_TOOLS: Tool[] = [
  { id: 'ai-select', icon: 'sparkles', label: 'AI Select', hint: 'Auto-detect and select the main subject', shortcut: 'S' },
  { id: 'generative-fill', icon: 'fill', label: 'Generative Fill', hint: 'Select area, describe, generate', shortcut: 'G', ai: 'GENERATIVE_FILL' },
  { id: 'remove-object', icon: 'eraser', label: 'Remove', hint: 'Select an object to erase it', shortcut: 'R', ai: 'REMOVE_OBJECT' },
  { id: 'replace-object', icon: 'replace', label: 'Replace', hint: 'Select an object, describe its replacement', shortcut: 'W', ai: 'REPLACE_OBJECT' },
  { id: 'background-gen', icon: 'image', label: 'Background', hint: 'Generate a new background', shortcut: 'D', ai: 'BACKGROUND_GENERATION' },
  { id: 'generative-expand', icon: 'expand', label: 'Expand', hint: 'Outpaint beyond the canvas edges', shortcut: 'X', ai: 'GENERATIVE_EXPAND' },
];

const ALL = [...CORE_TOOLS, ...AI_TOOLS];

export const TOOL_META: Record<string, { label: string; hint: string }> = Object.fromEntries(
  ALL.map((t) => [t.id, { label: t.label, hint: t.hint }]),
);

export default function Toolbar() {
  const tool = useEditor((s) => s.tool);
  const analyzing = useEditor((s) => s.analyzing);
  const [notice, setNotice] = useState('');

  const pick = async (t: Tool) => {
    if (t.id === 'ai-select') {
      useEditor.setState({ tool: t.id, rightTab: 'ai' });
      setNotice('');
      const ok = await smartSelectSubject();
      if (!ok) {
        setNotice('Import an image first');
        setTimeout(() => setNotice(''), 2500);
      }
      return;
    }
    useEditor.setState({
      tool: t.id,
      aiMode: t.ai ?? useEditor.getState().aiMode,
      rightTab: t.ai ? 'ai' : useEditor.getState().rightTab,
    });
  };

  const btn = (t: Tool, isAI: boolean) => {
    const active = tool === t.id;
    return (
      <button
        key={t.id}
        title={`${t.label} (${t.shortcut}) — ${t.hint}`}
        onClick={() => pick(t)}
        className={`w-9 h-9 grid place-items-center rounded-lg transition-all
          ${active
            ? 'bg-violet-600 text-white shadow-[0_0_12px_rgba(124,92,255,.45)]'
            : 'text-white/55 hover:bg-white/10 hover:text-white'}
          ${isAI && !active ? 'text-violet-300/75' : ''}`}>
        {t.id === 'ai-select' && analyzing
          ? <span className="w-3.5 h-3.5 rounded-full border-2 border-violet-300/40 border-t-violet-200 animate-spin" />
          : <Icon name={t.icon} size={17} />}
      </button>
    );
  };

  return (
    <>
      <aside className="w-12 shrink-0 bg-[#10131a] border-r border-white/10 flex flex-col items-center py-2 gap-0.5 overflow-y-auto gs-scroll">
        {CORE_TOOLS.map((t) => btn(t, false))}
        <div className="w-8 h-px bg-violet-500/40 my-1.5" title="Generative AI tools" />
        {AI_TOOLS.map((t) => btn(t, true))}
      </aside>
      {notice && (
        <div className="fixed left-14 bottom-10 z-40 px-3 py-1.5 rounded-lg bg-[#141823] border border-white/15 text-[12px] shadow-xl">
          {notice}
        </div>
      )}
    </>
  );
}

export const TOOL_SHORTCUTS: Record<string, string> = Object.fromEntries(ALL.map((t) => [t.shortcut.toLowerCase(), t.id]));
