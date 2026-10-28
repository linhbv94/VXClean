# Một lần xác thực admin và Quick cache không đóng app

Ngày 2026-10-11. Feedback production: mỗi mục System Junk hỏi mật khẩu, Quick đóng Chrome/ChatGPT/Antigravity, có lô bị ngắt vì manifest quá lớn.

- Một lượt dọn dùng một engine process và một payload có giới hạn 64 MiB; giữ đầy đủ proof, không cắt manifest. Kiểm tra giới hạn trước khi ghi intent/dọn. Không chia thành nhiều subprocess làm mất phiên xác thực.
- Dọn user-level trước; gom đúng những mục được cấp quyền và gặp permission để chạy một AppleScript admin cuối lượt. Mỗi mục kiểm tra identity/symlink và trạng thái tiến trình, trả kết quả riêng, journal riêng. Cancel không hỏi lại cho các mục khác, không tự replay. Không lưu password.
- Quick trong Library/Caches: không ép đóng app. Giữ guard dữ liệu profile/project/runtime và identity/content, chỉ dọn cache đã cấp quyền. Cache đang ghi có thể bị bỏ qua do thay đổi hoặc sinh lại. Chrome detailed/Application Support và adapter media/AI chi tiết vẫn giữ lifecycle theo rule.
- Nghiệm thu: nhiều mục cần admin chỉ một invocation; Cancel giữ các mục pending; path có dấu nháy/newline không chèn lệnh; identity thay đổi không xóa; payload >4 MiB qua producer→consumer không cắt proof; scan Quick không requires_app_quit dù Chrome đang mở; detailed giữ yêu cầu.

## Điều chỉnh 1.0.6 sau QA GUI thật

Hai lượt GUI chưa mutation: identity hoặc content một target đổi sau scan chặn cả Quick. Quick host phải preflight từng target độc lập, báo skipped theo path/lý do, chỉ gửi những target còn đúng proof. Không refresh proof để cấp quyền nội dung mới ngoài ngoại lệ Chrome cache đang mở được quy định ở mục cuối; không bỏ guard. Detailed/uninstall vẫn strict. Mọi skipped được cộng failure_count và hiển thị trong summary/history; không tự retry/replay.

## Điều chỉnh1.0.7 — admin physical parent

QA GUI1.0.6 dọn69/92mục,1.131.565.337bytes;4target đổi sau scan và19admin targets bị parent guard chặn. Foundation URL có thể hiển thị /tmp hoặc /var/log dù physical path là /private/...; parent shell pwd -P phải so với Darwin realpath, không Foundation URL.path. Thêm native fixture thật raw /tmp và /var/tmp qua cùng admin guarded shell; vẫn một invocation. Parser stdout xử lý cả LF/CR do AppleScript chuẩn hóa newline.

## Thông báo Quick ngắn gọn — 2026-10-11

- Lỗi thao tác và quét chưa đầy đủ dùng thông báo tiếng Việt ngắn, có nút đóng. Mã lỗi, đường dẫn và lý do kỹ thuật nằm trong phần chi tiết mở rộng, không nối thành đoạn đỏ dài.
- Kết quả dọn một phần giữ rõ số mục chưa dọn và số mục thành công; dùng biểu tượng cảnh báo thay biểu tượng thành công toàn phần. Chi tiết gom lý do trùng và giới hạn chiều cao cuộn.
- Đóng thông báo không thay đổi kết quả, lựa chọn hoặc khả năng quét lại. Quét mới đặt lại trạng thái thông báo.

## Chrome cache đang mở — 2026-10-11

