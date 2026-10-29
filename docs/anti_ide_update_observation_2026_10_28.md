# Antigravity IDE — snapshot trước update
Ngày: 2026-10-28. Chỉ đọc, không restart/cài/dọn.

| Vị trí | Bản/commit | Logical | Allocated |
|---|---|---:|---:|
| Applications/Antigravity IDE.app |2.5.5 / ecfbad74d93962fc8ca485d93ab9b4f3d4cb6cf8|723.04MB|769.04MB|
| com.google.antigravity-ide.ShipIt/update.og1Mqjc/Antigravity IDE.app |2.6.0 / 9e3a5da5d6731effd57d47d88bbe5df14ac6ccdd|587.77MB|633.70MB|

- Bản staging build2026-10-26T18:06:23.613Z, strict/deep signature đạt. Log IDE ghi downloading12:57:40→downloaded/ready12:58:09. PID IDE6583; ShipIt23164 trỏ đúng statefile và app IDE. Snapshot PID có thể thay đổi về sau.
- ShipItState.plist thực tếJSON, updateBundleURL staging, targetBundleURL Applications, bundleIdentifier com.google.antigravity-ide, launchAfterInstallation=false. Sau install có thể cần user mở lại nếu app không tự mở; không tự sửa state.
- Cache frontend riêng com.google.antigravity-ide chỉ cỡ~124KiB; không nhầm với staged payload. com.google.antigravity/pending thuộc app khác, chưa kết luận được phép dọn từ quan sátIDE.
- Giữ toàn bộ pendingShipIt trước restart. User tự update rồi kiểm tra tiếp version/hash app đã cài, staging,state,updater process/log để xác định gói cũ tự mất hay còn leftovers. Chưa đặt rule dọn mới.
- [Evidence metadata/hash/log updater](anti_ide_pending_update_2026_10_28.json); không thu thập nội dung chat/project.

## Sau user restart — 13:48, 2026-10-28

- Installed2.6.0/commit9e3a5da5d6731effd57d47d88bbe5df14ac6ccdd, main+Info hashes khớp staging trước-update. PID mới26470; ShipIt đã thoát.
- Gói staging update.og1Mqjc tự mất. CacheShipIt chỉ còn state312bytes/log3421bytes/stdout0bytes (~3.73KB); state vẫn trỏ URL staging đã mất, do đó file state tồn tại không tự chứng minh pending update. Temp backup cũ không còn; chỉ còn1temp directory rỗng.
- Log13:47:16begin install→13:47:49installation completed successfully→13:47:52launch succeeded/ShipIt quitting. Cảnh báo không xóa được intermediateapp vì không còn file, sau đó flow vẫn hoàn tất; không coi là failed update.
- Verify signature lần đầu ngay sau restart trả invalid signature; kiểm tra verbose đầy đủ sau đó và lặp lại đều đạt. Chưa xác định nguyên nhân lần đầu, không tự sửa ký/trust/app.
- Log cho thấy trước update vẫn checking→idle định kỳ, đến12:57 ngày28mới downloading→ready; không có cơ sở kết luận updater tắt hoặc mọi ngày trong2tháng không có release.
- Kết luận phạm vi cleaner: giữ pending payload trong lúc đang chờ; sau update luồng quan sát này tự dọn, chưa cần rule xóa broadShipIt. Log/state vàiKB không đáng thêm scope. Chưa suy rộng sang appAntigravity khác hoặc lần update lỗi/interrupted. [Snapshot sau](anti_ide_after_update_2026_10_28.json). Không dọn dữ liệu user hoặc đổi engine.
