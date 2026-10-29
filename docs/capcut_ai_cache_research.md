# Nghiên cứu cache CapCut, Codex, Antigravity và ChatGPT

Ngày khảo sát: 2026-10-10. Phạm vi macOS trên máy user. Chỉ đọc dữ liệu và tài liệu; không dọn cache, mở/đóng app, thay cấu hình, sửa engine, commit hoặc phát hành.

## 1. Kết luận cần biết trước

1. **Không đưa toàn bộ `~/Movies/CapCut/User Data/Cache` vào mục dọn an toàn.** Project trên máy đang tham chiếu tài nguyên bên trong thư mục này.
2. Với CapCut, log cũ và cache HTTP/shader của CEF là ứng viên rủi ro thấp hơn. Tài nguyên effect/music, database tài nguyên, project, presets và cấu hình cần giữ hoặc quản lý qua app.
3. Với AI agents, phần tốn dung lượng thường là **lịch sử, artifact, runtime và bộ cập nhật**, không chỉ cache tải về. Tên thư mục `cache` không xác định mức an toàn.
4. `~/.codex/plugins/cache` chứa code/skills/plugin; Antigravity CLI `cache` chứa thông tin resume. Không chọn dọn mặc định.
5. Bản bảo vệ Node vừa triển khai chặn CLI trỏ sang Home/Documents/System. **Nó chưa chứng minh dọn toàn bộ `.npm` không ảnh hưởng MCP**, vì `_npx` có thể chứa môi trường thực thi. Đây là hai bài toán khác nhau: đúng phạm vi filesystem và giữ môi trường hoạt động.
6. Không có hạng mục nào trong nghiên cứu này đã được chứng nhận bằng thử xóa rồi mở lại/export/chạy MCP. Các nhóm “rủi ro thấp” dưới đây là ứng viên để làm rule và nghiệm thu, không phải giấy phép dọn dữ liệu thật.

## 2. Bằng chứng và cách đọc kết quả

### 2.1 Nguồn bằng chứng

- Metadata filesystem: đường dẫn, loại file, số lượng, dung lượng; không follow symlink.
- Parse JSON project CapCut và chỉ tổng hợp đường dẫn phụ thuộc; không xuất tên project, caption hay nội dung video.
- SQLite chỉ đọc schema với `mode=ro&immutable=1`, không query hội thoại/token/nội dung người dùng; immutable bỏ qua WAL, do đó không dùng kết quả để kết luận tình trạng giao dịch mới nhất.
- Info.plist ứng dụng và source VXClean hiện tại.
- Tài liệu chính thức của CapCut, OpenAI, Google Antigravity, Electron, SQLite, npm và uv.

**Quan sát** là điều đọc được trên máy/source. **Suy luận** là tác động dự kiến từ cấu trúc hoặc tài liệu. **Chưa xác minh** là phần cần thử tái tạo hoặc kiểm tra bằng app. Không lấy tên folder làm bằng chứng duy nhất.

### 2.2 Phiên bản và giới hạn

| App trên máy | Phiên bản | Bundle ID |
|---|---|---|
| CapCut | 9.5.0 | `com.lemon.lvoverseas` |
| Antigravity | 2.19.1 | `com.google.antigravity` |
| Antigravity IDE | 2.5.5 | `com.google.antigravity-ide` |
| `/Applications/ChatGPT.app` | 26.1002.52244 | `com.openai.codex` |

App mang tên ChatGPT trên máy hiện dùng bundle ID Codex. Không giả định có hai kho cache độc lập cho ChatGPT và Codex; phân loại theo đường dẫn thực. Không phát hiện `Library/Caches/com.openai.chat` hay kho WebKit OpenAI riêng trong lần khảo sát này.

Dung lượng trong bảng là MB/GB decimal, chủ yếu tổng `st_blocks × 512` của file, làm tròn. App đang hoạt động có thể làm số liệu thay đổi giữa các lượt đọc. Không khử hardlink/APFS shared extents; **không đồng nghĩa dung lượng thực thu hồi**. Không đọc nội dung credentials. Kiểm tra process qua `ps` bị sandbox từ chối, nên trạng thái active/updater không được xác minh bằng process inventory; không vì vậy suy đoán app đang đóng.

## 3. CapCut

Root khảo sát: `~/Movies/CapCut/User Data/`.

### 3.1 Project thực sự phụ thuộc vào Cache

Trong 177 JSON đọc được bên dưới Projects, có **15 `draft_info.json` có cấu trúc timeline (`tracks` + `materials`)**:

| Nhánh Cache | Số JSON timeline tham chiếu | Số lần tham chiếu | Lần tham chiếu tới đường dẫn còn tồn tại |
|---|---:|---:|---:|
| `effect` | 14 | 1.187 | 24 |
| `music` | 2 | 8 | 8 |
| `artistEffect` | 2 | 6 | 0 |

Số lần tham chiếu không phải số file duy nhất hoặc số project độc lập. Với effect, các trường có `path`, `font_path`, `lumi_hub_path`; music có `path` và `beats_path`. Các file JSON là bằng chứng về phụ thuộc đường dẫn, chưa phải bằng chứng app thực sự load mọi trường đó trong lần export hiện tại.

