# Rà nợ kỹ thuật các vòng sửa VXClean 1.0.4–1.0.10

> Snapshot audit trước sửa. Các mục bên dưới đã được xử lý trong bản local1.0.11; xem [báo cáo sửa và giới hạn kiểm chứng](quick_patch_tech_debt_fix_report.md). Không suy ra đã phát hành từ trạng thái local.

Ngày: 2026-10-11. Phạm vi: diff hiện tại so với HEAD, spec24, evidence các lượt dọn thật, source journal/lifecycle/updater. Chỉ đọc source và journal thật; không dọn, không sửa code, không gọi cập nhật. Baseline Git vẫn ở nhóm commit 1.0.3; không thể gán mọi dòng trong diff cho đúng một version bằng commit riêng.

## Kết luận

Có nợ phát sinh từ các vòng chữa lỗi, đặc biệt bản sửa banner 1.0.10 mới giải quyết triệu chứng. Không nên coi lượt dọn thành công là đã hoàn tất recovery và updater. Không thấy từ phần rà này bằng chứng xóa nhầm file critical system; đây không phải chứng nhận an toàn toàn engine.

## 1. P1 — Banner chỉ xét lượt mới nhất, updater xét toàn bộ lịch sử

Nguồn: [operation_history.tsx](../desktop/src/components/operation_history.tsx), dòng18–26; [maintenance_bridge.rs](../desktop/src_tauri/src/maintenance_bridge.rs), dòng39–44; [app_lifecycle.swift](../desktop/native/app_lifecycle.swift), dòng80–87.

- UI ẩn lỗi journal và nghĩa vụ reopen của mọi lượt cũ khi có lượt mới hơn. Guard updater vẫn chặn bất kỳ nghĩa vụ reopen/journal lỗi nào trong toàn lịch sử. UI không có điểm truy cập lịch sử độc lập để xử lý mục bị ẩn.
- Quan sát thật: operation `9e668f61-94d3-4334-ab81-6df86ea2bca9` còn reopen_pending của ChatGPT; bundle vẫn `com.openai.codex`, version ghi trong journal20052, app hiện20156. Kiểm tra version diễn ra trước kiểm tra already_running, nên app đã cập nhật vẫn không thể được xác nhận mở lại theo code hiện tại.
- Hệ quả suy ra trực tiếp từ guard: cập nhật trong app có thể bị chặn mà banner không giải thích được nguyên nhân. Chưa thực thi updater để tái hiện, nhằm tránh thay đổi máy trong audit.
- Sửa gốc: tách lịch sử và danh sách sự cố chưa đối soát; banner theo incident mới/chưa acknowledge, không theo vị trí hàng đầu. Đối soát app đang chạy/được user xử lý; giữ xác minh identity trước tự mở app, không tự bỏ guard updater.

## 2. P1 — Journal gần giới hạn và thiếu vòng đời kết thúc cho partial/unknown

Nguồn: [journal_history.rs](../desktop/src_tauri/src/journal_history.rs), dòng3–13,50–71.

- Đo trực tiếp: 29 thư mục operation, tổng các file journal27.604.159 bytes (27,60MB); giới hạn đọc tổng33.554.432 bytes (32MiB), đã khoảng82,3%.
- Chỉ journal completed, mọi target success và host returned mới được hết hạn sau180 ngày. Partial, permission failure, unknown hoặc host returned nhưng không có native/lifecycle hoàn tất không có cơ chế resolve/acknowledge/compact tương ứng.
- Lượt mới dọn được cùng đường dẫn không tự giải quyết lượt cũ; không thể giả định nó chứng minh kết quả chính xác của thao tác trước.
- Rủi ro: tiếp tục tích lũy sẽ khiến đọc history báo vượt giới hạn và updater bị chặn. Đây là rủi ro tiềm tàng gần ngưỡng, chưa phải đã vượt ngưỡng.
- Sửa gốc: state machine phân biệt lỗi đã kết thúc với thao tác còn chưa rõ; compact log lớn sau khi đối soát, lưu summary/index; giữ unresolved thật và evidence cần thiết. Không xóa mù journal để vượt guard.

## 3. P2 — Admin batch đạt một lần nhập pass nhưng protocol kết quả còn thô

Nguồn: [maintenance_cli.swift](../desktop/native/maintenance_cli.swift), dòng761–772,793–836; [test_native_maintenance.py](../scripts/test_native_maintenance.py), dòng587–606.

