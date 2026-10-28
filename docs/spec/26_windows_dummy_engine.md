# Windows dummy engine
Ngày cập nhật: 2026-10-15

Mục tiêu: đóng gói Windows x64 NSIS `.exe`, giữ shell/UI hiện tại; chưa có tính năng engine. Không phát hành trong task triển khai.

- Windows compile module maintenance riêng, không compile bridge mutation Mac vào command dispatch. Không gọi Swift, process lifecycle, filesystem scan/delete/trash/uninstall hoặc terminal/folder picker.
- Capabilities engine đều false; sidebar vẫn cho điều hướng để xem UI. Banner Windows giải thích chưa có chức năng. Lệnh engine trả thông báo chưa hỗ trợ, không mock kết quả/success/metrics.
- History trả rỗng đúng schema, access status not_required. Settings/theme/titlebar/updater tiếp tục hoạt động; updater prepare/restart có state guard riêng không cần engine Mac.
- CLI worker Lens trên Windows bị vô hiệu hóa; không dùng Windows dummy để claim FDA/system permission hay safety Windows thật.
- Mac dùng nguyên module cũ. QA: native regression Mac, frontend build, dummy command rejection/không side effect và Windows CI cargo/build NSIS. Mac build/cross-check không thay Windows WebView2 smoke.
- Agent release phải build trên Windows runner, kiểm tra cài/mở/chuyển màn/theme/close; release note nói rõ Windows UI-only. Chưa có `.exe`/Windows runtime evidence thì không ghi đã release được kiểm chứng.


## Release 1.0.23 — 2026-10-28

User giao QA và release. Matrix phát hành Windows x64 UI-only cùng hai Mac có engine thật; Windows dùng NSIS currentUser và updater passive. Chữ ký updater dùng cùng key hiện tại, Mac giữ signer/certificate-bound identity. QA package/CI không thay Windows WebView2 runtime; giới hạn ghi rõ trong release review.
