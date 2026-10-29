# UI & Wireframe Specification: VXClean (`_spec3_ui_wireframe`)

> **Đối soát hiện hành — 2026-10-10:** [Truth engine và gaps](13_engine_behavior_truth.md) thay thế các mô tả implementation cũ mâu thuẫn bên dưới. [Dictionary toàn Dọn chi tiết](12_cleanup_dictionary.md) và [Quit/reopen](11_detailed_app_cleanup.md) là target **chưa nối engine/UI**. Scan mặc định giữ nguyên. Cleanup khác Uninstall; Movies/CapCut có thể xóa cả root khi chọn trong Uninstall, broad candidate mặc định bỏ chọn. Không coi thiết kế cũ hoặc mock preview là tính năng native đã nghiệm thu.


> Cập nhật UI/engine 2026-10-09: [spec feedback mới](07_ui_engine_feedback.md) ưu tiên khi hành vi/scope trong tài liệu này mâu thuẫn.

> Brief tiếp theo: [giữ trạng thái/header/Lens](08_scan_retention_ui_polish.md) ưu tiên cho cache 5 phút, CTA dashboard, header chung và tương tác Lens.


> **Tên sản phẩm:** VXClean
> **Thư mục dự án:** `cleaner_for_mac`
> **Mã tài liệu:** `_spec3_ui_wireframe`
> **Phiên bản:** 1.0.0
> **Ngày cập nhật:** 2026-10-07
> **Hệ quy chiếu Thiết kế:** Tuân thủ 100% [master_theme.md](../../../../_summary/standard_docs/master_theme.md) của hệ sinh thái VXUtilities (Dark Navy/Slate, Electric Cyan Accent, Glassmorphism, Desktop Compact Density).

---

## 1. Khung Cấu trúc Tổng thể Cửa sổ (Main Window Shell)

Kích thước mặc định: `960px × 640px` (Tối thiểu: `860px × 540px`). Cửa sổ hỗ trợ kéo thả tự do qua thanh tiêu đề không viền (Frameless Window Drag Region).

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [●][●][●]  VXClean — Tiện ích Giám sát & Dọn dẹp macOS         [FDA: Active] [⚙] [✕] │ ◄── Window Titlebar (h-10)
├───────────────┬────────────────────────────────────────────────────────────────────────┤
│ ❖ TỔNG QUAN   │                                                                        │
│  [■] Dashboard│                                                                        │
│               │                                                                        │
│ ⚡ DỌN DẸP     │                                                                        │
│  [◐] SmartScan│                                                                        │
│  [🧹] Dọn Rác  │                       MAIN CONTENT WORKSPACE                           │
│  [✕] Gỡ App   │                       (Vùng hiển thị nội dung chính)                   │
│  [☣] Tệp MồCôi│                                                                        │
│               │                                                                        │
│ 🌐 BỘ NHỚ     │                                                                        │
│  [◉] SpaceLens│                                                                        │
│               │                                                                        │
│ ⚙ HỆ THỐNG    │                                                                        │
│  [🛠] Cài đặt  │                                                                        │
├───────────────┴────────────────────────────────────────────────────────────────────────┤
│ v1.0.4 • Apple Silicon (M2 Max) • macOS 15.1 Sequoia               Thu hồi: 0 B        │ ◄── Status Bar (h-7)
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Thông số Thiết kế Shell (Tokens):
- **Window Base Background:** `bg-[#0f1117]` (Slate/Navy sâu).
- **Sidebar Background:** `bg-[#141821]/85 backdrop-blur-md border-r border-white/5` (Độ rộng cố định: `w-56`).
- **Sidebar Item (Default):** `text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-lg text-xs py-2 px-3`.
- **Sidebar Item (Active):** `text-cyan-400 bg-cyan-500/15 border-l-2 border-cyan-400 font-medium`.
- **Traffic Light Controls:** Chuẩn macOS native positioning (`top-3 left-4`).

---

## 2. Màn hình 1: Dashboard (System Telemetry & Health)

