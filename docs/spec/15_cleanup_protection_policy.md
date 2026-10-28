> **Cập nhật rule Quick theo user:** mục “Điều chỉnh theo user: góc nhìn dọn rác” trong [spec21](21_quick_scan_clean_parity.md) ưu tiên hơn các yêu cầu24h/giữ build-tool dưới đây; detailed không đổi.

> Override hiện hành 2026-10-11: riêng System Junk Quick clone toàn bộ rule MClean, không còn filter tên/profile/IPC/lock/tuổi/hardlink. Quyết định và kiểm chứng ở [spec21](21_quick_scan_clean_parity.md). User Cache/detailed giữ policy riêng.


# Policy bảo vệ dữ liệu tại backend

> **Contract mới nhất:** [spec21](21_quick_scan_clean_parity.md) mở lại gate Quick, bỏ filter vendor rộng, yêu cầu mọi target trong kết quả dọn có grant và actual cleanup/rescan; inventory updater/state giữ riêng. Các mức15/97/321MB và nghiệm thu trước là lịch sử.


> **Ưu tiên hiện hành 2026-10-11:** [spec20](20_quick_release_priority.md) thay các yêu cầu adapter riêng cho mọi cache Quick và gate full-detail dưới đây. Cache thường MClean được maintenance; Quick log/temp không còn ngưỡng24h hay guard build/tool; IPC/credential/path/identity/quyền vẫn giữ theo [spec21](21_quick_scan_clean_parity.md). Số 0B/15MB và trạng thái chỉ-adapter dưới đây là bằng chứng lịch sử, không mô tả source hiện hành. Kết quả gói cuối xem [checklist](../release_readiness_checklist.md).


> **Cập nhật implementation local 2026-10-10:** xem [truth sau triển khai](17_local_implementation_status.md) và [báo cáo build/QA](../local_completion_report.md). Nội dung target dưới đây không đồng nghĩa mọi gate đã pass; các nhánh thiếu evidence đang blocked.


Version: 1.0.0 — Ngày cập nhật: 2026-10-10. **Contract đã được nối theo phần implementation ở spec17; target DTO đầy đủ và các adapter còn thiếu vẫn là gate.** Scope sản phẩm ở [14](14_quick_detailed_scope.md), baseline source ở [13](13_engine_behavior_truth.md). Contract máy đọc ở [cleanup_protection_contract.json](../cleanup_protection_contract.json). Không dùng JSON dictionary design-only làm allowlist xóa.

## 1. Invariant chung

1. Scan read-only; kết quả scan, checkbox, tên cache, quyền ghi hoặc FDA **không tự cấp quyền xóa**.
2. Mọi mutation đều cần grant đúng operation + target, và policy độc lập đánh giá lại tại native executor. Rust kiểm tra ticket/DTO, Swift kiểm tra semantic rule/canonical path/identity/lifecycle ngay trước mutation. Không có nhánh bỏ policy khi Select all, chạy nền, retry hoặc admin.
3. Các operation là `quick_cleanup`, `detailed_cleanup`, `uninstall`, `orphan_cleanup`, `lens_trash`. Ticket không dùng chéo; Quick/Detail cùng policy bảo vệ, khác scan scope và lựa chọn. Không thể đổi `operation_scope` của ticket từ frontend.
4. Nếu không đủ evidence hoặc trạng thái không xác định, fail closed theo mục với lý do rõ ràng; không xóa rồi ghi cảnh báo. Build/cache tái tạo được vẫn cần điều kiện không đang dùng và đúng ownership/layout.
5. Không tự nâng admin cho cleanup thường. Uninstall chỉ retry known residual đã xác thực, explicit confirmation và lỗi quyền thực sự; broad discovery không admin fallback.

## 2. Decision table

