# System Specification Overview: VXClean (`_spec0_system`)

> **Đối soát hiện hành — 2026-10-10:** [Truth engine và gaps](13_engine_behavior_truth.md) thay thế các mô tả implementation cũ mâu thuẫn bên dưới. [Dictionary toàn Dọn chi tiết](12_cleanup_dictionary.md) và [Quit/reopen](11_detailed_app_cleanup.md) là target **chưa nối engine/UI**. Scan mặc định giữ nguyên. Cleanup khác Uninstall; Movies/CapCut có thể xóa cả root khi chọn trong Uninstall, broad candidate mặc định bỏ chọn. Không coi thiết kế cũ hoặc mock preview là tính năng native đã nghiệm thu.


> **Tên sản phẩm:** VXClean (macOS System Health, Deep Cleaning & Space Management Utility)
> **Thư mục dự án:** `cleaner_for_mac`
> **Phiên bản tài liệu:** 1.0.0 (Tauri 2 Hybrid Architecture with Swift Native Engine)
> **Ngày cập nhật:** 2026-10-07
> **Nền tảng mục tiêu:** macOS (Apple Silicon arm64 & Intel x86_64, tối thiểu macOS 13.0 Ventura) + Định hướng kiến trúc mở rộng Windows Adapter
> **Mô hình Kiến trúc:** Kiến trúc 3 tầng phân định (Hybrid Core with Native Subprocess Engine):
> - **Tầng 1 (UI Shell — định hướng tái sử dụng đa nền tảng):** Tauri v2 WebView (React 19.3 + TypeScript 7.0 + Vite 8.3 + Tailwind CSS 4.3 + Lucide Icons) tuân thủ nghiêm ngặt [master_theme.md](../../../../_summary/standard_docs/master_theme.md).
> - **Tầng 2 (Host Bridge & Process Supervisor):** Rust Native Core (Tauri 2 IPC, Non-blocking Process Spawner, Child Process Lifecycle Monitor, Protocol Contract Validator v1.0).
> - **Tầng 3 (Platform Native Engines):**
>   - *Trên macOS:* `vxclean_engine` (Swift Native Executable compiled via Command Line Tools), kế thừa và đóng gói các logic lõi từ `MClean/Services/` (`SystemMonitor.swift`, `ScanEngine.swift`, `CleaningEngine.swift`, `SpaceLensEngine.swift`).
>   - *Định hướng Windows:* PowerShell / Win32 Native Adapter chia sẻ chung JSON Contract và UI Shell.

---

## 1. Bối cảnh & Tôn chỉ Sản phẩm (Product Vision)

### 1.1. Nỗi đau thực tế (The Real Pain Point)
Hệ điều hành macOS nổi tiếng với sự ổn định, nhưng qua thời gian dài sử dụng (đặc biệt đối với giới lập trình viên, designer, người làm media), hệ thống tích lũy lượng lớn dữ liệu rác ẩn sâu trong thư viện:
- **Xcode DerivedData, iOS DeviceSupport, Simulators:** Thường xuyên phình to 20GB – 80GB mà Finder thông thường không tự động phát hiện.
- **Tệp ứng dụng mồ côi (Orphan App Residues):** Khi người dùng kéo một app vào Trash, các tệp cấu hình trong `~/Library/Application Support`, `~/Library/Caches`, `~/Library/Preferences` vẫn còn sót lại vĩnh viễn.
- **Sự thiếu minh bạch của các công cụ bên thứ ba:** Nhiều công cụ dọn dẹp thương mại tính phí bản quyền đắt đỏ, chạy daemon chạy ngầm nặng nề, hoặc quảng cáo sai lệch ("tất cả đều vào Thùng rác") trong khi thực tế âm thầm xóa vĩnh viễn bằng quyền root.

