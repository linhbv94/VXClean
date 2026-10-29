# VXClean — Tích hợp native engine

Version: 1.2.0 — Ngày cập nhật: 2026-10-09

## Kết quả

Frontend desktop gọi engine thật cho metrics, scan, clean, apps, uninstall, orphans và Space Lens. Mock chỉ dùng trong browser preview; desktop không fallback sang dữ liệu giả khi engine lỗi. Capability lấy từ host và kiểm tra sự hiện diện của binary.

- [Swift DTO adapter](../desktop/native/maintenance_cli.swift) dùng Foundation/AppKit, dùng trực tiếp [ScanEngine](../MClean/Services/ScanEngine.swift), [CleaningCategory](../MClean/Models/Models.swift), giữ lại [SystemMonitor](../MClean/Services/SystemMonitor.swift), [SpaceLensEngine](../MClean/Services/SpaceLensEngine.swift) và [OrphanSafetyPolicy](../MClean/Logic/Utilities/OrphanSafetyPolicy.swift).
- [Rust maintenance bridge](../desktop/src_tauri/src/maintenance_bridge.rs) đăng ký lệnh trong [lib.rs](../desktop/src_tauri/src/lib.rs).
- [Frontend bridge](../desktop/src/services/tauri_bridge.ts) nghe tiến trình riêng theo operation ID, dọn listeners và hủy scan khi user dừng.
- [Build script](../desktop/src_tauri/build.rs) biên dịch Swift mỗi khi nguồn thay đổi, theo kiến trúc target Mac; tài nguyên đóng gói vẫn là `vxclean_engine`. Binary production không nhận biến môi trường đổi home của bộ kiểm thử.

## Ranh giới và chính sách thực thi

| Luồng | Chính sách |
|---|---|
| Scan/Clean | Dùng ScanEngine MClean gốc cho đủ 10 nhóm Smart Scan; giữ ngưỡng/exclusions và lựa chọn theo từng mục; ẩn nhóm rỗng. |
| Archives/Mail Downloads/large files/lịch sử AI | Chuyển vào Trash; giữ isSelected từ scanner gốc (large files/lịch sử AI không chọn sẵn). |
| Caches/Logs/DerivedData/Trash | Xóa trực tiếp sau xác nhận; chặn Xcode Junk khi Xcode đang chạy. Trash giữ lựa chọn mặc định của MClean. |
| Uninstall | Chuyển bundle và residual khớp chính xác bundle ID vào Trash; chặn Apple/system, VXClean và app đang chạy. |
| Admin fallback | Chỉ sau lỗi quyền của thao tác Trash và cờ xác nhận riêng; quote shell/AppleScript, kiểm tra PID và inode trước lệnh đặc quyền. Không tự nâng quyền. |
| Orphans | Chỉ là danh sách ứng viên, không chứng minh dữ liệu đã bỏ đi. Không chọn mặc định; Application Support/Preferences bị khóa xóa. Chính sách volatile của engine gốc quyết định mục nào có thể dọn. |
| Space Lens | Dùng scanner POSIX compact tính allocated bytes, dedup hardlink, không đi theo symlink; package không drill xuống. DTO chỉ chứa con trực tiếp, nhấp đúp quét lại thư mục con; mặc định home, picker native chọn root khác, progress/cancel và partial rõ ràng. Trash chỉ cho mục đã phân tích dưới home; khóa gốc scan, Library, Applications, dotpath nguy hiểm và app đang chạy. |

Host giữ kết quả quét tối đa 15 phút, đối chiếu chính xác path/method và device/inode trước thao tác. Swift đối chiếu lại định danh và đường dẫn; từ chối symlink, mục không thuộc phạm vi và xác nhận thiếu. Các lệnh thay đổi dữ liệu được tuần tự hóa. stdout/stderr được đọc đồng thời, có giới hạn output và timeout 120 giây; hủy/timeout kill rồi reap subprocess.

Quyết định mới theo user: scan dùng trực tiếp source MClean thay cho scanner phạm vi hẹp trước đó. Các nhóm: System Junk, User Cache, AI Apps, Mail Files, Trash Bins, Large & Old Files, Xcode Junk, Brew Cache, Node Cache, Docker Cache. Giữ quy tắc quét/tính size và lựa chọn mặc định của MClean, bao gồm Trash/Archives; purgeable không được coi là rác dọn được. Nhóm không có dữ liệu không hiện trong kết quả. Frontend dùng GB thập phân như MClean và chọn theo từng item, không kéo mục optional vào lựa chọn mặc định của cả nhóm.

