# VXClean — vận hành release

> Quyết định chung2026-10-28: chỉ release platform có engine thật; có engine cho cả hai thì release cả hai. Không phát hành Windows dummy nữa trừ khi user yêu cầu lại. Riêng Clean1.0.23 đang chạy giữ nguyên đợt này.


Baseline public1.0.23; QA/release hoàn tất ngày2026-10-28. Nguồn trạng thái: work_log tổng và release_1_0_23_review.md/evidence.json. Không coi các báo cáo spike/handoff cũ là trạng thái release hiện tại.

## Phạm vi

Mac Silicon/Intel: engine thật Swift/Rust. Windowsx64: UI/updater-only, không scan/cleanup/uninstall/metrics/Lens; backend reject trước filesystem/process, không mock success. Giữ com.vxclean.desktop, updater key và certificate-bound signer Mac hiện có. Không tạo signer/key mới để chữa build.

## QA trước tag

- npm --prefix desktop run build.
- cargo test --locked --lib từ desktop/src_tauri.
- python3 scripts/test_native_maintenance.py và python3 scripts/test_manager_cleanup.py: chỉ synthetic home; native test đo RSS cần quyền sysctl. Không thay fixture bằng cache user. Fixture root hidden tránh file DS_Store từ bên ngoài; không bỏ assertion để cho qua.
- Chạy tests FDA/retention/history/Lens/uninstall-selection/circle/recent và node --test scripts/test_release_automation.mjs. Package profile6assets, không còn profile5 chỉMac.
- Build QA với signer hiện có, SDK27.0; giữ keychain/trust/FDA. Probe quyền từ app thật; scan thật chỉ đọc, không bấm dọn dữ liệu user. Destructive/recovery checks dùng fixtures.

## Phát hành

1. Đọc git status/diff, stage đúng source/spec/icon của lượt này. Không git add . hoặc stage toàn bộ báo cáo local/key.
2. Đồng bộ npm/Cargo/config/lock của app, viết docs/release_notes/VERSION.md thuần end user. PR/merge; tag bất biến vVERSION rồi push.
3. release.yml dùng Windows2022 và xcode27 standard public runners, không Actions caches/artifacts. Mac pin SDK27.0, Intel cross-build trênARM. Signer từ Secrets bắt buộc; thiếu thì fail, không fallback ad-hoc. Windows tự merge tauri.windows.conf.json, NSIS currentUser/updater passive.
4. Chờ cả3target+validate. Nếu hdiutil Resourcebusy tạm thời, đọc log rồi rerun failed cùngtag; nếu app code thay đổi thì version/tag mới. Không force-move tag hoặc publish draft lỗi.
5. Tải đủ6asset và lấy lại latest.json sau retry (không dùng manifest partial cũ). Xác minh layout, tất cả signatures/tamper, version/URL, icon, main+Swift engine arch/SDK, expected certificate và parent seal. Hai DMG phải có host/helper byte-exact gói updater đã kiểm.
6. scripts/verify_release_packages.py APP_ROOT ASSET_DIR cần macOS và official7-Zip CLI (PATH hoặc VXCLEAN_7ZIP). scripts/verify_release_dmgs.py APP_ROOT ASSET_DIR kiểm checksum, mount readonly và detach. Evidence JSON được ghi trong ASSET_DIR. Chạy cryptographic verifier scripts/verify_signature.mjs bằng publickey config cho mọi manifest entry.
7. User đã giao publish thì dispatch publish_release.yml, tag vVERSION và local_qa_passed=true. Workflow kiểm CI đúngSHA, version cao hơn latest và signatures trước public. Kiểm stable/latest, manifest exact và6assets HTTP200 không token; lưu IDs/hash/checkpoint vào docs.

## Permission/update proof

Mac dùng certificate leaf fe024021592c718a39ad70b76d2edc5da0cd6b70, appID riêng. Updater key và OS signer là hai lớp khác nhau. Không cấp/reset FDA hoặc trust toàn máy trong QA. Muốn claim giữ FDA: từ bundle cũ→mới qua updater thật, kiểm installed bytes và probe quyền mới, không cấp lại trong lượt đó. Gói helper là sealed resource: kiểm expected architecture/SDK/test-hook absence và thử tamper trong bản sao khiến parent verification fail.

Windows/Intel GUI và updater E2E cần bằng chứng riêng; không suy từ MacSilicon. Note phải ghi rõ Windows UI-only. Self-signed Mac chưa notarize và Windows chưa Authenticode có thể cần cho phép mở lần đầu; không hướng dẫn tắt bảo vệ toàn máy.


### Local signing recovery (2026-10-29)

Nếu codesign hỏi mật khẩu keychain cũ do duplicate identity, không yêu cầu user đoán mật khẩu. Dùng session ký tạm cùng certificate/key hiện có theo [runbook workspace](../../_summary/standard_docs/desktop_system_permissions.md). Giữ nguyên fingerprint/bundle ID, chạy build_signed_macos app-only và strict/DR gate. Session tạm phải cleanup, không đổi trust/TCC, không cần release.