### 1.2. Mục tiêu của VXClean
VXClean được kế thừa từ dự án mã nguồn mở `MClean`, sau đó tái cấu trúc theo bộ tiêu chuẩn **VXUtilities** để trở thành công cụ dọn dẹp hệ thống chuyên nghiệp, hiện đại và minh bạch:
1. **Kiến trúc Hiện đại & Đồng bộ (Unified VXUtilities Ecosystem):** Đồng bộ hoàn toàn giao diện với `VXMedia` và `VXPhotos` (`photo_picker`), sử dụng theme Slate/Navy cao cấp với điểm nhấn Electric Cyan.
2. **Minh bạch Tuyệt đối về An toàn Tệp (Transparent Safety Policy):** Tuân thủ [Báo cáo Đối soát An toàn](../../docs/safety_audit.md). Phân định rõ ràng: cái gì đưa vào Thùng rác (`Trash`), cái gì xóa trực tiếp (`removeItem` / `rm -rf`), và khi nào cần quyền quản trị (`Admin Privileges`). Tuyệt đối không che giấu hành vi xóa.
3. **Hiệu năng & Tối ưu Tài nguyên (Resource Efficiency):** App chính mở nhanh, UI mượt mà với React + Tailwind. Menu Bar giám sát hệ thống với tần suất lấy mẫu thông minh (tiết chế khi ẩn popover, không gây hao pin).
4. **Quy tắc Vận hành Cửa sổ macOS (True macOS Window Lifecycle):** Đóng cửa sổ chính (Cmd+W hoặc click nút đỏ) → Ẩn cửa sổ và ẩn khỏi Dock, app tiếp tục giám sát nhẹ trên Menu Bar. Click icon Menu Bar hoặc mở lại app → Hiển thị lại cửa sổ và Dock. Thoát ứng dụng (Cmd+Q hoặc menu Quit) → Chấm dứt toàn bộ tiến trình.

---

## 2. Ma trận Độ khó Kỹ thuật (Technical Difficulty Matrix)

```text
┌────────────────────────────────────────────────────────────────────────┐
│               MA TRẬN ĐỘ KHÓ KỸ THUẬT (DIFFICULTY MATRIX)              │
├────────────────────────┬─────────────┬─────────────────────────────────┤
│ Hạng mục               │ Mức độ khó  │ Rủi ro / Điểm nghẽn chính       │
├────────────────────────┼─────────────┼─────────────────────────────────┤
│ 1. Full Disk Access    │ ★★★★★ (9/10)│ Sandbox chặn ~/Library, Mail    │
│ 2. Safe Deletion Logic │ ★★★★★ (9/10)│ Xóa nhầm file hệ thống, TOCTOU  │
│ 3. Space Lens Engine   │ ★★★★☆ (8/10)│ Quét đệ quy treo RAM, IO disk   │
│ 4. Window & Dock Life  │ ★★★★☆ (7/10)│ macOS Activation Policy lag     │
│ 5. Telemetry Sampling  │ ★★★☆☆ (6/10)│ Mach host_statistics tốn CPU    │
└────────────────────────┴─────────────┴─────────────────────────────────┘
```

### Điểm khó 1: Rào cản Phân quyền Full Disk Access (FDA) & macOS Sandbox (Độ khó: 9/10)
* **Vấn đề:** macOS từ phiên bản Mojave (10.14) trở đi áp dụng chính sách TCC (Transparency, Consent, and Control) cực kỳ nghiêm ngặt. Ứng dụng không thể quét thư mục người dùng (`~/Library/Mail`, `~/Library/Safari`, `~/Library/Application Support`) nếu người dùng chưa cấp quyền Full Disk Access trong System Settings.
* **Giải pháp kiến trúc:**
  - Thiết kế `FullDiskAccessManager` trong Native Engine kiểm tra quyền đọc bằng cách thử truy cập tệp nhạy cảm (`~/Library/Safari/Bookmarks.plist`).
  - Tầng UI hiển thị trạng thái quyền minh bạch: nếu thiếu FDA, hiển thị cảnh báo hướng dẫn từng bước (Step-by-step Visual Onboarding) và nút bấm 1-click mở trực tiếp:
    `x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles`
  - Các module quét chạy với quyền thích ứng (Graceful Degradation): quét được các mục khả dụng và ghi chú rõ ràng các thư mục bị bỏ qua do thiếu quyền.

