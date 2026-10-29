> Cập nhật triển khai 2026-10-11: các kết luận pnpm chưa hỗ trợ, ZIP Anti bị giữ và Detailed trùng Quick bên dưới là baseline audit trước sửa. Source mới có CLI pnpm_prune, ZIP matching installed version và scope dedup; xem [spec22](spec/22_manager_prune_installer_cleanup.md) và [evidence mới](manager_cleanup_completion_evidence.json). Không suy ra source mới đã dọn dữ liệu thật.

# Audit User Cache — MClean và VXClean

Ngày: 2026-10-11. Chỉ đọc source và quét; không thay rule, không dọn dữ liệu.

## Kết luận

User Cache VXClean **chưa clone toàn bộ rule MClean**. Có 3 kiểu lệch: bỏ root khỏi scanner, chia root thành phần được chọn/phần bị giữ, và chặn thực thi theo policy. Hiển thị trong Detailed không chứng minh dọn được ở đó.

Tham chiếu độc lập: scanner User Cache nguyên source `42cf1f8` được biên dịch riêng rồi quét máy này. Không sử dụng scanner VX làm oracle; chưa chứng minh binary MClean cài đặt đúng source này.

Snapshot source gốc: 45 mục / 2.009.136.276 byte. VX Quick: 179 mục / 1.186.298.291 byte đủ điều kiện. Mục nhiều hơn do VX tách các file/thư mục con. Các lần quét không đồng thời; không dùng hiệu tổng byte để kết luận mất chính xác từng file.

## Phạm vi nguồn

MClean quét mục trực tiếp `~/Library/Caches`, trừ Homebrew/ollama/com.electron.ollama (vốn đã dành cho mục riêng ở MClean). Nó còn thêm `~/.npm/_cacache`, `~/.cache/pip`, `~/.cache/yarn`, `~/.cache/pnpm`, `~/Library/Caches/pip`.

VX scanner User Cache bỏ 3 root npm/yarn/pnpm khỏi danh sách bổ sung, còn 2 root pip. Quick không chạy Node/Brew/AI/Media/Chrome riêng. Detailed có các nhóm riêng nhưng coverage chỉ một phần.

| Đường dẫn bị bỏ/chuyển | Thực trạng |
| :--- | :--- |
| `~/.npm/_cacache` | Chuyển Node Cache chi tiết; hiện 233.235 byte được tìm thấy nhưng không cho chọn vì phát hiện npm/node/yarn/pnpm đang chạy. Process check rộng, không chứng minh tiến trình đó đang dùng cache này |
| `~/.cache/yarn` | Bỏ khỏi User Cache; Node mặc định chỉ tìm `~/Library/Caches/Yarn`, có thể tìm `.cache/yarn` qua CLI. Không có CLI/không trả path đúng thì root gốc bị bỏ qua |
| `~/.cache/pnpm` | Bỏ khỏi User Cache; Node dùng `~/Library/pnpm/store` và CLI nhưng allowlist không chứa `.cache/pnpm`. Không phải chuyển đầy đủ. Store hiện 866,29 MB được tìm thấy nhưng `unvalidated`, không dọn được |
| Homebrew | MClean đã loại khỏi User Cache; VX Detailed chỉ cho nhánh downloads phù hợp, chặn phần khác; không phải lệch mới do VX loại Quick |
| Ollama/com.electron.ollama | MClean đã loại khỏi User Cache và có AI Ollama riêng. VX thay AI bằng Codex/Anti/ChatGPT và không chạy scanner AI gốc; hai cache Ollama này hiện không có nhánh cleanup tương ứng |

Chrome/Adobe/CapCut/Codex trong Library/Caches **không bị bỏ toàn bộ khỏi Quick**. Quick vẫn xét chúng. Các nhánh riêng chủ yếu mở rộng ra Application Support hoặc Movies, vốn không thuộc User Cache gốc. Cần tránh gọi tất cả các nhánh này là dữ liệu đã chuyển khỏi Quick.

## Phần bị policy giữ — máy này

