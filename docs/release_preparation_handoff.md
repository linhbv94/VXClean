# Bàn giao chuẩn bị phát hành VXClean

> Gói mới nhất sau pnpm/Anti và sửa canonical ownership: đọc [handoff review hiện hành](manager_cleanup_review_handoff.md) trước các snapshot bên dưới. Source/artifact hashes và chữ ký gói cuối đã cập nhật; native26/manager9 đạt, runtime pnpm confirm/Cancel đạt, Quick–Detail overlap0. OS dialog Cancel và physical tray vẫn chưa chứng minh. Không publish.
> Cập nhật audit 2026-10-11: System Junk Quick đối chiếu nguyên scanner MClean `42cf1f8` bằng test độc lập exact path/size/default selection; native 26 nhóm và Rust 21 tests PASS. Đã sửa hidden eligibility manifest, Xcode path guard và trả giới hạn tính size System về 10.000 entry. Xem [audit rule](system_junk_rule_audit.md) và [bằng chứng hiện hành](system_junk_clone_evidence.json). Các số scan cũ bên dưới là snapshot lịch sử, không chứng minh parity rule.


Trạng thái 2026-10-11: **Rule Quick theo user đã sửa và nghiệm thu local: không giữ cache/build/tool chỉ vì đang build, không ngưỡng24h chung; ngoài-kết-quả ở dưới category**; dọn chi tiết hoàn thiện sau theo user. Gói cuối và hạn chế xem [Quick evidence](quick_mclean_adapt_evidence.json). Không ghi toàn scope ready hoặc coi Intel/updater install đã được test. Task hiện tại không commit/push/tag/publish. Dùng [checklist release duy nhất](release_readiness_checklist.md) để điều phối phần còn lại; không lấy build local làm hoàn thành scope.

### Cập nhật 2026-10-11 — System Junk clone MClean toàn bộ và xử lý chờ quyền Downloads

- User bác bỏ các filter riêng của VXClean trong System Junk. Quick hiện dùng chính scanner MClean: sáu roots, ngưỡng >1024B, size của scanner; bỏ lọc tên profile/project/updater, extension DB/credential/lock, IPC, tuổi và hardlink trong System Junk. Không kéo profile Chrome gốc/Application Support vào Quick. User Cache/detailed không đổi theo task này.
- Dọn toàn item như MClean; nếu thiếu quyền ghi thì flow xác thực admin macOS. Giữ phạm vi roots, symlink top-level, identity/manifest đổi sau scan; hardlink unlink alias được chọn, alias ngoài roots giữ nguyên. Admin prompt trên dữ liệu thật chưa được thực thi/nhập mật khẩu trong lượt này.
- Native25 nhóm PASS, Rust21 PASS; fixture full selection→dọn hết bytes→rescan0; gồm temp profile-copy, IPC/lock và hardlink; Rust→native kiểm chứng alias ngoài scope giữ nguyên. Không dọn data thật trong lượt này.
- Quét chỉ đọc native: System Junk1.200.874.425B/106mục, excluded System0B. App đóng gói mới: System1.2GB109/109 được chọn, User1.19GB179/179; tổng chọn2.39GB. Chọn/bỏ nhóm và confirm/cancel đạt; app đang mở màn kết quả. Số mục thay đổi do temp/log tạo mới trong quá trình build, không ép snapshot hai thời điểm giống nhau.
- User xác nhận Downloads chưa được cấp quyền vì không ngồi máy. Large Files chuyển worker song song từng root, budget5s/root, giữ kết quả root đã xong và báo partial thật; Quick đo~24.926s→9.943s. Không khẳng định Downloads đã quét; sau cấp quyền bấm Quét lại. Không cấp FDA/admin hộ user hoặc bỏ kiểm soát quyền.
- Đã đồng bộ đơn vị thập phân Dashboard/menu panel và các màn qua formatter; gói App/DMG/updater arm640.1.0 build, codesign deep/strict và hai verifier chữ ký/tamper đạt. Source/artifact hashes đã cập nhật. Chưa commit/push/tag/publish; Intel/macOS13/updater install và physical tray click vẫn chưa nghiệm thu.
- Truth: [spec21](spec/21_quick_scan_clean_parity.md), [evidence](system_junk_clone_evidence.json), [ảnh app](system_junk_clone_ui.png), [handoff](release_preparation_handoff.md). Không dùng bản 1.12GB hoặc ledger76MB cũ làm kết luận hiện tại. Không gọi Anti; không reset số vòng đã hết trước đó.

