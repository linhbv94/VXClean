# QA độc lập VXClean 1.0.18
Ngày: 2026-10-13. Phạm vi: luồng Full Disk Access từ bản public1.0.16; lượt đã được user xác nhận đóng ngày2026-10-13.

## Review
- Đối chiếu spec25, broker frontend, worker Rust và các điểm gọi Quick/Detail/uninstaller/orphan/Lens. Probe chỉ mở read-only rồi đóng; không đọc hoặc sửa TCC database. Timeout4s, trạng thái không xác minh không được coi là granted.
- FDA không thay native mutation policy/grant/journal/admin. Internal rescan sau đóng app dùng chế độ không tương tác, tránh treo lifecycle chờ modal.
- Pending scan dùng dialog chung, cancellation được kiểm tra trước/sau probe/resume; focus/recheck không phát lại scan đã hoàn tất.

## Kết quả mới
- Frontend build PASS; 48 Rust tests PASS.
- Broker FDA11 nhóm +typed deferral PASS; 7 release guards PASS; history/cache/retention10/selection5/circle18 PASS; git diff --check PASS.
- Native /Applications/VXClean.app About1.0.18, strict/deep signature PASS khi chạy với keychain thật; designated requirement ràng buộc certificate hiện có.
- Settings xác nhận quyền đọc từ worker của app, Kiểm tra lại vẫn confirmed. Quick scan chỉ đọc hoàn tất,2.45GB; System Junk partial hiển thị thật, Large Files mặc định bỏ chọn. Không quan sát prompt quyền từng container trong lượt này. Không dọn dữ liệu thật.
- 35 nhóm native fixtures và9 manager fixtures PASS; fixture7000 tệp/journal16.672s. CI hai kiến trúc, signed release packages/public endpoints chưa thực hiện.

## Ranh giới
- Đây là QA native Apple Silicon; chưa Intel GUI, Windows hoặc auto-update download/install/restart. FDA17→18 theo log và panel18 hiện confirmed, chưa chứng minh qua updater public.
- Public CI hiện ad-hoc khác signer local. User đã cho phép lưu signer local hiện có vào Secrets; đã lưu hai Secrets và chuẩn bị isolated keychain/config overlay/strict identity check/cleanup ở CI. Chưa publish, còn chờ CI/package verification.

## Version phát hành

Dùng1.0.19 để cao hơn bản local18 đã cài; chỉ đổi metadata version, không thay code ứng dụng sau QA. Native public19 và updater18→19 phải kiểm chứng riêng.

- Release19 chưa publish: đã sửa Secret PKCS12 thành định dạng Apple import đã kiểm chứng; bước user trust trên hosted runner chờ authorization. Release20 dùng sudo noninteractive/trust admin chỉ codeSign trên runner dùng một lần, timeout30s/command và cleanup. App code không đổi; tag19 giữ bất biến.

## Kết quả phát hành và updater cuối — 1.0.21

- Stable/latest [VXClean1.0.21](https://github.com/linhbv94/Cleaner_for_Mac/releases/tag/v1.0.21), releaseID411278260, tag0a546733382cd6de4337de0611e7f4b583c41719. Main CI38347273153, release38347277964 (haiMac+validate), publish38350780914 đều success.
- Năm assets publicHTTP200 không token. Hai updater archive chữ ký thật đạt, sửa byte bị từ chối; layout/URL/version/GitHub SHA256+size đạt. Hai package strict/deep codesign, certificate binding khớp signer local18, metadata/architecture/main+Swift engine/icon đạt; hai DMG checksum và app đối chiếu updater app đạt.
- Updater native trên /Applications/VXClean.app: local18 phát hiện21 → download/install → restart → About21. File main/engine/icon app đã cài khớp package public; strict signature và certificate binding đạt. Settings worker báo access_confirmed mà không thêm/bật lại FDA. Quick scan chỉ đọc sau update hoàn tất2.63GB, partial hiển thị đúng, Large Files không chọn mặc định; không quan sát prompt từng app, không dọn dữ liệu user.
- Intel có native CI/package checks; chưa Intel GUI/FDA updaterE2E. Windows không phát hành. E2E này chứng minh trên máy Apple Silicon hiện tại, không bảo đảm OS/MDM không thu hồi quyền về sau.
- Bản19/20 không publish, tag bất biến. Lỗi đã khắc phục: PKCS12 legacy để Apple import; noninteractive admin CodeSign trust trên runner disposable; bounded trust-removal timeout không ngăn xóa private keychain/search-list restore. Public certificate trust còn lại trên runner chỉ tồn tại đến khi VM bị GitHub hủy. Không đổi trust/quyền máy user trong release lượt này.
- [Evidence](release_1_0_21_evidence.json). User xác nhận đóng lượt ngày2026-10-13; TrackA tiếp theo build VXClean Windows, TrackB QA/test/release VXmp3 Mac độc lập.
