# Context quy chuẩn đã đọc bởi Codex chủ trì

Version: 1.0.0 — Ngày: 2026-10-09

Chỉ là snapshot để CLI UI đọc trong cwd. Không sửa các bản quy chuẩn gốc.

## .agents/AGENTS.md

# Quy tắc root tổng VXUtilities
Version: 1.2.0 — Ngày update: 2026-10-08

Trước mọi tác vụ UI desktop ở dự án con, bắt buộc đọc [quy chuẩn UI chung](../../_summary/standard_docs/desktop_ui_standards.md) và [master_theme](../../_summary/standard_docs/master_theme.md). Quy chuẩn UI chung ưu tiên khi mẫu cũ mâu thuẫn; áp dụng cả app tương lai. Đối chiếu checklist trước báo hoàn tất và ghi rõ phần chưa kiểm chứng.

Giữ quy tắc global user cung cấp: UTF-8, tiếng Việt chuyên nghiệp, không LaTeX, file mới snake_case, link nội bộ tương đối, không xóa thay đổi agent khác. Chỉ gọi CLI agent khác khi user yêu cầu; subprocess không gọi CLI agent tiếp.

## Nhật ký công việc và định nghĩa turn
- Nhật ký duy nhất ở root tổng: [work_log.md](_summary/work_log.md). Đọc khi tiếp tục công việc để nắm kết quả và task tiếp theo.
- Turn là đợt công việc do user xác nhận kết thúc. Chỉ đóng turn khi user nói rõ nó kết thúc; agent không tự định nghĩa ranh giới bằng phản hồi final, goal complete, heartbeat hay CLI kết thúc.
- Khi tiếp tục công việc hoặc chuyển sang bước mới, nếu log còn turn cũ chưa được user xác nhận done thì hỏi lại về turn đó; giữ trạng thái chưa đóng cho tới khi có câu trả lời. Không hỏi lại turn đã được xác nhận, không coi im lặng hay kết quả checks là xác nhận kết thúc.
- Khi user đóng turn, cập nhật log: phạm vi, kết quả/file chính, checks và bằng chứng, giới hạn còn lại, cùng tổng quan task tiếp theo theo thông tin user đã cung cấp. Không tự suy đoán task chưa được giao.
- History chỉ giữ tối đa 3 turn đã kết thúc, mới nhất ở trên. Khi thêm turn thứ tư, bỏ mục cũ nhất khỏi log; không tự tạo bản archive khiến history tăng vô tận. Giữ tài liệu sản phẩm/báo cáo tham chiếu riêng khi vẫn cần.
- Có thể cập nhật tổng quan task tiếp theo hoặc phần đang làm trong cùng file khi có thông tin mới; không tạo thêm mục history cho mỗi tin nhắn. Phần đang làm, nếu có, chỉ một mục và được gộp vào history khi user xác nhận kết thúc.

## Điều phối Anti trong task được user giao
- Khi user đã yêu cầu Codex giao việc cho Anti/Agy, quyền điều phối áp dụng đến khi task đó đạt kết quả trong phạm vi đã chốt: chuẩn bị task, gọi runner, theo dõi, review, giao sửa tiếp và kiểm chứng. Không hỏi lại quyền giao việc hoặc từng command thông thường; không tự giao task khác.
- Trước khi chạy, kiểm tra runner/task, workspace, lệnh và cwd cần thiết; dùng dry-run khi cần. Chuẩn bị đủ grants tạm chính xác cho đọc/sửa và checks trong phạm vi đã được user cho phép. Không cấp wildcard toàn máy, bypass approval hay thay permission global thường trực.
- Khi gặp lỗi quyền/công cụ thông thường, tự chẩn đoán từ log và sửa cách gọi hợp lệ: đúng cwd, lệnh đơn, grants tạm cần thiết, tool/API phù hợp. Chỉ chạy lại sau khi xác nhận lượt trước đã kết thúc; khôi phục grants riêng sau mỗi lượt. Tiếp tục phần độc lập và review kết quả thật.
- Không dùng thông báo “bị chặn/thiếu quyền” làm điểm dừng cho vấn đề có thể tự giải quyết trong phạm vi đã ủy quyền. Báo user khi có kết quả đáng chú ý hoặc thực sự cần hành động/quyết định của user; nêu nguyên nhân cụ thể và bước tối thiểu cần làm. Không hứa vượt sandbox, lách hành động bị từ chối hoặc che giấu lỗi chưa xử lý.
- User tự giao Anti một task mới không đồng nghĩa Codex được quyền tự gọi Anti cho task đó. Chờ yêu cầu điều phối trực tiếp nếu chưa có.