Màn hình hiển thị 4 khối chỉ số phần cứng thời gian thực và thẻ gợi ý hành động Smart Scan.

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ DASHBOARD HỆ THỐNG                                    [⟳ Làm mới (2s)] [Quét ngay]     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────────────────┐ │
│ │ CPU (Apple Silicon)  │ │ BỘ NHỚ RAM           │ │ DUNG LƯỢNG Ổ ĐĨA (Macintosh HD)  │ │
│ │   14.2%              │ │   24.8 GB / 32 GB    │ │   342.5 GB Khả dụng / 994.7 GB   │ │
│ │ ┌──────────────────┐ │ │ ┌──────────────────┐ │ │ ┌──────────────────────────────┐ │ │
│ │ │ ▄▅▂ ▂▃▅▆▇        │ │ │ ▓▓▓▓▓▓▓▓▓▓▓▒▒▒░░░░ │ │ │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒▒░░░░░░░ │ │ │
│ │ └──────────────────┘ │ │ └──────────────────┘ │ │ └──────────────────────────────┘ │ │
│ │ User: 9.8%  Sys: 4.4%│ │ Active: 14.1G Wired:6.2G│ Used: 652.2G • Purgeable: 18.4G │ │
│ └──────────────────────┘ └──────────────────────┘ └──────────────────────────────────┘ │
│                                                                                        │
│ ┌──────────────────────────────────────────────┐ ┌───────────────────────────────────┐ │
│ │ NGUỒN ĐIỆN & PIN                             │ │ KHUYẾN NGHỊ THU HỒI DUNG LƯỢNG    │ │
│ │   86% • Đang sạc (AC Attached)               │ │   Ước tính có thể dọn: ~14.8 GB   │ │
│ │ Tình trạng: Bình thường (Health 98%)         │ │                                   │ │
│ │ Chu kỳ sạc: 42 • Công suất: 96W USB-C        │ │ [ Bắt đầu Smart Scan toàn diện ]  │ │
│ │ *(Trên Mac để bàn: Hiển thị nguồn điện AC)*   │ │                                   │ │
│ └──────────────────────────────────────────────┘ └───────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Chi tiết Khối Pin (Xử lý trường hợp không có pin - Desktop Mac):
- Khi telemetry trả về `battery.has_battery = false` (Mac Studio, Mac Pro, Mac mini, iMac):
  - Khối nguồn điện tự động chuyển sang hiển thị: `Nguồn điện AC trực tiếp • Thiết bị để bàn`.
  - Ẩn thanh phần trăm pin và số chu kỳ sạc, không hiển thị giá trị ảo `0%`.

---

## 3. Màn hình 2: Smart Scan (3 Trạng thái Chi tiết)

