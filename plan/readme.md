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
- **Build chunk size warning (623 kB)**: static bundle lớn do Konva/react-konva; code-split dynamic import cho AI components — follow-up.

## Trạng thái

- [x] Plan
- [x] Fix #1–#6
- [x] `tsc --noEmit` clean; `npm run build` pass (vite build)
- [x] Commit + self-review

## Review Log

### Vòng 1
- Tất cả fixes là MINOR, không có CRITICAL/MAJOR. Không có security-sensitive sinks (canvas là client-side, không server endpoints, không secrets).
- `VALID_BLEND_MODES` Set chứa 11 giá trị đúng theo `BlendMode` type — 'normal' được xử lý riêng (→ 'source-over').
- SVG sanitize: regex để capture multiline tags (`[\s\S]*?`) đúng cách; `sanitized` không dùng `fetch`/`eval`/`innerHTML` — an toàn.
- `URL.revokeObjectURL` trong SVG branch dùng `try/finally` để đảm bảo revoke kể cả khi importImage throw.