# VXClean1.0.23 — QA độc lập và release

Ngày2026-10-28. User giao QA bản vừa sửa rồi release. Baseline public1.0.22; local handoff1.0.23 chưa public. Phạm vi gồm streaming live cache lớn, bounded journal/history, mô tả/ordering UI, icons/SDK27 và Windows UI-only adapter đã có.

## Gates

- Rust51, frontend/FDA11/retention10/history/Lens/selection5/circle18/recent2 đạt trên Mac. Release tests7 đổi sang profile6assets đạt.
- Native fixture lần đầu có file DS_Store mới sinh sau selected-target cleanup; không nới policy hoặc bỏ assertion. Chuyển fixture root sang hidden để tránh tác động từ trình duyệt thư mục. Lần sau đã qua assertion đó, dừng vì sandbox chặn sysctl của /usr/bin/time. Chạy lại fixture dưới quyền đo phù hợp, không dùng dữ liệu user.
- Native streaming/policy/recovery/manager fixture, signed local bundle/UI và CI/package/public đang kiểm. Không xóa cache thật.
- Windows chỉ giao diện và updater, không claim engine scan/cleanup/uninstall/metrics. Mac giữ bundleID/publickey/certificate fingerprint hiện có; không thay trust/FDA hoặc tạo signer mới.

## CI và chi phí

Repo public đã xác minh. Standard Windows2022/xcode27 runners, không cache/workflow artifacts; chỉ upload Releases. Tham chiếu [GitHub runner policy](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job). Hai target Mac build riêng; Intel cross-build trên ARM runner, không phải GUI Intel.

## QA local cuối

36 nhóm native và9 manager đạt khi chạy fixture có quyền đoRSS; 25.001file cache dọn hết và profile được giữ. Bundle ký certificate-bound cùng signer hiện tại, mainSDK27.0. Native UI telemetry thực và Quick scan chỉ đọc đạt; kết quả có cảnh báo một vùng SystemJunk chưa đầy đủ do quyền/giới hạn duyệt, không giả scan đầy đủ. UserCache5.56GB chọn được, Googleexcluded0B; ngoài kết quả17mục sắp dung lượng giảm dần. Không bấm Dọn. Settings Hệ thống báo quyền đọc được bảo vệ đã kiểm chứng, manual probe vẫn verified, không cấp lại quyền.

Rút gọn caption Updates dùng chung Windows/Mac; không đổi engine sau QA. PR checks và release CI/package/public đang chờ.

## Kết quả cuối2026-10-28

PR8 merged, tag a9ea43d725e17d41d943e145ac5e52211d91b61b. Build40622337715 và publish40625761621 thành công. Publicstable1.0.23, manifest và6assets HTTP200 không token. Updater signatures/tamper, hai Mac SDK27/architecture/icon/certificate seal và2DMG byte-exact đạt; Windows x64 installer/icon/manifest đạt.

Updater native MacSilicon1.0.22→1.0.23: download/install/restart, UI23, host và engine byte-exact CI, signer giữ nguyên, manual FDA probe vẫn access_confirmed, không cấp lại quyền. ThemeSystem/vi giữ nguyên. Không thay Applications. Windows/Intel GUI/updater chưa kiểm; Windows lần này UI-only. Từ lần sau chỉ Mac theo quyết định mới toàn workspace; dummy chỉ khi user yêu cầu.
