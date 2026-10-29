# VXClean — Kết quả local hiện hành

> Cập nhật gói cuối 2026-10-11: pnpm/Anti + canonical Quick/Detail đã triển khai, build/nghiệm thu local và sẵn sàng review độc lập. [Handoff](manager_cleanup_review_handoff.md), [evidence](manager_cleanup_completion_evidence.json), [hash gói](local_artifact_evidence.json). Giữ các giới hạn OS Cancel/tray/Intel/updater; không dùng báo cáo lịch sử để chứng nhận mọi gate đã đạt.
> Cập nhật audit 2026-10-11: System Junk Quick đối chiếu nguyên scanner MClean `42cf1f8` bằng test độc lập exact path/size/default selection; native 26 nhóm và Rust 21 tests PASS. Đã sửa hidden eligibility manifest, Xcode path guard và trả giới hạn tính size System về 10.000 entry. Xem [audit rule](system_junk_rule_audit.md) và [bằng chứng hiện hành](system_junk_clone_evidence.json). Các số scan cũ bên dưới là snapshot lịch sử, không chứng minh parity rule.


Cập nhật 2026-10-11: báo cáo dưới đây là lịch sử trước maintenance Quick. **Không dùng các số 0B/321MB hoặc gate cũ để kết luận trạng thái hiện tại.** Contract hiện hành: [spec21](spec/21_quick_scan_clean_parity.md); [bằng chứng hiện hành](system_junk_clone_evidence.json); [handoff](release_preparation_handoff.md).

## Báo cáo lịch sử

# VXClean — Kết quả hoàn thiện local

Ngày: 2026-10-10. Version0.1.0, macOS26.7/arm64. **Đã đóng gói local; chưa đủ bằng chứng nghiệm thu toàn bộ scope để phát hành.** Không commit/push/tag/draft/publish. User đã cho phép QA/dọn cache Chrome thật; không đóng/dọn Codex/Anti/Adobe thật.

## Gói đã tạo

- App: `desktop/src_tauri/target/release/bundle/macos/VXClean.app`.
- Bộ cài: `desktop/src_tauri/target/release/bundle/dmg/VXClean_0.1.0_aarch64.dmg`.
- Updater: `desktop/src_tauri/target/release/bundle/macos/VXClean.app.tar.gz` và `.sig`.
- Hash source/artifact, engine build tương ứng và kết quả xác minh ở [evidence](local_artifact_evidence.json). Codesign ad-hoc deep/strict đạt; chưa Developer ID/notarization. Hai verifier Rust/Node xác minh chữ ký thật theo public key trong app và từ chối tampering. Chữ ký updater không thay notarization của Apple.

## Đã kiểm chứng

| Nhóm | Bằng chứng local | Giới hạn |
|---|---|---|
| Scanner/safety | 20 nhóm fixture native, gồm Quick/revalidation không gọi CLI chuyên biệt, identity/manifest/scope, symlink/hardlink/new child, protected state, worker timeout, orphan Rust→Swift | Fixture chỉ chứng minh các case đã test; không chứng nhận mọi layout app/OS |
| Lifecycle | App AppKit riêng: Quit thường, Cancel không xóa, rescan/dọn cache exact/mở lại, không spawn duplicate | Chrome thật đã QA layout máy này:8window/90browser tab (gồm1tabQA), VL3tab;50profile files hash giữ khi đóng. Không chứng minh mọi layout hoặc project CapCut/Adobe |
| Trash | File/app fixture vào Trash thành công; test tự dọn marker của mình | Không thao tác dữ liệu user |
| Host/recovery | Rust20tests; pending/unknown giữ; completed recognized hết hạn180ngày; corrupt lifecycle và giới hạn đọc chặn updater | Không có Undo tự động cho cache remove; chưa chứng minh mọi power-loss/race |
| Frontend | Build đạt; retention10, uninstall defaults5, circle geometry18cases | Build không thay runtime QA |
| Packaged UI | Dashboard Quick một click tự scan; chuyển menu quay lại giữ kết quả; Large Files timeout có warning partial; AI Apps1,58GB found/65,94MB eligible; panel CPU/RAM/disk/battery thật, Open main đạt | Các hành vi này QA trước patch journal cuối; gói cuối khởi chạy và dashboard metrics đạt, không đổi scanner/panel |
| Release automation | 6 nhóm test verifier/layout/version/exact-commit publish guard/mocked finalization; actionlint3workflows; version/config validator | Không chạy remote, không gửi key hay tạo release |

