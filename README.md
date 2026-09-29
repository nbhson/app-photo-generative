# Generative Studio

A desktop-first, AI-powered image editor focused on **generative editing** — not a Photoshop clone.
Import an image, select an area, describe the change, pick from AI variations, and keep
editing non-destructively.

```
Import → Select → Prompt → Generate (4 variations) → Apply as layer → Undo / Export
```

## Features

- **Generative workflow** — Generative Fill, Remove Object, Replace Object, Background
  Generation, Generative Expand, AI Retouch, AI Upscale
- **AI command bar** (`Cmd/Ctrl + K`) with natural-language intent parsing
- **Smart selection** — one-click AI subject detection, click-to-select regions
- **Non-destructive layers** — every AI result lands on its own layer; full undo/redo + visual history
- **Before/after compare**, generation queue with live progress, variation regeneration
- **Prompt assistant** — one-click enhance (realistic, cinematic, product, editorial, artistic)
- **Pluggable AI providers** — `MockAIProvider` (zero setup, works offline) or any
  OpenAI-compatible endpoint, configured in-app with connection testing
- **Project files** (`.gstudio`), IndexedDB autosave, PNG / JPEG / WebP export

## Quickstart

```bash
npm install
npm run dev      # open the printed localhost URL
npm run build    # type-check + production build (dist/)
```

Requires Node 18+. No API key needed — the Mock provider generates instantly.

## Using a real AI model

1. Open **AI → AI Provider Settings** (or the link in the AI panel).
2. Fill in **Provider Name**, **Base URL** (e.g. `https://api.openai.com/v1`),
   **API Key**, **Model** (must be an image model, e.g. `gpt-image-1`), API Type.
3. Press **Test connection**, then **Save & use provider** — it becomes active immediately.
4. Generate. Requests go to `POST {baseUrl}/images/generations`.

> Custom providers persist in the browser's `localStorage` (key `gs-ai-providers-v1`),
> so they survive reloads. Demo note: the key is stored only in your browser — only use
> keys you can rotate. Production apps should call AI from a backend
> (`Browser → your API → provider`) so keys and billing stay server-side.

## Keyboard shortcuts

| Keys | Action |
|---|---|
| `V` / `M` / `H` | Move / Select / Pan |
| `S` `G` `R` `W` `D` `X` | AI Select, Fill, Remove, Replace, Background, Expand |
| `Cmd/Ctrl + K` | AI command bar |
| `Cmd/Ctrl + Z` / `+ Shift + Z` | Undo / Redo |
| `Cmd/Ctrl + S` | Save (browser) |
| `Delete` | Delete active layer |
| `Esc` | Close dialog / clear selection |

## Architecture

```
src/
├── components/   # TopBar, Toolbar, CanvasStage, RightPanel, Overlays, icons
├── ai/           # AIProvider abstraction, Mock + OpenAI-compatible providers,
│                 # generation queue runner (runGeneration.ts)
├── editor/…      # (folded into state/) commands-as-history, selection model
├── state/        # Zustand store: editor state · UI state · AI state (separated)
├── services/     # IndexedDB persistence, layer compositing, export
├── workers/      # (reserved) off-main-thread image work
└── types/        # Layer, AIOperation, GenerationResult, HistoryEntry, …
```

Key design decisions:

- **Provider abstraction** — the UI only talks to `AIProvider.generate()`. Swapping
  models/vendors means adding a class, not touching the editor.
- **Non-destructive by construction** — AI results are always new layers; history stores
  layer snapshots so every operation (including AI) is reversible.
- **No render storms** — Konva canvas lives outside React render flow; Zustand selectors
  stay referentially stable (derive with `useMemo`, never `.filter()` in a selector).

## Project format (`.gstudio`)

```json
{ "version": "1.0", "document": {}, "layers": [], "operations": [], "history": [] }
```

## Roadmap

- [ ] Real mask painting (lasso/brush) on selection layer
- [ ] PSD / SVG / PDF export targets
- [ ] Backend proxy reference implementation for provider keys
- [ ] Web Worker + OffscreenCanvas compositing for very large images
