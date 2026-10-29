# Scope dọn Library: Chrome, Figma, Adobe và bộ cập nhật

Ngày nghiên cứu: 2026-10-10. Trạng thái: đề xuất để user chốt; chưa triển khai hoặc xóa dữ liệu thật. **User đã chốt giữ nguyên scan mặc định; mục 7 cập nhật và ưu tiên hơn các đề xuất thay defaults cũ trong mục 6.**

## Phương pháp và giới hạn

Đọc metadata filesystem trên máy hiện tại, cộng allocated bytes (`st_blocks × 512`), bỏ qua symlink; MB/GB thập phân. Số liệu thay đổi khi app hoạt động, không phải dung lượng chắc chắn thu hồi trên APFS có clone/compression. Không đọc nội dung history, mật khẩu, tài liệu website hoặc project. Chưa thử dọn rồi mở lại app, chưa xác minh updater/app đã dừng. Phân loại dưới đây phân biệt quan sát với suy luận; tên Cache riêng lẻ không đủ chứng minh disposable.

Xem thêm [nghiên cứu CapCut và AI](capcut_ai_cache_research.md).

## 1. Library/Caches — 4 nhóm lớn

| Đường dẫn dưới ~/Library/Caches | Quan sát | Đề xuất |
| :--- | :--- | :--- |
| Google/Chrome | 834,59 MB; Profile 1 534,81 MB, Default 289,95 MB, Profile 4 9,84 MB | Tách từng profile, chỉ Cache/Code Cache; không chọn toàn Google |
| Adobe/CCX Welcome | 426,36 MB; learn 191,38 MB, discover_panel 111,39 MB, stock 83,43 MB, data 35,87 MB | Có vẻ nội dung màn Home/Learn/Stock tải về; ưu tiên assets đã xác minh, chưa mặc định cả root vì settings/data |
| com.google.antigravity | 366,25 MB; pending app khoảng 181,63 MB + update.zip 184,61 MB | Bộ cập nhật, không mặc định dọn |
| com.google.antigravity.ShipIt | 482,79 MB; update.* khoảng 482,78 MB | App staging cho cập nhật, không mặc định dọn |

Hai profile Chrome lớn chứa Cache 706,17 MB và Code Cache 115,41 MB, cộng 821,58 MB. Phần Storage của Profile 1 khoảng 3,17 MB chưa đưa vào scope. Profile 4 cần phân loại riêng trước khi cộng vào tổng eligible.

User ghi nhận cache Codex gần 2 GB biến mất sau update; lần đọc hiện tại không còn nhóm updater lớn đó, còn Caches/Codex khoảng 1,90 MB. Đây là bằng chứng lifecycle tự thu hồi trên máy này, không chứng minh mọi cache updater khác đang thừa. Tránh dọn app staged hoặc zip đang chờ cài. Nếu muốn thêm cleanup updater cũ, phải kiểm tra trạng thái cập nhật và version; tuổi file đơn thuần không đủ.

Các cache Apple còn lại lớn nhất: GeoServices 56,27 MB, helpd 35,47 MB, parsecd 17,17 MB. Đề xuất để OS quản lý trong scope đầu tiên: giá trị thu hồi nhỏ, chưa có kiểm chứng tái tạo theo phiên bản OS.

## 2. Google trong Application Support — 11,63 GB

Google không đồng nghĩa với Chrome: Chrome 10,35 GB, GoogleUpdater 815,12 MB, DriveFS 461,15 MB.

### Chrome 10,35 GB

| Nhánh | Dung lượng | Bản chất và quyết định |
| :--- | ---: | :--- |
| OptGuideOnDeviceModel | 4,27 GB | Model AI cục bộ; không phải history hoặc cache web. Không chọn mặc định; cân nhắc tính năng riêng quản lý model |
| Default | 3,36 GB | Profile chứa nhiều loại dữ liệu, giữ root |
| Profile 1 | 1,32 GB | Giữ root |
| Profile 2 / 7 / 4 / 5 | 437,70 / 313,49 / 57,13 / 8,57 MB | Giữ root, không coi profile ít dùng là orphan |
| component_crx_cache | 171,69 MB | Gói component tải về; cần lifecycle updater, chưa dọn mặc định |
| screen_ai | 133,97 MB | Component AI; chưa dọn mặc định |
| OptGuideOnDeviceClassifierModel | 126,03 MB | Model classifier; chưa dọn mặc định |
| optimization_guide_model_store | 58,31 MB | Model store; chưa dọn mặc định |
| WasmTtsEngine / Safe Browsing / CertificateRevocation | 23,38 / 19,82 / 5,41 MB | Runtime, dữ liệu bảo vệ và chứng chỉ; giữ |
| GraphiteDawnCache / GrShaderCache | 13,40 / 3,42 MB | Cache đồ họa; ứng viên sau kiểm chứng app đóng |

