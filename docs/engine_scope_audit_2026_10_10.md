# VXClean — Đối soát engine, scope dọn dẹp và mức sẵn sàng triển khai

Ngày: 2026-10-10. Reviewer: Codex. Phạm vi: working tree macOS hiện tại, không chỉ commit HEAD.

## Kết luận

Engine **khớp phần lớn với baseline được mô tả trong spec 13**, nhưng **chưa đáp ứng các target trong spec 11–12**. Bộ docs vẫn có mô tả cũ mâu thuẫn ở ngay phần contract/API, defaults và README; thêm banner ưu tiên spec 13 chưa tạo ra một bộ tài liệu có thể giao agent triển khai mà không phải tự giải thích lại.

Có thể chốt **scope v1 hẹp và bắt đầu triển khai theo giai đoạn**. Chưa sẵn sàng triển khai một lượt toàn bộ 68 rule, chưa sẵn sàng phát hành hoặc coi việc dọn dữ liệu thật đã được nghiệm thu. Ưu tiên trước là policy bảo vệ dùng chung cho mọi đường xóa, sửa các lỗi integration, rồi mới mở scope Chrome/Media.

Điểm cần quyết định trước implementation: “giữ scan mặc định” có nghĩa giữ cách phát hiện/nhóm/ngưỡng, hay cả quyền xóa và lựa chọn rủi ro hiện tại? Hai yêu cầu **giữ mọi defaults cũ** và **mọi đường dọn đều bảo vệ runtime/updater/data chưa xác minh** không thể đồng thời được bảo đảm bằng dictionary chỉ áp dụng ở Dọn chi tiết. Khuyến nghị giữ cách phát hiện của Quick, nhưng áp policy bảo vệ chung tại mutation; không tự thay defaults trong lượt audit này.

## 1. Công việc và quyết định trích xuất từ convo

Đã đọc đủ các trang trả về của chat **Review UI và nối engine**, ID `01a11f50-f03a-73c3-8b15-549ac9bd2d8e`, cùng tài liệu/source VXClean và overview/backlog/work log của bộ VX. Không dùng câu “agent đã xong” làm bằng chứng nghiệm thu.

| Giai đoạn | Quyết định/việc đã làm | Giới hạn hiện tại |
|---|---|---|
| Kế thừa MClean | Giữ nguồn gốc upstream, docs tác giả riêng; đổi thương hiệu VXClean | Source SwiftUI gốc và desktop Tauri cùng tồn tại; không đồng nhất hai đường thực thi |
| Đổi kiến trúc | Chung React UI/Tauri host; Swift native trên Mac; Windows adapter riêng sau | Windows chưa có engine; tái sử dụng UI không chứng minh tương thích OS/rule |
| Review UI, nối engine | Metrics, scan, clean, apps, uninstall, lens, orphans có command thật; browser preview có mock riêng | Có command không chứng minh mọi luồng hoạt động đúng; Orphans có lỗi host payload |
| Đối chiếu MClean | Nối trực tiếp 10 category ScanEngine; giữ grouping/ngưỡng/default từng item; Quick ẩn nhóm rỗng | Scanner gốc không phải chứng nhận safety; Quick/Detail hiện cùng phạm vi scan |
| UI/state | Sidebar, scan từ dashboard, sorting, Lens, theme và retention 5 phút | Retention UI khác grant host 15 phút; không phải cache quyền xóa lâu dài |
| Gỡ app quét rộng | Match tên chính xác trong các root Home/Library giới hạn; candidate không tick mặc định | Heuristic association, không tìm mọi dấu vết; `Movies/CapCut` có thể chứa cả project |
| Node cache động | CLI output qua canonical allowlist; kiểm tra lại trước xóa | Chặn path lệch không bảo vệ được runtime `_npx` nằm bên trong root hợp lệ |
| Safety user làm rõ | Tập trung tránh gom file critical của OS vào dọn; không bắt mọi thứ vào Trash | Cần policy độc lập với scanner; OS safety, app continuity và user data là ba tiêu chí riêng |
| Scope mới | Giữ Quick; Media Apps gồm CapCut/Adobe, Chrome riêng trong Dọn chi tiết | Rule cụ thể còn là đề xuất nghiên cứu; chưa mutation adapter/lifecycle |
| Đóng/mở app | Popup trước dọn; Quit bình thường; giữ Save/Cancel; mở lại app đã đóng | Chrome phải restore profile/tab thường; incognito/form ngoài yêu cầu; chưa runtime proof |
| Dictionary | Mọi dòng Dọn chi tiết có giải thích hậu quả; safe tick, risky/unknown bỏ tick; Select all | 68 entries là design, chưa nối DTO/engine/UI |
| AI history | Ảnh lịch sử input/generated mặc định không cần giữ; giữ bản tự lưu/nguồn project | Mapping ownership/DB chưa có; khoảng 6 tháng text là định hướng tentative, chưa retention policy executable |
| Phần còn lại của VXClean | Menu bar chi tiết, đóng cửa sổ ẩn Dock; ưu tiên Mac trước Windows | Desktop hiện `menu_bar_monitor=false`, chưa có tray/CloseRequested/activation policy tương ứng |

