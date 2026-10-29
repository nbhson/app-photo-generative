import { useEffect, useRef, useState } from 'react';
import { useEditor } from '../state/store';
import { smartSelectSubject } from '../ai/runGeneration';
import { Icon } from './icons';
// tool lists + derived maps live in toolMeta.ts — file này chỉ export component
// (fast-refresh yêu cầu file component không export constant khác)
import { AI_TOOLS, CORE_TOOLS, type Tool } from './toolMeta';

export default function Toolbar() {
  const tool = useEditor((s) => s.tool);
  const analyzing = useEditor((s) => s.analyzing);
  const [notice, setNotice] = useState('');
  // timeout ref — cleanup khi unmount (trước đây setState sau unmount)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);

  const pick = async (t: Tool) => {
    if (t.id === 'ai-select') {
      useEditor.setState({ tool: t.id, rightTab: 'ai' });
      setNotice('');
      const ok = await smartSelectSubject();
      if (!ok) {
        setNotice('Import an image first');
        if (noticeTimer.current) clearTimeout(noticeTimer.current);
        noticeTimer.current = setTimeout(() => setNotice(''), 2500);
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
        aria-label={`${t.label} — ${t.hint}`}
        aria-pressed={active}
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
