# VXClean — Log phát triển và bàn giao thiết kế

Ngày ghi: **2026-10-07, giờ Việt Nam (UTC+7)**.

## 1. Đang ở đâu

**Đã kiểm chứng kiến trúc Tauri + React gọi Swift engine trên Mac bằng một dashboard chạy thật. Chưa chuyển toàn bộ ứng dụng sang UI mới. Bước tiếp theo là thiết kế wireframe/flow cho các tính năng đầy đủ.**

Hiện có hai phần source cùng tồn tại:

| Phần | Vị trí | Trạng thái |
|---|---|---|
| App native SwiftUI kế thừa MClean | `MClean/`, `MClean.xcodeproj/`, `project.yml` | Đã tùy biến source thành VXClean; giữ các tính năng gốc để đối chiếu. Chưa build và kiểm chứng GUI bản native mới. |
| Bản thử UI chung Tauri + React | `desktop/` | Đã build debug `.app`, mở GUI và kiểm chứng dashboard đọc CPU/RAM/disk/battery thật qua Swift. |

Dashboard bản thử hiện là **màn chỉ số hệ thống**, chưa phải toàn bộ dashboard quản lý quét/dọn dẹp của app gốc. Bố cục hiện tại chỉ đủ kiểm chứng kết nối, chưa phải thiết kế sản phẩm cuối cùng.

## 2. Mục tiêu và yêu cầu đã thống nhất với user

- Tên sản phẩm: **VXClean**, tùy biến từ MClean trong repo `vxclean`.
- Giữ chức năng dashboard, Smart Scan, dọn dẹp, app uninstaller và Space Lens như bản gốc.
- Menu bar có tổng quan chi tiết hơn, tham khảo mức độ thông tin của CleanMyMac; đây là yêu cầu về thông tin/UX, chưa chốt việc sao chép bố cục của sản phẩm đó.
- Đóng cửa sổ chính cuối cùng → app tiếp tục chạy nền/menu bar và biến mất khỏi Dock. Mở lại → hiện cửa sổ và Dock. Quit → thoát hẳn.
- Đồng bộ stack UI và phong cách với **VXMedia** (`../vxmedia`) và **VXPhotos** (`../vxphotos`).
- Chuẩn bị kiến trúc để sau này dùng lại phần lớn UI trên Windows. **Chưa có bản Windows hoặc engine Windows chạy được.**
- Docs của tác giả nằm trong `docs_upstream/`; docs VXClean nằm trong `docs/`.
- Codex lập kế hoạch/review; Anti thực thi UI và các task vừa/dài. Codex được sửa nhanh những lỗi nhỏ phát hiện trong review.

## 3. Những gì đã làm

### A. Tiếp nhận source và bảo lưu nguồn gốc

- Đổi thư mục docs gốc thành `docs_upstream/`, tạo docs riêng cho VXClean và lưu README gốc.
- Ghi provenance: origin là `https://github.com/linhbv94/Cleaner_for_Mac.git`; upstream theo README là `https://github.com/maclifevn/MClean`.
- Commit import local: `42cf1f86ae91bc191858d2ae9df197e026da8f2b`.
- **Hash commit upstream chưa xác minh** vì bản import không mang theo lịch sử upstream; không coi hash import local là hash upstream.
- Giữ LICENSE MIT và ghi nhận tác giả gốc. Các thay đổi hiện vẫn nằm trong working tree; chưa tạo commit mới hoặc push trong quá trình này.

### B. Tùy biến source native SwiftUI

- Đổi branding hiển thị, product/output app, onboarding, About và các namespace cấu hình sang VXClean; giữ module `MClean` để tương thích source/tests hiện có.
- Đồng bộ bộ 385 khóa localization giữa 5 ngôn ngữ: en, vi, ja, zh-Hans, zh-Hant.
- Tắt update check upstream và chặn luồng release cũ; lưu cấu hình release gốc trong `docs_upstream/release_support/`.
- Bổ sung tổng quan menu bar CPU/history, RAM active/wired/compressed, dung lượng khả dụng và pin; tiết chế việc lấy mẫu chi tiết khi popover đóng.
- Viết policy/lifecycle cho close, reopen, settings/modal và Dock theo yêu cầu user.
- Giữ các engine quét/dọn dẹp/Space Lens và logic tìm app để tái sử dụng. Bổ sung loại trừ tự thân `vxclean` trong `Conditions.swift`.
- Đọc và ghi lại hành vi xóa thật: có luồng vào Trash, có luồng xóa trực tiếp/admin fallback. **Không được viết UI/copy rằng mọi thao tác đều đưa vào Trash.**

