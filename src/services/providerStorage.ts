import { useEditor } from '../state/store';
import type { CustomProviderConfig } from '../types';

const KEY = 'gs-ai-providers-v1';

function valid(c: unknown): c is CustomProviderConfig {
  if (!c || typeof c !== 'object') return false;
  const o = c as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.name === 'string'
    && typeof o.baseUrl === 'string' && typeof o.model === 'string'
    && typeof o.apiKey === 'string';
}

export function persistProviders() {
  try {
    const s = useEditor.getState();
    localStorage.setItem(KEY, JSON.stringify({
      customProviders: s.customProviders,
      activeProviderId: s.activeProviderId,
    }));
  } catch { /* private mode / quota — non-fatal */ }
}

/** Hydrate saved providers, then persist on every change. Call once at startup. */
export function initProviderPersistence() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const j = JSON.parse(raw) as { customProviders?: unknown; activeProviderId?: unknown };
      const list = Array.isArray(j.customProviders) ? j.customProviders.filter(valid) : [];
      const active = typeof j.activeProviderId === 'string' ? j.activeProviderId : 'mock';
      useEditor.setState({
        customProviders: list,
        activeProviderId: active === 'mock' || list.some((c) => c.id === active) ? active : 'mock',
      });
    }
  } catch { /* corrupted entry — start fresh */ }
  useEditor.subscribe((s, prev) => {
    if (s.customProviders !== prev.customProviders || s.activeProviderId !== prev.activeProviderId) {
      persistProviders();
    }
  });
}
