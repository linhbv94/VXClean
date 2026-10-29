# Screen và component contract VXClean

Version: 2.2.0 — 2026-10-29. Target release preparation; [scope](14_quick_detailed_scope.md), [policy](15_cleanup_protection_policy.md), [menubar design](16_menubar_release_ui.md) và [retention](08_scan_retention_ui_polish.md) là chuẩn hiện hành.

## Shell và dashboard

Giữ theme bộ VX theo [master theme](../../../_summary/standard_docs/master_theme.md): Navy/Slate, Cyan, density desktop hiện có, light/dark, native Mac traffic lights và Windows menu/control branch. Head bar production hiện VXClean, bỏ Bản thử; Browser Preview chỉ browser/mock. Không mở thêm master sidebar mới cho Chrome/Media.

Dashboard giữ CPU/RAM/Disk/Battery từ native, timestamp/error/stale; máy không pin có nhánh no-battery. Refresh single-flight, không debounce quá mức chặn thao tác hoặc nhân đôi sample với tray. Không gọi available disk là junk hoặc promised freed bytes.

## Quick

- Idle: Quét nhanh, mô tả System Junk/User Cache/Large & Old, không quảng cáo 10 nhóm.
- Scanning: progress/current path theo operation, cancel; không hiện CLI chuyên biệt.
- Results: đúng ba nhóm; default safe đã validation, Large Files false. Mỗi row name/size/method/short consequence; protected/unknown disabled và lý do.
- Dọn selection → review vĩnh viễn/Trash/hậu quả → policy/lifecycle → kết quả từng mục. Nút dọn mặc định không auto chọn Large Files.

## Dọn chi tiết

Category list giữ nhóm chung + Chrome, AI, Media, Node, Brew, Xcode, Docker, Mail, Trash. Dictionary giải thích từng dòng, badge tạo lại/mất dữ liệu/chưa xác minh/được bảo vệ; info mở exact scope/conditions/giữ gì. Không đưa internal IDs/schema vào copy user.

Checkbox trong nhóm chỉ Chọn tất cả nhóm đang xem. Trang tổng quan có count/bytes/selected của từng nhóm, Dọn các mục đã chọn xuyên nhóm và Chọn tất cả tổng quan tách rõ. Select all có thể chọn risky supported, không protected/informational/unsupported; indeterminate/deselect. Review global nêu mọi nhóm/hậu quả, không âm thầm chọn nhóm ẩn dưới checkbox category.

Popup Quit: app names, lý do, Đóng và dọn/Bỏ qua app/Hủy. Save/Cancel do app quản; không force quit. Reopen/restore failures tách với cleanup result. In-use row có thể selectable để Quit flow, nhưng hard-block row disabled.

## Uninstall, Orphans, Lens

Uninstaller giữ inventory/search/sort/associated files; Apple apps có thể bị lọc khỏi inventory, không bắt demo Safari hiện nếu source không emit. Self khóa. Known user-data có cảnh báo; discovered có nhãn Có thể liên quan, lý do, default false; Movies/CapCut nói rõ project/resources. Admin retry modal chỉ remaining known permission-denied targets, không discovery.

Orphans dùng copy Có thể là dư liệu, không tuyên bố xác minh app đã gỡ. Supported volatile chọn thủ công; blocked reason hiện. Giữ nav/entry hiện tại, không cần thêm sidebar master mới.

Lens giữ bubble/list renderer, geometry tests, folder chooser, breadcrumb Finder/Terminal/Copy (JS clipboard), depth/drill-down và partial flags. Chỉ can_trash target exact được chọn; quyền scan không là quyền xóa. Không thay UI thành tree cũ >10 MB.

## Menubar, settings và failure states

Menubar glyph/user SVG, panel 340 px, CPU/RAM breakdown/Disk/Battery/status, open main/quick-read/settings/quit theo spec 16. Main close ẩn Dock, panel click không bật Dock. Shared metrics sampler.

Settings hiện theme controls; không trình bày cleaning/scheduler/FDA boolean như đã có nếu chưa nối backend. Quyền chỉ yêu cầu khi operation cần; System Settings user tự cấp. Không mở autostart/autoClean trong task.

Loading, empty, partial, denied, blocked, stale, interrupted và outcome_unknown khác nhau. Native không fallback mock. Results removed estimates/Trash riêng; audit/details đủ cho user biết mục nào thực sự đã xử lý, không hứa Undo direct delete.

## Bổ sung corner popover — 2026-10-29

