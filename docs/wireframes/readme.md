# VXClean — Bộ Hồ Sơ Thiết Kế & Wireframes Giao Diện

> **Mã tài liệu:** `docs/wireframes/readme.md`
> **Phiên bản:** 1.0.0
> **Hệ quy chiếu Thiết kế:** [Master Styleguide](../../_summary/master_theme.md) và [Báo cáo Đối soát An toàn](../safety_audit.md)
> **Tài liệu Đặc tả Giao diện Toàn diện:** Xem chi tiết tại [03_ui_wireframe.md](../spec/03_ui_wireframe.md)

---

## 1. Bản Đồ Màn hình & Wireframe Chi tiết

Toàn bộ thông số kích thước, màu sắc Tailwind, trạng thái tương tác và wireframe ASCII đã được đặc tả hoàn chỉnh trong bộ tài liệu đặc tả `spec/`:

| Phân hệ màn hình | Trọng tâm thiết kế & Wireframe | Liên kết đặc tả chi tiết |
| :--- | :--- | :--- |
| **Window Shell** | Khung cửa sổ không viền 960x640, Sidebar định vị cố định, Traffic lights macOS native | [03_ui_wireframe.md#1-khung-cấu-trúc-tổng-thể](../spec/03_ui_wireframe.md) |
| **Dashboard** | 4 thẻ telemetry phần cứng thời gian thực, xử lý Mac để bàn không có pin | [03_ui_wireframe.md#2-màn-hình-1-dashboard](../spec/03_ui_wireframe.md) |
| **Smart Scan** | 3 trạng thái: Sẵn sàng (Idle), Đang quét (Progress), Kết quả quét & Dọn dẹp an toàn | [03_ui_wireframe.md#3-màn-hình-2-smart-scan](../spec/03_ui_wireframe.md) |
| **App Uninstaller** | Danh sách ứng dụng, phân rã file liên quan, khóa bảo vệ SIP & app tự thân | [03_ui_wireframe.md#4-màn-hình-3-app-uninstaller](../spec/03_ui_wireframe.md) |
| **Space Lens** | Trực quan hóa Bubble Map, bảng phân cấp đệ quy, Breadcrumb drill-down | [03_ui_wireframe.md#5-màn-hình-4-space-lens](../spec/03_ui_wireframe.md) |
| **Menu Bar Popover** | Cửa sổ HUD 320x380 trên khay hệ thống, giám sát mini, điều tiết tần suất lấy mẫu | [03_ui_wireframe.md#6-màn-hình-5-menu-bar-popover](../spec/03_ui_wireframe.md) |
| **Safety Modal** | Hộp thoại xác nhận minh bạch: Xóa trực tiếp vs Di chuyển vào Thùng rác | [03_ui_wireframe.md#7-hộp-thoại-xác-nhận-an-toàn](../spec/03_ui_wireframe.md) |

---

## 2. Phân định Trạng thái Kết nối Engine (Engine Bridge Mapping)

| Phân hệ | Trạng thái hiện tại trên bản thử Tauri (`desktop/`) | Trạng thái Native Engine (`MClean/Services/`) | Định hướng triển khai tiếp theo |
| :--- | :--- | :--- | :--- |
| **Telemetry Dashboard** | **Đã nối engine thật** (`SystemMonitor.swift`), đọc CPU/RAM/Disk/Battery qua CLI `metrics` | Sẵn sàng 100% | Tinh chỉnh giao diện theo wireframe spec |
| **Smart Scan** | Chưa nối IPC (Capability `smart_scan: false`) | Sẵn sàng trong `ScanEngine.swift` | Bổ sung subcommand `scan` vào `vxclean_engine` |
| **System Clean** | Chưa nối IPC (Capability `system_clean: false`) | Sẵn sàng trong `CleaningEngine.swift` | Bổ sung subcommand `clean` vào `vxclean_engine` |
| **App Uninstaller** | Chưa nối IPC (Capability `app_uninstaller: false`) | Sẵn sàng trong `AppPathFinder.swift` & `AppState.swift` | Bổ sung subcommand `apps` vào `vxclean_engine` |
| **Space Lens** | Chưa nối IPC (Capability `space_lens: false`) | Sẵn sàng trong `SpaceLensEngine.swift` | Bổ sung subcommand `lens` vào `vxclean_engine` |
| **Menu Bar & Dock** | Native source đã bổ sung policy; Tauri chưa nối | Sẵn sàng logic trong `MenuBarController.swift` | Tích hợp Tauri Tray icon & Window event listeners |
