# Menubar, Dock và shell cho bản chuẩn bị release

> **Cập nhật implementation local 2026-10-10:** xem [truth sau triển khai](17_local_implementation_status.md) và [báo cáo build/QA](../local_completion_report.md). Nội dung target dưới đây không đồng nghĩa mọi gate đã pass; các nhánh thiếu evidence đang blocked.


Version: 1.1.0 — Ngày cập nhật: 2026-10-29. Target macOS; **tray/lifecycle đã triển khai và QA panel trên gói arm64; đa màn hình/sleep-wake chưa QA**. Không đổi app identifier/icon bundle chính. Asset user cung cấp: [vxclean_icon_menubar.svg](../../vxclean_icon_menubar.svg).

## 1. Head bar và icon

- Head bar production chỉ hiện VXClean, không “Bản thử”. Đã bỏ nhãn trong source `title_bar.tsx` ở lượt chuẩn bị spec; cần build/QA gói để xác nhận. Browser Preview vẫn hiện badge riêng khi thực sự là mock/browser; không đổi preview thành số liệu native giả.
- SVG là glyph chổi trắng trên nền transparent, viewBox 64×64. Giữ hình và tỉ lệ; dùng template image monochrome trên macOS để OS đổi màu theo menu bar sáng/tối. Rasterize alpha từ chính SVG ở 18×18 và 36×36 (1x/2x), có thể optical-align nhưng không vẽ logo mới. Tên asset mới snake_case; giữ file SVG user đã có.
- Không dùng trắng cứng không-template khiến icon mất trên nền sáng; không dùng app icon nhiều màu thay glyph. Tooltip/accessibility name “VXClean”; icon click target native status item. Mặc định không thêm CPU/RAM text vào thanh menu để tránh chiếm chỗ.

## 2. Popover tổng quan

Click trái icon mở/toggle panel không kích hoạt Dock; click phải native menu “Mở VXClean”, “Cài đặt…”, “Thoát VXClean”. Panel khoảng 340 px rộng, co chiều cao theo pin/status, neo vào tray item, clamp trong visible monitor bounds, radius12px/viền1px/clip nội dung theo theme VX; native window và html/body trong suốt để bốn góc không còn nền vuông. Không mở cả native menu và panel trên cùng click.

```text
VXClean                      Cập nhật 14:32:05
CPU       18%                [sparkline ngắn]
RAM       12,4 / 24 GB        [thanh tỷ lệ]
          Active · Wired · Compressed
Ổ đĩa     Đã dùng / Tổng      [thanh tỷ lệ]
          Khả dụng: …         (không gọi là rác)
Pin       82% · Đang sạc      (chỉ máy có pin)
────────────────────────────────────────────
Thao tác: Đang quét / Đang dọn / Chưa quét
Quét nhanh         Mở VXClean         Cài đặt
```

- RAM breakdown dùng metrics thực; CPU sparkline sample có timestamp, giới hạn 20 điểm. Disk dùng giá trị engine và copy đúng semantics available có thể gồm purgeable; không hiển thị cache/rác từ số used disk.
- Nếu có kết quả Quick còn fresh, có thể hiển thị “Cache đủ điều kiện: …” estimate từ đúng snapshot/policy. Chưa scan/hết hạn → “Chưa quét”/“Cần quét lại”, không tự full disk scan khi click icon.
- “Quét nhanh” mở/focus main Smart Scan rồi bắt đầu scan read-only đúng scope ba nhóm, không cleanup 1-click và không auto tick Large Files. Đang mutation thì disabled action xung đột, hiển thị trạng thái để mở về đúng màn hình.
- “Cài đặt” mở main với settings; “Mở VXClean” restore window/dock/focus. Esc, click ngoài, mất focus đóng panel, không quit app và không mở main. Panel keyboard reachable, accessible labels, contrast đủ sáng/tối.
- Loading/error/stale state rõ; không thay native error bằng mock/0%. Không cần top-process/network/sensors/“free RAM” trong scope này vì engine chưa cấp dữ liệu hoặc action tương ứng.