Nguồn hiện hành: [truth engine](spec/13_engine_behavior_truth.md), [scope app cleanup](spec/11_detailed_app_cleanup.md), [dictionary](spec/12_cleanup_dictionary.md), [overview bộ VX](../../_summary/master_overview.md), [work log](../../_summary/work_log.md).

## 2. Phần engine đã đối chiếu khớp

- Desktop đi qua React → Rust → Swift MaintenanceCLI. Scan dùng ScanEngine, nhưng cleanup **không dùng CleaningEngine SwiftUI gốc**. Không lấy audit của cleaner gốc áp nguyên xi cho desktop.
- Quick có 10 category có thể quét, không trả nhóm rỗng. Detail thêm `--include-empty`; hiện chưa có Chrome/Media category native riêng.
- Host có grant 15 phút, exact path/method, device/inode, giới hạn số mục và mutex mutation. Swift re-scan cleanup và kiểm tra identity/symlink trước mutation. Đây là các lớp kiểm soát có thật, nhưng không thay semantic policy.
- Broad uninstall mặc định bỏ chọn, không admin fallback cho discovered paths. Node CLI ngoài allowlist bị bỏ qua và báo `unsupported_cache_paths`.
- Lens đọc rộng hơn quyền Trash: root hệ thống bị chặn; ngoài Home chỉ đọc; Library/dotpath/Applications trong Home bị chặn Trash. Scanner hiện dùng CompactLensScanner, DTO con trực tiếp, không phải cây SpaceLensEngine cũ lọc node >10 MB.
- Desktop không tự chuyển sang mock khi native lỗi. Metrics có protocol/platform validation; maintenance chưa có validation typed tương đương.

## 3. Findings cần xử lý

### F01 — P1: policy mới ở Detail có thể bị Quick và thư mục cha vượt qua

[ScanEngine](../MClean/Services/ScanEngine.swift), dòng 171–207 và 524–600, nhận nguyên root User Cache và `.npm`. [MaintenanceCLI](../desktop/native/maintenance_cli.swift), dòng 336–408, re-scan rồi tin membership/path/method; chưa có bộ classifier/protected policy chung để từ chối updater, runtime hay child có dữ liệu cần giữ.

**Fixture đã chứng minh:** nguyên `.npm` được tick và dọn thành công; marker runtime dưới `_npx` cũng bị xóa. Cache root khác được tick; thêm một file ẩn mới sau scan, giữ nguyên inode của root; clean vẫn xóa cả file mới. Re-scan root không tạo phân loại mới cho mọi child.

