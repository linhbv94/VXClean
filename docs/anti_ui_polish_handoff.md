# VXClean — Bàn giao feedback cache/header/Lens

Ngày: 2026-10-09. Spec trước triển khai: [08_scan_retention_ui_polish](spec/08_scan_retention_ui_polish.md).

## Phân công và kết quả

Anti thực thi UI: shared `page_header.tsx` cho Dashboard/Uninstaller/Lens/Orphans; CTA dashboard tròn 144px dưới metrics; Lens toolbar riêng; click nền SVG bỏ chọn, list tên toggle/double click, bar 96px tương đối max child và giữ parent %. Không đổi packing hoặc ngưỡng tên r≥18/size+% r≥65.

Codex thực thi retention và review: [scan_retention.ts](../desktop/src/services/scan_retention.ts), [retained_screen.tsx](../desktop/src/components/retained_screen.tsx), app/bridge và lifecycle components. Lazy mount các màn đã mở, giữ state tối đa 5 phút từ đọc thành công; màn ẩn hết TTL được unmount để giải phóng dữ liệu/DOM. Hết hạn không tự quét nền. Pending scan giữ cùng job, có thể quay lại xem/cancel. Failed/cancelled read không thành cache mới; late response trước mutation không được làm mới cache. Mutation invalidate trước/sau, kể cả partial failure. Cache không thay grant TTL/inode/path/running-app guards của backend.

Tab Orphans giữ state riêng, invalidation/TTL liên kết với parent Cleanup; quay lại category stale thì đọc lại. Dashboard CTA luôn yêu cầu lượt quét mới dù Smart Scan đã có kết quả; bấm menu giữ cache. Defer mount reads chống StrictMode duplicate; generation/mounted guards cho app/orphan. Màn ẩn có hidden/aria-hidden/inert, timer hết hạn kiểm tra lại active để tránh unmount màn vừa mở.

## Kiểm chứng

- Build TypeScript/Vite và native Mac debug bundle đạt; codesign deep/strict đạt.
- Cache clock regression 10 nhóm đạt: TTL boundary từ completion, pending, failed/cancelled, late response, invalidation, independent scopes và subscription cleanup. Geometry 18/18 đạt; backend native/Rust không đổi trong brief này.
- Runtime native: CTA tròn dưới metrics và một click scan; menu/back Smart Scan giữ lựa chọn bỏ chọn toàn bộ; CTA từ cached results bắt đầu scan mới. Lens giữ Documents/list/selection, background unselect, list name chọn/bỏ chọn, size/bar không đổi lựa chọn, double click vào Screenshots. Thin bar largest=100%, Adobe khoảng 16% chiều dài, parent % vẫn 86%/13,8%; 0 byte không có bar fill. Headers Lens/Uninstaller cùng title/icon/subtitle alignment. Detailed menu/back giữ Brew Cache; Apps giữ search CapCut và selection, vẫn 2,96 GB/4 mục.
- Không dọn dữ liệu user, không cấp FDA/admin, không commit/push/release. Chưa đo riêng RAM overhead bằng profiler; retention giữ metadata và DOM các màn đã mở, không giữ nội dung file, màn ẩn được giải phóng sau TTL. Việc giảm tổng RSS ngay sau unmount phụ thuộc garbage collector/WebKit.
- Smoke bản cuối sau inert/timer guard: Orphans quét xong, chọn 1 mục cache (không dọn), chuyển Danh mục rồi quay lại vẫn 234,39 KB/1 mục và không loading; native screenshot xác nhận. Đã quay lại dashboard sau QA. Một số snapshot AX của pane Orphans giữ lại không trả nội dung; screenshot và thao tác checkbox thật vẫn hoạt động, không ghi QA screen reader toàn diện là đạt.

## Điều phối CLI

Task mới spec08: lượt đầu conversation 66e4d968-27c3-4739-9934-a9377c8cb4b1 dừng vì shell inventory không cần thiết bị headless permission từ chối, chưa edits. Lượt sửa/phục hồi 1/3 conversation 0b63b741-b53e-488f-a905-74255575cb73 đã sửa UI; dừng trước checks/handoff vì gọi geometry command khác chuỗi allow được cấp. Codex review và chạy checks độc lập trong quyền workspace; không coi status SUCCESS của subprocess là nghiệm thu. Cả hai runner đã kết thúc, permission_recovery restored=true, 0 tham vấn; còn 2 vòng chưa dùng, không cần gọi lại. Bộ đếm spec07 giữ nguyên 3/3 đã hết.

Bàn giao tổng: [work log](../../_summary/work_log.md), Turn 8 đã đóng theo yêu cầu user ngày 2026-10-09.