| Classification | Hiển thị | Selection mặc định | Mutation |
|---|---|---|---|
| `rebuildable`, adapter/layout đã validation | Có, giải thích tải/build lại | Có trong đúng scope; Large Files luôn không | Chỉ sau khi đủ preconditions, app/helper/build đã hết dùng target |
| `user_data`, adapter opt-in có hỗ trợ | Có, hậu quả cụ thể | Không | Explicit selected + review hậu quả + đúng operation; v1 không tự mở history/project adapter |
| `unknown`, không có adapter | Có nếu đã discovery | Không, disabled | Từ chối `unsupported_rule` |
| `protected` hoặc OS-managed chưa đủ evidence | Có khi cần giải thích | Không, disabled | Từ chối `protected_target` |
| Informational reclaimable | Có, không cộng dung lượng có thể dọn trực tiếp | Không, disabled | Từ chối `informational_only` |

`effective_safety` và `can_delete` khác nhau: app đang mở có thể khiến rule rebuildable cần Quit, không biến cache thành user_data. Dòng đã validation có thể được chọn để vào flow Đóng và dọn; precondition runtime chỉ thỏa sau Quit. `blocked_reason` hard block khác `requires_app_quit` có thể giải quyết. Không dùng một boolean cleanable để thay mọi trạng thái.

## 3. Nhận diện scope và protected targets

- Resolve known roots từ OS/current user; path absolute canonical, component boundary, reject traversal/NUL/control characters, symlink và ancestor symlink. Resolve alias `/tmp`/`/private/tmp`, `/var`/`/private/var` nhất quán; không mở rộng quyền vì alias. Không substring-match app hoặc path.
- Chặn cleanup root `/`, Home, Library, Downloads/Documents/Desktop và mọi vendor/profile root bao nhiều loại dữ liệu. Không wipe whole `~/Library/Caches`, `~/Library/Caches/<app>` chưa được phân loại, `.npm`, CEF/profile root. Whole disposable leaf chỉ được xem xét theo rule riêng và kiểm tra mọi descendant.
- Chặn vùng OS critical: `/System`, `/bin`, `/sbin`, `/usr` (trừ child cache được adapter riêng phê duyệt, v1 không mở), `/private/var/db`, `/private/var/run`, `/private/var/vm`, boot/system volumes, Keychains, credentials, SSH/cloud config; không wildcard toàn `/private/var`. Apple apps, VXClean/current executable/resource/runtime được bảo vệ trước mọi operation.
- `/Library/Caches`, log/temp roots và Apple-owned cache không có quyền mutation mặc định chỉ vì scanner tìm thấy. V1 giữ OS-managed items ngoài mutation nếu chưa có matcher/evidence riêng; có thể hiển thị blocked. SIP/ownership/write permission không là classifier semantic.
- Project/source, autosave/recovery, cookie/session/password/site offline data, model/component, DB/WAL, sync state, updater staging/pending, MCP/plugin/package/tool runtime và active worktree được giữ trong cleanup scope. Một blacklist basename không đủ; registry adapter phải xác định vùng được giữ và chỉ grant child disposable.
- Node: chỉ npm `_cacache`/cache manager exact được validation; giữ `_npx`, executable/package runtime, project/node_modules/lock/config. Yarn/pnpm layout chưa validation không mutation. Brew: cache download riêng; không Cellar/Caskroom/opt/bin/installed app.
- Logs v1: chỉ adapter user-app xác định log rotated/archive đã đóng, tuổi ≥30 ngày, giữ phiên mới nhất và file active. Đây là default triển khai bảo thủ được chọn trong spec, không tuyên bố 30 ngày chứng minh hết dùng. Nếu adapter không xác định active/session thì blocked. System logs/temp chưa có lifecycle/ownership proof giữ read-only, không đoán từ tuổi. Cần test boundary 29/30/31 ngày với clock cố định.

## 4. Parent/child, overlap và snapshot