Nhiều tham chiếu không còn tồn tại không đủ kết luận project đã hỏng: có thể là dữ liệu cũ, đường dẫn đã thay, tài nguyên được resolve theo ID hoặc chỉ tải khi cần. Ngược lại, thiếu tham chiếu trong JSON cũng không chứng minh một file không dùng, vì còn database và metadata khác.

**Hệ quả:** Giữ riêng Projects chưa đủ để bảo toàn project nếu xóa tài nguyên mà timeline trỏ tới. Cần xét toàn bộ chuỗi phụ thuộc: timeline → source media/font/effect/music → resource metadata.

### 3.2 Bản đồ dữ liệu

| Vùng | Dung lượng khảo sát | Vai trò quan sát/suy luận | Nếu dọn | Đề xuất cho cleaner |
|---|---:|---|---|---|
| `Projects` | 611,6 MB | Timeline, media, backup, file tạm của project; có MP4/MOV/WAV/MP3 | Có thể mất khả năng mở, chỉnh sửa hoặc phục hồi project | Giữ; không phải junk |
| `Cache/effect` | 37,9 MB | Shader, Lua, model, texture và metadata; có timeline tham chiếu | Có thể thiếu hiệu ứng/font; tải lại có thể phụ thuộc tài khoản/phiên bản | Không chọn mặc định |
| `Cache/music` | 1,9 MB | Tài nguyên nhạc/beat được timeline tham chiếu | Có thể thiếu âm thanh hoặc dữ liệu beat | Giữ tài nguyên đang tham chiếu |
| `Cache/artistEffect` | 0,012 MB | Tài nguyên có tên trong timeline | Chưa xác minh khả năng khôi phục | Không chọn mặc định |
| `Cache/ressdk_db` | 781,6 MB allocated; 760,6 MB logical | Database tài nguyên + WAL/SHM | Có thể reset catalog/trạng thái/favorite; tái tải chưa chứng minh | Không tự dọn |
| `Cache/SmartCrop` | 85,9 MB | Có 9 MP4, không chỉ metadata | Có thể là kết quả xử lý media phục vụ project | Chưa xác minh; không chọn |
| `Cache/VENetworkPlayer` | 79,8 MB allocated trong lượt đọc sau | Theo tên có thể là dữ liệu phát media qua mạng | Có thể phải tải lại, ảnh hưởng preview/offline | Ứng viên cần kiểm chứng |
| `Cache/fontImage` | 45,2 MB | 6.996 file, có thể là ảnh/render chữ | Tái render có thể cần font và tài nguyên gốc | Không mặc định an toàn |
| `Cache/image`, `DynamicDownloader`, `AITextTemplate` | 12,3 / 10,7 / 6,6 MB | Ảnh tải về/template; DynamicDownloader có WebP | Có thể ảnh hưởng tài nguyên/template offline | Cần kiểm chứng theo loại |
| `Cache/GeckoCpp` | 34,2 MB | Tài nguyên/module theo tên; chưa xác minh cơ chế cập nhật | Có thể phải tải lại hoặc ảnh hưởng tính năng nhúng | Chưa cho dọn mặc định |
| `Cache/ILASDKDB`, `strategy`, `agentCache`, `nuroHistoryCache` | 2,4 / 4,3 / 0,2 / 0,4 MB | Tên gợi ý DB/state/AI history; chưa đủ bằng chứng | Có thể reset state/lịch sử/tính năng | Giữ đến khi có rule |
| `CEF/Cache` | 142,8 MB | **Đính chính: root profile CEF, có Cookies/IndexedDB/Service Worker** | Xóa cả root có thể mất state/auth/offline data | Giữ root; chỉ xét Cache/Code Cache/GPU bên trong, xem mục 10 |
| `CEF/GrShaderCache`, `GraphiteDawnCache`, `ShaderCache` | Tổng khoảng 7,0 MB | Cache dựng hình/shader | Dự kiến dựng lại, lần đầu có thể chậm | Ứng viên rủi ro thấp |
| `CEF/Movies`, `LocalPrefs.json`, DB khác | Khoảng 1,6 MB cho Movies | Có LevelDB và thiết lập; tên Movies ở đây không chứng minh là video | Có thể mất state/prefs hoặc phiên | Không xóa cả CEF |
| `Log` | 103,9 MB | 31 file nhật ký | Mất thông tin chẩn đoán | Chỉ log cũ, app đóng, giữ log gần nhất |
| `Crash`, `VELog` | Rất nhỏ/empty | Dữ liệu chẩn đoán | Mất bằng chứng lỗi | Có thể opt-in dọn cũ |
| `Config`, `MMKV`, `Presets` | 2,0 / 17,0 / 0,02 MB | Thiết lập và persistent state | Reset app/presets hoặc tài khoản; chưa phân tích credentials | Giữ |
| `Cloud files`, `Download`, `EMaterial`, `Resources`, `VideoRecord` | Nhỏ/empty ở máy này | Có thể là source, tải dở hoặc output ở máy khác | Có thể mất dữ liệu không tái tạo | Không suy rộng từ trạng thái empty |