Các sửa đổi menu bar/Dock ở phần native là **source đã triển khai và policy đã test**, chưa phải bằng chứng GUI lifecycle đã chạy đúng.

### C. Chốt kiến trúc UI chung và tạo bản thử

```text
React + TypeScript + Vite + Tailwind
                  ↓ invoke
             Tauri 2 / Rust
                  ↓ executable + JSON
        Swift native engine trên macOS

Windows về sau: cùng UI/contract, adapter hệ thống riêng.
```

- Stack frontend khớp dependency của VXMedia/VXPhotos: React 19.3, TypeScript 7.0, Vite 8.3, Tailwind 4.3, Tauri 2.12 và Lucide React.
- Dùng theme navy/slate, accent cyan, mật độ desktop compact, font hệ thống, dark/light theo [master_theme.md](../../_summary/master_theme.md).
- Tạo React shell/sidebar/dashboard và trạng thái chức năng chưa chuyển.
- Tạo Swift entry tại `desktop/native/main.swift`, **compile cùng `MClean/Services/SystemMonitor.swift` thật**, không viết lại thuật toán telemetry.
- Rust có hai command: `get_capabilities` và `get_system_snapshot`. Snapshot chứa protocol_version `1.0`, platform, timestamp và CPU/RAM/disk/battery.
- Gọi engine với argv cố định `metrics`, có timeout, xử lý exit/JSON/version/platform; không cấp frontend quyền shell tùy ý.
- Đóng gói engine vào `Contents/Resources/vxclean_engine`; resource mapping chỉ áp dụng cho macOS. App khai báo macOS tối thiểu 13.0.
- UI lấy snapshot lúc mở app và khi bấm Làm mới; **chưa phải monitor streaming liên tục**. Lấy CPU delta mất khoảng 2 giây; refresh có khóa chống gọi song song.
- Browser preview chỉ thông báo cần mở desktop, không hiển thị chỉ số giả như dữ liệu thật.
- Icon hiện lấy tạm từ upstream, chưa có bộ icon VXClean riêng.

### D. Review và sửa lỗi bản thử

- Sửa Swift entry để phù hợp chế độ compile; dùng module cache và toolchain CLT.
- Sửa import/tên file, vòng re-export và lỗi filesystem không phân biệt chữ hoa/thường. Cleanup có kiểm tra `samefile()` để không xóa nhầm cùng một file.
- Sửa Tailwind dark variant, đường dẫn resource khi đóng gói, giới hạn dev fallback, timeout và thu hồi child process.
- Bổ sung Vite type declarations/capability cho window drag và icon mà Tauri cần khi build.
- Rút gọn copy UI, ghi rõ snapshot/bản thử/chức năng chưa chuyển; sửa sidebar để tên các mục hiển thị đầy đủ.

## 4. Đã kiểm chứng đến mức nào

| Kiểm chứng | Kết quả và giới hạn |
|---|---|
| Native source | Parse 24 file Swift được chọn, typecheck AppConstants/SystemMonitor, plist/localization/config checks và 7 test production lifecycle policy đều pass. Không thay thế full build hoặc GUI test. |
| Swift engine mới | Compile bằng Command Line Tools; chạy `metrics` trả JSON dữ liệu thật; từ chối đối số sai hoặc thiếu. |
| React/Rust | TypeScript, Vite build và `cargo check --offline` pass. |
| Debug app bundle | Tauri build `.app` thành công bằng CLT, dependency cache offline; engine có trong Resources. |
| GUI Mac | Mở app, thấy CPU/RAM/disk/battery thật. Bấm Làm mới: nút bị disable khi lấy mẫu, sau đó timestamp/CPU cập nhật. Đã mở lại artifact cuối và xem bố cục sidebar/dashboard. |
| Chưa kiểm chứng | Windows, clean install dependency độc lập, release/notarization, FDA, xóa file thật, GUI menu bar/Dock mới, sleep/wake và các màn chức năng còn lại. |

Chỉ số RAM là ước tính từ Mach VM; dung lượng khả dụng có thể gồm purgeable. Khi đọc thông số ngoài môi trường desktop, sandbox của công cụ có thể hạn chế API dung lượng; không coi giá trị thiếu là kết luận ổ đĩa đầy.

## 5. Ma trận tính năng để Anti thiết kế tiếp