Khác biệt có chủ đích ở thao tác dọn: Archives/Mail/large files/lịch sử AI chuyển Trash; Docker reclaimable chỉ thông tin, không xóa binary docker. Swift quét lại để xác thực path/method hiện tại, host kiểm tra snapshot/inode, từ chối symlink; các mục parent/child cùng phương thức chỉ xử lý parent một lần. Scanner nguồn vẫn có giới hạn 10.000 entries và khả năng chồng lấn category; tổng scan không chứng minh số byte duy nhất được giải phóng. CLI cache probes đọc nonblocking, giới hạn 1 MiB/5 giây để tránh treo scan. Uninstaller dùng bundle ID chính xác, đã bổ sung Containers/Application Scripts; dung lượng dùng FileSizeCalculator của MClean. Quét app trong thư mục con Applications tối đa 4 cấp, bỏ qua symlink/package và ẩn app Apple/system trước tính dung lượng.

Dung lượng xóa là ước tính theo kích thước tệp xử lý; không đảm bảo số free-space tăng tương ứng trên APFS có snapshots, clones hoặc file đang mở. Trash bytes được báo riêng, không cộng thành dung lượng đã giải phóng vĩnh viễn.

## Kiểm chứng đã thực hiện

- Frontend TypeScript/Vite build đạt; Rust library tests đạt **6/6**: exact grant/method, grant hết hạn, inode bị thay thế, lens denied/unknown, mục chỉ thông tin không cấp quyền xóa.
- [Native regression](../scripts/test_native_maintenance.py) đạt **9 nhóm** trên home giả trong thư mục tạm: vắng Xcode không hiện, group System Junk/User Cache/Node/AI/large và lựa chọn optional, symlink, thiếu xác nhận, path ngoài phạm vi, sai method/inode, xóa trực tiếp và bytes, package/lens, orphan policy, bundle residual và chặn Apple, uninstall, sai CLI.
- Test chạy trong sandbox xác nhận lỗi quyền Trash được trả rõ, giữ nguyên fixture. Test có quyền chạy native xác nhận chuyển **tệp và app fixture** vào Trash thật, `trashed_bytes > 0`, `permanently_freed_bytes = 0`; chỉ dọn lại đúng path trả về, đúng UUID và marker nội dung. Không dọn dữ liệu thật của user.
- CLI scanner mới chỉ đọc trên Mac Silicon: 1,52 giây; hiện 4 nhóm có dữ liệu (Large & Old Files, Node Cache, System Junk, User Cache), không có Xcode; tổng tại thời điểm test khoảng 2,76 GB, Trash thiếu quyền. Các con số thay đổi theo dữ liệu và cache sinh lại. Metrics/apps/orphans của lượt tích hợp trước đã kiểm chứng riêng.
- Build debug `.app` đạt, ký ad hoc và kiểm tra codesign deep/strict. Gói có Swift engine trong Resources.
- Native WKWebView ở lượt tích hợp ban đầu: telemetry thật, Smart Scan khoảng 4,2 GB, hủy quét quay về idle, Safari bị khóa checkbox/nút gỡ, Space Lens đọc Downloads thật và fixture 12 KB với package 8 KB + file 4 KB. Modal xác nhận Trash hiện đúng và Hủy giữ nguyên tệp. Orphans không chọn mặc định.
- `git diff --check` đạt. Không commit/push/release trong task này.

## Giới hạn còn lại

- Chưa thực hiện xóa dữ liệu thật, nhập mật khẩu quản trị, cấp/thu hồi FDA thật hoặc kiểm chứng admin fallback đặc quyền ngoài fixture. FDA hạn chế phải hiển thị cảnh báo thay vì báo quét đầy đủ.
- Windows/Intel GUI, sleep/wake, hiệu năng cây cực lớn, menu bar/Dock lifecycle và release signing/updater chưa nghiệm thu trong task nối engine này. `menu_bar_monitor` vẫn false; Windows native maintenance chưa hỗ trợ.
- Bộ nhận diện app quét các root Applications được cho phép và thư mục con tối đa 4 cấp; app ở vị trí tùy ý hoặc residual không khớp bundle ID chính xác có thể không xuất hiện.
- User đã giao Codex điều phối Anti CLI cho brief UI tại spec 07; Codex review, sửa tích hợp và QA native. Không sử dụng window Anti đang làm task khác.

## Kiểm tra lượt đổi scan

Native WKWebView của gói mới xác nhận System Junk/User Cache/Node Cache/Large & Old Files, không có Xcode rỗng; 5 tệp lớn/cũ đều bỏ chọn mặc định, mở chi tiết thấy từng đường dẫn và phương thức Trash. Kết quả khoảng 2,76 GB tại thời điểm thử; cảnh báo quyền Trash vẫn hiện. Không dọn dữ liệu thật của user.