| Mục | Quick giữ lại | Có dọn ở Detailed không? | Rule/lý do thực tế |
| :--- | ---: | :--- | :--- |
| com.google.antigravity | 363,26 MB | Không; AI chỉ hiện disabled | owner chứa antigravity → updater_state. Mục con hiện có update.zip/pending; có cơ sở là updater trên máy này, nhưng filter tên rộng hơn cấu trúc đã xác minh |
| com.google.antigravity.ShipIt | 480,70 MB | Không; AI chỉ hiện disabled | owner chứa shipit → updater_state; giữ log/state/gói update cùng nhau |
| com.google.GoogleUpdater | 180,83 KB | Không | owner chứa updater → updater_state. Mục con thực tế là fsCachedData/Cache.db/WAL/SHM; chặn cả HTTP cache updater, không chỉ pending installer |
| GeoServices | 7,24 MB | Không với phần này | snapshot từ chối regular file có link count khác 1; phát hiện hardlink trong Resources. 48,64 MB còn lại vẫn chọn được ở cả 2 scope |
| CSXS | 1,50 KB | Không với phần này | thành phần Local Storage/Session Storage bị protectedNames; khoảng 689,68 KB khác vẫn dọn được |
| helpd | 252 B | Không với remainder | root không được grant; chỉ Generated, help index, Cache.db/WAL/SHM, fsCachedData theo adapter |
| AMPLibraryAgent | 520 B | Không với remainder | tương tự adapter Foundation; phần HTTP cache được dọn |
| GameKit/tipsd/Google/Adobe | remainder hiện 0 B | Không có byte remainder cần dọn trong snapshot | Có hàng excluded vì parent bị từ chối rồi tách được các mục con; không phải toàn bộ parent đều bị bỏ |

Hai folder Antigravity cộng 843,96 MB là phần giữ lại lớn nhất. Giữ chúng là quyết định policy VX, không chứng minh chúng critical của OS hoặc phải giữ vĩnh viễn. Pending update có thể bị gián đoạn nếu dọn; việc tải lại phụ thuộc updater. Chưa kiểm chứng tái tạo trên dữ liệu thật.

## Coverage Detailed chưa đầy đủ và khác Quick

- Google: Quick có thể xét toàn nhánh Chrome dưới Library/Caches; Detailed chỉ Default/Profile *, những tên Cache/Code Cache/GPUCache/DawnCache/GraphiteDawnCache/ShaderCache. Phần khác dưới Google không có grant. Snapshot các leaf Detailed Library/Caches khoảng 638,39 MB; Quick Chrome khoảng 641,44 MB. Quét khác thời điểm nên không khẳng định hiệu byte là phần bỏ sót cố định.
- Adobe: Quick tách và cho chọn khoảng 422,02 MB trong Library/Caches/Adobe; Detailed đánh owner adobe là unvalidated và không có adapter cho root đó. Media chỉ quét Adobe/Common/Media Cache Files và Peak Files ở Application Support; cfa/pek còn bị sourceUnverified chặn. **Không được mô tả Library/Caches/Adobe là đã chuyển đầy đủ sang Media.** User làm rõ rằng Quick vẫn dọn root này là đúng; khác coverage Detailed không phải lỗi cần buộc chuyển nhánh.
- CapCut: Library/Caches vẫn xét trong Quick, còn Media dọn đúng một số CEF child cache ở Movies. Không thay thế toàn root Library/Caches bị dedicated filter của Detailed.
- Codex: Quick xét owner Codex, Detailed chỉ grant một số child dưới Library/Caches/Codex/Default. `Library/Caches/com.openai.codex` hiện xuất hiện AI nhưng disabled; không thể suy ra mọi cache Codex đều được chuyển.
- ChatGPT, Xcode, Docker, npm/pnpm/yarn và các owner chuyên biệt bị dedicated filter trong User Cache Detailed không tự có adapter bao phủ mọi path.

## Tất cả tầng filter còn khác MClean

1. Global guard: tên protected ở bất cứ thành phần path; `.codex/.gemini`, project, profile/auth/storage, node_modules/_npx, models/plugins, pending/staging/updater; riêng path chứa `/ShipIt`, `/Xcode/Archives`, cache/app support VXClean.
2. Updater owner filter: chứa shipit/antigravity/updater bị chặn trước generic cache; không phân loại từng nội dung con.
3. Detailed dedicated owner filter: loại nguyên các owner nêu trong cleanup_policy.swift; nhánh riêng không luôn bao phủ tương ứng.
4. Foundation: chỉ 3 owner helpd/tipsd/AMPLibraryAgent có adapter con; phần khác root không được grant.
5. Pip: scanner parent được thay bằng http-v2 và wheels; các child khác biến mất khỏi candidate, không xuất hiện trong excluded_items. Không phải chuyển sang Detailed vì Detailed cũng chỉ 2 child này.
6. Full-tree snapshot: tối đa 20.000 entries, 4 giây, proof 3 MB; không symlink/hardlink/special file; toàn cây phải cùng rule. Không đủ thì cố tách leaf trong 4 giây/20.000 lượt, phần còn lại disabled. Đây là filter kỹ thuật, không chứng minh nội dung nguy hiểm.
7. Permission/process: không có quyền ghi thì disabled, không admin fallback cho User Cache. Pip bị chặn khi Python/pip bất kỳ đang chạy; app có lifecycle adapter thì có thể đóng/rescan/mở lại. Dữ liệu thay đổi sau scan thì bị từ chối khi dọn.
8. Symlink/path thay đổi bị lọc trước DTO; lỗi đọc hoặc size 0 có thể làm mục không xuất hiện. Không phải tất cả phần bỏ đều được liệt kê trong excluded_items.
9. Dung lượng: scanner VX User dùng giới hạn 200.000 entries thay 10.000 của nguồn; DTO lại tính size toàn cây với hidden files, không dùng nguyên item.size MClean. Vì vậy byte có thể tăng ngay cả khi rule dọn hẹp hơn.
10. Thực thi: MClean removeItem toàn mục; VX User Cache chỉ unlink regular files đã được grant, giữ directory, không xóa toàn parent. Ticket/identity/protocol/batching/cancel vẫn là guard thêm của VX.

