# Gói VXClean chờ review — 2026-10-11

Scope: bản Quick trước, manager pnpm/Anti và ownership Quick–Detail. Không commit/push/tag/publish. Gói arm64 0.1.0 hiện mở trên máy; [hash và chữ ký](local_artifact_evidence.json), [bằng chứng runtime/test](manager_cleanup_completion_evidence.json), [checklist](release_readiness_checklist.md).

## Điểm reviewer cần kiểm tra

- pnpm executable/argv cố định, store được nhận diện và xác minh lại; scan không prune. Store v11 hiện 12.288 bytes; v10 866.278.140 bytes không do CLI hiện tại quản lý. Không hứa toàn bộ inventory được thu hồi. Lỗi sau khi manager bắt đầu giữ outcome_unknown, không tự replay.
- Hai ZIP com.google.antigravity được engine đối chiếu bundle/version lúc scan và trước dọn; không cấp parent pending/state. IDE khác bundle chưa có rule installer; cache frontend cụ thể vẫn hỗ trợ.
- Quick/Detailed canonical path ownership, gồm alias /tmp; parent Detailed không được cấp quyền bao phủ Quick. Real scan overlap0; không xem hai tổng dung lượng bằng nhau là chứng minh rule bằng nhau.
- Quick vẫn theo spec21/MClean ở System Junk, scan có partial thì thông báo thật. Native26 + manager9 đạt; Rust21 từ lượt trước, host không đổi trong sửa alias cuối. Gói cuối codesign/Rust+Node signatures/tamper đạt.

## Chưa chứng minh, không đánh dấu PASS

- Hộp thoại quản trị OS Cancel: helper thật đã xóa đúng fixture, chưa kiểm được Cancel. CUA chặn SecurityAgent. Cần smoke thủ công trên dữ liệu thử.
- Physical tray icon/click: SystemUIServer CUA timeout; cần nhìn/click trên máy. Panel/icon tests có sẵn không thay bằng chứng đó.
- Intel/macOS13 và updater install/restart, remote CI/draft assets cần agent release xử lý theo quyền riêng. Gói ad-hoc, chưa notarized. Detailed full scope còn backlog, không dùng để chặn bản Quick theo user.

Không dọn dữ liệu user/prune store thật trong lượt nghiệm thu này. [Ảnh pnpm](manager_cleanup_ui.png), [xác nhận](manager_prune_confirmation_ui.png).