## Build và bí mật

- UI ở `desktop`, Rust host ở `desktop/src_tauri`, Swift resource build bởi build.rs, minimum deployment macOS13.
- `desktop/package-lock.json` là lockfile riêng; `npm ci --ignore-scripts`, sau đó `npm run build`.
- `.release_keys/` được gitignore. Private updater key giữ local, không chép vào log/doc. Agent phát hành cần đặt secrets GitHub `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` đúng public key trong config; không tạo key khác làm updater của bản này mất khả năng nhận update.
- Workflow `release.yml` được cấu hình build arm64/Intel vào draft GitHub Release khi agent phát hành được phép chạy; không tự publish, không dùng Actions cache/artifact. Task local này chưa chạy workflow hay tạo draft. Codesign ad-hoc không phải Developer ID/notarization. Phải ghi rõ cách phân phối và Gatekeeper; không cam kết bản ký Apple khi chưa có chứng chỉ.
- Chưa chạy CI trên remote, chưa chứng minh Intel/macOS13 runtime, chưa có engine Windows. Không đưa Windows asset rỗng vào release.

## Gates chưa được chứng minh

- Chrome: máy thật đã QA9cache/804.438.535logicalbytes/0failure,50tệp profile không đổi khi đóng,8window/90browser tab (1QA) vàVL3tab/order/selected khôi phục. [Evidence](chrome_cleanup_runtime_evidence.json). Cần layout/OS khác, pinned/group edge cases; không đồng nhất trường hợp máy này với bảo đảm mọi phiên. Hai journal thất bại trước sửa còn giữ, không auto replay.
- Cold start Codex/Antigravity sau dọn cache trên môi trường riêng: cần kiểm chứng frontend/plugin/MCP; tuyệt đối không dùng data thật của user để thay fixture.
- Updater từ gói cũ sang release cao hơn (public chain kiểm chứng sau first release): cần test chữ ký sai, endpoint lỗi, download ngắt, mutation đang chạy, cài thành công và restart. Frontend build không thay runtime update test.
- Packaged panel/real metrics/Open main và journal retention/bounded reads đã đạt local; tray click thực/ẩn Dock/đa màn hình/sleep-wake còn cần QA.

Kết quả từng gate và hash artifact cuối được cập nhật ở [báo cáo local](local_completion_report.md). Không dùng báo cáo hash của artifact cũ để xác nhận source mới.

## Lịch sử số liệu Quick trước điều chỉnh build/temp

Không chuyển category: User Cache tăng từ127MB lên1,17GB vì mở discovery Google/Adobe/AI trong Library/Caches. System Junk~224MB giảm do bỏ tổng inventory không có grant khỏi tổng rác; phần lớn chênh lệch là build/test/runtime trong /tmp (~994MB), vẫn hiển thị ngoài kết quả kèm lý do. UserCaches~844MB Anti/ShipIt staging được giữ; đã thấy tiến trình updater chạy. Bản cuối UI chọn tất cả2,09GB/2,09GB (278targets), default1,39GB do LargeFiles opt-in. Đây là mẫu đọc máy thật, không phải lượng đã dọn. Native25 kiểm chứng actual delete disposable + byte parity + rescan0 + HTTP regeneration + protected state unchanged. Không dọn thêm dữ liệu thật lượt này.

## Rule MClean adapt cuối theo user

Bỏ guard executable/library/target/tên QA/build và ngưỡng24h chung của Quick. Cache npm266MB/videoQA221MB/Swift289MB và phần công cụ release293MB/signature30,9MB đều có grant; còn lock/IPC, hardlink/symlink, project/profile/credential và quyền vẫn chặn. Alias /var/log,/var/tmp được canonical hóa sang /private/var. UI cuối System1,12GB516items/User1,18GB179items; chọn695items2,31GB bằng header. Ngoài kết quả dọn đã chuyển dưới categories. LargeFiles timeout20s trong lần UI cuối, warning hiện; native read-only scan có700MB, không coi timeout là scan đầy đủ. Native25 fixture đã dọn hết cache/tool mới và cũ, byte parity và rescan0, giữ protected. App/DMG/updater mới và hashes/codesign/signature/tamper đạt; chưa publish.