## 9. Lịch sử Cập nhật (Changelog)
- 1.2.0 (2026-10-08): Khi log còn turn cũ chưa có xác nhận done, hỏi lại trước khi ghi nhận kết thúc; không hỏi lại turn đã được user đóng.
- 1.1.0 (2026-10-08): Thêm work_log ở root tổng, turn do user đóng, history tối đa 3 turn và tổng quan task tiếp theo; ghi cách tự xử lý điều phối Anti/quyền tạm trong phạm vi được giao.
- 1.0.0 (2026-10-08): Thêm tham chiếu quy chuẩn UI ở root tổng cho mọi app.


## _summary/standard_docs/desktop_ui_standards.md

# Quy chuẩn desktop UI dùng chung
Version: 1.2.0 — Ngày update: 2026-10-08

Áp dụng mọi app hiện tại và tương lai dưới root tổng VXUtilities. Quy chuẩn này ưu tiên nếu master_theme.md có mẫu cũ mâu thuẫn. [Theme chung](../../_summary/standard_docs/master_theme.md).

## Thanh trên cùng
- Chỉ một hàng; cùng height, font family/size/weight, icon size và spacing giữa các app và OS. UI system font, không monospace cho tên app.
- Token chung đã chọn: height 32px; font system (-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif), cỡ 12px; tên app weight 600; icon tên app 16px, gap icon/tên 6px. Áp dụng cả app tương lai.
- Mac: một bộ traffic lights native góc trái, tiếp theo icon + tên app; icon riêng app nhưng cùng size/gap. Menu trên menu bar OS, không thêm hàng menu trong app.
- Win: bỏ hoàn toàn titlebar native của OS (`decorations: false`, không để runtime effect gọi `setWindowDecorations(true)` gây double bar); menu File/Edit/… bên trái, ẩn icon/tên app; đúng một bộ minimize/maximize/close bên phải. Không mang traffic lights bên trái của Mac sang Win.
- Action riêng app cùng hàng và chung visual. Vùng trống kéo cửa sổ; menu/buttons không kéo. Resize, maximize/restore, close phải hoạt động.

## Floating Action Bar & Batch Actions Tooltips
- Đối với các thanh tác vụ nổi (như Action Bar khi mark ảnh trong VXPhotos): Mọi nút biểu tượng (Rotate, Rename, Copy, Cut, Move, Trash, Unmark...) bắt buộc có hover tooltip rõ ràng, hiển thị tên chức năng và phím tắt tương ứng, nổi phía trên nút, không bị che khuất và biến mất mượt mà khi di chuột ra ngoài.

## Settings & Cấu trúc Sidebar chuẩn hóa
- Header trên, sidebar danh mục trái, nội dung phải, footer dưới.
- Đồng bộ font, màu/theme, radius, border, spacing, độ rộng sidebar, tiêu đề nhóm/divider, checkbox/radio, dropdown, buttons và trạng thái tương tác theo Settings VXMedia hiện tại.
- Cấu trúc Sidebar chuẩn gồm 2 nhóm ngăn cách bởi đường kẻ mờ:
  1. **Nhóm tính năng cốt lõi của app:** General, Playback/System/Shortcuts, Cache, Hotkeys...
  2. **Nhóm thông tin & hỗ trợ:**
     - **Cập nhật (Updates):** Tách thành tab độc lập; chứa card kiểm tra phiên bản mới nhất từ GitHub Releases và updater thật.
     - **Giới thiệu (About):** Chứa thông tin app (icon, tên, version thật, tác giả Bùi Việt Linh, repo link), giới thiệu công dụng ngắn 2–3 câu và công nghệ nền tảng.
     - **Ủng hộ tác giả (Support Author):** Menu cuối cùng của sidebar; làm nổi bật với icon `Coffee` và tông màu ấm (amber). Nội dung: Lời cảm ơn chân thành, card mã QR VietQR (Vietcombank) nền trắng sắc nét đặt ở vị trí trung tâm, tối ưu để người dùng quét trực tiếp từ app ngân hàng trên điện thoại (không cần hiển thị thủ công tên/số tài khoản hay nút copy STK).