AI Apps0B cũ do scanner legacy Ollama/LM Studio và artifact cũ. Scanner hiện quét Codex/Antigravity/ChatGPT; Cache/Code/GPU/Dawn exact có metadata riêng, lịch sử/ảnh/plugin/MCP/runtime/updater giữ lại. Lượng phát hiện thay đổi khi app tiếp tục ghi; không hứa toàn bộ1,58GB đều dọn được. [Evidence đọc native](ai_scan_local_evidence.json) ghi mẫu1.570.520.162bytes/65.944.718eligible,23dòng.

Quét nhanh máy này hiện **0B đủ điều kiện dọn**, dù có1,16GB System Junk và123,89MB User Cache được phát hiện. Không phải dữ liệu mock: broad OS/temp/log/generic cache thiếu semantic proof bị policy khóa. Không quảng bá Quick như đã hỗ trợ dọn toàn bộ những vùng MClean dọn.

## Gate còn lại và cách nghiệm thu

| Gate | Trạng thái / bước tiếp theo |
|---|---|
| Chrome nhiều profile/window/pinned/group | Máy thật đã dọn9/9cache,804.438.535logicalbytes,0failure;50tệp profile SHA-256giữ khi đóng;8window/VL3tab/order/selected khôi phục.90browser tab trước/sau, đóng1QA sauđó. Không suy rộng mọi layout; chưa reboot/ẩn danh/form. [Evidence](chrome_cleanup_runtime_evidence.json) |
| AI cold-start/MCP | Exact cache fixture giữ state/plugin/history đã đạt; cần Codex/Antigravity thật trên profile/môi trường riêng để chứng minh giao diện/plugin/MCP hoạt động sau dọn. Không dùng app đang điều phối task làm vật thử |
| Adapter thiếu evidence | Adobe cfa/pek, generic/System/rotated logs, Xcode/Mail/Trash/Docker, history6tháng/ảnh AI còn khóa. Cần layout/ownership/lifecycle/source proof và fixture trước enabled mutation; không tự đổi scope để ghi hoàn tất |
| Compatibility | Minimum buildmacOS13; Intel/macOS13 runtime chưa QA, Windows chưa engine. CI2Mac được cấu hình nhưng chưa chạy remote |
| Menubar thêm | Panel/actions/real metrics đã QA; click tray thực,1x/multimonitor/sleep-wake và hidden Dock còn chưa chứng minh toàn diện |
| Updater end-to-end | Endpoint lỗi đã báo đúng; signature/tamper đạt. Cần gói cũ+release mới cùng key để test download/install/restart, interrupted download, busy mutation. Chuỗi update công khai cần kiểm chứng sau first release; không đồng nhất với test crypto |
| Distribution | Agent phát hành kiểm tra repo public, secrets đúngkey, CI exactcommit, draft đủ5assetsMac, signatures/URLs và QA gate. Không bật Windows asset hay tự publish |

## Bàn giao

[Bàn giao release](release_preparation_handoff.md), [truth engine](spec/13_engine_behavior_truth.md), [implementation/giới hạn](spec/17_local_implementation_status.md), [gates](spec/18_release_completion_gates.md). Workflow preparation tạo draft khi agent phát hành được user giao chạy; publish là workflow riêng cần QA và CI đúng commit, không có Actions cache/artifact.

Counter Anti trước đây đã chạm điều kiện hai lượt không tiến triển; không gọi lại/resetcounter. Codex xử lý độc lập. App local cuối đã mở để user xem. **Task full-scope còn mở; báo cáo này không phải chứng nhận release-ready.**

## Bổ sung QA Chrome / icon menubar

