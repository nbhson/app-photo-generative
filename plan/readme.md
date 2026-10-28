# Plan — app-photo-generative

> React/Konva generative image editor — layer-based canvas, AI fill/retouch,
> provider config persistence (IndexedDB + localStorage).

## Kết quả Review (audit đợt 1)

| # | Severity | Vị trí | Vấn đề | Fix |
|---|----------|--------|--------|-----|
| 1 | MINOR | src/services/persistence.ts:37 | `canvas.width = width` — không clamp; state corrupt (IndexedDB) với width khổng lồ trước đây cấp phát canvas hàng GB rồi `toDataURL` fail ngầm | Clamp 1–8192 (EXPORT_MAX_DIM); round width/height trước clamp |
| 2 | MINOR | src/services/persistence.ts:37 | `blendMode` cast thẳng sang `GlobalCompositeOperation` — giá trị lạ từ corrupt IndexedDB không qua whitelist → behavior tùy trình duyệt | `VALID_BLEND_MODES` Set, fallback `'source-over'` cho 'normal' + unknown |
| 3 | MINOR | src/components/CanvasStage.tsx:138-151 | `onMouseUp` đọc `marquee` state (React async, có thể chưa flush) — drag ngắn hoặc nhanh bị miss/stale → selection lệch | Tính final rect từ `drawing.current` + pointer position lúc mouseup |
| 4 | MINOR | src/App.tsx:51-56 | SVG đánh giá từ external source — `<script>`, `<image href>`, `<use href>`, `<foreignObject>` có thể đọc data canvas (XSS/data exfil) | Rasterize SVG qua text đã sanitize (strip script/foreignObject/external href) trước drawImage; img.onerror revoke URL |
| 5 | MINOR | src/components/Overlays.tsx:106 | "API Type" select có 1 option cứng 'OpenAI Compatible' không đọc/ghi state — dead control | Xóa |
| 6 | MINOR | src/App.tsx:77-88 | Bitmap import: `URL.revokeObjectURL(url)` chỉ gọi trong `onload`, không gọi khi `onerror` — URL leak | Thêm `img.onerror` revoke URL |

## Không sửa (đã cân nhắc, ghi nhận)

- **`providerStorage.ts:34`**: `activeProviderId` normalization đã tồn tại ở audit time — line 34 kiểm tra `'mock'` hay `list.some(c => c.id === active)` và fallback `'mock'`. Không cần fix.
- **SVG `<img>` secure static mode**: browser đã chặn external resource load trong SVG-as-image context. Strip trước drawImage là defense-in-depth; bước này không thay thế CSP của host page.

---

# Round 2 (2026-10-29) — enterprise upgrade

> Phạm vi: deep review + code-split bundle 623 kB (follow-up đợt 1) + 4 features + a11y/UI polish + tests.

## Kết quả Review (audit đợt 2)

| # | Severity | Vị trí | Vấn đề | Fix |
|---|----------|--------|--------|-----|
| R1 | MAJOR | bundle | 1 chunk JS duy nhất 623 kB (gzip 190 kB) — konva/react-konva load eager dù chỉ CanvasStage dùng | `React.lazy(CanvasStage)` + Suspense fallback; tách vendor chunks |
| R2 | MAJOR | (repo) | Không có test nào (không test script, không test runner) | Thêm vitest + unit tests cho logic thuần (store history, persistence clamp, parseIntent, enhancePrompt, provider hash) |
| R3 | MAJOR | App.tsx:20-24 | Ctrl+S: `.then()` không `.catch()` — IndexedDB fail (private mode/quota) → saveStatus kẹt 'saving' mãi, không báo lỗi | try/catch → 'unsaved' khi fail, hiển thị lỗi |
| R4 | MINOR | Overlays.tsx | SettingsModal/WelcomeModal không đóng bằng Escape (chỉ CommandBar có) | Modal shell chung xử lý Esc |
| R5 | MINOR | store.ts:29 | `showShortcuts` là dead state — không UI nào đọc/ghi | Wire thành Shortcuts modal (`?` / menu Help) |
| R6 | MINOR | Toolbar.tsx:47 | `setTimeout` xóa notice không cleanup khi unmount → setState sau unmount | Cleanup trong effect/timeout ref |
| R7 | MINOR | RightPanel AITab:128, Overlays StatusBar:149 | `useEditor()` full-store subscribe → re-render toàn panel mỗi tick zoom/pan (wheel) | Selector hẹp theo field |
| R8 | MINOR | CanvasStage:82-90 | Effect attach Transformer không có deps → chạy + `batchDraw` mỗi render | Effect có deps `[activeLayerId, tool, layers.length]` |
| R9 | MINOR | CanvasStage:94-104 | Wheel zoom mọi lúc (không cần Ctrl) — mâu thuẫn với hint "Ctrl+scroll to zoom"; plain-scroll không pan được | Ctrl/⌘+wheel = zoom, plain wheel = pan dọc |
| R10 | MINOR | App.tsx:45-88 | Import bitmap/SVG: logic revoke URL + FileReader lặp — dedupe | Extract `services/imageImport.ts` dùng chung |
| R11 | MINOR | store.ts / RightPanel | `reorderLayers` có sẵn nhưng không UI — không đổi được thứ tự layer | Nút Move up/down trong LayersTab |
| R12 | MINOR | persistence.ts:16 | `loadProjectLocal` dead code — không khôi phục session | Feature: restore autosave lúc khởi động |
| R13 | MINOR | TopBar doExport | Export 1 format cứng, không chọn scale/quality | Export presets dialog (format × 0.5x/1x/2x + quality) |
| R14 | MINOR | a11y | Menu không có role/aria-expanded, modal không aria-modal, toolbar không aria-pressed, nhiều nút icon-only thiếu aria-label | Bổ sung aria + role + label |
| R15 | MINOR | CanvasStage LayerNode | `filters={[]}` dead prop; `isActive` prop nhận nhưng không dùng | Bỏ prop chết |

