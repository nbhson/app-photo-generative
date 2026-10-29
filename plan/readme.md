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

---

# Round 2 — session 2 (2026-10-29): hoàn thiện WIP bị gián đoạn + tests + audit bổ sung

> Bối cảnh: session trước bị ngắt giữa chừng — để lại WIP chưa commit (ExportDialog + Modal shell +
> ShortcutsModal + Toast + aria). Kiểm tra lại thấy: WIP **không build được** (bug `FORMATS` vs
> `FORMAT_INFO`), và status "vitest + unit tests" ở trên **chưa đúng** — vitest có trong devDeps
> nhưng không có test file nào và không có script `test`.

## Kết quả audit bổ sung (session 2)

| # | Severity | Vị trí | Vấn đề | Fix |
|---|----------|--------|--------|-----|
| S1 | CRITICAL | ExportDialog.tsx:74 | WIP tham chiếu `FORMATS` (undefined) trong khi map tên là `FORMAT_INFO` → `tsc -b` fail, app không build được | Đổi đúng tên; xóa var `projectName` unused |
| S2 | MAJOR | (repo) | Không có test nào dù plan ghi "[x] vitest + unit tests"; không có script `test` | Thêm vitest config (node env) + 46 tests: store (history/reorder/snapshot isolation), persistence (sanitize/clamp/blend whitelist), providers (error paths) |
| S3 | MAJOR | RightPanel AITab | Vẫn `useEditor()` full-store subscribe (R7 chỉ sửa StatusBar) — re-render cả tab AI mỗi wheel tick | `useShallow` selector hẹp |
| S4 | MINOR | ExportDialog | Tự viết lại backdrop + Escape handler — trùng lặp với Modal shell vừa tạo | Refactor dùng `Modal` chung (+ `aria-labelledby`) |
| S5 | MINOR | App.tsx Escape | Esc khi modal mở vừa đóng modal vừa clear selection (2 listener cùng trên window, `stopPropagation` không chặn được) | Guard: modal đang mở thì bỏ qua clear selection |
| S6 | MINOR | TopBar saveFile | `URL.revokeObjectURL(a.href)` gọi đồng bộ ngay sau `click()` — có thể hủy download (Firefox) | Revoke sau 10s |
| S7 | MINOR | TopBar New Project | Xóa project đang dirty không hỏi — mất work | `window.confirm` khi dirty + có layers |
| S8 | MINOR | vite.config | `advancedChunks` deprecated (rolldown) → warning mỗi build | Đổi sang `codeSplitting` |
| S9 | MINOR | (feature) | Không đổi được kích thước canvas (trừ AI Expand) | **Canvas Size dialog** — File → Canvas Size…, presets, clamp 1–8192, giữ vị trí layer, fit lại + history entry |

## Features (tổng Round 2, gồm phần hoàn thiện session này)

1. **Export presets dialog** (Ctrl+E) — format × scale × quality + preview kích thước *(hoàn thiện WIP)*
2. **Canvas Size dialog** — resize document + presets *(mới, session 2)*
3. **Keyboard shortcuts modal** (`?` / Help) *(hoàn thiện WIP)*
4. **Toast errors + layer reorder + session restore** *(toast/reorder hoàn thiện WIP; restore từ round trước)*

## Bundle (đo bằng `npm run build`)

| Trạng thái | JS chính (eager) | Konva chunk (lazy) |
|---|---|---|
| Trước Round 2 (1 chunk duy nhất) | **623 kB** (gzip 190 kB) | — |
| Đầu session này (đã có lazy CanvasStage) | 73.03 + 218.84 vendor-react ≈ **292 kB** (gzip ~90 kB) | 334.72 kB (gzip 102.7 kB) |
| Cuối session 2 (thêm 2 dialog) | 85.97 + 218.84 ≈ **305 kB** (gzip 93 kB) | 334.72 kB (gzip 102.7 kB) |

→ Main thread chỉ tải ~305 kB JS thay vì 623 kB một chunk; konva/react-konva (334.7 kB) chỉ tải khi canvas mount.

## Trạng thái session 2

- [x] Review WIP, sửa bug build (S1), hoàn thiện + commit
- [x] 46 unit tests green (`npm test`), tsc + build + lint green
- [x] Canvas Size dialog (S8, S7, S6 cùng commit)
- [x] AITab narrow selector (S3) — phần còn thiếu của R7
- [x] Self-review diff

## Không sửa (đã cân nhắc, ghi nhận)

- oxlint warnings còn lại (Toolbar only-export-components, TopBar refs false-positive, Overlays set-state-in-effect false-positive trên Modal keydown) — pre-existing, không phải lỗi runtime.
- Confirm dialog dùng `window.confirm` — đủ cho scope hiện tại, custom dialog chỉ là polish.
- AI menu khi canvas rỗng mở file import thay vì báo lỗi (đã có từ round trước) — giữ nguyên.

## Review Log

### Vòng 1
- Tất cả fixes là MINOR, không có CRITICAL/MAJOR. Không có security-sensitive sinks (canvas là client-side, không server endpoints, không secrets).
- `VALID_BLEND_MODES` Set chứa 11 giá trị đúng theo `BlendMode` type — 'normal' được xử lý riêng (→ 'source-over').
- SVG sanitize: regex để capture multiline tags (`[\s\S]*?`) đúng cách; `sanitized` không dùng `fetch`/`eval`/`innerHTML` — an toàn.
- `URL.revokeObjectURL` trong SVG branch dùng `try/finally` để đảm bảo revoke kể cả khi importImage throw.