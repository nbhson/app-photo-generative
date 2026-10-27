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
  applyEnvProvider();
  useEditor.subscribe((s, prev) => {
    if (s.customProviders !== prev.customProviders || s.activeProviderId !== prev.activeProviderId) {
      persistProviders();
    }
  });
}

const ENV_PROVIDER_ID = 'env-provider';

/**
 * Register a custom provider from build-time env vars so API keys can come from
 * the environment instead of being entered in the UI (which persists to localStorage):
 *   VITE_AI_BASE_URL — OpenAI-compatible base URL, e.g. https://api.openai.com/v1
 *   VITE_AI_MODEL    — image model name
 *   VITE_AI_API_KEY  — API key (optional; omit for keyless/local endpoints)
 */
function applyEnvProvider() {
  const env = import.meta.env as Record<string, string | undefined>;
  const baseUrl = env.VITE_AI_BASE_URL?.trim();
  const model = env.VITE_AI_MODEL?.trim();
  if (!baseUrl || !model) return;
  const st = useEditor.getState();
  if (st.customProviders.some((c) => c.id === ENV_PROVIDER_ID)) return;
  useEditor.setState({
    customProviders: [
      ...st.customProviders,
      { id: ENV_PROVIDER_ID, name: 'Configured (env)', baseUrl, apiKey: env.VITE_AI_API_KEY ?? '', model, apiType: 'openai-compatible' },
    ],
    activeProviderId: st.activeProviderId === 'mock' ? ENV_PROVIDER_ID : st.activeProviderId,
  });
}
