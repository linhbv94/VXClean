# Audit rule System Junk — 2026-10-11

Phạm vi: **System Junk trong Quét nhanh**. Không suy luận rule giống nhau từ tổng GB. Không áp dụng kết luận này cho User Cache hoặc Dọn rác chi tiết.

## Nguồn đối chiếu

Scanner MClean gốc được lấy trực tiếp từ commit `42cf1f8`, file `MClean/Services/ScanEngine.swift`. Đây là source nhập vào repo; chưa chứng minh binary MClean đang cài được build đúng từ commit này.

## Đối chiếu từng tầng

| Tầng | Rule MClean gốc / kết quả VXClean hiện tại |
| :--- | :--- |
| Vùng quét | `/Library/Caches`, `/Library/Logs`, `/private/var/log`, `~/Library/Logs`, `/tmp`, `/private/var/tmp`; cùng 6 vùng |
| Đơn vị kết quả | Mục trực tiếp trong mỗi vùng; thư mục được tính dung lượng đệ quy. Tham số maxDepth của source gốc không giới hạn phép tính này |
| Ngưỡng xuất hiện | Dung lượng lớn hơn 1.024 byte; cùng ngưỡng kỹ thuật, giao diện dùng đơn vị thập phân |
| Tính dung lượng | Bỏ qua mục ẩn trong phép tính, cộng regular files, dừng sau 10.000 entry mỗi thư mục như gốc. Trước audit VX đã nâng thành 200.000; đã trả System Junk về 10.000 |
| Symlink | Không chọn mục symlink cấp đầu; không mở rộng root qua symlink. Đây là giới hạn đường dẫn, không phải bộ lọc tên cache |
| Tên, loại, tuổi dữ liệu | Quick System không lọc profile/project/ShipIt, database/credential/lock/IPC, executable/library, môi trường build hoặc tuổi 24 giờ |
| Nội dung con | Không tách thư mục System thành phần được dọn và phần được giữ; không xét rule từng file con |
| Hardlink | Không loại mục System vì hardlink. Xóa liên kết được chọn, không xóa liên kết khác nằm ngoài vùng quét |
| Xcode đang chạy | Không dùng tên đường dẫn Xcode để chặn System Junk |
| Chứng thực kết quả | System chỉ lưu metadata/identity của mục gốc. Không duyệt toàn cây để cấp quyền tick, nên số file con không còn bị giới hạn manifest 20.000 entry/4 giây/3 MB |
| Mặc định tick | Mục System hợp lệ được chọn mặc định; không có bộ lọc nội dung riêng ở frontend hoặc host |
| Dọn | Quét lại phạm vi, kiểm tra identity mục gốc, xóa toàn mục bằng removeItem; thiếu quyền thì gọi xác thực quản trị macOS |
| Dung lượng đã dọn | Dùng size từ lần quét lại như nguồn MClean; đây là dung lượng ước tính, không phải đo số block thực sự giải phóng |

**Giới hạn kế thừa cần biết:** hidden files và phần vượt ngưỡng 10.000 entry không được cộng đầy đủ nhưng vẫn nằm trong thư mục bị xóa. Vì vậy số byte hiển thị có thể thấp hơn nội dung thực tế. Không được diễn giải số GB thành danh sách từng file được phép xóa.

## Những chỗ lệch âm thầm đã sửa

1. Giới hạn manifest toàn cây 20.000 entry/4 giây và proof 3 MB có thể làm một thư mục đã được scanner tìm thấy không tick/dọn được. System Quick chuyển sang proof mục gốc ở cả Swift lẫn Rust.
2. Chặn Xcode theo tên đường dẫn ở tầng thực thi vẫn có thể áp vào thư mục tạm; đã miễn System Junk.
3. Giới hạn tính dung lượng System bị nâng từ 10.000 lên 200.000; đã phục hồi ngưỡng source gốc.
4. Các guard nội dung/tên/tuổi/hardlink còn tồn tại cho scope khác nhưng Quick System trả rule MClean trước khi đi vào chúng.

## Khác biệt vận hành còn tồn tại — không che giấu

VXClean vẫn có protocol/scope hợp lệ, kết quả cấp quyền 15 phút, tối đa 10.000 target một request, giới hạn payload 4 MB và output engine 32 MB, tối đa 32 grant lưu trước khi reset, timeout tiến trình host 120 giây, hủy thao tác, kiểm tra đường dẫn/identity và không xóa executable host đang chạy. Batching xử lý payload lớn; lỗi quyền/identity/timeout vẫn có thể khiến thao tác thất bại và phải báo thật. Đây là các điểm kiểm soát thực thi khác MClean, không phải loại cache âm thầm theo tên.

Root-only proof **không chứng minh nội dung từng file con không đổi** giữa scan và delete. Nó kiểm tra mục gốc, không loại bỏ mọi race. Một thư mục tạm chứa dữ liệu duy nhất vẫn có thể mất dữ liệu khi dọn theo rule MClean. Không tuyên bố “mọi thứ trong temp đều tự sinh lại”.

## Kiểm chứng độc lập

Test biên dịch nguyên scanner từ commit `42cf1f8` thành binary tham chiếu riêng, chỉ thay home/root bằng fixture. Không lấy scanner VX hiện tại làm oracle. So sánh **đúng map đường dẫn → byte** và default selection trên cùng fixture, gồm thư mục hơn 20.000 entry, profile copy, lock, IPC, executable, Xcode giả và hardlink.

Kết quả: parity exact path/size/default selection PASS; toàn bộ target Quick được quảng cáo trên fixture được dọn, tổng byte khớp, quét lại về 0; hardlink và dữ liệu gốc ngoài scope còn nguyên. Toàn bộ suite native: **26 nhóm PASS**. Đây là bằng chứng trên fixture, không phải chứng minh mọi cấu hình máy tương lai.

Xác thực quản trị thực trên file người dùng và xử lý cancel ở popup OS chưa được chạy. Downloads chưa được user cấp quyền; không coi kết quả Large Files partial là quét thành công đầy đủ.

Bằng chứng đóng gói và kiểm thử: [system_junk_clone_evidence.json](system_junk_clone_evidence.json), [local_artifact_evidence.json](local_artifact_evidence.json). Spec hiện hành: [21_quick_scan_clean_parity.md](spec/21_quick_scan_clean_parity.md).

## Snapshot bản đóng gói cuối

Quét chỉ đọc mất 9,182 giây: System Junk 110 mục / 1.201.416.876 byte, 0 mục bị disable và 0 byte System bị chuyển sang excluded. 11 mục ngoài kết quả hiện tại đều thuộc User Cache; không phải System Junk. Giao diện xác nhận 110/110 System, 179/179 User Cache, tổng chọn 2,39 GB; bật/tắt group và mở/hủy xác nhận PASS. Không xóa dữ liệu thật. Các số trên chỉ là snapshot runtime, bằng chứng parity rule là test scanner độc lập đã mô tả ở trên.