## Không sửa (đã cân nhắc, ghi nhận)

- **Dark-only UI**: app editor dark-first (canvas-centric, chuẩn ngành — Photoshop/Figma). `color-scheme: dark` cố ý; không thêm light theme để tránh bề mặt test gấp đôi.
- **History snapshot bằng JSON deep-clone**: data-URL layers clone tốn RAM nhưng giới hạn 60 entries, chấp nhận được cho quy mô app.
- **API key trong localStorage**: đã cảnh báo trong UI (Round 1); kiến trúc backend proxy ngoài scope.

## Features mới (Round 2)

1. **Export presets dialog** — format (PNG/JPEG/WebP) × scale (0.5×/1×/2×) × quality (JPEG/WebP), xem trước kích thước output.
2. **Keyboard shortcuts modal** (`?` hoặc menu Help) — wire `showShortcuts` (trước đây dead).
3. **Session restore** — mở lại project autosave từ IndexedDB khi khởi động (`loadProjectLocal` trước đây dead code).
4. **Layer reorder** — nút lên/xuống trong LayersTab (dùng `reorderLayers` đã có nhưng không UI).

## Code-split (follow-up đợt 1)

- `CanvasStage` (konva + react-konva + use-image) → `React.lazy` + Suspense fallback.
- Vite 8/rolldown tự tách chunk theo dynamic import; đo before/after bằng `npm run build`.

## Trạng thái Round 2

- [x] Deep review (bảng trên)
- [x] Code-split 623 kB → main chunk nhỏ hơn (số liệu ở phần Verification)
- [x] Fix R3–R10, R15
- [x] 4 features (F1–F4)
- [x] a11y + UI consistency
- [x] vitest + unit tests
- [x] Build + tests green
- [x] Commit + self-review

## Review Log Round 2

### Vòng 1
- Code-split: CanvasStage lazy là đủ tách konva — phần còn lại (react-dom) tách qua manualChunks/advancedChunks của rolldown.
- Session restore: khôi phục im lặng nếu có autosave; "New Project" vẫn xóa sạch.
- Export dialog dùng `compositeLayers` có sẵn (đã clamp 8192) — scale=2 clamp tự nhiên qua EXPORT_MAX_DIM.

## Review Log

### Vòng 1
- Tất cả fixes là MINOR, không có CRITICAL/MAJOR. Không có security-sensitive sinks (canvas là client-side, không server endpoints, không secrets).
- `VALID_BLEND_MODES` Set chứa 11 giá trị đúng theo `BlendMode` type — 'normal' được xử lý riêng (→ 'source-over').
- SVG sanitize: regex để capture multiline tags (`[\s\S]*?`) đúng cách; `sanitized` không dùng `fetch`/`eval`/`innerHTML` — an toàn.
- `URL.revokeObjectURL` trong SVG branch dùng `try/finally` để đảm bảo revoke kể cả khi importImage throw.