import type { AIOperationType } from '../types';
import type { IconName } from './icons';

export interface Tool {
  id: string; icon: IconName; label: string; hint: string;
  shortcut: string; ai?: AIOperationType;
}

/** Canvas basics that actually work. */
export const CORE_TOOLS: Tool[] = [
  { id: 'move', icon: 'move', label: 'Move', hint: 'Drag layers to reposition', shortcut: 'V' },
  { id: 'marquee', icon: 'select', label: 'Select', hint: 'Drag on canvas to select an area for AI', shortcut: 'M' },
  { id: 'hand', icon: 'hand', label: 'Pan', hint: 'Drag to pan · Ctrl+scroll to zoom', shortcut: 'H' },
];

/** Generative tools — every one is wired to the AI engine. */
export const AI_TOOLS: Tool[] = [
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

export const TOOL_SHORTCUTS: Record<string, string> = Object.fromEntries(ALL.map((t) => [t.shortcut.toLowerCase(), t.id]));
