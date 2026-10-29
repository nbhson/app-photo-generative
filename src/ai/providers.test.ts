import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAICompatibleProvider } from './providers';

const provider = new OpenAICompatibleProvider({ baseUrl: 'https://api.example.com/v1/', apiKey: 'k', model: 'm', name: 'Test' });

describe('OpenAICompatibleProvider', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts to <baseUrl>/images/generations with bearer auth', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ b64_json: 'AAAA' }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const out = await provider.generate({ prompt: 'p', type: 'GENERATIVE_FILL', width: 512, height: 512 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/v1/images/generations'); // slash cuối đã strip
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer k');
    expect(JSON.parse(String(init.body)).model).toBe('m');
    expect(out.images[0].src).toBe('data:image/png;base64,AAAA');
  });

  it('throws a descriptive error on non-OK responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('rate limited', { status: 429 })));
    await expect(provider.generate({ prompt: 'x', type: 'UPSCALE', width: 10, height: 10 }))
      .rejects.toThrow(/Provider error 429|429/);
  });

  it('rejects when the provider returns no images', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 })));
    await expect(provider.generate({ prompt: 'p', type: 'VARIATION', width: 10, height: 10 }))
      .rejects.toThrow('Provider returned no images');
  });

  it('maps url responses too (không chỉ b64_json)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ data: [{ url: 'https://cdn.example.com/img.png' }] }), { status: 200 })));
    const out = await provider.generate({ prompt: 'p', type: 'VARIATION', width: 10, height: 10 });
    expect(out.images[0].src).toBe('https://cdn.example.com/img.png');
  });

  it('provider id/displayName derive from config', () => {
    expect(provider.id).toBe('custom-Test');
    expect(provider.displayName).toBe('Test');
  });
});