Đã tái hiện và sửa combined manifest>4MiB bằng phân lô đầy đủ proof; giữ giới hạn request và preflight toàn bộ. Đã tái hiện timeout120s do journal serialize bậc hai, thay bằng JSONL append+fsync16MiB/lô và reader bounded.20nhóm native gồm7000cache files dưới30s giữprofile;20Rusttests gồm log truncated/unknown outcome và packedicon đạt. Hai journal lỗi cũ giữ nguyên, không replay hoặc đổi thành success; lượt cuối dọn9/9đạt. Profile backup riêng localtmp, không có credentials/URLs trong repo.

Icon36×36 raw cũ có5760bytes (padding), Tauri silently bỏ ảnh. Packed5184bytes, compile-time length/visiblealpha và alphaPNG đối chiếu đạt. Bản mới mở được, panel fallback đã QA trước; **physical tray click chưa QA** vì CUA không có cửa sổ SystemUIServer. Không lấy panel hoạt động làm chứng minh icon hiển thị. Gói cuối bổ sung metadata response aggregate và gom target nhỏ vào lô dưới giới hạn request sau QA; filesystem/lifecycle giữ nguyên. Rust20 kiểm chứng đủ proof và giới hạn từng lô; không lặp dọn Chrome thật để đo tốc độ.

## Quét nhanh — cập nhật tiếp2026-10-10

Adapter mới cho HTTPpayload UUID tại fsCachedData của helpd/tipsd/AMPLibraryAgent; giữ parent/database/WAL/SHM/HSTS/state. Diagnostic cá nhân .ips/.crash/.diag trực tiếp cũ≥7ngày có thể chọn, mặc định bỏ chọn vì báo cáo cũ không tái tạo. System/temp/log khác vẫn khóa. UI hiển thị lý do khóa, hậu quả và tổng phát hiện/đủ điều kiện riêng.22nativegroups/20Rust đạt: Foundation cold cache500KB→native dọn payload→cache miss→tạo lại500KB; database/state giữ bytes; báo cáo mới/type sai/nested bị từ chối. Scan thật chỉ đọc~15MB cacheeligible; không dọn dữ liệu thật lượt này. [Spec](spec/19_quick_cleanup_validation.md) · [Evidence](quick_cleanup_validation_evidence.json). Gói/QA UI ghi trạng thái hiện tại trong evidence, không suy từ build sang nghiệm thu mọi scope.


## Bàn giao Quick ưu tiên — 2026-10-11

Scope user thay đổi: Quick scan + chọn + dọn trước, dọn chi tiết sau. Đã thay khóa gần hết cache bằng policy maintenance trên roots MClean; System cache, user cache, logs/temp cũ≥24giờ có bounded manifests, quyền, protected-child và runtime/IPC/executable guard. Không tự nâng admin hoặc dọn structural roots. Không cam kết mọi temp cũ không còn được dùng; đây là scope/rủi ro user chấp nhận.

23 nhóm native, 21 Rust,2integration host→native thực, retention10, frontend build/diff check đạt. Gói production đã dọn đúng cache QA disposable1.120.000bytes,1success/0failure; rescan không còn mục đó. UI gói cuối Dashboard auto-scan, checkbox nhóm/từng mục, confirm/cancel và retention khi đổi menu đạt. Không bấm delete UI trên dữ liệu thật để giả lập evidence; mutation được xác minh bằng producer/consumer integration và chính engine gói production.

App/DMG/updater local arm64 đã build; codesign deep/strict và2verifier Rust/Node chữ ký/tamper đạt, hash engine bằng OUT_DIR build. **Đạt chuẩn bàn giao local bản Quick**. Scope detailed chưa nghiệm thu toàn bộ, tray physical click/Intel/macOS13/updater install-restart chưa test; gói ad-hoc/chưa notarized. Worker file lớn kẹt trong Foundation directory open trên máy thật, timeout20giây báo partial đúng; cache vẫn có kết quả và dọn được.

[Evidence Quick](quick_release_validation_evidence.json), [artifact hashes](local_artifact_evidence.json), [checklist](release_readiness_checklist.md). Không commit/push/tag/publish.

Ảnh gói cuối sau quét lại: [Quick UI](quick_release_ui.png). App đang mở để user xem.
