# Google cache ngoài kết quả dọn — 2026-10-27

## Kiểm tra chỉ đọc

Ảnh user: `~/Library/Caches/Google` phần giữ lại2.79GB. Khảo sát filesystem hiện tại, không đọc nội dung cache/profile và không dọn: Google chỉ có Chrome,4profiles (Default, Profile1/4/7). Dung lượng hiện tại khác ảnh do thời điểm/cache sống; không khẳng định breakdown hiện tại khớp chính xác2.79GB đã giữ lại trong ticket ảnh.

| Đường dẫn tương đối trong Google | Logical thập phân | Số file |
|---|---:|---:|
| `Chrome/Profile 1/Cache` | 1,227.08 MB | 29,828 |
| `Chrome/Default/Cache` | 1,197.71 MB | 22,554 |
| `Chrome/Profile 1/Code Cache` | 346.57 MB | 5,888 |
| `Chrome/Default/Code Cache` | 209.62 MB | 3,971 |
| `Chrome/Profile 7/Cache` | 50.02 MB | 395 |
| `Chrome/Profile 4/Cache` | 46.37 MB | 468 |
| `Chrome/Profile 4/Code Cache` | 17.48 MB | 339 |
| `Chrome/Profile 7/Code Cache` | 12.40 MB | 148 |

Tổng logical 3.107GB, allocated 3.239GB. Không phát hiện symlink/hardlink/special file trong các mục đã duyệt;0lỗi đọc. Không dùng allocated làm bảo đảm dung lượng giải phóng thật trên APFS.

## Dữ liệu là gì

- `Cache`: tài nguyên/response web được tải lại khi cần; dọn làm lần truy cập sau tải lại và có thể mất bản cache dùng khi offline.
- `Code Cache`: mã JavaScript/WebAssembly đã biên dịch/generate để tăng tốc; có thể tạo lại. Không phải source project hay runtime agent.
- `Profile 1/image_cache` và `Storage` hiện0bytes; không đủ cơ sở cấp quyền xóa một parent chỉ từ tên Storage, không cần dọn root Google để xử lý các Cache đã nhận diện.
- Dữ liệu profile gốc (history/bookmarks/cookies/credentials/session) theo default Chrome ở `~/Library/Application Support/Google/Chrome`, tách với nhánh đang khảo sát. Không đề xuất xóa root Application Support hoặc “clear all site data”. Không đọc DB/profile user trong lượt này.

## Vì sao VXClean giữ lại

Source `cleanup_policy.swift`: Quick nhận diện Google/Chrome là rebuildable, nhưng metadata vẫn đòi full snapshot ≤20.000entries,≤4giây và proof JSON≤3MiB trước bật cleanable. `maintenance_cli.swift` tách leaf từ mixed Google parent với budget20.000visited/4giây; Google remainder = size parent trừ các leaf được đưa vào kết quả, không phải một folder độc lập có tên “phần giữ lại”.

Cache Profile1 hiện29.828files, Default22.554files: bản thân mỗi Cache vượt cap20.000, proof ước lượng7.49/5.62MB cũng vượt3MiB (ước lượng Python JSON, không phải serialization Foundation đo trực tiếp). Các Code Cache nhỏ hơn, có thể được nhận riêng nếu bước tách còn thời gian. Nhánh chậm/large-tree bị coi chưa xác minh nên phần chưa đưa vào kết quả nằm remainder. Full snapshot còn có thể fail bởi path thay đổi/quyền/link hoặc deadline, nhưng khảo sát không thấy link/hardlink/special; không gán toàn bộ thiếu coverage cho dữ liệu quan trọng.

Kết luận: giới hạn engine có thể giữ lại cache đúng scope Quick. Không phải yêu cầu giữ cache cả đời để Chrome hoạt động. Thông báo chung về nguy hiểm profile/link chưa diễn đạt đúng trường hợp vượt budget; cần lỗi lý do có cấu trúc và giải pháp xử lý cache lớn, không chỉ nới giới hạn/tự xóa Google root.

## Hướng xử lý kỹ thuật để dọn được

Nhận diện đúng từng Chrome profile/cache root và xử lý file theo batch/stream, giữ root/path identity/no-follow, revalidation và per-file result; không cần nhét toàn bộ manifest lớn vào UI/ticket. Khi vượt cap phải báo rõ “quá nhiều tệp/chưa xử lý hết”, không gắn với profile quý giá. Nếu cần cold cleanup để kiểm chứng, đóng Chrome bình thường rồi dọn đúng cache con và mở lại; không force quit. Đây là phương án đề xuất, chưa sửa engine/claim đã dọn được trong lượt phân tích này.

## UI đã sửa

“Ngoài kết quả dọn” sort size_bytes giảm dần bằng bản sao mảng, không đổi ticket/selection/scope/reason. Frontend TypeScript/Vite build đạt; chưa đóng gói/cài/release nên app production chưa tự có thay đổi.

## Nguồn

- [Chromium user/cache directory](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/user_data_dir.md)
- [Chromium disk cache](https://www.chromium.org/developers/design-documents/network-stack/disk-cache/)
- [Generated code cache](https://chromium.googlesource.com/chromium/src/+/HEAD/content/browser/code_cache/generated_code_cache.h)

## Đã triển khai sau phân tích

Theo chỉ đạo user, đã sửa live cache lớn và journal, QA local23 cho Chrome3.13GB tick được và Google remainder0B. Xem [báo cáo](large_cache_cleanup_report.md) và [evidence](large_cache_cleanup_evidence.json). Phần “chưa sửa engine” ở trên là trạng thái lúc phân tích ban đầu, được thay bằng kết quả triển khai này; chưa dọn dữ liệu thật.