- Quick đã cấp quyền cho mục `~/Library/Caches/Google/Chrome` theo `chrome_quick_cache` thì nội dung cache thay đổi không làm vô hiệu toàn mục. Giữ kiểm tra định danh thư mục gốc; chỉ lấy manifest hiện tại trong chính vùng cache đã chọn.
- Native xác minh lại từng đường dẫn, rule, symlink/hardlink và file thường trước khi xóa. File cùng inode được ghi thêm vẫn được dọn; dùng kích thước thực tại lúc cô lập để tính dung lượng. File thay định danh giữa manifest thực thi và xóa vẫn bị từ chối.
- Không áp dụng cơ chế này cho Application Support, profile, Detailed, gỡ app, tệp cá nhân hoặc rule chưa xác minh. Không quit Chrome trong Quick; cache mới sinh sau khi dọn có thể xuất hiện lại.

## Hoàn tất live Quick: Codex cache và loại wifi.log — 2026-10-11

- Áp dụng cùng cơ chế cache đang mở cho `ai_frontend_quick_cache` trong `~/Library/Caches/Codex`. Không mở rộng sang Application Support, lịch sử, plugin/MCP/runtime. Giữ root identity, rule từng child, no-follow/hardlink và kiểm tra inode lúc cô lập file.
- Theo chỉ đạo mới của user, bỏ riêng `/var/log/wifi.log` và alias `/private/var/log/wifi.log` khỏi scope Quick: không emit item, không cộng total/default selection hoặc đưa vào nhóm giữ lại. Native revalidation cũng từ chối nếu có payload/ticket cũ. Log xoay vòng như `wifi.log.0.bz2` vẫn giữ rule MClean hiện tại. Không nới content guard cho System Junk vì vấn đề wifi.log.
- Các rule khác vẫn dùng snapshot strict. Quét/dọn lại không tự replay hoặc mở rộng sang tệp lớn chưa chọn. App/OS có thể sinh cache/log mới sau dọn, vì vậy không hứa mọi scan sau đó là 0 B.

## UX chọn card và cảnh báo sự cố — 2026-10-11

- Card hạng mục Quick: click nền, tiêu đề, icon, mô tả hoặc dung lượng bật/tắt toàn bộ mục có thể dọn. Khi chọn một phần, click card chọn hết; click lần nữa bỏ hết.
- Toàn bộ dòng “Xem và chọn từng mục” chỉ mở/đóng details, không đổi lựa chọn. Checkbox từng tệp chỉ đổi tệp đó. Checkbox nhóm không toggle hai lần. Enter/Space trên card chọn nhóm; thao tác trên controls con giữ hành vi riêng.
- Cảnh báo chỉ hiện cho incident thực tế chưa được user acknowledge. Nút X lưu trạng thái đã xem qua backend, giữ nguyên bằng chứng và guard updater. Lịch sử độc lập tại Settings vẫn xem được cả lượt cũ, lượt đã ẩn và lượt thành công. Lượt thành công mới không được che nghĩa vụ mở lại app cũ; app đã chạy lại đúng bundle/path được đối soát thụ động.
- Không thay engine dọn hoặc tự chạy lại bất kỳ thao tác xóa nào.

## Bảo trì recovery/admin/policy — 2026-10-11

- Banner dùng incident chưa acknowledge từ toàn history, không dùng latest-only. Settings có lịch sử độc lập; acknowledge không đổi kết quả xóa, không bỏ guard updater. Backend cung cấp recovery_required cho UI và cùng phân loại pending reopen/journal lỗi cho updater.
- Reconcile chỉ đối soát app đang chạy đúng bundle/path; version khác do update không ngăn xác nhận already_running. Tự launch vẫn yêu cầu identity/version được kiểm chứng như cũ. Không tự Quit/launch qua thao tác xem history.
- Journal đọc giới hạn từng operation, trả summary thay full success-file log, tối đa200 failed/unknown targets mỗi operation trên UI; có tổng số retained targets và archive nguyên bản cho phần còn lại. Terminal có thể compact vào archive gzip có checksum và summary commit nguyên tử; giữ evidence unknown, không coi là success. Pending reopen/corrupt không compact. Known partial/cancelled có vòng đời180 ngày; unknown không tự hết hạn.
- Admin batch trả status từng mục, một parent lỗi không chặn siblings. Revalidate root metadata sau password; System Junk cấp quyền toàn root MClean, không claim proof từng descendant. Cancel giữ phần đã xóa nếu có. Một lượt một lần xác thực.
- execution_mode của rule native phân biệt strict_snapshot và live_cache_root; Rust dùng metadata đã giữ trong scan ticket, không thêm allowlist app riêng. Không mở rộng scope Quick.
- Một cleanup request/process, bỏ vòng loop batch cũ; giữ toàn proof và giới hạn64MiB. Đo RAM với fixture lớn. Regression nối history/banner/updater và admin guard lỗi từng mục.