| Tính năng | Native baseline | Tauri hiện tại | Wireframe cần bao phủ |
|---|---|---|---|
| Dashboard | Có màn tổng quan/quét gốc | Chỉ có telemetry thật | Tổng quan dung lượng, trạng thái máy, kết quả quét, hành động chính; phân biệt hệ thống và rác có thể dọn. |
| Smart Scan | Có engine/flow gốc | Chưa chuyển, capability false | Idle → scanning/progress → results → chọn mục → xác nhận → cleaning → kết quả/lỗi. |
| Dọn dẹp theo nhóm | Có category/scanner/cleaner | Chưa chuyển | Danh sách nhóm, chi tiết file, selection, quyền truy cập, xử lý thành công/một phần/thất bại. |
| App uninstaller | Có tìm app và file liên quan | Chưa chuyển | Danh sách/search app, chi tiết file liên quan, chọn mục, xác nhận hành vi gỡ, kết quả. |
| Space Lens | Có engine và UI gốc | Chưa chuyển | Chọn vị trí → phân tích → trực quan dung lượng/drill-down → chọn file → hành động và kết quả. |
| Menu bar | Source native đã bổ sung | Chưa chuyển | Popover CPU/RAM/storage/battery, mở app, Smart Scan, settings, Quit; trường hợp không có pin. |
| Dock/background | Native policy có test logic | Chưa chuyển | Quy tắc đóng/mở cửa sổ, menu bar vẫn chạy, explicit Quit; không tạo màn UI không cần thiết. |
| Settings/quyền | Có native baseline | Chưa chuyển | Theme, tùy chọn menu bar/nền, quyền FDA theo nhu cầu, trạng thái thiếu quyền và cách khắc phục. |

Trạng thái "Chưa chuyển" trong bản thử là thông tin tiến độ triển khai, **không phải thiết kế cuối cùng của các màn**. Anti có thể thiết kế flow đầy đủ, nhưng phải tách rõ wireframe/demo fixture với chức năng đã nối engine.

## 6. File nên đọc khi tiếp quản

1. Log này và [theme chung](../../_summary/master_theme.md).
2. [Kiểm chứng Tauri/GUI](tauri_bridge_verification.md), [đối soát hành vi xóa](safety_audit.md), [provenance](upstream_provenance.md).
3. [App React](../desktop/src/app.tsx), [dashboard](../desktop/src/components/dashboard.tsx), [sidebar](../desktop/src/components/sidebar.tsx), [CSS](../desktop/src/index.css), [DTO](../desktop/src/types.ts), [frontend bridge](../desktop/src/services/tauri_bridge.ts).
4. [Rust bridge](../desktop/src_tauri/src/engine_bridge.rs), [Swift entry](../desktop/native/main.swift), [SystemMonitor dùng chung](../MClean/Services/SystemMonitor.swift).
5. Đối chiếu flow/ảnh gốc tại [README tác giả](../docs_upstream/readme_original.md), `docs_upstream/assets/`, `MClean/Views/`, `MClean/ViewModels/` và các engine trong `MClean/Services/`.

[verification.md](verification.md) và [baseline_build_test.md](baseline_build_test.md) ghi giai đoạn native trước khi có bản thử Tauri; các mô tả môi trường/binary ở đó thuộc thời điểm kiểm chứng cũ. Dùng log này và báo cáo Tauri để hiểu trạng thái mới nhất.

## 7. Chạy lại bản thử

Từ root `vxclean`:

```bash
DEVELOPER_DIR=/Library/Developer/CommandLineTools python3 scripts/verify_tauri_bridge.py
```

Từ thư mục `desktop`:

```bash
DEVELOPER_DIR=/Library/Developer/CommandLineTools npm run tauri -- build --debug --ci --bundles app -- --offline
```

Artifact: `desktop/src_tauri/target/debug/bundle/macos/VXClean.app`.

Frontend hiện dùng symlink `desktop/node_modules` tới node_modules của VXMedia cho bản thử; clean install độc lập chưa xác minh. Binary/cache/build outputs được Git bỏ qua. `dist/MClean.app` ở root vẫn là binary upstream, không phải bản VXClean mới.

## 8. Prompt chuyển sang Anti

> Đọc `docs/development_log.md` trong repo `vxclean` để nắm trạng thái VXClean. Dựng wireframe và user flow cho dashboard, Smart Scan, cleanup, uninstaller, Space Lens, menu bar và settings, giữ chức năng native gốc và đồng bộ theme/stack với VXMedia/VXPhotos. Dashboard React hiện chỉ là bản thử telemetry, không phải thiết kế cuối. Bao phủ idle/loading/progress/results/empty/error/thiếu quyền/xác nhận thao tác và trường hợp Mac không có pin. Đọc `docs/safety_audit.md` trước khi viết copy về xóa file. Lưu output thiết kế trong `docs/wireframes/`, tên snake_case, link tương đối. Ghi rõ phần thiết kế đề xuất và phần đã nối engine; chưa triển khai backend hoặc xóa baseline ở bước wireframe. Không gọi ngược Codex/agent CLI. Tuân thủ AGENTS.md: tiếng Việt, không LaTeX.
