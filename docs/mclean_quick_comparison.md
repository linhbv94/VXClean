> Cập nhật theo yêu cầu cuối: các khác biệt System Junk 76 MB bên dưới là lịch sử trước sửa. Rule hiện tại dùng toàn phạm vi MClean, không còn lọc profile-copy/IPC/hardlink/tuổi/extension. Xem [evidence hiện tại](system_junk_clone_evidence.json). Profile Chrome gốc ở ~/Library/Application Support/Google/Chrome vẫn ngoài roots.

# MClean và VXClean — đối chiếu System Junk

Ngày2026-10-11. Đã bấm Scan Again trong MClean user mở; category System Junk cập nhật100items/1,2GB. Dashboard tổng vẫn đang scanning ở thời điểm quan sát; không gọi là toàn scan đã hoàn tất. Không click Clean hoặc dọn data thật.

VXClean snapshot:1.123.836.764B eligible+76.029.711B excluded=1.199.866.475B, hiển thị thập phân khoảng1,20GB. Không chuyển category; khác thời điểm scan có thể chênh byte nhỏ.

| Phần chưa dọn | MB thập phân | Lý do thực |
|---|---:|---|
| boost_interprocess |29,47|Guard IPC/shared memory, chưa chứng minh còn live hay bỏ đi|
| Chrome QA profile copies |28,57|Cookies/Bookmarks/Sessions/LocalState backup. Không symlink/hardlink/special file; bị profile guard, không phải thiết yếu cho app đã cài|
| Logs/cache thiếu quyền ghi |15,40|Parent không writable; FullDiskAccess không phải admin|
| Object build hardlink |1,95|Snapshot guard nlink>1; không có nghĩa object không tạo lại được|
| Các guard còn lại |0,64|Diagnostic/lock/protected child và mục nhỏ khác|

Thông báo generic “không xác minh/symlink/hardlink” không đủ phân biệt các nguyên nhân. Với Chrome QA, nguyên nhân đã xác minh là protected profile children; cần cải thiện lý do UI, không quy thành lỗi symlink.

Toàn VXClean dùng KB/MB/GB/TB hệ1000, có shared formatter main UI, menu panel cùng output. Dashboard và menu panel trước đây dùng1024 nhưng ghi nhãnGB; đã sửa. Rawbytes/allocated-vs-logical và giới hạn kỹ thuật không đổi. [Evidence](mclean_system_scan_evidence.json), [ảnh MClean](mclean_system_junk_comparison.png).