### Điểm khó 2: Đảm bảo An toàn Tuyệt đối khi Xóa tệp & Đối soát Danh mục (Độ khó: 9/10)
* **Vấn đề:** Các thao tác dọn dẹp hệ thống can thiệp vào các thư mục sâu. Nếu giải thuật regex hoặc đường dẫn sai lệch có thể xóa nhầm tệp dữ liệu sống của người dùng hoặc tệp hệ điều hành.
* **Giải pháp kiến trúc (Tuân thủ `docs/safety_audit.md`):**
  - **Cơ chế Danh sách trắng (Allow-list Enforcement):** Mọi đường dẫn trước khi quét hoặc xóa bắt buộc phải khớp với danh sách thư mục an toàn được định nghĩa trước (`Locations.swift`). Tuyệt đối cấm quét tự do ngoài phạm vi.
  - **Kiểm tra Liên kết mềm (Symlink Recheck):** Trước khi xóa bất kỳ file hoặc thư mục nào, giải mã canonical path (`resolvingSymlinksInPath`) và kiểm tra `samefile()` để ngăn chặn tấn công TOCTOU (Time-of-check to time-of-use).
  - **Bảo vệ Ứng dụng Tự thân:** Đưa bundle `local.vxclean.app` và tên tiến trình `vxclean` vào danh sách loại trừ bắt buộc trong `Conditions.swift`.
  - **Minh bạch Cơ chế Xóa trên UI:**
    - App Uninstaller & Space Lens: Mặc định chuyển vào Thùng rác (`trashItem`).
    - System Junk & Orphan Files: Xóa trực tiếp (`removeItem` hoặc `rm -rf` qua AppleScript với quyền admin sau khi người dùng nhập mật khẩu/Touch ID).

### Điểm khó 3: Phân tích Cây Thư mục Đệ quy & Space Lens Visualizer (Độ khó: 8/10)
* **Vấn đề:** Quét đệ quy cây thư mục người dùng với hàng trăm ngàn tệp có thể ngốn hàng Gigabyte RAM, gây nghẽn I/O và làm đơ giao diện.
* **Giải pháp kiến trúc:**
  - `SpaceLensEngine` xử lý đệ quy đa luồng (Concurrent Queue) với độ sâu giới hạn cấu hình được.
  - Tổng hợp dung lượng theo cấu trúc cây phân cấp (Hierarchical Node Tree), chỉ lưu trữ các node có dung lượng vượt ngưỡng tối thiểu (ví dụ: `> 10MB`).
  - Giao diện trực quan hóa dạng Bubble Map / Treemap hỗ trợ drill-down (đi sâu vào từng thư mục con) mà không cần render toàn bộ hệ thống file cùng lúc.

### Điểm khó 4: Quản lý Vòng đời Cửa sổ, Dock và Menu Bar (Độ khó: 7/10)
* **Vấn đề:** Trên macOS, hành vi đóng cửa sổ chính của một tiện ích dọn dẹp hệ thống chuẩn mực cần: không thoát app, ẩn icon trên Dock để tránh chiếm chỗ, nhưng vẫn duy trì icon trên Menu Bar; khi bấm vào Menu Bar hoặc mở app từ Spotlight/Launchpad thì cửa sổ và Dock phải xuất hiện lại ngay lập tức.
* **Giải pháp kiến trúc:**
  - Thiết lập vòng đời qua `NSApplication.ActivationPolicy`:
    - Khi cửa sổ chính mở: Chuyển sang `.regular` (hiển thị trên Dock và Command-Tab).
    - Khi đóng cửa sổ chính cuối cùng: Chuyển sang `.accessory` (ẩn khỏi Dock, chỉ giữ Menu Bar).
  - Rust Bridge giám sát sự kiện `tauri::WindowEvent::CloseRequested`, ngăn chặn thoát tiến trình và kích hoạt ẩn cửa sổ.

---

