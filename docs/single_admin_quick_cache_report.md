# VXClean 1.0.5 — admin một lần và Quick cache đang mở

## Vấn đề production

1.0.4 tới được native dọn nhưng native gọi AppleScript admin ngay tại từng mục gặp permission. MClean gốc gom các mục rồi chạy một lần cuối lượt. Quick trước đây áp lifecycle từ Detailed nên đóng Chrome/ChatGPT/Anti khi có rule yêu cầu. Screenshot cũng cho thấy lượt dọn ngắt do giới hạn payload4MiB.

## Thay đổi

- User-level dọn trước; các mục permission được gom và dùng một AppleScript admin cuối lượt. Script chỉ gồm target đã được cấp quyền, kiểm tra identity, parent canonical, symlink, cancellation và engine còn sống trước từng lần rm. Mỗi mục có kết quả/journal; Cancel không hỏi lại, không tự replay, không lưu password.
- Một cleanup dùng một native process/request có giới hạn64MiB, giữ toàn bộ proof. Giới hạn được kiểm tra trước mutation. Timeout mutation hữu hạn600giây để tránh kill giữa dialog/bulk; scan vẫn120giây.
- Ordinary Quick User Cache không requires_app_quit hoặc chặn chỉ vì app đang chạy. Guard dữ liệu/profile/runtime/content/identity vẫn giữ; cache thay đổi có thể skip hoặc được app sinh lại. Detailed Application Support/media/AI vẫn dùng lifecycle theo adapter.

## Kiểm chứng

28 nhóm native fixture PASS (7000 Chrome cache files7.451s);23 Rust tests PASS. Batch3 mục thiếu quyền dùng đúng1 invocation, Cancel giữ mục pending, ký tự quote/newline không chèn lệnh, identity swap không xóa replacement. AppKit fixture đang mở vẫn chạy sau Quick dọn; Detailed quit/cancel/rescan/reopen đạt. Payload trên5MiB qua host→native production dọn fixture thành công; hai proof2.3MB được giữ nguyên trong một request. Đây là fixture và runner xác thực mô phỏng, chưa là test người dùng nhập password trong dialog OS.

[Spec](spec/24_single_admin_pass_quick_live_cache.md) · [Evidence](single_admin_quick_cache_evidence.json). Không publish patch trong lượt này.

## Bản cài local

Đã build app/DMG1.0.5, codesign và updater signature/tamper rejection PASS; test>5MiB bằng engine trong gói PASS. Đã thay /Applications/VXClean.app, giữ1.0.4 tại /tmp/vxclean_pre_single_admin_1_0_4.app, mở lại bằng CUA và chạy Quick scan read-only qua GUI. Không dọn user data hoặc nhập mật khẩu OS trong lượt này.