Gói cuối sau bổ sung phát hiện lỗi đọc trong cây con: scan resource 1,40 giây; native UI khoảng 2,77 GB, vẫn 4 nhóm và không Xcode. Cảnh báo quyền hiện đủ Trash/System Junk/User Cache, không chỉ root Trash. Resource production không chứa VXCLEAN_TEST_HOME; codesign deep/strict đạt.

## Feedback UI/engine — cập nhật

Spec đã cập nhật trước triển khai: [07_ui_engine_feedback](spec/07_ui_engine_feedback.md). Detailed scan trả đủ 10 nhóm, kể cả nhóm rỗng. Lens mặc định home có progress/cancel, picker native, nút FDA, partial và can_trash; root ngoài-home chỉ xem, root/system bị từ chối. Ticket riêng mỗi scan. Scanner POSIX compact Lens: 16,38 giây trên home, 38 con trực tiếp, khoảng 50 GB đọc được, partial=true; scanner Foundation ban đầu vượt125giây. Allocated bytes = st_blocks ×512, dedup hardlink, không theo symlink. Đã QA native sau review Anti; kết quả bên dưới.


## Nghiệm thu feedback UI/engine ngày 2026-10-09

- Sidebar đúng 5 mục: Tổng quan → Quét nhanh → Space Lens → Gỡ ứng dụng → Dọn rác chi tiết. Dashboard một click chuyển màn và bắt đầu quét; auto-start được sửa để không bị React cleanup hủy timer.
- Kết quả có dữ liệu theo System Junk → User Cache → Large & Old → Node → Brew; detailed scan đủ 10 nhóm kể cả rỗng, Orphans là tab bên trong. Large/AI history giữ lựa chọn mặc định gốc, có thể chọn chủ động.
- Uninstaller ẩn app SIP/system, danh sách gọn sort tên/dung lượng hai chiều. QA CapCut trên máy thật: 2,96 GB, đủ bundle/cache/container 864,26 KB/application scripts, khớp ảnh user. App Adobe trong thư mục con đã hiện; native fixture xác minh uninstall nested bundle và bốn loại residual chính xác, không lấy bundle ID lân cận.
- Theme System/Light/Dark ở Settings, bỏ toggle headbar, lưu lựa chọn và theo matchMedia khi System. Codex bổ sung palette Light cho Uninstaller/Orphans.
- Lens circle/list, single click xem thông tin/double click quét vào thư mục, mặc định home. QA home 66,85 GB/38 con với partial=true, Documents/Screenshots drill thật, Cancel dừng quét, /System bị từ chối và xóa panel/grant cũ. Root /Applications 49,49 GB/44 con chỉ đọc. Picker RFD có parent cửa sổ app, Cancel giữ root cũ; chọn Applications bắt đầu quét thật. Nút FDA mở đúng trang macOS, không đổi quyền (VXClean vẫn off).
- Geometry 18/18 (3 viewport, bounds/no overlap/area ratio/zero/determinism), Rust 6/6, native regression 9 nhóm với fixture riêng và Trash thật đạt. Không dọn dữ liệu user. Build frontend/native app và codesign deep/strict được kiểm tra.
- Anti: lượt đầu + 3/3 vòng sửa/review, 0 tham vấn, runner đã kết thúc và khôi phục grants. Codex sửa độc lập sau review: auto-start/cancel/stale state, POSIX Lens, RFD picker, exact can_trash, app coverage/size và native fixture. Không còn vòng CLI tự động.

Gói debug cuối build/codesign deep/strict đạt; SHA-256 resource khớp native source binary, không có test-home override. Native UI bản cuối xác nhận CapCut Light 4 mục/2,96 GB và Screenshots item_count=105; theme System được lưu qua restart, đặt lại System và để dashboard sau QA.

## Giữ kết quả quét và polish UI

[Spec 08](spec/08_scan_retention_ui_polish.md) và [handoff](anti_ui_polish_handoff.md): frontend giữ state session 5 phút từ read thành công, lazy mount, unmount màn ẩn hết hạn; pending job không nhân đôi khi đổi menu. Dọn/gỡ/Trash invalidate cache trước/sau; không kéo dài grants 15 phút hoặc bỏ guards native. Backend không đổi. Header chung, CTA dashboard tròn, Lens toolbar riêng và toggle/bar mới đã QA native; cache clock 10 nhóm, geometry 18/18, frontend/native build/codesign đạt. Không lưu dữ liệu cache ra đĩa hoặc giữ nội dung file; chưa đo riêng RAM overhead.
