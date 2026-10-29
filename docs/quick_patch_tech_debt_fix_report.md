# VXClean — sửa tech debt các patch Quick

Ngày: 2026-10-12. Bản local: 1.0.11. Không commit/push/phát hành.

## Kết quả theo audit

| Khoản nợ | Thay đổi | Bằng chứng |
| --- | --- | --- |
| Banner lệch updater | Backend phân loại incident; acknowledge chỉ ẩn notification. Settings có lịch sử độc lập. App đang chạy đúng bundle/path được đối soát dù version đã đổi; không tự launch khi xem lịch sử. | Rust kiểm tra incident cũ + success mới + acknowledge; fixture AppKit passive/no duplicate; lifecycle ChatGPT cũ đã thành already_running trên gói local. |
| Journal gần32MiB | Giới hạn từng operation; nén journal terminal thành gzip có checksum và summary; giữ nguyên event stream/intent và file nguyên bản trong archive. Known partial có retention180 ngày; unknown không tự hết hạn. | Fixture history36MiB, corruption, crash leftovers, retention và chronology; kiểm chứng byte với backup journal thật. |
| Admin kết quả thô | Trả outcome mỗi mục; một parent mất không làm throw cả lượt. Kiểm tra root metadata sau xác thực. Cancel phân biệt admin_not_started, vẫn giữ uncertainty của lần user-level nếu có. | Fixture Cancel, quoting, root replacement/mtime, parent mất trước/sau tạo lệnh, sibling thành công; vẫn một admin invocation. |
| Policy live lặp | Native rule xuất execution_mode. Rust dùng ticket metadata; dispatcher/validator dùng chung native policy. Dùng một snapshot hiện tại thay lặp snapshot trong cùng revalidation. | Chrome/Codex root identity và thay đổi nội dung có regression; native profile/history/runtime vẫn được giữ. |
| Khung batch và JSON thừa | Một request/process; bỏ loop/aggregate payload batches. Đếm kích thước JSON không tạo chuỗi, stream stdin sang engine. | Rust full proofs và oversize rejection; native7000 files; đo RAM riêng từng fixture. |
| Regression rời rạc | Thêm suite history policy và nối CI; mở rộng native/admin/lifecycle + Rust journal tests. | 34 Rust tests,34 nhóm native; UI Settings/X/cold-start kiểm chứng trên app Mac. |

## Kiểm chứng

- `cargo test --locked --offline --lib`:34 tests đạt.
- `python3 scripts/test_native_maintenance.py`:34 nhóm đạt. Lượt đầu fixture admin dùng target không nằm trong kết quả Quick nên bị từ chối đúng scope; đã sửa fixture sang root Quick hợp lệ và chạy lại đạt. Không tính lượt đầu là pass.
- `node scripts/test_operation_history.mjs`: lọc notification/lịch sử, old incident sau new success, acknowledgement và corrupt notification đạt. Suite được thêm vào CI; chưa chạy CI remote.
- Scan retention10, uninstall selection5, circle geometry18 nhóm đạt; frontend build và `git diff --check` đạt.
- App/DMG/updater arm64 đóng gói; codesign deep/strict và chữ ký updater/tamper rejection kiểm tra ở gói cuối.
- Native7000 cache files:7,010s; peak RSS159.629.312 bytes. Fixture host oversize64MiB: peak RSS144.572.416 bytes. Đây là hai phép đo riêng, không phải RAM tổng của app hoặc bảo đảm trần RAM64MiB.
- Journal thật:29 operations,27.604.159 bytes trước;21 archives, khoảng3,67MB sau. 72 file bằng chứng khớp byte backup; chỉ lifecycle của operation `9e668f61-94d3-4334-ab81-6df86ea2bca9` thay đổi để ghi nhận ChatGPT/Codex already_running. Không xóa unknown hoặc tự coi là thành công.
- Trường hợp host skip toàn bộ targets được đánh dấu native_execution:not_started, có test không tạo recovery giả.
- Quick runtime cuối quét265,95MB System Junk (29 mục),782,70MB User Cache (173 mục),522,67MB tệp lớn/cũ (4 mục không chọn). Scan báo partial ở2 nhóm; không nhận coverage toàn máy. Card toggle/expand và đổi menu giữ kết quả đạt.
- Nút X ghi4 acknowledge; Settings vẫn hiện incident và bằng chứng. Đối soát không launch/quit app khác hoặc replay dọn.
- Backup app1.0.10 và journal trước QA ở `desktop/src_tauri/target/local_backups/`; giữ cả journal QA đầu để truy vết.

## Giới hạn còn lại

- Scope/rules Quick giữ nguyên; không mở live mode ra mọi cache. Giới hạn proof3MiB/mục, request64MiB và manifest20.000 entries vẫn là giới hạn kỹ thuật có fail-closed, không hứa RAM bị giới hạn tương ứng.
- System Junk cấp grant toàn root theo MClean; guard root sau password không phải snapshot mỗi descendant. Unknown từ các lượt cũ được giữ, acknowledge không giải quyết hoặc xóa kết quả chưa rõ.
- Cancel admin được kiểm thử bằng fixture shell; chưa thực hiện Cancel mới ở hộp xác thực OS trong lượt này. Không dọn cache/tệp người dùng mới để QA tech debt.
- Không nhận đã kiểm thử Windows/Intel/macOS cũ, notarization hoặc updater public install/restart. Gói local không được notarize; release agent tiếp tục theo checklist hiện hành.

Tham chiếu: [audit gốc](quick_patch_tech_debt_audit.md), [spec24](spec/24_single_admin_pass_quick_live_cache.md), [evidence](quick_patch_tech_debt_fix_evidence.json).