### 3.1. Trạng thái 1: Sẵn sàng (Idle State)
Ở trạng thái này, giao diện tập trung vào một nút tròn lớn ở trung tâm để kích hoạt quét nhanh:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                        │
│                                      ╭─────────╮                                       │
│                                    │     ⚡    │                                       │
│                                    │   QUÉT    │  ◄── Nút tròn phát sáng Cyan Glow     │
│                                    │   NHANH   │      (hover:scale-105 active:scale-95)│
│                                      ╰─────────╯                                       │
│                                                                                        │
│                         Sẵn sàng kiểm tra toàn diện hệ thống                           │
│     Quét an toàn: Bộ nhớ đệm • Nhật ký ứng dụng • Dữ liệu build Xcode • Thùng rác      │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2. Trạng thái 2: Đang quét (Scanning Progress State)
Hiển thị tiến trình dạng vòng tròn kèm danh mục đang xử lý thời gian thực:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                        │
│                                      ╭─── 68% ─╮                                       │
│                                    │  Đang quét│                                       │
│                                    │  12.4 GB  │                                       │
│                                      ╰─────────╯                                       │
│                                                                                        │
│                          Đang kiểm tra: Xcode DerivedData...                           │
│               [■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■░░░░░░░░░░░░░░░░]                │
│                                                                                        │
│  [✓] Bộ nhớ đệm hệ thống (3.2 GB)             [✓] Nhật ký & Báo cáo lỗi (412 MB)       │
│  [●] Tệp phát triển Xcode (8.8 GB)...         [○] Thùng rác hệ thống (Chờ duyệt)       │
│                                                                                        │
│                                   [ Dừng quét ]                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.3. Trạng thái 3: Kết quả Quét (Results & Action State)
Sau khi quét xong, hiển thị bảng phân loại rác và nút bấm dọn dẹp an toàn:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ PHÁT HIỆN: 14.82 GB DỮ LIỆU CÓ THỂ DỌN                     [Tất cả] [Bỏ chọn]          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [✓] 🗄️ BỘ NHỚ ĐỆM NGƯỜI DÙNG (User Caches)                           3.20 GB   [Xem >] │
│     Bao gồm: Caches Safari, Spotify, Chrome, Slack (Tự động tái tạo khi dùng)          │
│                                                                                        │
│ [✓] 🛠️ DỮ LIỆU BUILD XCODE (DerivedData)                              6.40 GB   [Xem >] │
│     Bao gồm: Build index, module cache dự án cũ (Tự động tái tạo khi build lại)        │
│                                                                                        │
│ [ ] 📦 BẢN ARCHIVE XCODE (Archives) - Cần lưu ý                       2.40 GB   [Xem >] │
│     Bao gồm: Các bản build release/dSYM đã archive (KHÔNG tự tái tạo, mặc định tắt)    │
│                                                                                        │
│ [✓] 📄 NHẬT KÝ HỆ THỐNG & CRASH LOGS                                 412.0 MB   [Xem >] │
│     Bao gồm: DiagnosticReports, ASL logs cũ hơn 30 ngày                                │
│                                                                                        │
│ [✓] 🗑️ THÙNG RÁC HỆ THỐNG (Trash)                                     2.41 GB   [Xem >] │
│     Bao gồm: 142 tệp đang nằm trong ~/.Trash                                           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Đã chọn: 12.42 GB • Xóa trực tiếp 10.01 GB, Làm rỗng Thùng rác 2.41 GB                 │
│                                                              [ Dọn dẹp 12.42 GB ]      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Màn hình 3: App Uninstaller (Gỡ cài đặt Ứng dụng & File Rác)

Bố cục dạng 2 cột (Master-Detail Layout): Cột trái là danh sách ứng dụng; Cột phải là cây phân rã tệp phụ thuộc liên quan.

```text
┌──────────────────────────────────────┬─────────────────────────────────────────────────┐
│ TÌM ỨNG DỤNG [🔍 Tìm tên hoặc ID...]  │ CHI TIẾT GỠ CÀI ĐẶT: Docker Desktop             │
│ Sắp xếp: [Dung lượng giảm dần ▼]     │                                                 │
├──────────────────────────────────────┼─────────────────────────────────────────────────┤
│ [✓] 🐳 Docker Desktop        12.4 GB │ [✓] Ứng dụng gốc (.app)                 3.8 GB  │
│     v4.35 • Apple Silicon            │     /Applications/Docker.app                    │
│                                      │                                                 │
│ [ ] 🎨 Figma                   2.1 GB │ [✓] Dữ liệu máy ảo & Container          8.1 GB  │
│     v116.15 • Apple Silicon          │     ~/Library/Containers/com.docker.docker      │
│                                      │                                                 │
│ [ ] 🎧 Spotify                 1.4 GB │ [✓] Bộ nhớ đệm ứng dụng                 480 MB  │
│     v1.2.40 • Universal              │     ~/Library/Caches/com.docker.docker          │
│                                      │                                                 │
│ [🔒] 🧭 Safari                48.0 MB │ [✓] Tệp cấu hình người dùng              24 MB  │
│     Hệ thống bảo vệ (SIP Locked)     │     ~/Library/Preferences/com.docker.docker.plist│
│                                      ├─────────────────────────────────────────────────┤
│                                      │ Cơ chế: Đưa vào Thùng rác (trashItem)           │
│                                      │ [ Bỏ chọn cấu hình ]     [ Gỡ cài đặt (12.4 GB) ]│
└──────────────────────────────────────┴─────────────────────────────────────────────────┘
```