- Scanner emit target exact với `rule_id`; category là nhãn hiển thị, không là permission. Partition ownership Node/Brew/Chrome/AI/Media/Xcode/Docker khỏi generic User Cache; Quick không enumerate các root chuyên biệt này.
- Nếu parent bao một protected/unknown child, không grant parent. Emit các child disposable riêng; kiểm tra no-follow từng component/descendant. Không gom các child lại thành broad parent vì cùng method.
- Một path/identity chỉ thuộc một mutation trong batch. Registry ưu tiên rule cụ thể; dedup trước cả tổng bytes và operation. Hardlink aliases không được bypass protected scope; kiểm tra link count/ownership, reject nếu không chứng minh được độc lập. Scan truncated/denied không cấp whole-folder wipe.
- Grant lưu identity device/inode/type và scope snapshot. Strict cleanup/Lens kiểm tra nội dung descendants của directory; parent inode không thay thế child manifest. Gỡ app là grant toàn root user chọn: native đối soát root metadata, bundle ID/version, SIP/self/app-running và association trước khi chuyển nguyên root vào Trash; không dereference symlink con. Đây không phải proof từng descendant. System Junk root grant theo MClean giữ ngoại lệ đã chốt tại spec24.
- Child mới/đổi type/identity sau scan hoặc protected child xuất hiện: invalidate target, trả `scope_changed`, yêu cầu scan/review lại; không tự chọn child mới từ re-scan. Adapter có thể dùng per-file targets để giảm subtree authorization.
- Ưu tiên no-follow descriptor-relative filesystem operations khi cần chống path swap. Không hứa loại hoàn toàn race chỉ bằng hai lần realpath/stat. Nếu không bảo đảm ranh giới mutation của directory trong điều kiện hiện tại, skip mục đó; test swap trước/sau check và intermediate ancestor.

## 5. Ticket và protocol target

Ticket host-owned, UUID riêng mỗi scan/operation: `{ticket_id, operation_scope, scan_mode, created_at, expires_at, policy_version, dictionary_version, platform, allowed_targets}`. TTL hiện có 15 phút giữ làm upper bound; bất kỳ mutation/rule đổi/layout đổi/lifecycle rescan không khớp phải invalidate sớm. UI retention 5 phút là state/cache khác, không renew authority.

Mỗi allowed target lưu `{target_id, rule_id, canonical_path, method, device, inode, file_type, content_snapshot, app_context, conditions}`. Nội dung registry và stamps do backend tạo; frontend gửi target ID, không tự khai proof an toàn. Native vẫn reclassify rule độc lập, không tin `effective_safety`/`can_delete` do UI gửi.

Maintenance protocol target `2.0`: typed request/response + `platform`, `policy_version`, `operation_scope`; reject mismatch ở host và native. Metrics giữ protocol `1.0`. Enum/DTO đồng bộ Swift/Rust/TypeScript; parser validate bắt buộc/type/range/limit trước cấp ticket. Version policy bắt đầu `1.0.0`; dictionary version là file local có version, không hardcode một phiên bản tương lai.

DTO row bổ sung `target_id`, `rule_id`, `operation_scope`, `effective_safety`, `can_delete`, `blocked_reason`, `requires_app_quit`, `default_selection_reason`, `conditions`, `size_kind`, `is_partial`; rule validation hiện hành phải lấy từ registry executable, không copy boolean của dictionary 68 design_only.

Mutation request: `ticket_id`, `operation_scope`, `target_ids`, `operation_id`, `confirm_direct_delete`, `confirmed_risk_target_ids`. Không nhận admin_shell method như lựa chọn frontend. Compatibility shim nếu còn path payload phải lookup đúng target đã grant, không tạo grant từ path mới. Scope/version/method/selection sai trả error trước mutation.

## 6. Lifecycle, reporting và recovery

States: `planned → awaiting_confirmation → quitting_apps → revalidating → mutating → completed|partial|cancelled|failed|interrupted`. Persist intent trước mutation từng target, outcome sau mutation; operation/app-reopen state tối thiểu trong app data directory, atomic update, tránh link-follow/overwrite file không thuộc VXClean. Không ghi nội dung chat, cookie, URL ẩn danh hoặc secret vào journal/log.

