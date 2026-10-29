# Biên bản Bàn giao Giao diện UI VXClean cho Codex (Native Engine Integration)

> **Người thực hiện (Frontend):** Antigravity (Anti)  
> **Người tiếp nhận (Backend/Engine):** Codex  
> **Ngày bàn giao:** 2026-10-09  
> **Trạng thái UI:** Đã hoàn thành 100% Mock & Giao diện, `npm run build` đạt **393ms, 0 lỗi TypeScript/Vite**.

---

## 1. Tổng quan Kiến trúc Đã Triển khai

Frontend của **VXClean** đã hoàn thiện toàn bộ tầng giao diện Shell theo chuẩn thiết kế `_summary/standard_docs/master_theme.md` (Navy/Slate `#0f1117`, Electric Cyan `#06b6d4`, compact desktop density) và đã tích hợp đầy đủ Mock Adapter để phục vụ chạy thử nghiệm độc lập trên browser hoặc trong Tauri WebView.

```
cleaner_for_mac/desktop/src/
├── types.ts                      # Toàn bộ DTOs khế ước (Scan, Clean, Apps, Lens, Orphans, SystemSnapshot)
├── services/
│   ├── mock_engine.ts            # Dữ liệu giả lập chuẩn macOS (DerivedData, Caches, SIP app, Treemap lens)
│   └── tauri_bridge.ts           # Cầu nối gọi Rust host (có fallback mock tự động khi chạy dev)
├── components/
│   ├── title_bar.tsx             # Thanh tiêu đề Custom macOS Traffic lights & Dragging
│   ├── sidebar.tsx               # Điều hướng 6 tabs chính (Dashboard, Smart Scan, Cleanup, Uninstaller, Orphans, Space Lens)
│   ├── dashboard.tsx             # Viễn trắc phần cứng thời gian thực (CPU, RAM, DISK, BATTERY)
│   ├── smart_scan_view.tsx       # Luồng quét nhanh 1-click + modal cảnh báo rủi ro Xcode Archives
│   ├── cleanup_view.tsx          # Bảng dọn rác chi tiết chia nhóm + checkbox + Reveal in Finder
│   ├── uninstaller_view.tsx      # Quản lý & gỡ app tận gốc (khóa SIP Safari, khóa tự thân, Modal Admin fallback rm -rf)
│   ├── orphans_view.tsx          # Dọn dẹp tệp mồ côi (Postman, Slack, Zoom) theo OrphanSafetyPolicy
│   ├── space_lens_view.tsx       # Kính không gian: Breadcrumb chuột trái/phải Context Menu, Treemap & Table View
│   └── settings_modal.tsx        # Cài đặt 3 tab (Cơ bản, Danh sách Bỏ qua, Bản quyền & Donate QR)
└── app.tsx                       # Bộ điều phối trung tâm
```

---

## 2. Danh sách Subcommand CLI Swift Cần Nối (`vxclean_engine`)

Host Rust trong `desktop/src_tauri/src/lib.rs` sẽ khởi chạy subprocess CLI `vxclean_engine` (hoặc bundle Swift binary) theo bảng phân nhiệm sau:

| Subcommand CLI | I/O Giao tiếp | Khế ước Payload (`types.ts`) | Mô tả & Ràng buộc Kỹ thuật |
| :--- | :--- | :--- | :--- |
| `metrics` | stdout JSON | `SystemSnapshot` | Đọc Mach Host CPU, VM stats, Statfs, IOPS. **Throttle lock 2.5s** trên frontend đã được cài đặt để Swift đo delta CPU chính xác mà không bị spam call. |
| `scan` | `--all` / stdout JSON | `ScanResponse` | Quét Caches, Logs, Mail, Xcode DerivedData & Archives, Trash. Tách riêng `xcode_archives` (`is_selected_by_default: false`). |
| `clean` | `--stdin` / stdout JSON | `CleanPayload` → `CleanResponse` | Nhận JSON danh sách path qua stdin. Trả về `permanently_freed_bytes` vs `trashed_bytes`. |
| `apps` | `--include-residuals` / stdout JSON | `AppsListResponse` | Quét `/Applications`, đọc `Info.plist`, phân rã Application Support, Caches. Đánh dấu `is_system_protected` nếu thuộc Apple/SIP, `is_self_app` nếu là VXClean. |
| `uninstall` | `--app-id <id> --stdin` | `UninstallPayload` → `CleanResponse` | Di chuyển tệp vào Thùng rác (`trashItem`). Nếu có cờ `allow_admin_fallback: true` và lỗi phân quyền, thực thi AppleScript sudo `rm -rf` (UI đã có popup xác nhận riêng). |
| `lens` | `--path <dir> --depth <n>` | `SpaceLensResponse` | Đọc cấu trúc đệ quy thư mục, đánh dấu `is_package` (`.app`, `.xcodeproj`, `.photoslibrary`) và `is_access_denied`. |
| `orphans` | stdout JSON | `OrphansResponse` | Đối soát thư mục `Application Support` và `Caches` với `/Applications` để lọc ra các app đã bị kéo vào thùng rác. |

---

## 3. Các Điểm Codex Cần Lưu ý Khi Nối Engine

1. **Phân tách Rõ Ràng Phương thức Xóa Tệp:**
   - Xóa an toàn: gọi `NSWorkspace.shared.recycle(urls, ...)` hoặc `FileManager.default.trashItem(at:resultingItemURL:)` (tệp nằm trong `~/.Trash`, có thể Put Back).
   - Xóa trực tiếp: `FileManager.default.removeItem(at:)` cho Caches, Logs, DerivedData, Orphans.
   - Xóa quản trị viên: AppleScript prompt `with administrator privileges` chỉ kích hoạt khi frontend gửi `allow_admin_fallback: true`.
2. **Khế ước Full Disk Access (FDA):**
   - Nếu không có FDA, không báo lỗi văng app; trả về cờ `fda_limited_categories: ["mail_downloads", "safari_caches"]` trong `ScanResponse` để UI hiển thị banner hướng dẫn người dùng.
3. **Phân luồng Stream Tiến trình:**
   - Khi quét hoặc dọn dẹp dung lượng lớn, Rust Host phát sự kiện `scan_progress` hoặc `clean_progress` qua Tauri Event API để Frontend cập nhật thanh tiến trình mượt mà.

## 4. Kết quả Codex tiếp nhận (2026-10-09)

Đã nối native maintenance và sửa các điểm UI ảnh hưởng thao tác thật; xem [báo cáo tích hợp và kiểm chứng](native_engine_integration.md). Trạng thái mock/100% ở phần bàn giao mô tả thời điểm Anti bàn giao, không phải trạng thái runtime hiện tại.