---

## 5. Màn hình 4: Space Lens (Phân tích Trực quan Dung lượng)

Cung cấp khả năng điều hướng sâu vào từng thư mục với Breadcrumb và hiển thị phân cấp trực quan:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ PHẠM VI: [~ / Users / vic / Projects /] ◄── Breadcrumb Navigation  [Bubble Map] [Bảng] │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────┐ ┌───────────────────────────────────┐ │
│ │ TRỰC QUAN HÓA BUBBLE MAP / TREEMAP           │ │ DANH SÁCH TỆP & THƯ MỤC NẶNG      │ │
│ │ ┌───────────────────────┬──────────────────┐ │ │                                   │ │
│ │ │                       │ node_modules     │ │ │ [📁] target/            14.2 GB  │ │
│ │ │ target/               │ 6.8 GB           │ │ │ [📁] node_modules/       6.8 GB  │ │
│ │ │ 14.2 GB               ├──────────────────┤ │ │ [📁] .build/             2.4 GB  │ │
│ │ │                       │ .build/          │ │ │ [📄] backup.tar.gz       1.8 GB  │ │
│ │ │                       │ 2.4 GB           │ │ │                                   │ │
│ │ └───────────────────────┴──────────────────┘ │ │ Chi tiết: target/debug/deps       │ │
│ │                                              │ │ Đường dẫn: .../photo_picker/target│ │
│ │ Click đúp vào khối để phóng to thư mục con   │ │                                   │ │
│ └──────────────────────────────────────────────┘ │ [ Mở Finder ]  [ Chuyển vào Trash]│ │
│                                                  └───────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Quy chuẩn Tương tác Breadcrumb Segment:
Mỗi phân đoạn (segment) trong thanh Breadcrumb (ví dụ `~`, `Users`, `vic`, `Projects`) hỗ trợ 2 hành vi chuột:
1. **Chuột trái (Left-click):** Điều hướng ngay lập tức (Jump/Drill-up) về cấp thư mục tương ứng trong giao diện Space Lens.
2. **Chuột phải (Right-click):** Mở Context Menu (kính mờ `rounded-lg shadow-xl py-1 text-xs`) với các tùy chọn tiện ích:
   - `Mở trong Finder` (trên macOS) / `Mở trong File Explorer` (trên Windows) (Gọi lệnh `reveal_in_file_manager`).
   - `Sao chép đường dẫn` (`Copy Full Path` vào Clipboard).
   - `Mở trong Terminal` (`Open in Terminal` tại thư mục đó).

---

## 5.1. Kiến trúc Thành phần Tái sử dụng (Reusable Component Contract)

Toàn bộ các dòng hạng mục trong Smart Scan, System Cleaner, App Uninstaller và Space Lens được thiết kế theo mô hình **Generic Data-Driven Components**:
- **`CategoryCardItem` / `CategoryRowItem`:**
  - Component độc lập hoàn toàn với OS. Nhận props: `icon`, `title`, `description`, `size_bytes`, `item_count`, `category_type`, `deletion_method`, `isChecked`, `onToggle`, `onInspect`.
  - **Khả năng thích ứng Windows (100% Seamless):** Khi chạy trên Windows, UI giữ nguyên 100%. Engine Windows chỉ cần cung cấp JSON payload với các categories tương ứng (`%TEMP%`, `Windows Update Cache`, `Prefetch`, `Recycle Bin`) thay vì (`Caches`, `Xcode DerivedData`, `Mail Downloads`).
- **`FileDetailRow`:** Component dòng tệp con (icon, tên, đường dẫn rút gọn, dung lượng `font-mono`, nút mở Explorer/Finder, checkbox). Dùng chung cho modal duyệt chi tiết rác, cây phụ thuộc app và danh sách Space Lens.


---

## 6. Màn hình 5: Menu Bar Popover (Tiện ích Giám sát Khay Hệ thống)