- Khi compact, giữ `history_updated_at_ms` từ journal gốc để thứ tự và tuổi retention không bị reset theo thời điểm nén hoặc acknowledge. Có regression đọc trước/sau nén và ẩn cảnh báo.

## Thứ tự item khi expand — 2026-10-12

- Danh sách item trong mỗi card kết quả quét sắp theo size_bytes giảm dần (lớn trước, nhỏ sau). Chỉ đổi thứ tự hiển thị, giữ path làm key và giữ nguyên lựa chọn/scope dọn. Không mutate mảng items của scan ticket.

## Gỡ app theo root và cache điều hướng Lens — 2026-10-12 (Lens1.0.13 đã thay bởi1.0.15)

- Gỡ app cấp grant toàn root đã chọn, không cấp quyền theo nội dung từng cache file. Snapshot root identity/metadata được đối soát trước thao tác; native vẫn kiểm tra bundle ID/version, app đã thoát, SIP/self protection và association từng path. Chuyển root vào Trash theo đơn vị, không duyệt/xóa theo symlink con. Root symlink/special/hardlink vẫn bị chặn. Discovery chứa project vẫn opt-in, không tự tick.
- Không áp dụng root grant này cho Quick/Detail hoặc Lens Trash. Lỗi preflight nêu path chưa xác minh, không ghi đã gỡ thành công.
- Lens giữ tối đa16 kết quả folder đã quét trong5 phút; về folder cha hoặc folder đã xem dùng cache. Folder mới cần scan một lần. Quét lại bỏ cache; mọi mutation invalidate cache. Không dùng cache hiển thị để cấp quyền xóa.

## Cây điều hướng Space Lens đa nền tảng — 2026-10-12 (thiết kế1.0.14 bị thay vì chưa đạt)

- Scanner giữ cây mới nằm trong Rust dùng chung Mac/Windows; không phụ thuộc Swift. Một traversal tính size và giữ metadata điều hướng, không đọc nội dung hoặc theo symlink. Unix dùng allocated bytes, Windows hiện dùng logical bytes và báo size_kind rõ.
- Giữ tối đa50.000 node/48 tầng mỗi snapshot; nhánh vượt giới hạn có children_complete=false, mở rộng riêng khi vào. Không cắt mặc định3 tầng. Cache5 phút, refresh/mutation invalidate.
- Navigation không cấp quyền xóa: chỉ tạo proof cho con trực tiếp root. Trước xác nhận Trash ở nhánh sâu, quét lại folder đang xem để tạo proof mới; native macOS giữ revalidation hiện tại. Windows chưa có native Trash tương ứng, không tuyên bố Windows mutation đã hỗ trợ.
- Nghiệm thu fixture: nested tree, size, symlink/package/denied, cancellation, retention, navigation bridge call count; đo thời gian thật, không cam kết số chưa đo.

- Runtime scan Rust chạy ở worker process chính executable với mode chỉ đọc `--lens-scan`, trước khởi tạo Tauri/UI. Host dùng pipe/progress, hủy/timeout120 giây/kill process group như engine hiện tại: syscall đọc folder bị kẹt không được giữ thread trong app vô hạn. Progress heartbeat250ms, không phát một event UI cho mỗi node.