## 3. Kiến trúc Luồng Dữ liệu & Hợp đồng Tương tác (IPC Data Flow)

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   KIẾN TRÚC TỔNG THỂ CỦA VXCLEAN                       │
└────────────────────────────────────────────────────────────────────────┘

  [ React Frontend (Tauri WebView) ]
      │  UI State, Theme Navy/Slate, Desktop Density
      │  Components: Dashboard, SmartScan, Cleaner, Uninstaller, SpaceLens, Settings
      │
      ▼ (Tauri IPC `invoke`)
  [ Tauri 2 Host (Rust Core) ]
      │  Command Routing & Sandbox Validation
      │  Commands: get_capabilities, get_system_snapshot, execute_scan, execute_clean
      │
      ▼ (Subprocess Execution with Timeout & JSON stdout)
  [ Platform Engine: `vxclean_engine` (macOS Swift CLI) ]
      ├── `metrics`: Đọc Mach kernel VM, CPU ticks, statfs disk, IOKit battery
      ├── `scan`: Duyệt thư mục theo Locations.swift & Conditions.swift
      ├── `clean`: Thực thi removeItem / trashItem / admin osascript
      └── `spacelens`: Duyệt đệ quy cây dung lượng disk
```

### Hợp đồng Dữ liệu Phiên bản 1.0 (Protocol Contract v1.0)
Mọi phản hồi từ `vxclean_engine` trả về Rust Core và đẩy lên Frontend đều tuân thủ cấu trúc chuẩn mực khớp trực tiếp với [desktop/src/types.ts](../../desktop/src/types.ts):
```json
{
  "protocol_version": "1.0",
  "platform": "macos",
  "timestamp": "2026-10-09T05:20:00Z",
  "metrics": {
    "cpu": { "usage": 14.2, "history": [10.2, 12.5, 14.2] },
    "memory": { "used_bytes": 26626859008, "total_bytes": 34359738368, "active_bytes": 15139049472, "wired_bytes": 6657982464, "compressed_bytes": 4829827072, "fraction": 0.775 },
    "disk": { "used_bytes": 700147630080, "total_bytes": 1000204886016, "available_bytes": 300057255936, "fraction": 0.70 },
    "battery": { "has_battery": true, "charge_percent": 86, "is_charging": true, "is_ac_powered": true, "is_charged": false }
  }
}
```
*Ghi chú:* Đối với các subcommand tác vụ khác (`scan`, `clean`, `apps`, `lens`), payload chi tiết được trả về trực tiếp theo các schema tương ứng trong [04_api_data.md](04_api_data.md).


---

## 4. Hệ thống Tài liệu Đặc tả Chi tiết (Specification Roadmap)

Bộ tài liệu đặc tả được cấu trúc đồng bộ theo 7 tài liệu chuẩn mực VXUtilities:

| Thứ tự | Mã tài liệu | Tên file | Trọng tâm nội dung |
| :--- | :--- | :--- | :--- |
| **00** | `_spec0_system` | [00_system_overview.md](00_system_overview.md) | Tổng quan hệ thống, tôn chỉ sản phẩm, ma trận độ khó, kiến trúc 3 tầng |
| **01** | `_spec1_business_process` | [01_business_process.md](01_business_process.md) | Quy trình nghiệp vụ vĩ mô, Swimlane phân quyền FDA, ma trận an toàn xóa tệp |
| **02** | `_spec2_feature_flow` | [02_feature_flow.md](02_feature_flow.md) | Luồng trạng thái (State Flow) cho Smart Scan, Deep Clean, Uninstaller, Space Lens, Menu Bar |
| **03** | `_spec3_ui_wireframe` | [03_ui_wireframe.md](03_ui_wireframe.md) | Bố cục màn hình, wireframe text, thông số Tailwind, trạng thái empty/loading/error |
| **04** | `_spec4_api_data` | [04_api_data.md](04_api_data.md) | Khế ước IPC Tauri, JSON schemas đầu vào/đầu ra, định nghĩa DTO TypeScript/Rust |
| **05** | `_spec5_qa_acceptance` | [05_qa_acceptance.md](05_qa_acceptance.md) | Tiêu chí nghiệm thu Gherkin (Given-When-Then), ma trận edge cases, checklist kiểm thử |
| **06** | `_spec6_demo_presentation` | [06_demo_presentation.md](06_demo_presentation.md) | Kịch bản trình diễn (Demo Playbook), checklist kiểm chứng thực tế và kịch bản video |
