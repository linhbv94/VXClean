> **Cập nhật rule Quick theo user:** mục “Điều chỉnh theo user: góc nhìn dọn rác” trong [spec21](21_quick_scan_clean_parity.md) ưu tiên hơn các yêu cầu24h/giữ build-tool dưới đây; detailed không đổi.

> **Chốt mới 2026-10-11:** Detailed không nhận target đã cleanable bởi Quick, kể cả child dưới target đó. Chỉ bổ sung vùng/target ngoài coverage Quick; không cần user dọn Quick trước. Quy tắc parent-child, scope và QA ở [spec21](21_quick_scan_clean_parity.md). Engine đã nối loại trùng theo target Quick cleanable; kiểm chứng mới ở spec22.

> **Chốt phạm vi theo user 2026-10-11:** Cache của Chrome, Adobe, CapCut và Codex nằm trong `~/Library/Caches` vẫn thuộc User Cache của Quick, theo rule đủ điều kiện. Có nhóm Chrome/Media/AI trong Detailed không phải lý do loại vendor đó khỏi Quick. Detailed bổ sung các vùng riêng (Application Support, Movies, cache chuyên biệt) và matcher chi tiết; không bắt buộc thay thế toàn coverage Quick. Việc Detailed User Cache đánh owner `adobe` là `unvalidated` chỉ chặn lựa chọn trong scope Detailed, không ngăn Quick dọn `Library/Caches/Adobe`. Đây là phân phạm vi được user chấp nhận; hạn chế coverage Detailed ghi riêng, không coi là lỗi chuyển nhánh. Audit: [user_cache_rule_audit.md](../user_cache_rule_audit.md).

> Override hiện hành 2026-10-11: riêng System Junk Quick clone toàn bộ rule MClean, không còn filter tên/profile/IPC/lock/tuổi/hardlink. Quyết định và kiểm chứng ở [spec21](21_quick_scan_clean_parity.md). User Cache/detailed giữ policy riêng.


# Truth hành vi engine hiện tại

> **Ưu tiên hiện hành 2026-10-11:** [spec20](20_quick_release_priority.md) thay các yêu cầu adapter riêng cho mọi cache Quick và gate full-detail dưới đây. Cache thường MClean được maintenance; Quick log/temp không còn ngưỡng24h hay guard build/tool; IPC/credential/path/identity/quyền vẫn giữ theo [spec21](21_quick_scan_clean_parity.md). Số 0B/15MB và trạng thái chỉ-adapter dưới đây là bằng chứng lịch sử, không mô tả source hiện hành. Kết quả gói cuối xem [checklist](../release_readiness_checklist.md).


Ngày cập nhật: 2026-10-10. Baseline trước triển khai được giữ trong [snapshot lịch sử](../spec_history/13_engine_behavior_before_implementation.md); không dùng baseline đó để nghiệm thu source mới.

Nguồn chuẩn hiện tại:

- [Implementation local và giới hạn](17_local_implementation_status.md): scope scanner, policy mutation, lifecycle, protocol, journal và nhánh đang khóa.
- [Gate trước release](18_release_completion_gates.md): yêu cầu còn phải chứng minh.
- [Báo cáo local](../local_completion_report.md) và [hash/evidence](../local_artifact_evidence.json): phân biệt source, gói đã build, QA thực và phần chưa đạt.

Quick chỉ System Junk/User Cache/Large & Old, cả revalidation; các nhánh chuyên biệt ở Detail. Cleanup, uninstall, orphan và Lens dùng authority riêng. Cache phải khớp rule executable độc lập ở native, identity/manifest và điều kiện runtime. Checkbox hoặc tên cache không tự cấp quyền xóa. Dữ liệu chưa xác minh vẫn hiển thị nhưng bị khóa; không coi mọi mục phát hiện là dung lượng có thể dọn.

AI Apps đã chuyển sang Codex/Antigravity/ChatGPT; history/images/plugin/runtime/updater được giữ. Menubar, updater và lifecycle đã có implementation, song full Chrome session restore/AI cold-start và compatibility nhiều OS chưa được chứng minh. Không gán release-ready cho toàn bộ scope chỉ từ build hoặc fixture.

## Quét nhanh — cập nhật tiếp2026-10-10

Adapter mới cho HTTPpayload UUID tại fsCachedData của helpd/tipsd/AMPLibraryAgent; giữ parent/database/WAL/SHM/HSTS/state. Diagnostic cá nhân .ips/.crash/.diag trực tiếp cũ≥7ngày có thể chọn, mặc định bỏ chọn vì báo cáo cũ không tái tạo. System/temp/log khác vẫn khóa. UI hiển thị lý do khóa, hậu quả và tổng phát hiện/đủ điều kiện riêng.22nativegroups/20Rust đạt: Foundation cold cache500KB→native dọn payload→cache miss→tạo lại500KB; database/state giữ bytes; báo cáo mới/type sai/nested bị từ chối. Scan thật chỉ đọc~15MB cacheeligible; không dọn dữ liệu thật lượt này. [Spec](19_quick_cleanup_validation.md) · [Evidence](../quick_cleanup_validation_evidence.json). Gói/QA UI ghi trạng thái hiện tại trong evidence, không suy từ build sang nghiệm thu mọi scope.

## Quick live cache lớn — 2026-10-27

Theo [spec24](24_single_admin_pass_quick_live_cache.md), live_cache_root dùng ticket root identity; native duyệt kiểm chứng toàn cây rồi batch512file, không dùng full-subtree manifest hoặc cap20.000entries/3MiB để loại cache lớn. Quyền/rule/link/identity/journal vẫn đối soát độc lập. Strict cleanup và Lens không đổi. Xem [báo cáo/evidence](../large_cache_cleanup_report.md).
