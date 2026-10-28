# VXClean1.0.23 — QA độc lập và release

Ngày2026-10-28. User giao QA bản vừa sửa rồi release. Baseline public1.0.22; local handoff1.0.23 chưa public. Phạm vi gồm streaming live cache lớn, bounded journal/history, mô tả/ordering UI, icons/SDK27 và Windows UI-only adapter đã có.

## Gates

- Rust51, frontend/FDA11/retention10/history/Lens/selection5/circle18/recent2 đạt trên Mac. Release tests7 đổi sang profile6assets đạt.
- Native fixture lần đầu có file DS_Store mới sinh sau selected-target cleanup; không nới policy hoặc bỏ assertion. Chuyển fixture root sang hidden để tránh tác động từ trình duyệt thư mục. Lần sau đã qua assertion đó, dừng vì sandbox chặn sysctl của /usr/bin/time. Chạy lại fixture dưới quyền đo phù hợp, không dùng dữ liệu user.
- Native streaming/policy/recovery/manager fixture, signed local bundle/UI và CI/package/public đang kiểm. Không xóa cache thật.
- Windows chỉ giao diện và updater, không claim engine scan/cleanup/uninstall/metrics. Mac giữ bundleID/publickey/certificate fingerprint hiện có; không thay trust/FDA hoặc tạo signer mới.

## CI và chi phí

Repo public đã xác minh. Standard Windows2022/xcode27 runners, không cache/workflow artifacts; chỉ upload Releases. Tham chiếu [GitHub runner policy](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job). Hai target Mac build riêng; Intel cross-build trên ARM runner, không phải GUI Intel.