Menubar tài nguyên Tauri: cửa sổ trong suốt, main nền theme/viền1px/radius12px/clip nội dung; giữ kích thước340×430 và click ngoài ẩn. Theo [quy chuẩn floating surface](../../../_summary/standard_docs/desktop_ui_standards.md#corner-cửa-sổ-và-menubar-popover). Thay đổi source chưa đồng nghĩa bản release đã được cập nhật hoặc QA native đạt.


## Đồng bộ UI suite — Codex tiếp quản ngày2026-10-29

Theo [Settings](../../../_summary/standard_docs/settings_standards.md), [song ngữ](../../../_summary/standard_docs/bilingual_standards.md) và [updater](../../../_summary/standard_docs/auto_update_standards.md). Mục này cập nhật các mô tả cũ trái ranh giới General; không thay engine hoặc tự đánh dấu Specs ready/QA/release.

| Tab / surface | Key / owner | Capability, apply và persist |
|---|---|---|
| Chung | `vxclean_theme` | system/dark/light thực có, radio2cột; không thêm Pure Black giả |
| Chung | `vxclean_lang` | vi/en; apply/persist ngay và storage sync; shared Settings/update/permission/history dùng locale này |
| Quyền truy cập | Native scan access | Kiểm tra trạng thái thật; không tạo boolean quyền giả; giữ flow FDA và busy gates |
| Lịch sử | Native operation history | Không xóa journal khi reset; giữ reopen/retry/ack có thật |
| Updates | `desktop/src/services/app_updater.ts` | Notice và panel dùng chung controller; bỏ check/downloadAndInstall thứ hai và bỏ hướng vào Settings để cài |

Header56/sidebar192/footer56, panel body riêng cuộn, modal focus trap/Escape và restore focus. Reset chỉ theme→system, giữ locale và dữ liệu. Native menu app thêm GitHub/đúng tác giả, đổi locale; Settings show main trước khi emit cùng router. Catalog vi/en và context chung đã nối vào shell/dashboard, cleanup, smart scan, uninstaller, orphans, lens và các dialog; callbacks đọc locale hiện hành mà không khởi động lại scan/job. Còn cần native runtime QA toàn bộ các màn, không gọi đây là release-ready.

Bằng chứng/checks và giới hạn: [báo cáo Codex](../../../_summary/agents_handoff/suite_ui_codex_20261029_result.md). ST/BI/AU/TB native acceptance chỉ đạt khi có evidence phù hợp; source/build không tự đạt runtime.

Localization source: `desktop/src/services/ui_copy.json` v1.0.0 có vi/en cùng stable IDs; `common_copy.ts` là compatibility lookup cho literals cũ, `ui_language.tsx` là context của app. User paths/names và journal IDs không được dịch.


## Feedback20261029 — Settings component dùng chung

- Căn cứ: [feedback user](../../../_summary/feedback.md) và [Settings contract](../../../_summary/standard_docs/settings_standards.md). Title VXabc Settings không icon; commonvisual/copy lấy VXMedia.
- Source dùng lại: [canonical React](../../../_summary/standard_codes/settings_ui/settings_ui.tsx), vendorlocal `src/components/shared/settings_ui.tsx` + CSS + SHAmanifest (Clean ở desktop/src); không runtimeimport sibling.
- Windowapp dùng shell672×560, header/footer56/sidebar192/body24; maxheight theo viewport. General chỉ2sectionTheme→Language, chỉcapability thật. Updates/About/Support dùngcomponent; version/repo/description/icon/QR làmetadata riêng, tabnghiệpvụ vàconfig/updaterguards giữadapter hiệncó.
- Nghiệmthu riêng: commoncopy/geometry vi-en, theme/localeapply+readback, radio/tabkeyboard/focustrap/Escape, body cuộn/footerkhôngche; native/Windows/packaged/E2E phải ghi evidence, build/hashPASSkhông tựđạt. About native thamchiếuSearch, khác AboutSettings.

## Cập nhật Feedback 2026-10-29 (Anti UI)
- Spacing Traffic Lights (macOS): Tích hợp `sync_mac_traffic_lights` chuẩn 14/34/54 center, bước 20pt, gap 6pt theo AppKit reference vào `src_tauri/src/lib.rs` và `menubar.rs`, khắc phục lỗi spacing bị giãn lệch.
- Native About panel: Bổ sung icon bundle, metadata version thật, tác giả `Bùi Việt Linh`, mô tả và link GitHub chuẩn theo mẫu VXSearch.
- Titlebar Windows: Hiển thị SVG Shield + tên app 'VXClean' bên trái cạnh menu Tệp/Xem/Trợ giúp; cụm window controls (min/max/close) bên phải sau nút Settings gear.



### About native — đính chính 2026-10-30
Theo hợp đồng menu/About root: PNG trong suốt512×512 riêng app (không Dock squircle/default32), layout AppKit theo Search. Credits: Bùi Việt Linh → mô tả vi/en → GitHub URL; footer © 2026 Bùi Việt Linh. All rights reserved. Giữ version thật, không lặp build version. Cần QA bundle/native mới; không coi cargo check là visual PASS.