Chrome chính thức hỗ trợ model AI tải xuống và tự quản lý khi thiếu tài nguyên. Bản local nằm dưới OptGuideOnDeviceModel/2025.8.8.1141. Chưa xác minh tính năng nào trên máy đang sử dụng model này; không gọi nó là junk chỉ vì lớn. Xóa thủ công cũng chưa chứng minh ngăn tải lại. [Google: built-in AI](https://developer.chrome.com/docs/ai/get-started).

### Dữ liệu website là phần lớn thứ hai

| Nhóm | Quan sát | Scope |
| :--- | :--- | :--- |
| Service Worker | Khoảng 3,28 GB trên các profile; CacheStorage khoảng 3,21 GB | Website có thể lưu tài nguyên offline; không tự động xóa cả nhóm |
| IndexedDB | Default 589,41 MB, Profile 1 95,44 MB, Profile 2 38,68 MB | Database của website; có thể chứa dữ liệu chưa đồng bộ, giữ |
| File System | Default 488,64 MB, Profile 1 109,76 MB, Profile 2 6,88 MB | Storage do web app sử dụng; giữ |
| Extensions | Default 233,50 MB, Profile 7 244,76 MB | Mã extension, giữ |
| Cookies, Local Storage, Sessions, History, Bookmarks, Login Data, extension settings | Có trong profiles | Đăng nhập, tab, lịch sử, cấu hình và trạng thái; giữ |
| GPUCache, DawnWebGPUCache, DawnGraphiteCache | Có trong nhiều profiles | Ứng viên cache đồ họa riêng; không xóa parent profile |

Service Worker Default: CacheStorage 1.765,47 MB, ScriptCache 52,96 MB, Database 0,25 MB. Profile 1 tương ứng 995,52 / 14,71 / 0,43 MB. Profile 2 366,08 / 1,00 / 0,03 MB. Profile 7 50,66 / 1,78 / 0,06 MB; Profile 4 30,02 / 0,97 / 0,06 MB. Dù tên CacheStorage, đây là storage do website quản lý, cần màn xem theo website và người dùng chủ động chọn nếu triển khai sau; scope đầu tiên bỏ qua.

Google phân biệt cached images/files với cookies/site data, bao gồm IndexedDB và web storage. Vì vậy đề xuất chỉ dọn HTTP/code/GPU cache; không gộp database và offline storage vào một nút cache chung. [Google: loại dữ liệu duyệt web](https://support.google.com/chrome/answer/2392709/clear-browsing-data-computer?hl=en-GB).

### GoogleUpdater và DriveFS

GoogleUpdater: crx_cache 784,46 MB, runtime version 27,19 MB, còn lại log/config. Giữ runtime và package pending; log đã rotate là ứng viên, không suy luận toàn crx_cache đã cài xong.

DriveFS: Resources 183,43 MB là JS/SVG runtime; Logs 166,50 MB; account store 110,15 MB chứa database và WAL; content_cache hiện chỉ khoảng 0,05 MB. Scope chỉ log cũ sau kiểm chứng, giữ Resources/account DB/content cache/lost_and_found. Google xác nhận lost_and_found có thể chứa file chưa upload được, nên đây là dữ liệu cần cứu chứ không phải junk. [Google Drive troubleshooting](https://support.google.com/drive/answer/2565956?co=GENIE.Platform%3DDesktop&hl=en).

## 3. Figma — 1,60 GB

DesktopProfile 1.589,08 MB, v43 1.576,35 MB. Trong v43:

| Nhánh | MB | Quyết định |
| :--- | ---: | :--- |
| Cache | 785,74 | Ưu tiên scope cache sau đóng app |
| Code Cache | 763,47 | Ưu tiên scope cache sau đóng app |
| GPUCache + DawnWebGPUCache + DawnGraphiteCache | 17,07 | Ứng viên cache đồ họa |
| blob_storage | 8,60 | Chưa đủ bằng chứng, giữ |
| Cookies / Local Storage / IndexedDB / Session Storage | Nhỏ | Giữ đăng nhập và trạng thái |
| FigmaAgent.app / Figma Desktop.app | 12,26 / 1,97 | Runtime, giữ |
| settings.json, desktop_state.json, font_cache.json | Nhỏ | Giữ trong cleanup thông thường |

Cache + Code Cache riêng v43 đạt 1.549,21 MB. Không mặc định xóa v41/v42 chỉ vì version cũ: chưa chứng minh hết tham chiếu.

Figma có thao tác Reset Figma and Restart và hướng dẫn reset cả Application Support/Figma khi troubleshooting. Đây là reset ứng dụng, không phải cơ sở để cleaner xóa cả root thường xuyên. Chọn các cache branch cụ thể để tránh đụng settings/runtime và phiên làm việc. [Figma hướng dẫn chính thức](https://help.figma.com/hc/en-us/articles/22380853110551-Clear-the-Figma-desktop-app-cache).

## 4. Adobe — phân biệt media cache với tài nguyên project

Application Support/Adobe 604,02 MB:

| Nhánh dưới Adobe | MB | Quyết định |
| :--- | ---: | :--- |
| Common/Media Cache Files | 316,29 | Có .cfa và cache khác; ưu tiên cleanup media cache khi project/app đóng |
| Common/Media Cache | 0,22 | Cần xử lý cùng lifecycle cache media |
| Common/Peak Files | 3,78 | Ứng viên, cần kiểm chứng riêng |
| Common/Motion Graphics Templates | 225,03 | Template .mogrt phục vụ chỉnh video; giữ |
| OOBE | 43,50 | Cấu hình/account/onboarding; giữ |
| CameraRaw, UXP, CoreSync, Libraries, app preferences | Phần còn lại | Giữ nếu chưa có rule riêng |

Adobe xác nhận media cache tái tạo khi source media cần dùng; dọn tất cả yêu cầu đóng project và lần sau sẽ phải tạo lại. Không nhầm .cfa là âm thanh gốc; nhưng vẫn cần kiểm chứng mở project/export với source còn tồn tại. [Adobe: media cache](https://helpx.adobe.com/premiere/desktop/troubleshooting/media-issues/clear-media-cache-using-preferences.html).

Caches/Adobe/CCX Welcome: hai nhánh learn/assets 186,45 MB và discover_panel/assets 110,95 MB từng được coi là ứng viên tổng 297,40 MB; **khảo sát sâu phát hiện template .psdt trong hai nhóm, nên không nhận cả assets** (mục 7); nguồn và hình thái filesystem gợi ý nội dung màn Home, chưa có chứng nhận cleanup chính thức đủ chi tiết để bật mặc định. Stock/data cũng chưa chọn mặc định, tránh đánh đồng asset với cache vô giá trị.

Application Support/com.adobe.dunamis 381,08 MB: nhiều thư mục UUID, 78 file không extension chiếm 380,95 MB. Chưa có bằng chứng chính thức/local đủ để phân loại disposable; không khẳng định telemetry rồi xóa. Giữ ngoài scope đầu tiên, nghiên cứu riêng nếu tăng bất thường.

## 5. Hai nhóm còn lại trong hình

- com.apple.wallpaper 799,71 MB: aerials/videos có 2 video .mov tổng 787,30 MB; thumbnail 8,26 MB, manifest khoảng 4,13 MB. Đây là tài nguyên wallpaper/screensaver, không phải project người dùng hay cache trình duyệt. Để OS quản lý, chưa đưa vào cleanup mặc định vì cần biết video đang chọn và cơ chế tải lại.
- Nhóm co…namis trên ảnh là com.adobe.dunamis đã nêu trên; nhóm com…aper là com.apple.wallpaper. Không suy đoán từ nhãn rút gọn: tên đã xác minh trên filesystem.

## 6. Đề xuất scope để chốt

### Ưu tiên triển khai và nghiệm thu

1. Chrome: từng profile chỉ Cache/Code Cache đã nhận diện, GPU/shader cache có rule riêng. Giữ toàn bộ site data và profile state.
2. Figma: DesktopProfile/v*/Cache, Code Cache và GPU/shader cache. Không reset root, không xóa runtime/settings.
3. Adobe: media cache trong Common với app/project đã đóng; ưu tiên API/thao tác lifecycle của app nếu có. Không templates/presets/plugins/cloud state.
4. Log cũ của app đã xác định, file đang ghi bỏ qua; retention log độc lập với retention chat.
5. Codex/Anti/ChatGPT tiếp tục policy ở báo cáo AI: chat text khoảng 6 tháng tentative; ảnh history input và generated disposable theo ý user, giữ bản tự save/source project; cần mapping image-owned trước triển khai.

Riêng Chrome Cache/Code Cache của 2 profile lớn + Figma v43 Cache/Code Cache + Adobe Media Cache Files khoảng **2,69 GB ứng viên**. Chưa trừ file mới/đang dùng, chưa bao gồm GPU/log/Adobe CCX; đây không phải cam kết thu hồi hoặc kết quả safety test.

### Ngoài cleanup mặc định

AI model Chrome, website offline storage, updater staging, wallpaper, dunamis chưa rõ, code MCP/npx/uv runtime, dữ liệu sync hoặc project. Có thể hiển thị dung lượng với giải thích; không mặc định chọn. Quét để xem dung lượng không đồng nghĩa được gom vào cleanup.

### Thay đổi cần làm so với engine hiện tại

ScanEngine.scanUserCache hiện enumerate trực tiếp mọi child của ~/Library/Caches, trừ vài root do category khác sở hữu. Nó có thể gom cả updater Anti vào một item cache. Đây là khuyến nghị audit cũ, chưa được phê duyệt; user sau đó yêu cầu giữ nguyên scan mặc định. Các rule app/nhánh + lifecycle mới chỉ đề xuất cho Dọn rác chi tiết; không thay defaults trong lượt này. Không chỉ thêm các đường dẫn Application Support rồi giữ cách quét rộng cũ.

Safety phải enforce lần nữa lúc xóa: canonical path/identity, không symlink, tránh parent bao trùm mục được bảo vệ, kiểm tra app/updater còn chạy, không đổi scope chỉ vì UI gửi path. Nếu không xác minh được app đã đóng thì skip, báo lý do. Không cần admin cho phạm vi user Library này; permission không đủ thì báo partial, không tự nâng quyền để dọn system.

### Nghiệm thu trước bật mặc định

Fixture âm tính chứa Cookies/History/IndexedDB/project/template/runtime: scan không chọn, cleanup không xóa dù gửi path parent. Kiểm tra app đang mở và updater pending phải skip. Thử từng app trên dữ liệu mẫu: khởi động lại, đăng nhập/tab/extension/project còn nguyên, media export đạt, cache tái tạo; offline website không bị mất. Chưa thực hiện các kiểm chứng này trong lượt nghiên cứu.

## 7. Kết luận khảo sát sâu và scope đề xuất mới

Định hướng user: **giữ nguyên scan mặc định**, Media Apps (CapCut/Adobe) và Chrome là nhóm của Dọn rác chi tiết. [Spec đóng/mở lại app](spec/11_detailed_app_cleanup.md). “Nhận scope” dưới đây chỉ là khuyến nghị để user chốt và làm tests; chưa ship hoặc dọn thật.

### 7.1 Chrome — nhận cache tái tạo, không nhận dữ liệu website/model

| Nhánh | Kết luận cụ thể | Bằng chứng/giới hạn |
|---|---|---|
| ~/Library/Caches/Google/Chrome/{Default,Profile N}/Cache | Nhận HTTP cache | Cấu trúc Cache_Data; đúng category cache trình duyệt, giữ profile root |
| Cùng profile /Code Cache | Nhận generated code cache | Không gồm Storage hoặc site DB |
| Application Support/Google/Chrome/{Default,Profile N}/GPUCache, DawnWebGPUCache, DawnGraphiteCache | Nhận cache graphics | Cần đóng Chrome/helper, không xóa parent |
| Chrome/GraphiteDawnCache, GrShaderCache | Nhận cache graphics ở root | Không mở rộng sang mọi component có chữ Cache |
| Service Worker/CacheStorage, ScriptCache, Database | Loại cả nhóm khỏi scope đầu | Browser API tách cache và cacheStorage; site data có thể phục vụ offline |
| IndexedDB, File System, Local/Session Storage, WebStorage, blob_storage, Shared Dictionary | Bảo vệ | Không coi DB/blob là file tạm chỉ từ tên |
| Cookies/History/Bookmarks/Login Data/Sessions/Sessions_Encrypted/Preferences/Local State/extension state | Bảo vệ | Đây là điều kiện giữ đăng nhập và khôi phục profile/tab |
| Extensions, Web Applications, TTS, Widevine, safety/certificate components | Bảo vệ | Code/runtime/tính năng, không phải cache tài nguyên web |
| OptGuideOnDeviceModel + classifier/model store/screen_ai | Ngoài scope đầu | Model/tính năng cục bộ, lợi ích 4,27 GB nhưng không cam kết không tải lại hoặc không mất tính năng |
| component_crx_cache, GoogleUpdater/crx_cache | Ngoài scope đầu | Artifact updater không có bằng chứng đã cài xong; không dọn theo tuổi đơn thuần |

Profile 4 đã đọc sâu: Cache 8,97 MB, Code Cache 0,87 MB, tổng 9,84 MB. Cộng ba profile HTTP/code đã đo khoảng **831,42 MB**, chưa cộng GPU hoặc mức thay đổi app đang chạy.

Google có API riêng cho cache và site storage; hỗ trợ origin filtering nhưng cần Chrome extension. Không phát sinh extension/browsing permission mới chỉ để tăng scope trong bản đầu; native cleaner chỉ exact cache paths khi đóng app. Không gọi API Electron để inject vào Chrome/CapCut/Figma bên ngoài. [Chrome browsingData](https://developer.chrome.com/docs/extensions/reference/api/browsingData).

### 7.2 Adobe — media cache có căn cứ, CCX assets không nhận cả nhóm

Quan sát file thực trong `Adobe/Common/Media Cache Files`: 18 .cfa chiếm 310,12 MB; 35 .prmdc2 5,39 MB; 191 .ims 0,78 MB. `Common/Peak Files` có 54 .pek chiếm 3,78 MB.

- Đề xuất nhận **.cfa ở exact Media Cache Files và .pek ở exact Peak Files**: khoảng **313,90 MB**. Không tìm các extension này toàn Home hoặc xóa ở project/scratch disk tùy chỉnh.
- .prmdc2/.ims còn ~6,17 MB: dù nằm trong root media cache, chưa xác định semantics đủ rõ bằng nguồn đang đọc; **bỏ khỏi scope đầu** để tránh biến allowlist directory thành wildcard file vô điều kiện.
- Media Cache database ~0,22 MB: scope đầu giữ DB; hãng quản lý reference lifecycle. Không xóa DB/WAL riêng để “dọn triệt để”.
- Motion Graphics Templates .mogrt 225 MB, LUT/presets/plugins/OOBE/CoreSync/Libraries: giữ.

Adobe xác nhận .cfa là bản audio conform, .pek phục vụ waveform, và media cache tái tạo khi cần source. Cache database dùng chung Premiere/After Effects/Media Encoder; phải kiểm tra các app/queue cùng dùng vùng, không chỉ Quit Premiere. Nguồn gốc media phải còn truy cập được để tái tạo; không quảng bá dọn cache là giúp cứu nguồn audio đã mất. [Adobe conform/waveform](https://helpx.adobe.com/th_en/premiere/desktop/organize-media/import-files/audio-conforming-specifications.html), [shared cache](https://helpx.adobe.com/media-encoder/desktop/encoding-and-exporting/media-cache-database.html), [dọn thủ công](https://helpx.adobe.com/ca/premiere/desktop/troubleshooting/media-issues/delete-media-cache-files-manually.html).

**CCX Welcome khảo sát sâu:** 12 .psdt chiếm 84,20 MB, 33 .mp4 59,77 MB, jpeg 240,08 MB, png 13,27 MB, metadata JSON 28,99 MB. Learn có 6 template .psdt 51,88 MB; Discover có 2 template 11,82 MB; Data có 4 template 20,49 MB. Metadata có các key assetMetadata/_assetPaths/LEARN/DISCOVER_PANEL/STOCK nhưng chưa chứng minh mọi asset chỉ là thumbnail.

Do có template/project starter và media tải về, **loại nguyên CCX Welcome và nguyên assets khỏi scope đầu**. Không xóa ảnh/jpeg/mp4 theo extension: tutorial/stock cũng có thể dùng offline. Muốn mở rộng phải nối manifest → asset role, so với tài liệu hãng và fixture tutorial/template; lợi ích chưa đủ để áp dụng heuristic rộng. Hướng này cụ thể hơn nhãn “297 MB ứng viên” trước đó.

`com.adobe.dunamis`: 78 file không extension 380,95 MB, 8 XML nhỏ và file phụ. Kiểm tra header không nhận diện SQLite/ZIP/GZIP; chưa đọc payload cá nhân hoặc kết luận đây là telemetry disposable. **Loại khỏi scope đầu**. Unknown app data không mặc định thành junk.

### 7.3 Figma, logs và các ứng viên phụ

- Figma v43 Cache/Code Cache 1.549,21 MB và graphics 17,07 MB: đề xuất nhận exact branch nếu sau này user đưa Figma vào scope; giữ blob_storage, IndexedDB, Cookies, state/settings/runtime. Tài liệu hãng reset app là thao tác troubleshooting, không tự chọn reset root. v41/v42 chưa chứng minh orphan; không xóa version folder. **Figma chưa được tự thêm vào Media Apps**.
- Google Drive Logs 166,5 MB và updater logs nhỏ: chỉ đề xuất log đã rotate/đủ tuổi, giữ log active/gần nhất; đề xuất 7 ngày nhưng chưa user chốt. Không dọn content_cache/account DB/resources/lost_and_found hoặc dùng disconnect account như cleanup.
- GeoServices/helpd/parsecd/wallpaper: ngoài scope chi tiết mới; không tự thay category mặc định hoặc nâng quyền system theo nghiên cứu.
- Updater staging: ngoài scope đầu; việc Codex update tự làm mất staging lớn là lý do ưu tiên lifecycle của app.

### 7.4 Đóng Chrome và khôi phục tab/profile thường

User đã loại tab ẩn danh và form chưa gửi khỏi yêu cầu phục hồi. Còn lại cần khôi phục **các profile thường + các tab đang mở**, giữ cookies/bookmarks/extensions và session files.

Source Chromium có `--restore-last-session`, xử lý last opened profiles và tách Guest/Incognito. Đây là hướng triển khai hợp lý nhưng source main không thay kiểm thử Chrome binary macOS đang cài. AppleScript dictionary local có windows/tab/mode/URL/active tab, **không có property profile rõ ràng**; snapshot URL không đủ làm phục hồi đúng profile.

Ưu tiên Quit app bình thường để Chrome lưu phiên, giữ session/Local State, launch đúng bundle với cơ chế restore; không đóng từng window/tab trước vì có thể làm thay đổi session ghi lại, không chỉnh startup prefs. Nếu dùng browser-native Restart phải điều phối để Chrome chưa mở lại trước khi cleanup kết thúc; chưa triển khai giải pháp đó. [Chromium startup source](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/browser/ui/startup/startup_browser_creator.cc).

Không yêu cầu tắt app cho scan read-only; popup đóng ở bước chuẩn bị dọn, re-scan sau Quit rồi mở lại sau cleanup. Media app có save dialog/queue khác Chrome nên cần adapter riêng; không force quit. Spec ghi tests nhiều profile/cửa sổ, app đang đóng, helpers, timeout/cancel/permission, partial failure và mở lại.

### 7.5 Phạm vi có thể chốt từ lượt nghiên cứu

| Nhóm sản phẩm | Scope đầu đề xuất | Ngoài scope đầu |
|---|---|---|
| Media Apps / CapCut | CEF HTTP/code/graphics cache đúng nhánh; log cũ | Resource/media cache native, DB/effect/music/project/SmartCrop/Gecko |
| Media Apps / Adobe | Exact .cfa conform + .pek waveform trong Common cache | .ims/.prmdc2 chưa rõ, DB, CCX assets/template, presets/sync/dunamis |
| Chrome | HTTP/code/graphics cache, giữ profile/session | Website offline data, model/components/updater |
| AI Apps nếu mở rộng theo báo cáo AI | HTTP/code/graphics frontend + logs cũ | Runtime/MCP/plugin, transcript/artifact/image cleanup chưa mapping |

Chrome ~831 MB + Adobe .cfa/.pek ~314 MB + CapCut HTTP/code/graphics ~104 MB → khoảng **1,25 GB nhánh cụ thể**, chưa lọc trạng thái/tuổi/identity; không cộng Figma 1,55 GB khi user chưa đưa vào nhóm mới. Không cộng trùng Chrome cache đang có trong scan mặc định vào lợi ích “mới thêm”. Tổng 2,69 GB cũ gồm Figma và rộng hơn Adobe, không phải tổng scope user vừa định hướng.

Scope đã được thu hẹp bằng bằng chứng mới; không còn coi nhóm chưa rõ là mặc định dọn được. Chưa chạy mutation/restart/export fixture, chưa chứng nhận runtime an toàn. User vẫn là người chốt danh sách feature; implementation chỉ bắt đầu sau scope được chốt.
