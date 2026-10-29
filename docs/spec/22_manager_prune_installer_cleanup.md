# pnpm prune và bộ cài Anti — 2026-10-11

## Scope đã được user duyệt

- Node Detailed nhận diện pnpm CLI/store và gọi pnpm store prune; VX không unlink/rm nội dung store. Không chạy prune trong scan hay tự khởi động. Store inventory tách khỏi ước tính thu hồi; dung lượng được manager dọn báo sau thao tác, không hứa tổng store đều dọn được.
- Lệnh executable/argv cố định, không shell; nhận diện store path qua pnpm rồi kiểm tra nằm trong vùng pnpm cho phép, không symlink root hoặc path project/system. Xác minh lại khi chạy, confirmation, cancel, timeout, journal và exit code thật; không replay prune sau restart. CLI unavailable/unknown store => chỉ xem kèm lý do.
- Anti installer: chỉ hai ZIP update.zip và pending/Antigravity.zip trong cache com.google.antigravity, khi bundle/version trong ZIP khớp app Antigravity đã cài. Không dọn pending directory/state hoặc nhánh khác qua parent. Có ShipIt thì hiện khuyến nghị mở đúng Antigravity để update trước rồi scan lại; log/state riêng không phải bằng chứng update đang chờ.
- Phân biệt Antigravity app com.google.antigravity và Antigravity IDE com.google.antigravity-ide. Không suy luận cơ chế update chung, không gọi endpoint placeholder. Luồng IDE chưa xác minh đầy đủ; chỉ hướng dẫn thao tác app khi chưa có adapter đáng tin.
- Detailed bỏ target đã được Quick cleanable bao phủ; không cấp grant parent Detailed xuyên target Quick. Loại trùng bằng classifier thật, không vendor blanket hoặc tick của user.

## QA

Fixture manager: nhận diện, success, nonzero, timeout/cancel, store đổi giữa scan/run, path ngoài allowlist, không chạy lệnh tùy ý, giữ project và chỉ manager xóa phần unreferenced. Installer: installed version khớp/mismatch, ZIP giả/đổi, ShipIt recommendation, hai bundle phân biệt. Actual user data không tự dọn để test. Ghi báo cáo/evidence/work log sau hoàn tất; không publish.

Trạng thái: đã nối source và đóng gói/nghiệm thu local phần manager. Sẵn sàng review độc lập; không đồng nghĩa mọi gate OS/tray/Intel/updater install đã đạt để publish. [Evidence](../manager_cleanup_completion_evidence.json), [checklist](../release_readiness_checklist.md).

Ownership Quick/Detail so sánh đường dẫn canonical: /tmp và /private/tmp, /var/log và /private/var/log, /var/tmp và /private/var/tmp được coi cùng target. Real read-only gói cuối overlap0; 26 regression + 9 manager fixture đạt. Không dùng số scan để thay bằng chứng rule.

## Chi tiết store theo phiên bản

CLI hiện tại trên máy trả `~/Library/pnpm/store/v11`. Store v10 cũng tồn tại, được giữ riêng chỉ đọc với lý do cần pnpm tương thích. Prune active v11 không đồng nghĩa dọn v10; không tự tải/chạy CLI phiên bản khác. Lỗi sau khi manager bắt đầu có thể đã dọn một phần: result/journal giữ outcome_unknown, không replay.

## Anti IDE — tín hiệu đã quan sát

App IDE bundle com.google.antigravity-ide/version2.5.5; product.json có updateUrl https://example.com, commit hiện có. Code Electron có checkForUpdates/autoUpdater.setFeedURL. Log phiên restart ghi idle → checking for updates → idle; đây chỉ là trạng thái kiểm tra, chưa chứng minh có/download/install update. Không dùng trạng thái idle làm điều kiện cấp quyền dọn installer app Antigravity khác bundle. Chưa nối tự động click/drive update IDE.

## Chốt bổ sung của user — 2026-10-11

- Đối chiếu ZIP với app đã cài là logic native chạy độc lập trong ứng dụng, không cần agent, model hay dịch vụ AI. Khi scan, engine đọc Info.plist trong từng ZIP và app; trước khi dọn, engine chạy lại rule và kiểm tra manifest/identity. Không khớp, app không còn tồn tại hoặc không đọc được => không cấp quyền dọn theo rule installer. Không chỉ dựa vào tên ZIP hay kết quả agent từng kiểm tra.
- Tạm chưa cấp rule dọn bộ cập nhật **Anti IDE** chưa xác minh. Không thêm lệnh tự update hay filter vendor mới. Các cache frontend đã có adapter cụ thể (Cache, Code Cache, GPU/Dawn cache trong Application Support/Antigravity IDE) vẫn thuộc AI Apps; chưa biết nội dung vùng updater không đồng nghĩa toàn bộ cache IDE phải giữ.
- Câu hỏi chờ quan sát: khi user thấy IDE báo **Restart to update**, yêu cầu agent kiểm tra chỉ đọc cache, pending/ShipIt nếu có và log updater **trước restart**, rồi so sánh sau restart. Xác định chính xác bundle, đường dẫn, phiên bản installer/app, file nào đã dùng xong và file nào là state; từ bằng chứng đó chốt rule. Không tự dọn hoặc suy luận từ luồng Antigravity app cũ.

## Quan sát thật trước restart — 2026-10-28

User thấy Restart to update và yêu cầu chỉ đọc trước khi tự restart. Installed IDE2.5.5/commit ecfbad74d93962fc8ca485d93ab9b4f3d4cb6cf8; ShipIt của đúng bundle `com.google.antigravity-ide` chứa `update.og1Mqjc/Antigravity IDE.app`2.6.0/commit9e3a5da5d6731effd57d47d88bbe5df14ac6ccdd, signature strict/deep đạt. Staging587.77MB logical/633.70MB allocated. Main log12:57:40 downloading→12:58:09 downloaded→ready; ShipIt process đang chạy và state trỏ staging→Applications. State file tên.plist nhưng nội dungJSON, `launchAfterInstallation=false`.

Đây là pending payload đang dùng, không dọn trước restart. Chưa cho phép dọn hậu-update chỉ vì version khớp: cần so sánh installed hash/version/commit, staging còn/mất, state và ShipIt process/log sau user update. Cache `com.google.antigravity`/ShipIt không có hậu tố IDE thuộc bundle khác; không suy ruleIDE từ haiZIP app cũ. Không sửa engine/rule hoặc tự restart trong lượt quan sát. [Snapshot](../anti_ide_pending_update_2026_10_28.json).

### Đối chiếu sau restart 2026-10-28

Installed2.6.0 khớp main/Info hashstaging; ShipIt completed/launch succeeded rồi thoát. Payload staging tự mất, temp cũ mất, còn1tempdir rỗng và~3.73KBstate/log. State vẫn trỏ payload đã mất: không dùng riêng sự tồn tại state/log làm bằng chứng updatepending. Luồng đã quan sát không cần rulexóaShipIt mới; giữ pending trước update, ưu tiên để updater tự quản lý. Không mở rộng rule sang bundleAntigravity khác/lầnupdate lỗi. [Evidence sau](../anti_ide_after_update_2026_10_28.json).