Quit app theo [11](11_detailed_app_cleanup.md), chờ helper/build/export liên quan; không kill process theo tên vendor toàn máy. Cancel/save timeout hoặc app khởi động lại khiến precondition chưa đủ phải skip. Chrome regular profiles/tabs cần fixture thật; không dùng launch thành công làm proof restore. App không chạy trước dọn không tự mở. Node/Brew/build đang dùng cache: skip/chờ thay vì tự kill CLI/tool.

Cancel dừng ở boundary giữa target; target đã bắt đầu phải có intent/outcome và recovery reconciliation. Cmd+Q/host shutdown hủy reads, ngừng bắt đầu mutation mới, kết thúc/reap owned child có journal; không bỏ orphan engine tiếp tục xóa. OS crash/power loss không cho chạy lại xóa tự động; reconcile pending status, cho user thấy `interrupted` và app cần mở lại.

Timeout/child crash có thể là partial mutation. Lưu/đọc per-target journal hoặc durable progress để hiển thị kết quả đã biết và `outcome_unknown` cho target chưa xác minh; không báo chưa dọn gì hoặc success toàn bộ. Retry chỉ target còn lại sau revalidate; không re-execute completed target.

Counts phân biệt successful/blocked/failed/unknown. Bytes là logical/allocated estimate có label, tách removed/trashed; legacy `permanently_freed_bytes` nếu giữ phải mô tả estimate removed, không claim physical free-space delta. Trash không giải phóng dung lượng ngay; scan partial/entry cap phải có warning.

## 7. Các operation riêng

- **Uninstall:** app identity/association riêng; bundle và known residual có thể chứa dữ liệu cá nhân nên confirm mất dữ liệu. Broad Movies/CapCut vẫn default false, cho phép Trash toàn root khi user chọn ở uninstall, không gọi nó là rebuildable cache. Uninstall ticket retain đã xác thực để retry residual sau bundle Trash thành công; không bỏ guard global khi bundle vắng. Apple/self/system targets vẫn chặn.
- **Orphans:** absence app inventory chỉ heuristic. UUID ticket riêng, only supported volatile candidates, identity phải bind từ Rust sang Swift; không reuse cleanup scope để sửa bug missing stamps. Policy chặn user_data/unknown; scan partial không chứng minh orphan.
- **Lens:** scope read không là scope Trash. Giữ chỉ Home non-protected target được grant, ngoài Home read-only, Library/dot/Applications/root/self/running app blocked; confirmation + identity. Không mở rộng Lens delete trong task này.

## 8. Bằng chứng bắt buộc trước enabled mutation

Fixture phải đi qua producer host và consumer native, không chỉ payload Swift tự viết. Kiểm tra unknown/protected injection, scope/version/method mismatch, ancestor symlink swap, directory same-inode new child, hardlink alias, partial traversal, expired ticket, protected content unchanged, safe exact content removed, repeated request không mutation lặp.

Quick tests chứng minh chỉ ba scanners và không Node/Brew/Docker CLI ở cả scan lẫn revalidation; dedicated roots không chui vào User Cache. Reproduce rồi fix các probes của [audit](../engine_scope_audit_2026_10_10.md) và [Quick recheck](../quick_scope_recheck_evidence.json). App Save/Cancel, active helper, timeout/crash/restart/retry phải có evidence. Chưa pass thì branch disabled/read-only với lý do, không dán nhãn release-ready giả.

## Quick live cache lớn — 2026-10-27

Theo [spec24](24_single_admin_pass_quick_live_cache.md), live_cache_root dùng ticket root identity; native duyệt kiểm chứng toàn cây rồi batch512file, không dùng full-subtree manifest hoặc cap20.000entries/3MiB để loại cache lớn. Quyền/rule/link/identity/journal vẫn đối soát độc lập. Strict cleanup và Lens không đổi. Xem [báo cáo/evidence](../large_cache_cleanup_report.md).
