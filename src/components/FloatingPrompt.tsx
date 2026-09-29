import { useState } from 'react';
import { useEditor } from '../state/store';
import type { AIOperationType } from '../types';
import { defaultPromptFor, runGeneration } from '../ai/runGeneration';
import { Icon } from './icons';

const PLACEHOLDERS: Partial<Record<string, string>> = {
  'generative-fill': 'Describe what to generate in the selection…',
  'remove-object': 'Describe what to remove…',
  'replace-object': 'Describe the replacement…',
  'background-gen': 'Describe the new background…',
  'generative-expand': 'Describe how to extend the scene…',
};

export default function FloatingPrompt() {
  const selection = useEditor((s) => s.selection)!;
  const tool = useEditor((s) => s.tool);
  const promptText = useEditor((s) => s.promptText);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const opType: AIOperationType =
    tool === 'remove-object' ? 'REMOVE_OBJECT'
    : tool === 'replace-object' ? 'REPLACE_OBJECT'
    : tool === 'background-gen' ? 'BACKGROUND_GENERATION'
    : tool === 'generative-expand' ? 'GENERATIVE_EXPAND' : 'GENERATIVE_FILL';

  const go = async () => {
    setBusy(true); setErr('');
    try {
      await runGeneration(opType, promptText || defaultPromptFor(opType));
      useEditor.setState({ promptText: '' });
    } catch (e) { setErr(e instanceof Error ? e.message : 'Generation failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="absolute left-1/2 -translate-x-1/2 bottom-6 z-20 w-[min(560px,90%)]">
      <div className="bg-[#141823]/95 backdrop-blur border border-violet-500/40 rounded-xl shadow-[0_8px_40px_rgba(0,0,0,.6)] p-3">
        <div className="flex items-center gap-1.5 text-[11px] text-violet-300 mb-1.5">
          <Icon name="sparkles" size={12} />
          <span className="font-medium tracking-wide uppercase">{opType.replace(/_/g, ' ')}</span>
          <span className="text-white/30">· {Math.round(selection.width)}×{Math.round(selection.height)}px selection</span>
          <button className="ml-auto text-white/40 hover:text-white transition-colors" onClick={() => useEditor.getState().setSelection(null)}>
            <Icon name="x" size={13} />
          </button>
        </div>
        <div className="flex gap-2">
          <input
            autoFocus
            value={promptText}
            onChange={(e) => useEditor.setState({ promptText: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') go(); if (e.key === 'Escape') useEditor.getState().setSelection(null); }}
            placeholder={PLACEHOLDERS[tool] ?? 'Describe what you want to generate…'}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500 placeholder:text-white/30"
          />
          <button onClick={go} disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium disabled:opacity-50 transition-colors">
            {busy
              ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              : <Icon name="sparkles" size={14} />}
            {busy ? 'Generating…' : 'Generate'}
          </button>
        </div>
        {err && <div className="text-[12px] text-red-400 mt-1.5">{err} <button className="underline" onClick={go}>Try again</button></div>}
      </div>
    </div>
  );
}
