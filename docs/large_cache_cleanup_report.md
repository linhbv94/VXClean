# Dọn live cache lớn và wording sản phẩm — 2026-10-27

## Thay đổi

- User yêu cầu cache tái tạo được phải dọn được, không bị bỏ qua vì manifest lớn. Scan/host ticket của Quick live_cache_root dùng root identity. Native kiểm chứng toàn cây bằng iterator, không giữ full manifest; trước khi xóa kiểm chứng lại rule/no-follow/no-hardlink/quyền ghi rồi xử lý batch512regular files. Mỗi batch đối soát root device/inode, mỗi file vẫn fd-relative identity check, isolate/unlink và journal. Không dùng rm parent, không nới nhánh cleanup khác.
- Bỏ phụ thuộc20.000entries/3MiB manifest đối với live cache đã nhận diện; giới hạn chống dữ liệu lỗi của nhánh khác giữ nguyên. Native journal giữ200success mẫu trong RAM/result, không bỏ uncertain/error; full per-file intent/outcome vẫn durable. Journal128MiB/read tổng256MiB bảo đảm scale case hiện tại; không claim vô hạn dung lượng/thời gian.
- History reducer không coi tổng số file thành công là cap20.000recovery targets; success mẫu200, evidence đầy đủ được archive. Ngoài kết quả dọn đã sort size giảm dần.
- Không còn wording MClean trong frontend React hoặc mô tả trả về từ CleanupPolicy. Giữ machine rule IDs lịch sử, source paths upstream và license/attribution; không đổi tên ứng dụng MClean thật nếu inventory của user có app đó.

## Kiểm chứng

-51Rust tests đạt, gồm large event stream/recovery/archive/reread; fixture native36nhóm đạt, gồm25.001file scan chọn được/dọn hết, profile marker giữ nguyên và edgecases link/hardlink/protected child/live content changes.
- Stress60.001file: scan_selectable, clean_success,0file cache còn lại; profile marker giữ nguyên; events33.273.165bytes, state200targets,166.065giây scan+clean. Chỉ synthetic home, không dọn dữ liệu user. Stress alias temp ban đầu bị policy path canonical từ chối; đã đặt synthetic home đúng workspace như fixture chuẩn, không nới policy để test qua.
- Frontend build, FDA broker/history JS và7release automation tests đạt. Không có public release trong task này. Đã cài QA local23, codesign deep/strict/certificate-bound và updater signature/tamper đạt. UI Quick: Chrome3.13GB tick được, User Cache4.09GB, Google excluded0B, toàn excluded36.19MB và16rows giảm dần. Không bấm dọn dữ liệu thật. Backup22 giữ trong target/local_backups/vxclean_before_1_0_23.app.

## Giới hạn

Không coi fixture dọn thành công là đã dọn Chrome của user. File mới sinh/identity thay đổi trong lúc dọn vẫn có thể giữ lại hoặc partial; đây là trạng thái cần báo thật. Chưa Windows engine/runtime hoặc Intel/OS cũ QA. Mac signing identity giữ ổn định, không upload key/đổi trust. Rà độc lập mutation/recovery trước release theo quy chuẩn chung.

## Keychain khi build

Gói QA lần đầu lỗi ký vì keychain VXClean đang khóa (`errSecInternalComponent`); mở lại keychain riêng bằng cơ chế đã cấp trước đó rồi build lại đạt. Không đổi trust/signing identity/FDA, không upload key. Hộp “codesign wants to access key…” thuộc bước build ký app, khác hộp xác thực admin khi dọn hoặc FDA; không yêu cầu user nhập mật khẩu máy vào keychain riêng chưa rõ. App phát hành không cần private key ký trên máy end user.