- Reset Defaults bên trái footer, Close bên phải.
- Nội dung cuộn theo viewport, header/footer dùng được. Dialog tối đa calc(100dvh - 32px), header/footer không co; body flex: 1 và min-height: 0; nội dung overflow-y: auto.
- Di chuyển cửa sổ khi mở Settings: Header của Settings modal bắt buộc có `data-tauri-drag-region`, `WebkitAppRegion: 'drag'` và `onMouseDown` gọi `startDragging()`.

## Checklist bắt buộc trước báo hoàn tất
- [ ] Một hàng chrome, bố cục Mac/Win đúng, Win không bị double bar (`decorations: false`).
- [ ] Ghi giá trị token chung height/font/icon/spacing và nơi dùng.
- [ ] Mọi nút biểu tượng trong floating action bar có hover tooltip hiển thị tên chức năng.
- [ ] Settings theo cấu trúc chuẩn: Tách riêng tab Updates, About và tab Support (với mã QR VietQR căn giữa, nổi bật).
- [ ] Theme/language hiện có đọc được, không overflow.
- [ ] Checks phù hợp và bằng chứng visual từng app/OS thực sự đã kiểm tra.
- [ ] Ghi rõ OS/phần chưa verify; build Mac không chứng minh Win hoạt động.

## Lịch sử cập nhật
- 1.3.0 (2026-10-09): Tối giản tab Ủng hộ tác giả: căn giữa mã QR VietQR nổi bật, loại bỏ thông tin số tài khoản và nút copy STK trên desktop; làm sạch toàn bộ wording hiển thị tên workspace local.
- 1.2.0 (2026-10-08): Chuẩn hóa cấu trúc Settings với 3 tab riêng biệt (Updates, About, Support với QR Vietcombank thật); bổ sung quy chuẩn hover tooltip cho floating action bar và triệt tiêu triệt để double bar trên Windows.
- 1.1.0 (2026-10-08): Chốt token titlebar chung và tiêu chí viewport Settings sau review trực tiếp.
- 1.0.0 (2026-10-08): Ghi yêu cầu user chuẩn hóa chrome, Settings và About toàn bộ app.


## _summary/standard_docs/master_theme.md

# VX Theme & Design System — Master Styleguide

> Version: 1.2.0 — Ngày update: 2026-10-08
> Bắt buộc đọc [quy chuẩn UI chung](../../_summary/standard_docs/desktop_ui_standards.md), ưu tiên cho titlebar, Settings và About.

> **Bộ tiêu chuẩn Thiết kế & Giao diện Nhất quán (Design Language) cho hệ sinh thái công cụ cá nhân VXUtilities (`VXMedia`, `VXTriage / photo_picker`, `VXmp3`, `VXCleaner`, `VXClick`, `VXKey`).**
>
> Được trích xuất trực tiếp từ kiến trúc giao diện thực tế của **VXMedia** (`media_tool`).

---

## 1. Triết lý Thiết kế (Design Principles)

1. **Dark-First, Adaptive Clean:**
   - Mặc định tối ưu sâu cho chế độ nền tối (Dark mode) phong cách Navy/Slate trầm ấm (`#0f1117`), không dùng đen tuyền (`#000000`) nhằm bảo vệ mắt và tạo chiều sâu cao cấp.
   - Hỗ trợ Light mode phẳng, sạch sẽ, chuẩn xác cho môi trường ánh sáng mạnh.