## 3. Sampling và quyền cửa sổ

- Một host metrics service shared cho dashboard/panel, single-flight; không nhân đôi CPU sample subprocess khi mở hai UI. Panel mở: refresh khoảng 5 giây (sampler native CPU hiện cần khoảng 2,1 giây); hidden/background chỉ refresh nhẹ mỗi 30 giây hoặc nghỉ khi không có consumer. App sleep dừng timer, wake refresh một lần; không backlog queued jobs.
- Không chạy cleanup/scan theo timer. Metric read errors có timestamp và retry bounded; giữ last good data với stale badge. Hủy/reap child do mình tạo khi Quit. Chỉ claim resource usage bằng số đo idle/visible/background thực, không quảng cáo “CPU gần như bằng 0”.
- Nếu dùng WebviewWindow phụ cho panel, capability chỉ metrics + open/focus/request navigation; không cấp clean/uninstall/lens delete tùy tiện cho panel. Mutation chỉ main, native policy vẫn kiểm tra caller/window/scope. Raw generic invoke không trở thành đường bypass qua panel.

## 4. Lifecycle macOS

States: `main_visible`, `background`, `quitting`; panel-visible không là main_visible. Main có Dock khi đang mở. Nút đỏ/Cmd+W → prevent destroy/exit, hide main + panel, activation/accessory policy ẩn Dock, tray vẫn tồn tại. Không dùng hide app đơn thuần nếu Dock vẫn còn.

Tray mở main hoặc launch/reopen app → regular activation, show/unminimize/focus main, chỉ một instance/window. Mở/đóng panel không đổi policy thành regular. Child ownership, cancellation và mutation journal theo [15](15_cleanup_protection_policy.md).

Cmd+Q/native Quit/tray Quit → shared shutdown handler, không bị CloseRequested biến thành hide. Khi mutation đang chạy: dừng ở safe boundary, lưu kết quả/reopen obligations và dọn owned child; UI giải thích đang kết thúc thao tác nếu cần chờ. Không kill target Chrome/Adobe/AI apps để thoát VXClean. Quit không để metrics timer/engine tiếp tục chạy.

Tray creation thất bại → **giữ main/Dock mở**, báo lỗi; không hide khiến user mất đường mở app. App chưa có tray không được đánh `menu_bar_monitor=true`. Không bật autostart/login item không được user yêu cầu. Windows hiện chưa có maintenance adapter; không copy activation policy hoặc tuyên bố Win release-ready.

## 5. Acceptance native

- SVG thật trong bundle; icon rõ ở light/dark, 1x/2x và menu bar wallpaper khác nhau. Không thay shape.
- Panel anchor đúng primary/secondary screen, near edge; Esc/click outside đóng; mở panel không xuất hiện Dock; reload không tạo icon/timer/listener trùng.
- CPU/RAM/disk/battery thực, no-battery branch, stale/error/sleep-wake; timestamp/counters khớp shared sampler; không scan khi chỉ mở panel.
- Main close → background/ẩn Dock; reopen từ tray/Finder → một window/Dock; Cmd+Q và tray Quit → exit + không owned children còn sống. Active read/mutation shutdown có test, không skip journal.
- Packaged macOS GUI phải được kiểm tra, source build/unit test không thay visual/lifecycle QA. Ghi rõ artifact/version/hash/OS/architecture và checks còn thiếu.

Tham chiếu kỹ thuật: [Tauri system tray](https://v2.tauri.app/learn/system-tray/). Dùng API của phiên bản dependency đang cài; bật feature `tray-icon` nếu cần, template flag và activation policy theo crate/native APIs thực tế, không dựa vào docs cũ của SwiftUI.

## Lịch sử cập nhật

- 1.1.0 (2026-10-29): Chốt radius12 và nền alpha xuyên các lớp cho popover; cần QA native bản mới, không kế thừa kết luận visual của gói cũ.
