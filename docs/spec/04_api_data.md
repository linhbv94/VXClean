# IPC và native data contract VXClean

> **Cập nhật implementation local 2026-10-10:** xem [truth sau triển khai](17_local_implementation_status.md) và [báo cáo build/QA](../local_completion_report.md). Nội dung target dưới đây không đồng nghĩa mọi gate đã pass; các nhánh thiếu evidence đang blocked.


Version: 2.0.0 — 2026-10-10. Baseline theo source [13](13_engine_behavior_truth.md); target bảo vệ theo [15](15_cleanup_protection_policy.md). DTO target chưa triển khai, không ghi đồng bộ 100% với source. Metrics giữ 1.0; maintenance target 2.0.

## Baseline đang callable

JS invoke argument keys theo Tauri camelCase; JSON payload bên trong snake_case. Source chuẩn hiện có: [TypeScript](../../desktop/src/types.ts), [frontend bridge](../../desktop/src/services/tauri_bridge.ts), [Rust](../../desktop/src_tauri/src/maintenance_bridge.rs), [Swift](../../desktop/native/maintenance_cli.swift).

| Command | Baseline arguments/return |
|---|---|
| get_capabilities | Không args; platform/native/feature flags, menu_bar_monitor hiện false |
| get_system_snapshot | Không args; protocol_version 1.0, platform, timestamp, CPU/RAM/Disk/Battery metrics |
| start_scan | operationId, includeEmpty; hiện scan all 10 nhóm, chưa scope filter |
| cancel_scan | operationId; đọc scan/lens registered, chưa mutation cancellation |
| clean_items | payload scan_id/targets path+method/confirm_direct_delete, operationId |
| get_installed_apps | Không args; app metadata/known/discovered associated paths |
| uninstall_app | payload app_id/selected_paths/allow_admin_fallback; baseline chưa có operationId ở IPC |
| get_orphans | Không args; heuristic groups/safe flags |
| clean_orphans | selectedPaths, confirmDirectDelete; host hiện thiếu identity binding |
| analyze_space_lens | path, operationId; Rust worker toàn cây; UI nhận root/direct children, lens_id/scan_root_path/is_partial/can_trash |
| get_lens_folder | lensId, path → folder DTO từ snapshot Rust hoặc null nếu hết TTL/ngoài root; không đọc filesystem/không tạo grant |
| trash_lens_item | lensId, path; grant riêng, Trash |
| choose_scan_folder | Không args; path hoặc null |
| reveal_in_file_manager, open_in_terminal | path |
| get_scan_access_status | worker cùng app, timeout4s; protected-read probe, không đọc TCC contents; status access_confirmed/restricted/unverified/not_required + bundle path/signing diagnostics |
| open_full_disk_access_settings | Không args; mở System Settings, không tự cấp quyền |

Clipboard qua JS API, không command copy_to_clipboard. Không gọi execute_clean/trash_space_lens_items từ spec cũ.

## Target scan và rule DTO

start_scan bổ sung `scanMode: quick|detailed`, giữ operationId; Quick backend fixed categories system_junk/user_caches/large_files, không nhận arbitrary category để mở scope. Detail có category filter được backend validation trong allowed group list và includeEmpty phù hợp. Revalidation phải theo scope ticket, không scan all làm phát sinh CLI chuyên biệt.

Response maintenance typed envelope: protocol_version 2.0, platform, policy_version, dictionary_version, operation_scope, operation_id và data. Scan data có ticket_id/scan_id, expires_at, categories, is_partial/limited_paths/unsupported_cache_paths, size_kind/estimates. Các key của DTO native snake_case; missing/invalid version/type/platform không cấp grant.

JunkItem baseline được mở rộng theo spec 15: target_id/rule_id/operation_scope/effective_safety/can_delete/blocked_reason/requires_app_quit/default_selection_reason/conditions/size_kind/is_partial. Category thêm chrome/media_apps. Các hard block không cleanable; app Quit precondition không bị nhầm hard block.

Ticket và identities do host tạo từ typed validated scan; native independently classifies policy. frontend không gửi safety/protected proof được tin cậy. Dictionary design_only không grant quyền; executable registry version/layout/evidence quyết định effective fields.

## Target mutation và recovery

clean_items target payload: ticket_id, operation_scope, target_ids, operation_id, confirm_direct_delete, confirmed_risk_target_ids. Rust và native verify scope/version/method, unique target IDs, limits và owned window before mutation. Admin_shell không là method frontend có thể chọn. Nếu giữ compatibility path payload, bắt buộc map exact granted target, không auto-grant.

Orphan/Uninstall/Lens UUID ticket riêng, cùng identity/invariant framework. Uninstall ticket lưu association/remaining targets để retry sau bundle mất; broad discovery vẫn no-admin. Orphans sửa host-native missing stamps và tests producer thật. Lens read grant không mutation root.

Progress theo operation_id và target_id, stage/outcome; cancellation mutation hợp tác ở boundary. Durable journal giữ intent/outcome/reopen obligations, query operation status sau timeout/restart; không auto replay deletion. Method/result per target, error enum theo [contract JSON](../cleanup_protection_contract.json); interrupted/outcome_unknown không success giả.

Byte counters phân biệt estimated_removed_bytes, trashed_bytes, size_kind/partial. Legacy permanently_freed_bytes nếu giữ là removed estimate; không physical free-space proof. Không đếm informational Docker reclaimable vào removable totals.

## CLI và timeout