2. **Glassmorphism & Subtle Depth (Kính mờ cao cấp):**
   - Sử dụng hiệu ứng nền mờ (`backdrop-filter: blur(16px - 20px)`) kết hợp viền mảnh bán trong suốt (`rgba(255, 255, 255, 0.08 - 0.12)`).
   - Phân lớp rõ rệt: Base Layer (Nền ứng dụng) → Panel Layer (Khung làm việc/Sidebar) → Floating Layer (HUD, Dropdown, Context Menu, Modal).
3. **Compact Desktop Density:**
   - Mọi khoảng cách (padding, margin, gap) được tối ưu cho ứng dụng tiện ích máy tính (desktop utility), không dùng khoảng trắng rộng thênh thang của web thông thường.
   - Cỡ chữ trung tâm là `text-xs` (12px), dữ liệu kỹ thuật dùng `text-[10px]` - `text-[11px]`.
4. **Electric Cyan Accent:**
   - Sử dụng tông màu **Cyan/Teal** làm điểm nhấn thương hiệu nhận diện công nghệ, hiện đại, sắc sảo.
5. **Snappy & Micro-interactions:**
   - Hiệu ứng chuyển cảnh tức thì (100ms - 200ms ease), nút bấm có phản hồi `active:scale-95`, scrollbar siêu mảnh 6px tự ẩn.

---

## 2. Bảng Màu Hệ Thống (Color Palette & Tokens)

### A. Màu Nền (Background Surfaces)

| Vị trí / Layer | Dark Mode | Light Mode | Ý nghĩa sử dụng |
|---|---|---|---|
| **App Canvas (Base)** | `#0f1117` | `#f8fafc` | Nền gốc toàn bộ cửa sổ ứng dụng |
| **Glass Panel (Sidebar / HUD)** | `rgba(20, 24, 33, 0.85)` | `rgba(255, 255, 255, 0.92)` | Thanh bên (Sidebar), thanh điều khiển nổi (Floating HUD) |
| **Glass Surface (Card / Modal)** | `#141821` | `#ffffff` | Cửa sổ cài đặt (Modal), khung dialog |
| **Glass Dropdown / Menu** | `rgba(15, 20, 28, 0.96)` | `#ffffff` | Context Menu, Dropdown chọn lựa chọn |
| **Backdrop Blur Overlay** | `rgba(0, 0, 0, 0.60)` | `rgba(0, 0, 0, 0.40)` | Màn che mờ khi bật popup/modal |

### B. Màu Điểm Nhấn (Accent & Brand Colors)

| Vai trò | Mã Màu | Tailwind Class | Sử dụng |
|---|---|---|---|
| **Primary Accent** | `#06b6d4` / `#22d3ee` | `text-cyan-400`, `bg-cyan-500` | Nút kích hoạt, thanh timeline, slider volume, tab đang chọn |
| **Accent Glow / Ring** | `rgba(6, 182, 212, 0.3)` | `ring-cyan-500/30`, `shadow-cyan-400/50` | Viền focus, hiệu ứng sáng viền nhẹ |
| **Accent Active Surface** | `rgba(6, 182, 212, 0.15)` | `dark:bg-cyan-500/20`, `bg-cyan-50` | Hàng file đang chọn, tab hoạt động |

### C. Màu Ngữ Nghĩa (Semantic Colors)

| Nhóm | Màu chính | Tailwind Class | Trường hợp sử dụng |
|---|---|---|---|
| **Star / Marked / Warning** | `#fbbf24` / `#f59e0b` | `text-amber-400`, `fill-amber-400` | Đánh dấu ảnh (Star/Mark), folder icon hover, cảnh báo |
| **Success / Toast / Image** | `#34d399` / `#10b981` | `text-emerald-400`, `bg-emerald-500` | Thông báo Toast hoàn tất, icon dạng tệp Hình ảnh |
| **Video / Blue Accent** | `#38bdf8` / `#0284c7` | `text-cyan-400`, `text-blue-400` | Icon dạng tệp Video |
| **Audio / Amber Accent** | `#fbbf24` / `#d97706` | `text-amber-400` | Icon dạng tệp Âm thanh (Audio), sóng nhạc |
| **Danger / Mute / PDF** | `#fb7185` / `#f43f5e` | `text-rose-400`, `bg-rose-500` | Tắt âm (Mute), icon tệp PDF, nút xóa/hủy nguy hiểm |

