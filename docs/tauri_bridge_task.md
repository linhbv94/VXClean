# VXClean — kiểm chứng kiến trúc React ↔ Swift

[Sub-process Task: DO NOT invoke other agent CLIs]

User đã giao Anti thực thi UI và công việc kỹ thuật, Codex lập kế hoạch/review. Được ghi source trong cleaner_for_mac. Đây là một lát cắt chạy thật để kiểm chứng kiến trúc, chưa phải chuyển toàn bộ app.

## Quyết định kiến trúc

- UI React + TypeScript + Vite + Tailwind, Tauri 2/Rust làm desktop shell.
- macOS dùng Swift native engine; Windows sau này có adapter riêng cùng contract. Không gọi backend macOS là backend Windows.
- Tái sử dụng UI, DTO, trạng thái loading/error và theme; capability quyết định chức năng nào khả dụng theo OS.
- Giữ source SwiftUI hiện tại làm baseline đến khi đạt parity: dashboard, Smart Scan, cleanup, uninstaller, Space Lens, menu bar/Dock.

## Output trong một lượt

1. Tạo thư mục `desktop/` với frontend và Tauri shell. Ưu tiên `src_tauri/`, chạy CLI tại thư mục chứa config nếu cần; tên chuẩn tool như Cargo.toml/tauri.conf.json được giữ. Không sửa sibling apps hay dist/MClean.app.
2. Đọc `../media_tool/package.json`, `../photo_picker/package.json`, `../_summary/master_theme.md`, CSS của VXMedia. Đồng bộ stack/theme thực tế. Compact navy/cyan, sidebar, dashboard CPU/RAM/disk/battery, dark/light, Lucide, tiếng Việt. Giao diện thật hiển thị dữ liệu lấy từ engine; browser preview hiển thị trạng thái cần mở desktop, không bịa số.
3. Swift executable trong `desktop/native/`: compile **MClean/Services/SystemMonitor.swift thực tế**, không copy lại thuật toán. Một entry mới chạy snapshot (CPU lấy delta đủ 2 giây, RAM/disk/battery), encode JSON có protocol_version, platform, timestamp và metrics. Arg cố định `metrics`; lỗi stdout/stderr/exit code rõ ràng; không quyền xóa, shell, FDA. MainActor/RunLoop phải thực sự chạy để lấy CPU delta.
4. Tauri command `get_capabilities` và `get_system_snapshot`: Rust gọi executable bundled bằng đường dẫn do app resolve (không hardcode workspace khi đóng gói), argv cố định, async/blocking hợp lý, timeout/kill và kiểm tra exit/JSON. Frontend không được có shell execute quyền tổng quát. Đóng gói Swift bằng resource mapping hoặc sidecar theo tài liệu Tauri. Platform config: chỉ Mac có engine; Windows adapter trả unsupported rõ ràng và build Rust không import API Mac vô điều kiện.
5. UI dashboard refresh, loading/error rõ, chặn refresh song song. Các mục Smart Scan/cleanup/uninstaller/Space Lens ghi chưa chuyển, không nút giả báo thành công. Menu bar/Dock là bước tiếp sau, không claim đã port.
6. Script `scripts/verify_tauri_bridge.py` và build script tương ứng dùng subprocess argv, timeout, temp caches trong workspace hoặc /tmp. Luôn đặt DEVELOPER_DIR=/Library/Developer/CommandLineTools: máy hiện chọn Xcode chưa nhận license, không tự nhận license hay đổi xcode-select. Compile Swift từ CLT; run kiểm chứng JSON dữ liệu thật và invalid arg; frontend tsc/Vite build; cargo check/build --offline nếu cache có. Có thể dùng node_modules từ ../media_tool bằng symlink local gitignored cho spike, ghi rõ chưa xác minh clean install. Không tải dependency mới; nếu offline thiếu báo đúng phần bị chặn. Cấu hình pnpm/npm/cargo phải dùng scripts rõ ràng.
7. Ghi `docs/tauri_bridge_verification.md`: lệnh/kết quả thật, phạm vi chứng minh, giới hạn chưa test GUI/Windows/package nếu chưa chạy. Thêm link vào docs/readme.md. .gitignore loại node_modules, target, frontend build, Swift binary; không ignore source/package lock. Không commit/push.

## Thực thi hiệu quả

- Đọc skill `_uxui0_core` và quy tắc UI phù hợp; theme có sẵn là ground truth, không sinh design system mâu thuẫn hay đổi theme toàn suite.
- Dùng file tools để tạo/sửa. Nếu cần command batch, viết script trong scripts/ và gọi `python3 scripts/<name>.py`; đã cấp permission cho mẫu này. Không shell substitution, không rm, không python -c, không gọi agy/codex hay subagents.
- Không đọc lại toàn repo; chỉ dependency và file liên quan. Budget thời gian 10 phút. Kết thúc với file đã đổi và kết quả xác minh, không SUCCESS nếu checks chưa pass.
- Lưu ý: Bắt buộc tuân thủ quy chuẩn AGENTS.md — Tuyệt đối KHÔNG dùng cú pháp LaTeX, công thức plain text/Unicode, Tiếng Việt chuyên nghiệp, snake_case.
