# VXClean 1.0.4 — sửa Quick bị chặn tại host

Ngày: 2026-10-11. Bản user đang chạy: 1.0.3.

## Nguyên nhân

Host Rust từ chối alias macOS `/tmp` vì canonical path là `/private/tmp`, trong khi native scanner/cleaner cho phép alias OS này. `collect_manifests` bỏ lỗi nên item vẫn hiển thị chọn được; `bind_identities` chặn cả batch với `protected_target: partial/unsupported target`. Lỗi xảy ra trước native cleanup và flow xin quyền admin.

## Sửa và bằng chứng

- Host chỉ chấp nhận ba alias cố định đã được native hỗ trợ: `/tmp`, `/var/log`, `/var/tmp`; không chấp nhận symlink tùy ý. Không đổi rule MClean hoặc phạm vi Quick.
- Scan read-only bằng engine bản cài: 318 mục cleanable, 116 mục alias; probe host mới không có mục thiếu manifest.
- 23 Rust tests PASS, gồm tạo fixture 4KB dưới `/tmp`, remember → bind identities → native production clean, success_count=1 và thư mục biến mất; symlink tùy ý vẫn bị chặn.
- Lần thử đầu dùng fixture 7 byte bị native từ chối scope_changed vì không thuộc scan System Junk. Tăng fixture lên 4KB, giữ nguyên rule engine, chạy lại toàn bộ đạt.
- Không dọn dữ liệu thật của user trong lượt sửa. GUI dọn và popup mật khẩu admin chưa kiểm chứng; popup chỉ cần khi native gặp permission, không hiện vô điều kiện.

## Phân phối

Patch local 1.0.4 đã cài vào /Applications/VXClean.app và mở lại. Giữ backup 1.0.3 tại /tmp/vxclean_pre_alias_fix_1_0_3.app. Build app/DMG, codesign và updater signature/tampered-artifact rejection đạt; fixture qua engine đóng gói cũng PASS. Chưa commit/push/tag/publish. Artifact và trạng thái cài ghi tại [quick_host_alias_fix_evidence.json](quick_host_alias_fix_evidence.json).