### D. Phân Lớp Văn Bản & Viền (Text & Border Layers)

| Thành phần | Dark Mode | Light Mode |
|---|---|---|
| **Primary Text** | `#f8fafc` (`text-white` / `text-slate-100`) | `#0f172a` (`text-slate-900`) |
| **Secondary Text** | `#cbd5e1` (`text-slate-300`) | `#334155` (`text-slate-700`) |
| **Muted / Subtitle Text** | `#94a3b8` (`text-slate-400`) | `#64748b` (`text-slate-500`) |
| **Disabled / Hint Text** | `#64748b` (`text-slate-500`) | `#94a3b8` (`text-slate-400`) |
| **Borders (Mảnh)** | `rgba(255, 255, 255, 0.08)` đến `0.12` | `rgba(0, 0, 0, 0.08)` hoặc `#e2e8f0` |

---

## 3. Hệ Thống Font & Typography

### Phông chữ:
- **UI Text Font:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` (Tận dụng font gốc của macOS San Francisco và Windows Segoe UI để đạt độ sắc nét native).
- **Data & Monospace Font:** `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` (`font-mono`). Bắt buộc dùng cho:
  - Thời gian (Timestamp: `08:55`, `00:03 / 02:45`).
  - Phím tắt (Hotkeys: `Space`, `Cmd+C`, `M`, `W`).
  - Giá trị kỹ thuật (Loudness `96.0 dB`, Kích thước `4032x3024`, Tỷ lệ Zoom `125%`).
  - Số thứ tự file / Counter (`01/45`).

### Thang kích thước (Type Scale):

| Kích cỡ | Class Tailwind | Font Weight | Phạm vi sử dụng |
|---|---|---|---|
| **Micro** | `text-[10px]` | `font-mono`, Medium | Nhãn phím tắt, badge đếm nhỏ, thời gian chi tiết |
| **Tiny** | `text-[11px]` | Regular / Medium | Mô tả phụ trong Settings, sub-label dưới tên file |
| **Base Body** | `text-xs` (12px) | Medium (`font-medium`) | Toàn bộ nhãn nút bấm, dòng dữ liệu bảng, input |
| **Subhead** | `text-sm` (14px) | Semibold (`font-semibold`) | Tiêu đề thanh bên (Sidebar), tiêu đề mục bảng |
| **Header** | `text-base` (16px) | Semibold (`font-semibold`) | Tiêu đề hộp thoại Modal cài đặt; tên app trên titlebar dùng 12px/600 theo quy chuẩn UI |
| **Display** | `text-2xl` (24px) | Bold (`font-bold`) | Chỉ số âm lượng OSD (Volume Overlay), đồng hồ lớn |

---

## 4. Hệ Thống Spacing & Bán Kính Bo Góc (Radii & Layout Metrics)

### A. Bo góc (Border Radius):
- **Cửa sổ Modal / Dialog lớn:** `rounded-2xl` (16px).
- **Khung nổi (Floating HUD / Card / Dropdown):** `rounded-xl` (12px).
- **Hàng bảng / Danh sách / Ô input / Tab item:** `rounded-lg` (8px).
- **Icon button nhỏ / Context menu item:** `rounded-md` (6px).
- **Pill / Badge đếm / Nút tròn:** `rounded-full` (9999px).

### B. Kích thước chuẩn các khối giao diện:
- **Top Window Bar:** Height 32px (`h-8`), font UI system 12px, tên app weight 600, icon 16px/gap 6px.
  - Trên macOS: Height chung với Windows theo quy chuẩn UI, chừa lề trái `pl-[82px]` để không đè vào cụm 3 nút đóng/mở/thu nhỏ (Traffic Lights).
  - Trên Windows: Height chung với macOS; menu trái, một bộ nút cửa sổ phải, ẩn icon/tên app và bỏ titlebar native lặp.
  - Có thuộc tính kéo thả cửa sổ: `data-tauri-drag-region` và CSS `WebkitAppRegion: 'drag'` (các nút bên trong phải gán `WebkitAppRegion: 'no-drag'`).
- **Sidebar Settings:** `w-48` (192px), nội dung cuộn trong dialog có max-height theo viewport; theo [quy chuẩn UI chung](../../_summary/standard_docs/desktop_ui_standards.md).
- **Sidebar danh sách:** Độ rộng cố định `w-64` (256px) hoặc `w-72` (288px).
- **Context Menu:** Chiều rộng chuẩn `w-60` (240px) đến `w-64` (256px).
- **Modal Cài đặt:** Chiều rộng chuẩn `max-w-xl` đến `max-w-2xl` (672px).

---

## 5. Thư viện Icon & Kích Thước (Lucide Icons)

Toàn bộ hệ thống thống nhất sử dụng **Lucide Icons** (`lucide-react` / `lucide`):

| Cỡ Icon | Class Tailwind | Sử dụng |
|---|---|---|
| **Mini** | `w-3.5 h-3.5` (14px) | Icon trong tab, icon folder, icon kính lúp tìm kiếm, icon phím tắt |
| **Standard** | `w-4 h-4` (16px) | Icon nút bấm thanh công cụ, icon sidebar items, nút đóng `X` |
| **Medium** | `w-5 h-5` (20px) | Icon tiêu đề modal, icon điều khiển phát nhạc chính |
| **Large / OSD**| `w-8 h-8` (32px) | Icon hiển thị to giữa màn hình (Loa âm lượng OSD, Trạng thái Play) |

---

## 6. Mẫu Thành Phần Giao Diện Chuẩn (Reusable UI Patterns)

### A. CSS Khung Kính Mờ (Glassmorphism Core)

Khai báo sẵn trong `index.css`:

```css
/* Dark Theme Panel */
.dark .glass-panel {
  background: rgba(20, 24, 33, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
}

/* Dark Theme Dropdown / Context Menu */
.dark .glass-dropdown {
  background: rgba(15, 20, 28, 0.96);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
  color: #f1f5f9;
}

/* Light Theme Panel */
.light .glass-panel {
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
  color: #0f172a;
}

/* Custom Minimal Scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(150, 150, 150, 0.25);
  border-radius: 9999px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(150, 150, 150, 0.4);
}
```

---

### B. Mẫu Nút Bấm & Thẻ Tab (Tabs & Buttons)

#### 1. Tab Bar Item:
```tsx
// Tab đang active:
<div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all border max-w-[180px] bg-white/15 dark:bg-white/10 text-white border-white/20 shadow-xs">
  <FolderOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
  <span className="truncate leading-none">Folder Name</span>
</div>

// Tab không active (hover):
<div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all border max-w-[180px] text-slate-400 hover:text-slate-200 hover:bg-white/5 border-transparent">
  <Folder className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400 shrink-0" />
  <span className="truncate leading-none">Folder Name</span>
</div>
```

#### 2. Dòng Danh Sách / Bảng File (List / Table Item):
```tsx
// Dòng đang chọn:
<div className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs transition-colors bg-cyan-50 dark:bg-cyan-500/20 text-cyan-900 dark:text-cyan-200 border border-cyan-300 dark:border-cyan-500/30 font-semibold shadow-2xs">
  <div className="flex items-center gap-2.5 min-w-0">
    <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />
    <span className="truncate font-medium">IMG_001.JPG</span>
  </div>
  <div className="w-2 h-2 rounded-full bg-cyan-500 dark:bg-cyan-400 shadow-sm shadow-cyan-400/50 shrink-0" />
</div>

// Dòng bình thường (hover):
<div className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 border border-transparent transition-colors">
  <div className="flex items-center gap-2.5 min-w-0">
    <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />
    <span className="truncate font-medium">IMG_002.JPG</span>
  </div>
</div>
```

---

### C. Ô Nhập Liệu Tìm Kiếm (Search & Filter Inputs)

```tsx
<div className="relative flex items-center">
  <Search className="w-3.5 h-3.5 absolute left-3 text-slate-400 pointer-events-none" />
  <input
    type="text"
    placeholder="Lọc nhanh..."
    className="w-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors shadow-2xs font-medium"
  />
</div>
```

---

### D. Badge Số Lượng & Hotkey (Badges & Shortcut Keys)

```tsx
// Badge số lượng (Marked items):
<span className="px-1 py-0.2 rounded-full text-[10px] font-mono leading-none bg-cyan-500/25 text-cyan-300 border border-cyan-400/40 shrink-0">
  12
</span>

// Badge phím tắt trong menu / tooltip:
<span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
  Space
</span>
```

---

### E. Thông Báo Nổi (Toast Notification)

```tsx
<div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300 ease-out animate-in fade-in slide-in-from-bottom-2">
  <div className="glass-panel px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-medium text-emerald-400 border border-emerald-500/20">
    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
    <span>Đã đổi tên 45 tệp thành công</span>
  </div>
</div>
```

---

## 7. Tiêu Chí Nghiệm Thu Giao Diện (Design Consistency Checklist)

Mọi công cụ mới (`VXTriage / photo_picker`, `VXmp3`, `VXCleaner`, `VXClick`, `VXKey`) khi dựng giao diện **bắt buộc phải vượt qua checklist 8 điểm sau** để đảm bảo cảm giác như xuất thân từ một "gia đình phần mềm duy nhất":

- [ ] **1. Nền App Đúng Mã:** Phải dùng nền `#0f1117` cho dark mode và `#f8fafc` cho light mode. Không bao giờ dùng nền đen thuần `#000000` cho vùng nội dung lớn.
- [ ] **2. Thống Nhất Màu Accent:** Màu chủ đạo tương tác là **Cyan (`cyan-400` / `cyan-500`)**. Màu cảnh báo/đánh dấu là **Amber**, màu thành công là **Emerald**, màu nguy hiểm/xóa là **Rose**.
- [ ] **3. Kính Mờ Chuẩn Spec:** Mọi panel, sidebar, context menu hoặc floating bar đều dùng class `.glass-panel` hoặc `.glass-dropdown` với `backdrop-filter: blur(16px - 20px)`.
- [ ] **4. Font Đôi Native + Mono:** Giao diện dùng System Font của hệ điều hành; mọi con số, thời gian, phím tắt, đơn vị đo (dB, KB, px) bắt buộc áp dụng `font-mono text-[10px]` hoặc `text-[11px]`.
- [ ] **5. Thư Viện Icon Lucide:** Chỉ dùng icon từ `lucide-react`, cỡ chuẩn `14px` (`w-3.5 h-3.5`) hoặc `16px` (`w-4 h-4`).
- [ ] **6. Bo Góc Phân Cấp:** Cửa sổ lớn `rounded-2xl`, panel/dropdown `rounded-xl`, item/input `rounded-lg`, menu con `rounded-md`, badge/pill `rounded-full`.
- [ ] **7. Chuẩn Titlebar Kéo Thả:** Nếu app có custom titlebar, macOS bắt buộc có padding trái `pl-[82px]` để tránh Traffic Lights, các nút tương tác phải gán `WebkitAppRegion: 'no-drag'`.
- [ ] **8. Phản Hồi Tương Tác Đồng Bộ:** Nút bấm có hiệu ứng hover mờ `hover:bg-white/10` và `active:scale-95`; hàng được chọn có viền `cyan-500/30` và chấm trạng thái phát sáng.


## Lịch sử cập nhật
- 1.2.0 (2026-10-08): Chốt token titlebar 32px/12px, sidebar Settings 192px và giới hạn viewport; bỏ mô tả font titlebar 16px mâu thuẫn.
- 1.1.0 (2026-10-08): Thêm quy chuẩn chung, bỏ height Mac/Win khác nhau.