Đây là bằng chứng về phạm vi xóa vượt nội dung đã phân loại, **không phải bằng chứng đã phá MCP hoặc xóa file OS critical trên máy thật**. Rủi ro runtime có căn cứ: npm có thể cài package dùng để thực thi vào cache và đưa executable vào PATH. [npm exec](https://docs.npmjs.com/cli/v11/commands/npm-exec/).

**Yêu cầu sửa:** scan grant không được tự là bằng chứng “disposable”; policy chung kiểm tra rule, scope, ownership, protected descendants và preconditions tại mutation. Grant child an toàn không cấp quyền xóa parent. Quick không được xóa parent bao phủ nhánh bị Detail bảo vệ. Có fixture cố tình cấp mục protected từ scanner sai nhưng backend vẫn từ chối.

### F02 — P2: Orphans thiếu identity từ host

[Rust bridge](../desktop/src_tauri/src/maintenance_bridge.rs), dòng 168–175, không gọi `bind_identities` và không gửi `identities`; [Swift](../desktop/native/maintenance_cli.swift), dòng 358–366, bắt buộc trường này.

**Đã tái hiện bằng payload có hình dạng đúng như host:** CLI exit 0, `success_count=0`, `failure_count=1`, lỗi “Thiếu định danh tệp từ host”; nguồn giữ nguyên. Control thêm đúng identity dọn được fixture. Đây là fail closed, không phải nguy cơ xóa vượt quyền.

Regression native cũ tự cấp identity nên vẫn pass, không phát hiện integration thiếu trường. Cần kiểm thử payload do host thực sự tạo, không chỉ gọi Swift với payload tự viết.

### F03 — P2: retry uninstall có thể thất bại sau khi bundle đã được gỡ

[UI Uninstaller](../desktop/src/components/uninstaller_view.tsx), dòng 180–192, giữ những mục `permission_denied` để retry admin. Nhưng [Swift](../desktop/native/maintenance_cli.swift), dòng 291–307, yêu cầu bundle vẫn có trong app inventory ở mỗi lượt.

Nếu lượt đầu Trash bundle thành công nhưng residual bị lỗi quyền, retry residual không còn thỏa guard bundle tồn tại. **Fixture mô phỏng bundle đã biến mất:** native trả exit 1, “Ứng dụng được bảo vệ hoặc không hợp lệ”; residual còn nguyên. Không gọi AppleEvent/admin trong thử nghiệm này; chưa tái hiện toàn UI + Trash thành công + permission failure.

Cần transaction/uninstall ticket giữ association đã xác thực cho các residual còn lại, scope hẹp và identity riêng; không sửa bằng cách bỏ guard toàn cục. Broad discovery vẫn không được admin fallback. Phải có test mixed success → retry residual sau khi bundle không còn.

### F04 — P1 trước bật cleanup mới: child scope, app lifecycle và failure recovery chưa đủ

[MaintenanceCLI](../desktop/native/maintenance_cli.swift), dòng 384–389, chỉ guard Xcode cho một số path; chưa guard Chrome/CapCut/Adobe/AI/npm/Docker tương ứng. File đang mở không tự được chứng minh là backend sẽ bỏ qua. System cache/root allowlist chưa chứng minh mọi file bên trong được phép dọn.

[Rust execute](../desktop/src_tauri/src/maintenance_bridge.rs), dòng 80–117, kill child sau 120 giây, trả lỗi thay cho final report. Clean không đăng ký cancellation như scan. Không có durable mutation journal nên có thể đã xóa một phần mà user chỉ nhận timeout. Quit/crash của host và việc thu hồi child lúc thoát app chưa có lifecycle handler trong [lib.rs](../desktop/src_tauri/src/lib.rs); đây là nhận định source, chưa thử kill/crash runtime trong lượt này.

V1 không cần hứa Undo cho xóa trực tiếp. Nhưng phải biết item nào đã xử lý, app nào đã đóng và phải mở lại, và không biến timeout thành “chưa dọn gì”. Tạm dừng/cancel giữa các item, bảo vệ child process khi host thoát, lưu trạng thái tối thiểu và xử lý re-open sau crash.

### F05 — P2: defaults/copy không khớp safety mục tiêu

- Xcode Archives source vẫn tick true; native dùng Trash. Detail xác nhận hậu quả Archives chỉ khi category là `xcode_archives`, nhưng native phát `xcode_junk`, nên nhánh giải thích riêng không chạy. Xem [CleanupView](../desktop/src/components/cleanup_view.tsx), dòng 197–205.
- Known Application Support/Containers trong uninstall được helper chọn sẵn khi không có cờ false, dù có thể chứa dữ liệu cá nhân. Broad discovered thì bỏ chọn đúng. Xem [selection helper](../desktop/src/services/uninstall_selection.ts). Chọn “known association” không tự có nghĩa “cache an toàn”.
- Orphans là heuristic absence khỏi app inventory, không phải chứng minh app đã gỡ. Không phát hiện app ngoài root, CLI hoặc mọi cách đặt tên dữ liệu. Dòng giới thiệu “các ứng dụng đã từng xóa” mạnh hơn bằng chứng thực tế.

Không tự đổi defaults Quick trong audit. Khi triển khai dictionary phải tách default cho từng operation, không dùng safety của cache áp cho uninstall root chứa project.

### F06 — P2: dung lượng hiển thị chưa là dung lượng chắc chắn thu hồi

Cleanup scanner dùng logical size; directory traversal bỏ file ẩn và dừng sau 10.000 entries nhưng không báo truncation riêng. Mutation `size()` lại đếm subtree rộng hơn. App inventory dùng allocated size; Lens dùng `st_blocks` và dedup inode. Không được gọi cả ba là cùng phép đo.

Scan tổng có thể cộng trùng `.npm/_cacache` và `.npm`. UI Quick gộp selected parent/child cùng method, native cũng gộp trước mutation; điều đó không sửa tổng tìm thấy của mọi category. Docker reclaimable informational vẫn có thể được cộng vào tổng scan dù không cleanable.

Xóa file không chứng minh dung lượng đĩa vật lý tăng đúng bằng bytes báo cáo. Cần tách logical/allocated/estimated removable/trashed và actual free-space delta nếu đo, kèm partial/truncated. “Trash bytes” không phải “freed bytes”. Sources: [scanner](../MClean/Services/ScanEngine.swift), dòng 898–933; [size calculator](../MClean/Logic/Utilities/FileSize.swift); [native size/mutation](../desktop/native/maintenance_cli.swift); [Lens](../desktop/native/compact_lens_scanner.swift).

### F07 — P2: docs không còn là một contract thực thi thống nhất

Banner ưu tiên spec 13 có ích, nhưng bên dưới vẫn ghi:

| Tài liệu | Mô tả cũ còn tồn tại | Source hiện tại |
|---|---|---|
| spec 01, 02, 03 | Archives mặc định bỏ chọn; spec 01 removeItem | Source tick true, native Trash |
| spec 04 API | `execute_clean`, `trash_space_lens_items`, `copy_to_clipboard`; cancel thiếu operation ID | `clean_items`, `trash_lens_item`; clipboard qua JS, cancel theo operation ID |
| spec 04 CLI | Metrics 5s; scan 45s; clean 60s; có scan `--categories` | Metrics 6s; maintenance 120s; Swift chỉ chấp nhận scan all/include-empty |
| spec 00/README | Cleanup kế thừa CleaningEngine/Locations; background Dock/Menu Bar như đã có | Desktop dùng MaintenanceCLI; menu capability false, chưa lifecycle handler |
| spec 05/06 | Demo Safari khóa nhưng vẫn nhìn thấy; chặn mọi file đang dùng; full Menu Bar demo | Apps Apple bị loại; chưa file-in-use guard chung; Menu Bar chưa nối |
| docs index | Maintenance Tauri chưa runtime kiểm chứng | Có lịch sử runtime và native fixture; phải ghi từng luồng, artifact, giới hạn mới |
| spec 13 bytes | Cụm “khác scanner allocated hoặc lens” dễ hiểu scanner cleanup dùng allocated | Scanner cleanup là logical; inventory apps/Lens dùng allocated theo cách khác nhau |

Spec 11–12 mô tả target khá rõ và không tự nhận đã triển khai. Tuy vậy dictionary có **68 ID duy nhất, 68 design_only, 46 entries thiếu matching_scope, 17 entries để default_selected=true ở mức thiết kế**. Không phải lỗi JSON; đây là bằng chứng chưa có contract executable để bật defaults trực tiếp. `default_selected` từ file design không được chảy thẳng vào UI.

Cần cập nhật nội dung hiện hành của API/defaults/method, chuyển bản cũ thành lịch sử, và thống nhất link/thứ tự đọc. Không giao agent “đọc toàn docs rồi tự chọn cái đúng”.

## 4. Scope v1 khuyến nghị chốt

Đây là đề xuất để quyết định/triển khai, không tự cấp quyền dọn dữ liệu thật.

| Nhánh | Nhận vào v1 | Giữ/không cho mutation trong v1 |
|---|---|---|
| CapCut | Exact CEF HTTP/code/graphics cache đã nhận diện dưới User Data; rule và fixture từng nhánh | Parent CEF/Cache là profile; Projects, effect/music, resource DB/WAL, SmartCrop và asset chưa rõ |
| Adobe | `.cfa` trong exact Common/Media Cache Files; `.pek` trong exact Common/Peak Files | DB, `.ims/.prmdc2` chưa rõ, CCX/template/preset/sync; không tìm extension toàn Home |
| Chrome | HTTP/code/graphics cache của từng profile đã nhận diện | Cookies, credentials, Sessions, IndexedDB, Service Worker/offline data, extensions/model/updater |
| AI apps | Hoàn thiện dictionary cho baseline; frontend cache exact của Codex/Anti/ChatGPT chỉ kích hoạt sau mapping + validation riêng | Runtime/MCP/plugin, DB/WAL, worktree, history/ảnh chưa có ownership contract; chưa auto bật ba adapter từ tên category AI cũ |
| Logs | Trong v1 chỉ mô tả/hiển thị rule hậu quả | Auto cleanup theo tuổi chờ chốt cutoff/phiên gần nhất/lifecycle; 7 ngày là đề xuất, chưa quyết định user |
| Uninstall | Bundle/known association và broad discovery bỏ chọn; Movies/CapCut có thể chọn toàn root với cảnh báo mất project | Không tái dùng grant cleanup; không suy tên match thành ownership chắc chắn; không mở admin cho discovery |
| Unknown/user data | Hiển thị giải thích và bỏ tick; opt-in chỉ cho rule mutation đã hỗ trợ, đúng operation | Unknown không có adapter → disabled deletion dù user Select all; project root CapCut không mở thành cache cleanup v1 |
| Figma/system/model/updater mới | Không tự mở thêm nhánh từ research | Figma chưa được user đưa vào nhóm Media; không mở scope system hoặc updater chỉ vì nhiều GB |

“An toàn” phải tách hai việc: có thể tái tạo theo rule đã kiểm chứng, và **đã thỏa điều kiện để xóa ngay**. Row cần Quit app có thể selectable để đi vào flow Đóng và dọn; không được cấp mutation khi helper còn dùng cache. Spec cần thống nhất liệu safe default tick áp trước hay sau Quit, tránh condition “chỉ tick khi đã đóng” khiến flow tự đóng khó dùng.

Source Chromium có cơ chế restore last session và xử lý last opened profiles; đó là cơ sở chọn hướng thử, không là bằng chứng app VXClean khôi phục đủ mọi cửa sổ/profile. Cần test Chrome binary Mac thật với ít nhất hai profile, startup khác Continue where left off, pinned/grouped tabs và nền/helper. [Chromium startup](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/browser/ui/startup/startup_browser_creator.cc). Nếu spike thất bại, giữ nhánh này chỉ đọc hoặc dùng Quit thủ công có báo giới hạn; không âm thầm hạ cam kết restore.

## 5. Lựa chọn và kế hoạch triển khai

| Phương án | Đánh đổi | Đánh giá |
|---|---|---|
| Nối toàn bộ 68 rule và popup ngay | Nhiều UI nhanh; matchers/lifecycle/ownership chưa đủ, dễ hợp thức hóa broad root cũ | Không khuyến nghị |
| Sửa nền bảo vệ, dictionary toàn Detail, mở rule v1 hẹp theo từng app | Ít GB hơn, thêm negative tests; có phạm vi rõ để nghiệm thu | Khuyến nghị |
| Chỉ đọc/giải thích, dọn bằng công cụ app gốc tạm thời | Chưa đạt trải nghiệm VXClean trọn vẹn; giữ giá trị phân tích và giảm scope mutation | Fallback cho rule/restore chưa vượt gate |

Thứ tự làm:

1. **Contract và plumbing:** thống nhất API/docs hiện hành; sửa Orphans; transaction retry uninstall; fixtures đi qua producer host và native consumer. Chốt ý nghĩa giữ Quick và protected policy dùng chung.
2. **Nền mutation:** semantic rule policy độc lập, exact target/parent-child partition, identity/preconditions recheck, báo partial/truncated, tối thiểu durable operation/app re-open state. Không mở rộng quyền admin để che lỗi nhận diện.
3. **Dictionary toàn Detail:** DTO `operation_scope/rule_id/dictionary_version/effective_safety/blocked_reason`; hậu quả từng dòng; Select all đúng danh sách đang xem và không vượt backend. Unknown hiển thị nhưng không mutation. Rule/version thay đổi làm stale grant cần scan lại.
4. **Spike lifecycle/Chrome:** Quit/Save/Cancel/helper/re-open, hai profile Chrome và crash/launch failure. Làm sớm trước khi hứa restore đầy đủ. Adobe test shared cache/queue, source media missing; CapCut preview/export online và offline trên project fixture.
5. **Adapter v1:** nhận từng rule exact đã vượt checks. Không bật default safe dựa vào design_only; layout/version không khớp phải degrade thành unknown/blocked. AI history/ảnh, logs retention, Figma và Windows để phase riêng sau.
6. **Toàn VXClean trước ship Mac:** menu bar/Dock, Cmd+Q/child ownership, sleep/wake; build đúng artifact source; FDA/admin paths trên fixture có quyền hợp lệ; Intel/OS matrix theo target thực muốn hỗ trợ; updater/release là task riêng.

Gate trước coi một nhánh dọn được nghiệm thu: unknown/protected injection bị từ chối; nội dung cần giữ không đổi; dữ liệu safe được dọn đúng; Save/Cancel không mutation; app/helper restart không phá task/project/session; partial/timeout/crash không success giả; UI defaults/consequences và actual packaged binary đều đã test. Không yêu cầu “không bao giờ lỗi”, nhưng phải có coverage, giới hạn và bằng chứng cụ thể.

## 6. Bằng chứng kiểm chứng trong lượt này

Máy kiểm tra: macOS 26.7 arm64. HEAD `59b2aee83fa41783afe3a921f63025b3c1f6816d`; source cần review gồm nhiều thay đổi tracked/untracked, nên hash HEAD không đại diện toàn bộ source đang chạy checks. [Evidence JSON](engine_scope_audit_evidence.json) lưu hash file source và kết quả probe.

| Check | Kết quả | Điều không chứng minh |
|---|---|---|
| `scripts/test_native_maintenance.py` | 11 nhóm regression đạt | Trash fixture bị sandbox từ chối, kiểm chứng failure/giữ nguồn; không phải Trash thành công hoặc safety tổng thể |
| `cargo test --offline --lib` | 6 tests đạt | Không có integration test clean_orphans producer payload hay retry sau bundle mất |
| `test_scan_retention.cjs` | 10 nhóm đạt | Không là host grant invalidation/runtime memory profile |
| `test_uninstall_selection.cjs` | 5 cases đạt | Không là ownership/data safety của known residual |
| `test_circle_packing.cjs` | 18 cases đạt | Chỉ geometry, không safety engine |
| `tsc --noEmit` trong desktop | Đạt | Không thay GUI/runtime/platform QA |
| Probe bổ sung | Tái hiện F01/F02/F03 trong synthetic home; Orphans control có identity dọn được | Không xóa user data, không Quit app thật, không admin hoặc Chrome/Adobe/CapCut runtime |

Probe chỉ dùng home giả dưới thư mục tạm, compile với `ENGINE_TESTING`; tất cả marker mới tạo. Lỗi lần chạy probe đầu do alias `/var`/`/private/var` trong so sánh đường dẫn của harness đã được sửa bằng canonical path; không phải fix source production. Lượt probe sau đạt đầy đủ các assertion về hành vi nêu trên. Type-check ban đầu gọi nhầm đường dẫn tool; đã chạy lại đúng cwd desktop và đạt.

Cargo tests có chạy build script biên dịch engine local. Binary local và resource trong debug `.app` có SHA-256 khác nhau tại lúc đối chiếu; chưa chứng minh bundle chứa đúng implementation đang audit. Hash khác chỉ chứng minh byte khác, không tự xác định nguyên nhân/source version. Không thay app đang cài, chưa rebuild/retest GUI bundle, không commit/push/release.

Đây là audit và scope đề xuất. Engine/UI/spec hiện hành chưa được sửa theo findings trong lượt này; chỉ thêm báo cáo/evidence. Muốn triển khai tiếp có thể giao giai đoạn 1–2 trước, rồi nghiệm thu và mở từng adapter.
