# VXClean — checklist bàn giao release Quick Scan

## Maintenance local1.0.11 — 2026-10-12

- Sửa sáu nhóm debt của các patch Quick: recovery/updater, journal, admin outcomes/guard, live policy, request streaming và regression CI. [Báo cáo](quick_patch_tech_debt_fix_report.md).
- Rust34 tests, native34 nhóm đạt. App/DMG/updater arm64 local kiểm tra codesign/signature/tamper; Settings history và acknowledge cold-start có native QA.
- Scope Quick giữ nguyên. Không dọn cache/tệp người dùng mới trong lượt maintenance; không nhận đã chạy OS Cancel hoặc updater public install/restart mới.
- Không commit/push/publish. Các gate nền tảng và phân phối ở phần dưới vẫn cần agent release đọc; không tự coi toàn bộ checklist cũ đã đóng.

## Trạng thái mới nhất sau pnpm/Anti — 2026-10-11

- [x] Source pnpm CLI-only prune, hai ZIP Anti xác minh phiên bản, Detailed loại coverage Quick; 26 nhóm native regression và 9 nhóm manager fixture đạt, Rust21 đạt. Không chạy prune/dọn installer trên dữ liệu thật.
- [x] App/DMG/updater arm64 build mới đạt; codesign deep/strict gói mới đạt.
- [x] Gói mới: pnpm inventory/chọn/confirm/cancel; hai ZIP Anti native runtime match; canonical Quick/Detail overlap0. [Evidence cuối](manager_cleanup_completion_evidence.json).
- [x] Rust/Node signature/tamper và codesign đạt; source/artifact hashes cập nhật cho gói sau sửa alias /tmp. App đã mở để review.
- [x] Helper adminRemove chạy trên OS thật và chỉ xóa fixture riêng; agent không nhập mật khẩu.
- [ ] OS authentication dialog Cancel chưa chứng minh. CUA không cho tương tác SecurityAgent; helper hoàn tất thành công trước khi hủy. Không gọi success là Cancel pass.
- [ ] Physical menubar icon/click: SystemUIServer CUA timeout; panel/source/icon test không thay tray smoke thủ công.
- Quét chỉ đọc gói mới xác nhận /tmp/antigravity_ide_official.dmg (212.175.820 bytes) thuộc System Junk Quick, cleanable/default selected; chưa dọn file. Scan có partial nên không suy rộng thành quét toàn máy đầy đủ.
- Sau bàn giao local: agent release thực hiện version/commit/CI hai Mac/secrets/draft/assets và quyết định phân phối ad-hoc/Gatekeeper. Intel/macOS13, updater install/restart chưa chứng minh; detailed full scope không phải gate bản Quick theo user.

> Cập nhật audit 2026-10-11: System Junk Quick đối chiếu nguyên scanner MClean `42cf1f8` bằng test độc lập exact path/size/default selection; native 26 nhóm và Rust 21 tests PASS. Đã sửa hidden eligibility manifest, Xcode path guard và trả giới hạn tính size System về 10.000 entry. Xem [audit rule](system_junk_rule_audit.md) và [bằng chứng hiện hành](system_junk_clone_evidence.json). Các số scan cũ bên dưới là snapshot lịch sử, không chứng minh parity rule.


Cập nhật: 2026-10-11. Scope mới theo user: ưu tiên Quick scan + chọn + dọn; dọn chi tiết hoàn thiện sau. **Điều chỉnh coverage MClean theo user đã đạt local: bỏ24h/giữ build-tool trong Quick, fixture dọn hết/rescan0; còn giới hạn OS/runtime ghi ở handoff.** [Evidence hiện hành](system_junk_clone_evidence.json). Contract hiện hành: [spec21](spec/21_quick_scan_clean_parity.md). Không commit/push/tag/publish trong task này.

## Gate bổ sung bắt buộc

- [x] Nút X ẩn banner, giữ journal và new-alert behavior.
- [x] Đối chiếu MClean2GB: discovery đầy đủ Google/Adobe/AI; không tính updater/state giữ lại thành junk.
- [x] Mọi Quick result item có grant thật; scan→clean toàn bộ→rescan fixture0, excluded giữ nguyên.
- [x] Quit/rescan/reopen ở Quick giữ scope và Cancel/Skip báo chưa hoàn thành đủ.
- [x] Final app smoke/build/evidence sau thay đổi; không dùng artifact321MB cũ làm ready.

## Gate bản Quick

- [x] Mở policy maintenance cho cache thường ở roots MClean; System Junk Quick dùng toàn rule MClean, bỏ profile/IPC/lock/hardlink/age filters; giữ roots/top-level symlink/identity/manifest. User Cache và detailed giữ policy riêng.
- [x] Dọn fixture thật qua Rust→Swift; positive cache/log/temp và negative critical/state/runtime/fresh item. 25 nhóm native đạt; 21 Rust đạt; retention10 đạt; frontend build đạt.
- [x] Rule temp sửa theo user: executable/library/toolchain QA có thể dọn, System Junk Quick gồm cả IPC/lock/profile-copy/hardlink; fixture full clean/rescan0 và alias ngoài roots nguyên vẹn đạt.
- [x] Gói cuối: Dashboard→Quick tự scan, chọn nhóm/từng mục, confirm/cancel, giữ scan khi đổi menu. Xác minh cleanup cùng payload host/native và rescan fixture.
- [x] App/DMG/updater local, codesign/signature/tamper, source↔artifact hashes và handoff.
- [x] Bảng PASS/UNVERIFIED đúng phạm vi; không dùng hạn chế detailed để chặn bản Quick, không gọi toàn bộ detailed hoàn thành.

## Kiểm chứng bản đóng gói hiện hành

- [x] System Junk1.2GB109/109 được chọn; checkbox nhóm cập nhật tổng, confirm/cancel không dọn data thật.
- [x] Native25 và Rust21; App/DMG/updater, codesign và hai verifier chữ ký/tamper đạt.
- [x] Downloads chờ quyền: worker tách từng root; partial thật, không tính là đã quét.
- [ ] Xác thực admin/cancel trên OS thật cho System Junk thiếu quyền ghi; flow đã triển khai, chưa thực thi dữ liệu user.

## Hoàn thiện sau bản Quick

Xcode/Mail/Trash/Docker, Media Adobe/source proof, AI history/ảnh/cold-start, layout Node/Brew mở rộng. Các phần đã có nhưng unsupported phải hiện đúng lý do và không cấp grant. Giữ [checklist full scope cũ](spec_history/release_full_scope_checklist_2026_10_10.md) để không mất backlog.

## Agent release tiếp nhận

Commit/push/version/tag, remote CI và build Intel/arm64, cấu hình secret updater cùng key, kiểm tra draft/assets rồi publish theo quyền user giao riêng. Gói local ad-hoc, chưa notarized. Intel/macOS13 runtime và updater install/restart chưa được nghiệm thu; chữ ký crypto không thay kiểm thử install/restart. Menu bar physical click vẫn cần smoke thực, không coi fallback panel là bằng chứng tray.

Dừng trước publish. Không gọi Anti lại/reset counter. Không tăng scope nghiên cứu; sửa lỗi cụ thể của Quick và đóng gate bằng bằng chứng.