## Cây điều hướng hiện hành1.0.15: sửa nghiệm thu Library lớn — 2026-10-12

- User tái hiện Library → Application Support vẫn quét lại. Giới hạn50.000node làm rơi cấu trúc cây; không còn dùng giới hạn node/depth để cắt cây rồi quét lại khi điều hướng.
- Scanner Rust worker giữ toàn bộ metadata đọc được theo cấu trúc phẳng gọn, không đọc contents, không theo links/reparse. Host Rust giữ snapshot5 phút; UI chỉ nhận root + direct children cho folder đang xem. Query subtree lấy metadata snapshot, không gọi scanner/read filesystem.
- Hết TTL, chọn folder ngoài root đã quét, refresh hoặc mutation mới cần scan. Permission-denied giữ node/partial và không tự quét lại khi đi vào. Packages vẫn không drill theo Finder semantics.
- Tách navigation và mutation proof như trước: query không tạo grant; Trash nhánh sâu vẫn xác minh riêng trước xác nhận, không dùng cây UI làm quyền xóa.
- Nghiệm thu bắt buộc nhánh thật Library → Application Support → Google → Chrome và fixture >50.000 entries, tạo file mới sau scan không xuất hiện khi lần đầu vào child, chỉ xuất hiện khi refresh. Scanner/host/query dùngRust, Windows type-check scanner; không tuyên bố full Win runtime.

- Snapshot phẳng truyền worker → host qua gzip rồi deserialize trực tiếp typed để tránh nhiều bản sao JSON; không truyền toàn cây sang WebView. Host giữ tối đa2 snapshot, timer5 phút giải phóng RAM; FE tối đa16 folder DTO. Output compressed32MiB/timeout120s là lỗi có báo, không truncate rồi scan lại.

### QA độc lập trước publish1.0.15

- Khi Trash từ nhánh Lens cached phải scan parent mới trước confirmation, preview lấy name/size từ item vừa scan. Không dùng metadata snapshot cũ để mô tả grant mới; nếu mục không còn cleanable thì chặn. Native vẫn revalidate identity/content trước mutation.

- 2026-10-27: “Ngoài kết quả dọn” cũng sắp size_bytes giảm dần bằng bản sao mảng; không thay excluded reason, scope hay khả năng chọn/xóa.

## 2026-10-27 — Cache lớn không phụ thuộc manifest toàn cây

Quick live_cache_root (Chrome/Codex đã nhận diện) phải kiểm chứng toàn cây bằng lượt duyệt chỉ đọc, không gom manifest lớn vào ticket. Ticket giữ root identity; native validate lại tree/rule/no-link/hardlink trước mutation, sau đó snapshot và dọn batch tối đa512regular files. Giữ root/parent, không đi theo link; mục nguy hiểm được chặn trước batch đầu. Thay đổi trong khi thực thi vẫn kiểm tra identity từng file, cancellation và journal/per-file outcome. Không nới cap manifest cho các loại dữ liệu khác. Fixture >20.000file và >3MiB proof phải scan chọn được/dọn hết, marker profile ngoài cache giữ nguyên; symlink/hardlink/protected child phải fail closed.

Wording UI không nhắc tên sản phẩm upstream; attribution/license và đường dẫn imported source không thay. Rule IDs lịch sử giữ ổn định để không phá ticket/journal, mô tả hiển thị dùng VXClean/loại dữ liệu cụ thể.

Journal cache lớn: giữ tối đa200success targets trong trạng thái RAM/result.json, giữ nguyên mọi uncertain/error; events.jsonl vẫn ghi durable intent/outcome từng tệp. Event byte budget128MiB, read budget tổng256MiB; không phải quyền xóa rộng hơn. History reducer giữ200success mẫu, không coi số success đã hoàn tất là cap20.000uncertain. Phải test journal lớn qua read/recovery/compact, không chỉ xóa file. Các giới hạn chống dữ liệu lỗi vẫn fail closed và báo partial thật.