Cửa sổ nhỏ gọn (Kích thước: `320px × 380px`) mở ra khi người dùng click vào biểu tượng VXClean trên Menu Bar:

```text
┌────────────────────────────────────────┐
│  VXClean Monitor            [⚙] [✕]    │
├────────────────────────────────────────┤
│  CPU           12.4%  [ ▄▅▂ ▂▃  ]     │
│  RAM (32GB)    78.0%  [▓▓▓▓▓▓▓░░]     │
│    App: 14.2G • Wired: 6.1G • Free: 7G │
│                                        │
│  DISK          65.5%  [▓▓▓▓▓▓░░░]     │
│    Khả dụng: 342.5 GB (Purgeable: 18G) │
│                                        │
│  PIN           86% ⚡ Đang sạc (96W)   │
│    Thời gian đầy: ~25 phút             │
├────────────────────────────────────────┤
│  ⚡ Rác khả dụng: ~14.8 GB              │
│  [ Quét & Dọn nhanh ]                  │
├────────────────────────────────────────┤
│  [ Mở Dashboard chính ]  [ Thoát hẳn ] │
└────────────────────────────────────────┘
```

---

## 7. Hộp thoại Xác nhận An toàn (Safety Confirmation Modal)

Mọi thao tác dọn dẹp lớn bắt buộc hiển thị hộp thoại xác nhận tuân thủ `safety_audit.md`:

```text
┌─────────────────────────────────────────────────────────┐
│ ⚠️ XÁC NHẬN DỌN DẸP DỮ LIỆU                             │
├─────────────────────────────────────────────────────────┤
│ Bạn sắp dọn dẹp 12.42 GB dữ liệu đã chọn.               │
│                                                         │
│ Chi tiết cơ chế xử lý:                                  │
│ • 10.01 GB (Caches, Logs, Xcode): Xóa trực tiếp vĩnh viễn│
│   (Không thể khôi phục từ Thùng rác).                   │
│ • 2.41 GB (Thùng rác hệ thống): Làm rỗng hoàn toàn.     │
│                                                         │
│ [✓] Tôi hiểu rằng các tệp bộ nhớ đệm sẽ bị xóa vĩnh viễn│
│                                                         │
│              [ Hủy bỏ ]   [ Xác nhận Dọn dẹp ]          │
└─────────────────────────────────────────────────────────┘
```

---

## 8. Màn hình Chi tiết Dọn Rác Theo Nhóm (System Cleaner)

Bố cục 2 cột: Cột trái chọn danh mục rác; Cột phải duyệt chi tiết từng file con kèm đường dẫn và checkbox:

```text
┌──────────────────────────────────────┬─────────────────────────────────────────────────┐
│ DANH MỤC HỆ THỐNG                    │ CHI TIẾT DANH MỤC: Xcode DerivedData (6.40 GB)  │
├──────────────────────────────────────┼─────────────────────────────────────────────────┤
│ [✓] 🗄️ Bộ nhớ đệm (User Caches)3.2 GB│ [✓] 📁 MyApp-a8f8d9b1...                2.1 GB  │
│ [✓] 🛠️ Xcode DerivedData      6.4 GB │     ~/Library/Developer/Xcode/DerivedData/MyApp │
│ [ ] 📦 Xcode Archives (Cẩn thận)2.4 GB│ [✓] 📁 PhotosTool-e4c1...               1.8 GB  │
│ [✓] 📄 Nhật ký hệ thống       412 MB │     ~/Library/Developer/Xcode/DerivedData/Photos│
│ [✓] 🗑️ Thùng rác hệ thống     2.4 GB │ [✓] 📁 ModuleCache.noindex              2.5 GB  │
│                                      ├─────────────────────────────────────────────────┤
│                                      │ Cơ chế: Xóa trực tiếp (removeItem)              │
│                                      │ [ Chọn tất cả ]       [ Dọn nhóm này (6.4 GB) ] │
└──────────────────────────────────────┴─────────────────────────────────────────────────┘
```

---

