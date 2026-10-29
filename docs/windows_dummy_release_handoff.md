# Bàn giao Windows UI-only cho agent release
Ngày cập nhật: 2026-10-15

## Phạm vi được user chốt

Mac giữ hành vi hiện tại. Windows x64 có giao diện và dummy engine, chưa có scan/cleanup/uninstall/metrics/Space Lens/system tray engine. Không đưa dữ liệu mock vào gói production. User sẽ giao agent chuyên release; task hiện tại không commit/push/tag/publish hoặc upload key.

## Implementation

- `desktop/src_tauri/src/windows_dummy.rs`: command adapter riêng theo compile target Windows. Engine commands reject trước mọi filesystem/process action, history rỗng; update prepare/resume/restart giữ state guard và main-window scope. Worker Lens CLI không chạy trên Windows.
- `desktop/src_tauri/tauri.windows.conf.json`: cửa sổ Windows không native decoration trùng, NSIS current-user `.exe`; không thêm Swift resource hay FDA.
- Sidebar vẫn điều hướng các màn, banner Windows UI-only, tính năng chưa có trả thông báo rõ. Settings/theme/window controls/updater là shell hiện có; chưa claim updater E2E Windows.
- `.github/workflows/build.yml` thêm job Windows chạy Rust tests và build NSIS không cần signing secret. Release workflow hiện vẫn macOS; không tự publish Windows bằng pipeline Mac cũ.

## Agent release cần làm

1. Đọc spec26, hướng dẫn root `_summary/standard_docs/desktop_system_permissions.md`, trạng thái Git và thay đổi có trước. Chọn version mới theo release request; chưa bump version trong task dummy.
2. Chạy Windows CI đúng commit. Trên Windows: `npm ci --ignore-scripts` tại desktop; `cargo test --locked --lib maintenance_bridge::tests` tại src_tauri (Mac vẫn chạy toàn bộ hồi quy); `npm run tauri -- build --bundles nsis`. Khi chỉ check build không có updater secret, thêm `--config '{"bundle":{"createUpdaterArtifacts":false}}'`. Không dùng cấu hình bỏ updater artifact cho bản release có updater.
3. `.exe` ở `desktop/src_tauri/target/release/bundle/nsis/`. Kiểm tra cài/mở/chuyển màn/dark mode/minimize/maximize/close; thao tác scan/dọn/gỡ chỉ báo chưa hỗ trợ, không giả success; không yêu cầu quyền admin/FDA để dùng shell.
4. Nếu publish Windows: bổ sung asset/manifest platform và verifier phù hợp, tái sử dụng updater key đúng app sau khi có quyền; không đổi signer Mac. Note Windows UI-only và cảnh báo Windows unsigned/SmartScreen theo thực tế; không claim chức năng cleaner hoạt động.
5. Kiểm tra hồi quy Mac, đúng artifact/signature/public endpoints và ghi rõ Windows WebView2/updater/runtime đã test hay chưa. Không diễn giải local Mac compile là `.exe` đã cài chạy được.

## Giới hạn môi trường

Triển khai trên macOS; chưa có Windows GUI/runtime và không tự dispatch CI/push trong task này. Xem work log để biết checks thực tế và blockers; cần Windows runner tạo installer trước nghiệm thu artifact.

## Checks triển khai đã chạy

- Mac `cargo test --locked --lib`:50/50 đạt, gồm2dummy tests. Lỗi Tauri macro trùng khi compile cả hai adapter trong test đã sửa bằng cfg_attr Windows; commands Windows giữ đủ23 entry points. Bridge mutation Mac không sửa.
- Frontend TypeScript/Vite build đạt;7release automation tests đạt; FDA broker11 nhóm/typed defer, history và Lens cache/navigation JS đạt; YAML/config parse và diff whitespace đạt.
- Native build cache cũ trỏ đường dẫn repo trước rename đã làm mới riêng tauri/plugin outputs; lượt test cuối đạt. Không thay source engine Swift.
- Cross Windows dừng trong dependency ring do thiếu Windows SDK C headers (`assert.h`), chưa đến compile full app Windows. Job Windows mới chưa chạy vì không push/dispatch trong task này. Chưa có `.exe`, cài đặt hay GUI Windows evidence; đây là bước cần agent release thực hiện, không coi đã QA Windows.