- Shell chỉ trả index thành công. Cancel, identity_changed, permission_denied, rm lỗi đều bị quy về outcome_unknown. Vì removeItem trước đó có thể đã xóa một phần, cần phân biệt phần đã biết và phần chưa biết; không được đổi mọi cancel thành untouched.
- Tạo shell bằng `try items.map`; một parent mất trước realpath làm throw cả batch, các mục hợp lệ còn lại không được admin xử lý.
- Sau thời gian chờ password, shell kiểm tra parent physical path và root device/inode; không so lại size/mtime/snapshot. Guard root/content ở preflight không đồng nghĩa guard ấy được giữ xuyên thời gian chờ xác thực. Với System Junk, snapshot MClean vốn chỉ xét root, không duyệt toàn bộ descendants; không được mô tả thành proof từng file con.
- Sửa gốc: kết quả có cấu trúc từng target, phân biệt not_started/guard_rejected/partial/unknown/success; xác định rõ grant là root hay snapshot. Một target lỗi không làm bỏ toàn batch. Giữ một phiên xác thực, không quay lại một password mỗi file.

## 4. P2 — Ngoại lệ live cache lặp ở ba nơi

Nguồn: [maintenance_bridge.rs](../desktop/src_tauri/src/maintenance_bridge.rs), dòng202–203; [maintenance_cli.swift](../desktop/native/maintenance_cli.swift), dòng649–662; [cleanup_policy.swift](../desktop/native/cleanup_policy.swift), dòng293–303.

Chrome/Codex được nhận diện bằng cùng hai rule_id viết lại ở Rust host, Swift dispatcher và Swift validator. Cơ chế đúng cho ca đã kiểm chứng, nhưng thêm một app/rule sẽ phải nhớ sửa ba nơi. Native còn lấy snapshot nhiều lần, làm tăng I/O và cửa sổ thay đổi. Sửa bằng contract execution_mode có kiểu rõ ràng, native vẫn là nguồn quyết định quyền; host kiểm tra contract thay vì duy trì allowlist độc lập. Không mở live mode cho mọi cache một cách tự động.

## 5. P2 — Nâng payload64MiB và giữ khung batch cũ là giải pháp chuyển tiếp

Nguồn: [maintenance_bridge.rs](../desktop/src_tauri/src/maintenance_bridge.rs), dòng329–399; [cleanup_policy.swift](../desktop/native/cleanup_policy.swift), dòng257.

cleanup_batches giờ luôn trả đúng một payload nhưng caller vẫn loop/aggregate/processed/nhánh lỗi lô trước. Payload được clone/serialize nhiều lần;64MiB là giới hạn JSON chứ không phải giới hạn RAM. Per-target proof vẫn bị chặn ở3MiB, nên nâng tổng lên64MiB không làm mọi thư mục lớn dọn được. Chưa đo peak RAM mới, không gán số RAM thực tế. Sửa trước bằng bỏ abstraction batch đã chết, giữ one-process execution; sau đó đo và cân nhắc truyền theo chunk trong cùng process/auth session nếu cần.

## 6. P2 — Regression tests chưa nối UX, recovery và updater thành một luồng

Nguồn: [quick_selection_ux_evidence.json](quick_selection_ux_evidence.json), [journal_history.rs](../desktop/src_tauri/src/journal_history.rs), [test_native_maintenance.py](../scripts/test_native_maintenance.py).

Có fixture native cho quoting, Cancel, root replacement, cache live và dọn thật có evidence. Tuy nhiên8 kịch bản banner được chạy ad hoc; repo chỉ lưu kết quả, chưa có suite chạy lại cho chúng. Chưa thấy regression end-to-end: old reopen_pending + new successful cleanup + startup + updater eligibility; near-limit history; mất một parent trong admin batch. Các checks đã qua không chứng minh những trường hợp này. Cần bổ sung đúng các kịch bản này, không tăng số test bằng cách sao chép điều kiện implementation.

## Những thay đổi không phải vá tạm

- Gom admin một invocation và dọn user-level trước: hướng hợp lý; cần hoàn thiện protocol kết quả.
- realpath cho alias macOS, parser LF/CR: sửa nguyên nhân cụ thể, có fixture và dọn thật xác minh.
- Cache Chrome/Codex live: phạm vi chính xác, root identity và no-follow/atomic rename có cơ sở; nợ nằm ở policy lặp và hiệu năng, không phải mặc định cần quay lại quit app.
- Loại active wifi.log: scope user đã yêu cầu, enforced cả scan và native; không phải chỉ giấu UI.
- Click card + stopPropagation cho details/checkbox: hợp lý và QA native đạt; role group chỉ là nhóm, trạng thái chọn vẫn đọc qua checkbox con. Chưa thử VoiceOver, không nhận đã đạt accessibility toàn bộ.

## Thứ tự xử lý

1. Đồng bộ recovery/history/banner/updater, đối soát pending hiện có bằng quy tắc có bằng chứng.
2. Vòng đời journal và ngưỡng dung lượng.
3. Admin per-target outcomes và guard xuyên auth, với fixtures tương ứng.
4. Gom policy live, bỏ khung batch chết và đo RAM/I/O.

Không thay scope Quick/Mclean, không tự thêm filter bảo vệ ngoài yêu cầu user. Chưa refactor, chưa build hay release mới trong lượt audit.