## 9. Màn hình Tệp Mồ Côi (Orphan Files Cleaner)

Quét và phát hiện các tệp cấu hình còn sót lại của các ứng dụng đã gỡ bỏ khỏi hệ thống theo `OrphanSafetyPolicy`:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ TỆP MỒ CÔI (ORPHAN RESIDUES)                       [⟳ Quét lại] [Dọn 1.84 GB đã chọn] │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Đã phát hiện 3 thư mục rác thuộc các ứng dụng không còn tồn tại trên máy:              │
│                                                                                        │
│ [✓] 🗑️ Postman (Ứng dụng đã bị gỡ)                                     1.20 GB         │
│     Đường dẫn: ~/Library/Application Support/Postman                                   │
│     Trạng thái an toàn: Khớp chính sách OrphanSafetyPolicy.isSafeCandidate             │
│                                                                                        │
│ [✓] 🗑️ Slack Desktop Cache (Ứng dụng đã bị gỡ)                         520 MB          │
│     Đường dẫn: ~/Library/Caches/com.tinyspeck.slackmacgap                              │
│                                                                                        │
│ [✓] 🗑️ Zoom Presets (Ứng dụng đã bị gỡ)                                120 MB          │
│     Đường dẫn: ~/Library/Preferences/us.zoom.xos.plist                                 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Cơ chế xử lý: Xóa trực tiếp vĩnh viễn khỏi hệ thống (removeItem)                       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Màn hình Cài Đặt (Settings Modal — 3 Tab Đồng Bộ VXUtilities)

Modal kích thước chuẩn `max-w-xl`, phân tách 3 tab: Cập nhật (Updates), Giới thiệu (About), Ủng hộ tác giả (Support):

```text
┌─────────────────────────────────────────────────────────────────┐
│ CÀI ĐẶT & THÔNG TIN                                         [✕] │
├─────────────────────────────────────────────────────────────────┤
│ [ Cập nhật ]    [ Giới thiệu ]    [ Ủng hộ tác giả ]            │
├─────────────────────────────────────────────────────────────────┤
│ • Tab Cập nhật:                                                 │
│   Phiên bản hiện tại: v1.0.4 • Kênh phát hành: Stable (GitHub)   │
│   [ Kiểm tra bản mới ] -> Mở trang GitHub Releases chính thức    │
│                                                                 │
│ • Tab Giới thiệu:                                               │
│   VXClean — Tiện ích Giám sát & Dọn dẹp macOS hiệu năng cao     │
│   Phát triển bởi Bùi Việt Linh • Kế thừa từ mã nguồn mở MClean  │
│                                                                 │
│ • Tab Ủng hộ tác giả:                                           │
│   Hiển thị mã QR VietQR căn giữa (assets/qr.png)                │
│   Napas247 • Vietcombank • BUI VIET LINH                        │
│   Hướng dẫn quét mã trực tiếp từ ứng dụng ngân hàng             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. Hộp Thoại Xác Nhận Đặc Quyền Quản Trị (Admin Fallback Confirmation)

Kích hoạt khi thao tác đưa tệp vào Thùng rác (`trashItem`) bị từ chối do quyền hệ thống:

```text
┌─────────────────────────────────────────────────────────┐
│ 🔐 YÊU CẦU QUYỀN QUẢN TRỊ (ADMIN PRIVILEGES)             │
├─────────────────────────────────────────────────────────┤
│ Tệp sau đây không thể di chuyển vào Thùng rác:           │
│ /Library/PrivilegedHelperTools/com.docker.vmnetd        │
│                                                         │
│ ⚠️ CẢNH BÁO THAY ĐỔI CƠ CHẾ XÓA:                        │
│ Nếu tiếp tục bằng quyền quản trị, tệp này sẽ bị         │
│ XÓA TRỰC TIẾP VĨNH VIỄN (rm -rf), không thể khôi phục!   │
│                                                         │
│ [ Hủy bỏ (Bỏ qua tệp này) ]   [ Tiếp tục & Xác thực ]   │
└─────────────────────────────────────────────────────────┘
```