### 3.3 Vì sao ressdk_db lớn và vì sao không xóa WAL riêng

Quan sát được 6 file `.db`, 5 `.db-wal`, 5 `.db-shm`. Tổng logical của DB khoảng 602,5 MB, WAL khoảng 157,9 MB. Một schema resource DB có 46 bảng, gồm `effect`, `panel_category`, `category_resource_status`, `favorite_effect`, `artists_forbid_delete_info`, các bảng search. **Schema có chỗ chứa favorite và trạng thái tài nguyên; chưa query để xác nhận favorite thực tế của user.** Đây không phải thư mục chỉ chứa preview video.

WAL có thể chứa giao dịch đã commit nhưng chưa nhập vào database chính. Tách/xóa WAL riêng có thể mất giao dịch hoặc làm hỏng dữ liệu; không coi đuôi `-wal` là rác. Không chạy checkpoint/VACUUM hay thao tác DB thủ công trong nghiên cứu này. [SQLite WAL](https://sqlite.org/wal.html).

### 3.4 Mức có thể dọn hiện tại

- Đính chính sau khảo sát sâu: **CEF HTTP/code cache chỉ khoảng 95,43 MB**, cộng shader/GPU khoảng 8,08 MB và log root khoảng 103,90 MB → tối đa khoảng 207,4 MB trước lọc log. Con số 254 MB trước đây đã tính nhầm cả profile CEF vào HTTP cache, không còn dùng.
- Toàn bộ `User Data/Cache` khoảng 1,10 GB không đủ điều kiện tự chọn.
- CapCut có [hướng dẫn dọn render cache trong Settings > Draft](https://www.capcut.com/help/editing-not-match-displayed). Tài liệu này không xác nhận xóa tay mọi thư mục nói trên; một [trang trợ giúp khác](https://www.capcut.com/help/template-export-gets-stuck) còn đưa hướng dẫn desktop khác. Phải kiểm chứng trên 9.5.0 và ưu tiên chức năng dọn của app nếu có.
- Dọn tài nguyên “không dùng”: cần lập tập tham chiếu từ project + database, xét khả năng tải lại, rồi thử project có font/effect/music, cả offline. Chỉ đọc JSON không đủ chứng minh một tài nguyên không dùng.
- Khi gỡ CapCut, root Movies/CapCut vẫn được hiển thị opt-in như bản sửa trước. Gỡ app và quyết định bỏ toàn bộ project là hành động khác với dọn cache để tiếp tục dùng.

## 4. Codex và ChatGPT trên máy này

[OpenAI xác định `CODEX_HOME`, mặc định `~/.codex`, là nơi chứa config, auth, history, logs và state](https://learn.chatgpt.com/docs/config-file/config-advanced). Vì vậy không coi cả root là cache.

| Vùng | Dung lượng quan sát | Vai trò | Chính sách đề xuất |
|---|---:|---|---|
| `~/.codex/sessions` | 296 MB | Transcript/phiên local | Giữ; quản lý lịch sử riêng |
| `archived_sessions` | 130 MB | Phiên đã archive vẫn là dữ liệu | Không tự dọn vì “đã archive” |
| `state_5.sqlite` | Khoảng 8,5 MB + sidecars | Schema có threads/projects/attachments/tool state | Bảo vệ |
| `thread_history_1.sqlite` | Khoảng 118 MB + sidecars | Schema có turns/items/realtime history | Bảo vệ |
| `memories_*.sqlite`, `goals_*.sqlite`, `queue_*.sqlite` | Nhỏ | Tên và cấu trúc gợi ý memory/goals/queue state; chưa query nội dung | Giữ DB/WAL/SHM cùng nhau |
| `logs_2.sqlite` | Khoảng 58 MB + 7,4 MB WAL | Schema có bảng logs | Không rm DB live; nếu cần phải dùng retention/maintenance phù hợp |
| `plugins/cache` | Khoảng 83 MB trong lượt đo riêng | Có JS/Python/skills/manifest của plugin | **Bảo vệ như plugin đang cài** |
| `packages/app-server-daemon` | 333 MB | Runtime daemon, không phải download junk | Bảo vệ |
| `skills`, `rules`, `AGENTS.md`, `config.toml`, auth | Nhỏ | Hướng dẫn, quyền/config, đăng nhập | Bảo vệ |
| `automations` | Nhỏ | Nhiệm vụ định kỳ | Bảo vệ |
| `attachments`, `generated_images`, `visualizations` | 0,1 / 12,1 / 3,0 MB | Input/output của task | Dữ liệu user; opt-in quản lý artifact |
| `computer-use` | 76,9 MB | Có app helper, config và sessions | Không dọn root |
| `worktrees` | Nhỏ hiện tại | Checkout có thể có thay đổi chưa commit | Dùng lifecycle của Codex, không rm folder |
| `cache` | 32,1 MB | Catalog và thông tin app/tools theo tên file | Có thể tái truy vấn nhưng chưa xác minh mọi entry; chưa chọn dọn |
| `.tmp` | 52,5 MB | Có thể chứa dữ liệu task/runtime đang dùng | Không xóa chỉ vì tên tmp; cần biết owner/lifecycle |
| `models_cache.json` | 0,43 MB | Chưa đọc nội dung; tên không chứng minh model weights | Không có lợi ích dung lượng đáng kể để ưu tiên |
| `shell_snapshots` | 0,8 MB | Có thể dùng để khôi phục môi trường shell | Giữ khi còn phiên cần resume |
| `Library/Caches/Codex/Default` | 1,15 MB | Cache profile riêng | Ứng viên giới hạn đúng nhánh, app đóng |
| `Library/Caches/com.openai.codex/org.sparkle-project.Sparkle/Installation` | 1,82 GB | Tên/cấu trúc cho thấy staging bộ cập nhật; chưa kiểm chứng trạng thái installer | **Ứng viên lớn nhưng chưa an toàn tự chọn**: cần update đã xong, không còn helper giữ thư mục |
| `Library/Application Support/Codex/Default/Local Storage`, IndexedDB, Cookies… | Nhỏ | Persistent browser/session state | Giữ, không xóa cả profile |
| `Application Support/Codex.bak`, `com.openai.codex.bak` | Chưa định lượng ở bảng này | Backup không mặc nhiên vô dụng | Chỉ quản lý backup opt-in |

Plugin có quy trình install/remove riêng; xóa trực tiếp cache chứa code có thể làm plugin hoặc MCP không còn chạy. [OpenAI plugin commands](https://learn.chatgpt.com/docs/developer-commands).

Codex có quản lý worktree và lưu snapshot trước khi dọn checkout. Cleaner tự rm worktree không được coi là tương đương quy trình đó. [OpenAI worktrees](https://learn.chatgpt.com/docs/environments/git-worktrees).

**ChatGPT cloud không phải bản sao đảm bảo của mọi phiên Codex local, artifact hoặc thay đổi trong checkout.** Không dùng giả định “chat ở server rồi” để cho dọn `.codex`. Nghiên cứu này chưa kiểm tra khả năng khôi phục từng loại phiên từ backend.

## 5. Antigravity

Máy có cả Antigravity và Antigravity IDE, cộng dữ liệu CLI và browser profile. Không coi các root cũ/khác tên là orphan chỉ vì có bản mới.

### 5.1 Những phần cần giữ

| Vùng | Dung lượng | Ảnh hưởng nếu dọn | Đề xuất |
|---|---:|---|---|
| `~/.gemini/antigravity-ide/conversations` | 651 MB | Có thể mất lịch sử/local session | Giữ |
| `.../brain` | 303 MB | Artifact/context của task; có thể có báo cáo/code/output | Giữ; quản lý artifact riêng |
| `.../browser_recordings` | 409 MB | Mất ảnh/video bằng chứng thao tác, QA | Opt-in xóa lịch sử, không nhãn cache an toàn |
| `.../knowledge`, `implicit`, annotations | Nhỏ | Có thể mất context/knowledge/state | Giữ cho tới khi xác minh lifecycle |
| `.../mcp`, `mcp_config.json`, `bin`, builtin | Nhỏ đến 12,8 MB cho bin | Mất công cụ/config/khả năng khởi chạy | Bảo vệ |
| `~/.gemini/antigravity-cli/conversations`, brain | 58,8 / 20,6 MB | Mất nội dung phiên/artifact | Giữ |
| `~/.gemini/antigravity-cli/cache` | 0,02 MB | Có mapping dùng để resume phiên | Không dọn root |
| `~/.gemini/antigravity-browser-profile` | 216 MB | Có cookie/storage/phiên đăng nhập của browser agent | Không xóa cả profile |
| `~/.antigravity-ide/extensions` | 734 MB | Xóa extension đã cài | Chỉ uninstall qua IDE |
| `Application Support/Antigravity IDE/User/History` | 12,2 MB | Mất lịch sử chỉnh sửa/phục hồi cục bộ | Giữ hoặc quản lý history riêng |
| `User/workspaceStorage`, globalStorage | 4,8 / 2,2 MB | Workspace state và extension state | Giữ |
| `WebStorage` | 164 MB | Có thể là webview persistent state, không biết toàn bộ semantics | Không tự dọn |
| `Local Storage`, Cookies, Session Storage, Service Worker | Nhỏ | Có thể reset auth/state/offline behavior | Giữ |
| `~/.gemini/config`, token, settings | Nhỏ | Config tích hợp/quyền/đăng nhập | Bảo vệ |

Google mô tả root `~/.gemini/antigravity-ide/` chứa artifact, knowledge và config. [Antigravity settings](https://www.antigravity.google/docs/settings?tab=ide).

CLI lưu mapping workspace → conversation trong `cache/last_conversations.json`; mất mapping có thể làm `agy -c` bắt đầu phiên mới thay vì tiếp tục phiên mong muốn. Không khẳng định xóa mapping đồng nghĩa xóa toàn bộ nội dung conversation. [Antigravity resume](https://www.antigravity.google/docs/cli/commands/resume).

### 5.2 Những ứng viên rủi ro thấp hơn

| Đường dẫn dưới `Library/Application Support/` | Dung lượng | Điều kiện/tác động |
|---|---:|---|
| `Antigravity IDE/Cache` | 27,3 MB | HTTP cache; dự kiến tải lại, chỉ khi app và helper đã thoát |
| `Antigravity IDE/CachedData` | 52,3 MB | Theo cấu trúc có thể là code cache của IDE; cần thử cold start/extension |
| `Antigravity IDE/GPUCache`, Dawn caches, Code Cache | Khoảng 7 MB | Dự kiến compile/render lại |
| `Antigravity/Cache`, `Code Cache`, GPU/Dawn caches | Khoảng 30 MB | Cache frontend của app khác, không phải toàn bộ User Data |
| `Antigravity IDE/logs` | 66,5 MB | Chỉ nhật ký phiên cũ, giữ phiên active/gần nhất |

Electron phân biệt HTTP cache với persistent storage như cookie, IndexedDB và localStorage. **Xóa cache HTTP không tương đương xóa cả profile.** Đây là căn cứ nền tảng, chưa phải chứng nhận từng build Antigravity. [Electron session APIs](https://www.electronjs.org/docs/latest/api/session).

Các vùng cập nhật trong `Library/Caches/`:

- `com.google.antigravity/pending` + `update.zip`: khoảng 366 MB.
- `com.google.antigravity.ShipIt/update.*`: khoảng 483 MB.

Chúng là ứng viên staging/download cập nhật theo tên và cấu trúc. Không dọn khi updater đang tải, cài hoặc chờ restart; trạng thái đó chưa được xác minh trong lượt nghiên cứu. Không chọn cả root updater mặc định chỉ vì nằm trong Library/Caches.

## 6. Cache dùng chung và nguy cơ MCP

### 6.1 npm/npx

Trên máy có `~/.npm/_npx` khoảng **46 MB**, 2.370 file. npm exec/npx có thể cài package vào cache và chạy executable từ đó. Suy luận: MCP dùng npx hoặc trỏ trực tiếp vào package cached có thể lỗi khi code bị dọn; lần chạy sau có thể cần network, auth hoặc resolve lại version. [npm exec](https://docs.npmjs.com/cli/v11/commands/npm-exec/).

VXClean hiện có:

- User Cache: `.npm/_cacache`.
- Node Cache: **toàn bộ `.npm`**, được allowlist bảo vệ phạm vi ở lượt trước.

Do đó chọn Node Cache vẫn có thể bao gồm `_npx`. Bản sửa trước xử lý “đường dẫn config không được trỏ bừa vào dữ liệu/system”, **không xử lý đầy đủ “cache này có executable đang phục vụ MCP không”**.

Đề xuất nghiên cứu, chưa triển khai:

- Tách cache download `_cacache` với môi trường thực thi `_npx`.
- `_npx` không chọn mặc định; hiển thị tác động có thể cần cài/tải lại tool.
- Với cache download, ưu tiên thao tác do package manager quản lý và không dọn khi có tool đang dùng; `npm cache verify` không phải cam kết giữ mọi môi trường MCP.
- Không khẳng định lần Figwright lỗi sau dọn trước đây do `_npx`: **KHÔNG ĐỦ BẰNG CHỨNG lịch sử process/log/version**. Đây là một cơ chế có thể giải thích lỗi, chưa phải nguyên nhân được chứng minh.

### 6.2 uv/uvx/Python

Trên máy có `~/.cache/uv` khoảng **243 MB**. uvx có thể tạo môi trường tool trong cache; tài liệu uv cảnh báo không sửa/xóa trực tiếp cấu trúc cache, có thao tác cleanup quản lý lock và tái tạo environment khi cần. Symlink link mode có thể làm môi trường phụ thuộc trực tiếp vào cache. [uv cache](https://docs.astral.sh/uv/concepts/cache/), [uv tools](https://docs.astral.sh/uv/concepts/tools/), [uv CLI link mode](https://docs.astral.sh/uv/reference/cli/).

Không dọn `.venv`, interpreter, thư mục tool đã cài hoặc nguyên cache bằng filesystem rule chung. Nếu hỗ trợ, dùng quy trình manager, kiểm tra tool đang hoạt động và phân biệt cache tải về với môi trường chạy. VXClean hiện chưa có rule quét uv trong các nhóm đã đọc.

## 7. Chênh lệch giữa nghiên cứu và engine hiện tại

| Nội dung | Engine hiện tại | Đề xuất từ nghiên cứu |
|---|---|---|
| CapCut Movies data | Quét rộng khi gỡ, bỏ chọn | Giữ behavior; nếu dọn cache cần rule theo nhánh, không dọn cả root |
| AI Apps | Rule Ollama/LM Studio | Không quảng bá như đã bao phủ Codex/Antigravity/ChatGPT |
| Library/Caches | Nhiều subfolder được chọn để dọn | Cần loại/ràng buộc updater staging và app đang dùng |
| npm | Node Cache có thể chọn nguyên `.npm` | Tách `_cacache` và `_npx`, bảo vệ runtime |
| `.codex/plugins/cache` | Không nằm trong root cleanup hiện tại | Bổ sung negative safety fixture nếu mở rộng AI cleanup |
| `.gemini/.../brain`, conversations | Không nằm trong cleanup mặc định hiện tại | Giữ dữ liệu/phiên; nếu có chức năng quản lý history phải opt-in riêng |
| SQLite sidecars | Chưa có policy chung kiểm chứng lifecycle DB trong phạm vi này | Không nhận diện `.db-wal/.db-shm` là junk theo suffix |

Tham chiếu source: [ScanEngine](../MClean/Services/ScanEngine.swift), [native adapter](../desktop/native/maintenance_cli.swift), [spec quét rộng và cache động](spec/10_uninstall_discovery_cache_safety.md).

## 8. Cách nghiệm thu trước khi chọn dọn mặc định

1. **CapCut:** project mẫu chứa video/nhạc/font/effect/SmartCrop; ghi hash project/source. Dọn từng nhánh bằng cơ chế phù hợp; cold start, preview, mở/chỉnh/export, kiểm tra offline. Không dùng project user làm fixture destructive.
2. **AI agents:** phiên local và archived, artifact, plugin/MCP, extension, auth và workspace mẫu. Dọn cache frontend riêng; restart và resume, chạy tool, kiểm tra output/state còn nguyên.
3. **Runtime cache:** tách app đóng với daemon/MCP còn chạy; có fixture runtime dưới `_npx`/uvx, version pinned, offline/network failure. Không chỉ test folder không bị trỏ ra Documents.
4. **Updater:** kiểm tra trạng thái download/install/pending restart; chỉ prune artifact hoàn tất qua lifecycle của updater, không suy từ mtime hay tên cache.
5. **DB:** không tách DB/WAL/SHM; nếu cần log retention phải qua cơ chế database/app với lock và migration phù hợp.
6. **Default:** nhánh chưa đủ bằng chứng bỏ chọn. Tách lựa chọn “dọn cache tái tạo”, “xóa lịch sử/artifact”, “reset app”, “gỡ app và dữ liệu”.

Không sửa engine trong lượt này. Nghiên cứu xác định nơi cần giữ và ứng viên ưu tiên; không cam kết xóa an toàn tuyệt đối hoặc dung lượng thu hồi chính xác.

## 9. User bổ sung retention và đối chiếu MClean (2026-10-10)

### 9.1 Yêu cầu retention

- Không cần giữ lịch sử agent quá lâu; **6 tháng là mốc dự kiến**, chưa coi là giới hạn cứng không chỉnh được.
- User làm rõ: **mọi ảnh thuộc lịch sử agent đều mặc định không cần giữ, gồm ảnh user gửi và ảnh agent tạo**. Ảnh hữu ích user đã tự lưu; không giữ ảnh generated trong history như ngoại lệ mặc định. Cleanup chỉ xử lý bản ảnh do app quản lý gắn với history, không xóa bản user đã lưu độc lập, ảnh gốc bên ngoài hoặc source asset của project. Output không phải ảnh không tự nằm trong yêu cầu này.
- Tách retention text/history theo tuổi conversation với cleanup ảnh history (cả input/generated); không mặc định phải giữ ảnh đủ 6 tháng. Xóa ảnh có thể làm chat cũ không xem lại được ảnh/context hình; user chấp nhận không lưu lâu nhưng chưa giao thao tác xóa dữ liệu hiện tại.
- Cần xác định mapping attachment ↔ conversation và quyền sở hữu file; DB/state/WAL/config/plugin/runtime vẫn phải giữ. Không dùng mtime file thay cho ngày hoạt động chat, không xóa ảnh đang phục vụ task chạy. Chính sách active task/attachment cần thiết kế trước mutation.
- Chưa triển khai retention hoặc xóa ảnh trong lượt ghi nhận này.

### 9.2 AI Apps trong source MClean

`scanAIApps()` có đúng 8 mục, chỉ Ollama và LM Studio:

| Rule | Đường dẫn | Mặc định |
|---|---|---|
| Ollama logs | `~/.ollama/logs` | Chọn |
| Ollama cache | `~/Library/Caches/ollama` | Chọn |
| Ollama Electron cache | `~/Library/Caches/com.electron.ollama` | Chọn |
| Ollama WebKit | `~/Library/WebKit/com.electron.ollama` | Chọn |
| Ollama saved state | `~/Library/Saved Application State/com.electron.ollama.savedState` | Chọn |
| Ollama prompt history | `~/.ollama/history` | Không chọn |
| LM Studio logs | `~/.lmstudio/server-logs` | Chọn |
| LM Studio conversations | `~/.lmstudio/conversations` | Không chọn |

Chỉ thêm mục tồn tại, đọc được, dung lượng lớn hơn 1.024 bytes; hai mục optional dùng ngưỡng 0. Tính dung lượng folder, deduplicate rồi sort size giảm dần. Không có retention 6 tháng, phân tích tham chiếu project, hoặc tìm rộng Codex/Antigravity/ChatGPT. Không quét model root bằng AI Apps. Group User Cache khác vẫn có thể quét cache Library của các app này.

UI MClean gọi CleaningEngine với mục đã chọn. `cleanItems` kiểm tra allowlist rồi `FileManager.removeItem` toàn item; không có rule riêng chỉ xóa log cũ/attachment. **Lệch scan/mutation trong source:** allowlist đó không chứa `.ollama` hay `.lmstudio`, nên những mục trực tiếp dưới hai root này có thể được scanner hiển thị nhưng cleaner từ chối. Rule WebKit/Library còn được chấp nhận; WebKit không được chứng nhận là chỉ cache vô hại. VXClean dùng native mutation adapter riêng, không chạy CleaningEngine nguyên bản; không suy lỗi này áp dụng nguyên xi sang VXClean.

Hiện cả 8 đường dẫn không tồn tại trên máy. MClean đang cài version 1.0.4; binary có chuỗi LM Studio logs/conversations, chưa chứng minh binary khớp source hiện tại. Không có snapshot/log lần quét user nhớ lại, vì vậy **KHÔNG ĐỦ BẰNG CHỨNG xác định mục từng hiện ra**, không quy nó cho Codex/Antigravity.

Nguồn local: [scanner](../MClean/Services/ScanEngine.swift), [cleaner MClean](../MClean/Services/CleaningEngine.swift), [AppState](../MClean/ViewModels/AppState.swift).

## 10. Khảo sát sâu để chốt scope — 2026-10-10

**Định hướng đã chốt:** scan mặc định giữ nguyên; Media Apps (CapCut/Adobe) và Chrome riêng trong Dọn rác chi tiết. Đóng/mở lại app chỉ là định hướng, chưa được thực thi. [Spec flow](spec/11_detailed_app_cleanup.md). Các “đề xuất nhận” dưới đây là phạm vi có đủ căn cứ để đưa sang bước triển khai và nghiệm thu, không có nghĩa đã thử dọn an toàn trên dữ liệu thật.

### 10.1 Đính chính quan trọng: CEF/Cache không phải toàn HTTP cache

Đọc xuống một cấp cho thấy `~/Movies/CapCut/User Data/CEF/Cache` là profile, có Cookie DB, IndexedDB, Service Worker, WebStorage, LevelDB và cache con. Phân loại cũ dựa quá nhiều vào tên Cache; đã sửa bảng và tổng ở mục 3.

| Đường dẫn dưới User Data | MB | Kết luận scope đề xuất | Điều kiện/tác động |
|---|---:|---|---|
| CEF/Cache/Cache | 85,688 | Nhận HTTP cache | CapCut và helper thoát; lần mở lại cần tải tài nguyên web |
| CEF/Cache/Code Cache | 9,740 | Nhận generated code cache | App thoát; compile lại |
| CEF/Cache/GPUCache, DawnCache | 0,561 mỗi nhánh | Nhận cache dựng hình | App thoát; shader/render warm-up |
| CEF/GrShaderCache | 5,84 | Nhận cache dựng hình | Cần smoke test phiên bản 9.5.0 |
| CEF/GraphiteDawnCache, ShaderCache | 0,56 mỗi nhánh | Nhận cache dựng hình | Không bao gồm parent CEF |
| CEF/Cache/Service Worker | 45,097 | Loại khỏi scope đầu | Webview có thể dùng nội dung offline và state |
| CEF/Cache/IndexedDB | 0,717 | Bảo vệ | Persistent webview database |
| CEF/Cache/Cookies, WebStorage, databases, Shared Dictionary, DB/LevelDB khác | Nhỏ | Bảo vệ | Không reset profile để đổi lấy vài MB |
| CEF/Movies, LocalPrefs.json | Khoảng 1,60 MB và prefs nhỏ | Bảo vệ | State/profile khác, không phải source Movies thông thường |
| Log | 103,90 | Nhận log cũ | Đề xuất giữ 7 ngày và file gần nhất từng nhóm; threshold chưa user chốt, không giữ theo 6 tháng chat |

Nền tảng Chromium/Electron phân biệt HTTP cache, generated code cache và persistent storage. Đây là căn cứ semantics, không chứng minh CapCut expose API cleanup cho cleaner bên ngoài. [Electron session](https://www.electronjs.org/docs/latest/api/session).

Đọc lại 177 project JSON không thấy chuỗi đường dẫn tới CEF HTTP/shader, SmartCrop, VENetworkPlayer, GeckoCpp, fontImage, image, DynamicDownloader hay Log. **Không tham chiếu JSON không chứng minh unused**, vì app có thể lưu phụ thuộc bằng ID/database; chỉ CEF cache có thêm căn cứ semantics. Không mở rộng sang các nhóm media dưới Cache từ kết quả âm tính này.

### 10.2 Kết luận với các ứng viên media còn lại

- `VENetworkPlayer`: dữ liệu phát media có thể phục vụ offline; không đủ bằng chứng tái tạo không mất quyền truy cập. **Loại khỏi scope đầu**, thay vì giữ nhãn ứng viên mơ hồ.
- `SmartCrop`: có MP4 kết quả xử lý; không biết app còn dùng chúng để export hoặc xử lý tiếp. **Loại khỏi scope đầu**.
- `fontImage`, `image`, `DynamicDownloader`, `AITextTemplate`: ảnh không đồng nghĩa preview vô giá trị; có thể là asset/template. **Loại khỏi scope đầu**, không dùng quy tắc mọi ảnh đều bỏ. Yêu cầu bỏ ảnh lịch sử agent không áp dụng cho media project.
- `GeckoCpp`: tài nguyên/module nhúng, không có contract công khai prune. **Loại khỏi scope đầu**.
- `ressdk_db`, effect/music/artistEffect, ILASDKDB/strategy/state, Projects/presets/config: **bảo vệ**, đã có bằng chứng phụ thuộc hoặc persistent state.
- Render cache qua Settings > Draft là khả năng hãng mô tả; chưa có mapping chính thức tới các folder đang khảo sát. **Không tự biến chức năng Clear Cache của app thành rule rm cả User Data/Cache.** [CapCut hướng dẫn](https://www.capcut.com/help/editing-not-match-displayed).

Nếu muốn mở rộng các nhánh bị loại: tạo project fixture phụ thuộc đúng tính năng, quan sát file app tạo, xóa bản fixture từng nhánh, thử mở/export cả offline, đối chiếu output và resource state. Chỉ kiểm tra project mở được hoặc thư mục tự tái sinh chưa đủ. Không cần đưa thử nghiệm dài này vào bản scope đầu để thu hồi 80 MB mà tăng rủi ro project.

### 10.3 AI apps: chuyển từ ứng viên chung sang phạm vi cụ thể

| Nhóm | Kết luận đề xuất | Điều kiện và phần giữ |
|---|---|---|
| Antigravity IDE/Cache, Antigravity/Cache | Nhận nếu cấu trúc là HTTP cache riêng | App/helper thoát; giữ parent, User, WebStorage, Cookies, workspace/global state |
| Antigravity/Code Cache và Code Cache trong profile đã nhận diện | Nhận code cache | Không khớp substring Cache trên mọi folder |
| GPUCache/Dawn/Graphite ở profile frontend AI | Nhận shader cache riêng | Smoke test renderer, task resume, MCP sau mở lại |
| Antigravity IDE/CachedData 52,33 MB | Có thêm bằng chứng code cache, đưa vào danh sách cần test trước nhận | Hai thư mục hash; bundled main.js dùng VSCODE_CODE_CACHE_PATH làm codeCachePath. Chưa nối chắc chắn mọi file của fork vào startup cache, chưa cold start test nên không chọn trong scope đầu |
| Antigravity IDE/logs 66,5 MB | Nhận log phiên cũ | Đề xuất giữ 7 ngày và phiên gần nhất; log không đồng nghĩa conversation |
| Library/Caches/Codex/Default | Chỉ Cache và Code Cache trực tiếp | Bên cạnh có Partitions, không xóa root Default hoặc mọi partition chưa nhận diện |
| Codex/GraphiteDawnCache và cache đồ họa profile đã nhận diện | Nhận riêng | Giữ Default/Local Storage/IndexedDB/Cookies/Sessions, component/runtime |
| ~/.codex/cache, .tmp | Loại khỏi scope đầu | Metadata/runtime/lifecycle chưa có contract prune; lợi ích nhỏ |
| Codex/Anti update staging | Loại khỏi scope đầu | Pending/install lifecycle chưa xác minh; auto-update tự thu hồi đã có quan sát Codex |
| logs_2.sqlite và mọi DB/WAL/SHM | Bảo vệ | Không rm DB sống hoặc viết SQL maintenance tùy tiện |
| MCP/plugin/extensions/npx/uv runtime | Bảo vệ trong scope AI mới | Không phải cache frontend; không chứng minh nguyên nhân lỗi Figwright cũ |

Ảnh và lịch sử AI là **quản lý dữ liệu**, chưa xếp vào “cache an toàn”: user đã chốt ảnh lịch sử gồm input/generated không cần giữ; bản tự save/source project cần giữ. Phải có mapping ownership + conversation activity và tránh active task; hiện chưa đủ contract chính thức để nối filesystem deletion với DB của Codex/Anti. Scope đầu cache frontend không tự xóa transcript/brain/recordings/attachments. Lịch sử text khoảng 6 tháng vẫn tentative, video browser recording chưa được user cấp chính sách tương đương ảnh.

### 10.4 Điều cần kiểm chứng và quyết định đã rõ

Phân loại filesystem, exact path, loại file, source/documentation đã đủ để **thu hẹp đề xuất**. Chưa thực hiện Quit, restart, deletion, export hoặc MCP invocation trên cache đã dọn. Nhánh không đủ căn cứ đã chuyển sang loại khỏi scope đầu, không quảng bá an toàn rồi để user tự chịu rủi ro.

Không thay scan mặc định theo user yêu cầu. Rủi ro đã ghi ở cache updater/Node defaults hiện tại vẫn tồn tại trong baseline; spec này không tự miễn trừ rủi ro đó hoặc tuyên bố baseline đã an toàn.