Không có filter tuổi 24 giờ chung cho User Cache hiện tại. Rule tuổi cũ nằm nhánh System/detailed khác; không lấy nó giải thích chênh lệch User Cache.

## Đánh giá lý do

Giữ profile/project/login thực có cơ sở sản phẩm. Nhưng protectedNames theo tên, hardlink, manifest limit hoặc thiếu adapter là những hạn chế do VX tự đặt; không được tự gọi là file critical hoặc chỉ có thể tồn tại mãi. Updater đang pending có rủi ro gián đoạn, khác rủi ro mất project. Reroute chỉ hoàn thành khi nhánh khác tìm đúng path và thực sự cho chọn/dọn, không phải chỉ hiện disabled.

Bằng chứng: [user_cache_rule_audit_evidence.json](user_cache_rule_audit_evidence.json). Nguồn: [ScanEngine.swift](../MClean/Services/ScanEngine.swift), [cleanup_policy.swift](../desktop/native/cleanup_policy.swift), [maintenance_cli.swift](../desktop/native/maintenance_cli.swift).

## User làm rõ và kiểm tra Anti sau update

User xác nhận giữ cache app Library/Caches trong Quick là đúng; Detailed bổ sung scope riêng, không yêu cầu thay thế toàn Quick. Do đó khác coverage Adobe Quick/Detailed được chấp nhận. “Dedicated owner adobe” là tên thư mục đầu sau Library/Caches, không phải cơ chế nhận diện app đang mở hay owner/quyền UNIX.

Quét chỉ đọc sau user update Anti: `com.google.antigravity` còn 363.255.137 byte; `com.google.antigravity.ShipIt` còn 15.927 byte. Tổng 363.271.064 byte, giảm 480.685.548 byte so snapshot trước. ShipIt không còn thư mục update.Qgy4B7n; com.google.antigravity vẫn có update.zip/pending. Không xóa dữ liệu hay thay rule.

## Hướng xử lý pnpm và kiểm tra sau restart Anti

`~/.cache/pnpm` hiện không tồn tại trên máy này. Coverage gap có thể ảnh hưởng máy khác hoặc cấu hình cũ; không có dung lượng bị bỏ sót ở đúng đường dẫn này trong snapshot hiện tại. Hướng xử lý: bổ sung discovery path chuẩn/legacy, xác minh cấu trúc và manager/version; cache download thuần được cấp rule riêng, dlx/runtime/project/config giữ ngoài grant. Không thêm allowlist root rồi xóa mù toàn cây.

Store đang có dữ liệu: dùng adapter chính thức `pnpm store path` + `pnpm store prune`, xác minh executable/version và store path, xử lý busy/cancel/journal bằng scope Node Detailed. Không rm toàn store hoặc hứa 866,29 MB đều thu hồi được. Store tổng là inventory; dung lượng thu hồi phải dựa kết quả prune thực. pnpm prune chỉ bỏ package không còn tham chiếu, package cần lại được tải lại; layout global virtual store có liên kết project nên manager cần tự quản lý. Đây là phương án đề xuất, chưa thực thi prune. [Tài liệu pnpm](https://pnpm.io/cli/store).

Sau restart: cache com.google.antigravity vẫn 363.255.137 byte; ShipIt 15.927 byte. Hai archive update.zip và pending/Antigravity.zip mỗi file 181.627.488 byte, SHA256 giống nhau, Info.plist bundle com.google.antigravity/version2.22.0. App Antigravity đã cài2.22.0; Antigravity IDE là bundle khác/version2.5.5. Vì vậy restart IDE không chứng minh updater app kia đã hoàn tất. Đây là ứng viên installer dư, chưa khẳng định an toàn xóa khi updater còn hoạt động. Không dọn dữ liệu trong kiểm tra này.