| Luồng | Baseline | Target |
|---|---|---|
| Metrics | metrics, typed 1.0, timeout 6 giây | Shared service/single-flight, semantics giữ |
| Maintenance read/mutation | argv cố định, stdin JSON, timeout 120 giây | Typed 2.0, scope explicit, cancellation/journal/recovery, timeout có thể partial |
| Scan | scan --all, optional --include-empty | Thêm scope/mode parser (ví dụ --scope quick_cleanup); Quick không --all |
| Cleanup | clean --stdin | Same entry point, policy mandatory/ticket scope/target IDs verified |
| Apps/Orphans/Lens | Separate commands hiện có | Separate ticket/operation, no policy bypass |

Giới hạn hiện có stdout 32 MiB, stdin cleanup Swift/host 64 MiB (lifecycle request vẫn4MiB), target 10.000 cần giữ/validate typed và báo error; không hang pipe, kill/reap own subprocess hữu hạn. Nếu cần đổi timeout vì workload, ghi hằng số mới và test thay vì âm thầm dùng số cũ. Timeout scan120giây, mutation600giây. Host shutdown không để owned engine tiếp tục mutation. Một cleanup dùng một process/request, gom permission failures và admin một lần cuối lượt; xem spec24.

## Menubar

Metrics service host-owned, shared main/panel. Panel chỉ metrics + request open main/navigation/settings/quick scan read; mutation main-only. Capability menu_bar_monitor true chỉ khi native tray setup đạt; secondary window không được grant maintenance mutations. Native menu Quit/reopen phải dùng common lifecycle handler, không frontend-only hide.


### Contract maintenance sau audit các patch Quick — 2026-10-11

- Item scan Quick/Detail có `execution_mode`: `strict_snapshot` hoặc `live_cache_root`. Native policy quyết định mode, host chỉ dùng metadata của ticket native; UI không tự cấp live mode. Scope/rules Quick không thay đổi.
- `get_operation_history`: đối soát thụ động app đã chạy lại đúng bundle/path, trả summary toàn history. Các field bổ sung: `recovery_required`, `acknowledgement.acknowledged`, `retained_targets_count`, `history_updated_at_ms`, `archive_sha256`, `summary_sha256`, `original_files`. Backend kiểm tra checksum trước khi dùng summary. Không tự launch hoặc chạy lại dọn.
- `acknowledge_operation({ operationId })`: ẩn notification đã xem qua journal, không xóa evidence, không đổi outcome hoặc updater guard.
- Admin outcome mỗi target: `success`, `admin_not_started`, `guard_rejected`, `partial`, `outcome_unknown`. `prior_removal_may_be_partial` giữ thông tin một lượt user-level có thể đã xóa dở; Cancel admin không chứng minh lượt user-level chưa làm gì.
- Archive `evidence.json.gz` chứa row đầy đủ và nội dung nguyên bản từng file host/result/lifecycle/events/cancel. Summary chỉ commit sau archive; nguyên bản chỉ được bỏ khi digest đúng. File hỏng/lạ khiến journal fail closed.

- Host bỏ qua toàn bộ targets trước khi khởi chạy native trả `native_execution: not_started`; journal terminal của ca này không được coi là một thao tác dọn bị ngắt. Không suy ra ca này từ success_count0 đơn thuần.

- Scope uninstall dùng content_snapshots gồm root metadata của mỗi target đã chọn; không dùng giới hạn full subtree của cache để chặn app/data root lớn. Native chuyển nguyên root và kiểm tra lại association/bundle ID/version/app đã thoát. Scope khác giữ manifest riêng. Lens cache là dữ liệu hiển thị5 phút/16 keys, mutation revision làm mất hiệu lực cache, không thay quyền native.

### Space Lens Rust navigation snapshot

Scanner Rust dùng chung Mac/Windows. Response thêm `children_complete`, `is_partial` từng node; `size_kind` (`allocated` Unix, `logical` Windows), `retained_nodes`. Children metadata giữ trong cùng snapshot, không tự tạo quyền xóa sâu. FE dùng `scan_root_path` nội bộ để phân biệt root proof và folder hiển thị.

Không cắt cây theo số node hoặc độ sâu. Host giữ metadata phẳng đầy đủ đọc được5 phút từ hoàn tất; query không gia hạn TTL. Root system không quét; Windows reparse points không duyệt. Quét lỗi/timeout không cấp snapshot thành công. Worker → host dùng gzip/deserialize typed; UI chỉ nhận folder đang xem, không nhận toàn cây. Giới hạn32MiB compressed output và timeout120s được giữ làm lỗi có báo, không cắt cây rồi âm thầm quét lại.

- `get_lens_folder` trả `scan_root_path` gốc và `lens_id` gốc; metadata query không trở thành deletion grant. Host giữ tối đa2 cây, tự giải phóng khi hết5 phút; mutation xóa navigation snapshots. FE giữ tối đa16 folder DTO làm cache hiển thị.

### Scan access preflight

Trước các read scan thật, bridge gọi coordinator dùng chung theo [spec25](25_full_disk_access_flow.md). Query Lens snapshot và metrics không yêu cầu FDA. `access_confirmed` là evidence truy cập probe, không là deletion grant/boolean TCC chính thức. Cancel/Để sau là `ScanAccessDeferred`, không gán lỗi native; lỗi native thật giữ nguyên. Rescan nội bộ lifecycle dùng noninteractive preflight, thiếu quyền throw để finally phục hồi app.

## Quick live cache lớn — 2026-10-27

Theo [spec24](24_single_admin_pass_quick_live_cache.md), live_cache_root dùng ticket root identity; native duyệt kiểm chứng toàn cây rồi batch512file, không dùng full-subtree manifest hoặc cap20.000entries/3MiB để loại cache lớn. Quyền/rule/link/identity/journal vẫn đối soát độc lập. Strict cleanup và Lens không đổi. Xem [báo cáo/evidence](../large_cache_cleanup_report.md).
