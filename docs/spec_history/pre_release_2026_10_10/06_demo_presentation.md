# Demo & Presentation Specification: VXClean (`_spec6_demo_presentation`)

> **Đối soát hiện hành — 2026-10-10:** [Truth engine và gaps](13_engine_behavior_truth.md) thay thế các mô tả implementation cũ mâu thuẫn bên dưới. [Dictionary toàn Dọn chi tiết](12_cleanup_dictionary.md) và [Quit/reopen](11_detailed_app_cleanup.md) là target **chưa nối engine/UI**. Scan mặc định giữ nguyên. Cleanup khác Uninstall; Movies/CapCut có thể xóa cả root khi chọn trong Uninstall, broad candidate mặc định bỏ chọn. Không coi thiết kế cũ hoặc mock preview là tính năng native đã nghiệm thu.


> **Tên sản phẩm:** VXClean
> **Thư mục dự án:** `cleaner_for_mac`
> **Mã tài liệu:** `_spec6_demo_presentation`
> **Phiên bản:** 1.0.0
> **Ngày cập nhật:** 2026-10-07
> **Phạm vi:** Kịch bản trình diễn tính năng (Demo Playbook), Kịch bản clickthrough mẫu, và Hướng dẫn thuyết trình cho Stakeholders & Người dùng.

---

## 1. Kịch bản Trình diễn 5 Màn (5-Act Demo Playbook)

Thời lượng tổng cộng ước tính: **3 - 5 phút**.

### Màn 1: Giới thiệu Hệ thống & Trực quan Telemetry (Thời lượng: 45 giây)
* **Mục tiêu:** Thể hiện sự mượt mà, chính xác và đồng bộ của giao diện theo phong cách VXUtilities Master Theme.
* **Thao tác thực hiện:**
  1. Mở ứng dụng VXClean.
  2. Chỉ vào 4 khối thông số phần cứng trên Dashboard: CPU (có sparkline lịch sử dao động), RAM (phân rã Active/Wired/Compressed), Ổ đĩa (phân biệt Used vs Purgeable), và Pin/Nguồn điện.
  3. Nhấn nút "Làm mới" trên thanh tiêu đề: Thấy nút bị khóa (disabled) trong 2 giây khi lấy mẫu Mach VM và sau đó số liệu cập nhật tức thời.
* **Lời thoại dẫn (Talking Points):**
  > "VXClean được xây dựng trên kiến trúc lai hiệu năng cao: Giao diện React Tailwind hiện đại siêu nhẹ kết hợp cùng Swift Native Engine đọc trực tiếp từ nhân Mach của macOS. Mọi chỉ số phần cứng bạn thấy ở đây hoàn toàn là dữ liệu thật từ máy, không có bất kỳ số liệu giả lập nào."

---

### Màn 2: Trải nghiệm Smart Scan & Sự Minh bạch An toàn (Thời lượng: 60 giây)
* **Mục tiêu:** Chứng minh tốc độ quét, phân loại rác thông minh và cam kết an toàn tuyệt đối.
* **Thao tác thực hiện:**
  1. Click tab **Smart Scan** ở Sidebar.
  2. Nhấn nút tròn **"QUÉT NHANH"** phát sáng Electric Cyan.
  3. Theo dõi vòng tròn tiến trình hiển thị thời gian thực các danh mục đang được quét: Bộ nhớ đệm, Nhật ký, DerivedData của Xcode, và Thùng rác.
  4. Khi danh sách kết quả hiện ra (ví dụ: phát hiện 14.8 GB), click mở xem chi tiết từng nhóm.
  5. Bấm nút "Dọn dẹp": Cửa sổ xác nhận an toàn bật lên, phân định rõ ràng các tệp xóa vĩnh viễn và tệp làm rỗng Thùng rác.
* **Lời thoại dẫn (Talking Points):**
  > "Khác với các phần mềm quảng cáo sai lệch rằng mọi thứ đều vào Thùng rác, VXClean công khai minh bạch 100% cơ chế xóa theo báo cáo đối soát an toàn. Người dùng luôn biết chính xác tệp nào bị xóa vĩnh viễn và tệp nào an toàn có thể khôi phục."

---

### Màn 3: Gỡ Ứng dụng Sạch & Bộ lọc Bảo vệ Hệ thống (Thời lượng: 45 giây)
* **Mục tiêu:** Thể hiện khả năng bóc tách tệp phụ thuộc và tính năng bảo vệ ứng dụng quan trọng.
* **Thao tác thực hiện:**
  1. Click tab **Gỡ App** (App Uninstaller).
  2. Tìm kiếm ứng dụng nặng (ví dụ: Docker Desktop) và mở cây phân rã: Thấy rõ file `.app`, kèm toàn bộ Container, Caches và Preferences nằm sâu trong `~/Library`.
  3. Cuộn đến ứng dụng hệ thống như **Safari**: Thấy icon ổ khóa và huy hiệu "Bảo vệ hệ thống (SIP Locked)", nút gỡ bị vô hiệu hóa hoàn toàn.
  4. Cuộn đến chính **VXClean**: Thấy nhãn "Ứng dụng tự thân (Protected)", ngăn chặn người dùng vô tình tự xóa công cụ.
* **Lời thoại dẫn (Talking Points):**
  > "Khi gỡ một ứng dụng, VXClean không chỉ xóa file .app mà gom sạch toàn bộ các tệp rác ẩn sâu trong Library. Đồng thời, bộ lọc bảo vệ hệ thống ngăn chặn tuyệt đối việc xóa nhầm các app cốt lõi của Apple hay làm hỏng hệ điều hành."

---

### Màn 4: Khám phá Dung lượng với Space Lens (Thời lượng: 45 giây)
* **Mục tiêu:** Trực quan hóa các thư mục chiếm dung lượng lớn và điều hướng drill-down mượt mà.
* **Thao tác thực hiện:**
  1. Click tab **Space Lens**.
  2. Chọn phạm vi quét thư mục Projects hoặc Downloads.
  3. Chuyển đổi giữa chế độ **Bubble Map** (Khối trực quan) và chế độ **Bảng phân cấp**.
  4. Click đúp vào một thư mục con nặng (ví dụ: `target/` hoặc `node_modules/`): Cây thư mục lập tức thu phóng vào trong, Breadcrumb phía trên cập nhật đường dẫn tương ứng.
* **Lời thoại dẫn (Talking Points):**
  > "Space Lens biến cấu trúc thư mục phức tạp thành bản đồ trực quan sống động. Bạn có thể dễ dàng đào sâu từng lớp để tìm ra đúng tệp nặng nhất đang chiếm dụng ổ cứng của mình."

---

### Màn 5: Vòng đời Cửa sổ Chuẩn macOS & Khay Menu Bar (Thời lượng: 45 giây)
* **Mục tiêu:** Khẳng định trải nghiệm native hoàn hảo của ứng dụng desktop macOS.
* **Thao tác thực hiện:**
  1. Bấm nút đỏ (X) trên cửa sổ chính: Cửa sổ đóng lại, icon trên thanh Dock biến mất tức thì, không gây vướng mắt.
  2. Di chuột lên thanh Menu Bar trên cùng của Mac: Click vào biểu tượng VXClean, một Popover nhỏ gọn mở ra với đầy đủ thông số mini CPU, RAM, Disk và nút Quét Nhanh 1-click.
  3. Nhấn "Mở VXClean Dashboard": Cửa sổ chính hiện lại ngay lập tức và icon xuất hiện lại trên Dock.
  4. Nhấn phím tắt `Cmd+Q`: Ứng dụng thoát hoàn toàn và đóng sạch tiến trình.
* **Lời thoại dẫn (Talking Points):**
  > "VXClean tuân thủ chuẩn mực vòng đời ứng dụng của Apple: Ẩn khỏi Dock khi đóng để giải phóng không gian làm việc, nhưng luôn sẵn sàng túc trực trên Menu Bar với mức tiêu thụ CPU gần như bằng 0. Khi cần mở lại, mọi thứ xuất hiện chỉ trong tích tắc."

---

## 2. Danh mục Chuẩn bị Cho Buổi Trình diễn (Pre-demo Checklist)

- [ ] **Môi trường:** Đảm bảo máy tính chạy macOS 13+ (Ventura trở lên), khuyến nghị Apple Silicon.
- [ ] **Quyền hạn:** Kiểm tra quyền Full Disk Access đã được cấp trong System Settings để có thể demo quét sâu toàn diện.
- [ ] **Dữ liệu mẫu:** Có sẵn một vài project có thư mục build hoặc cache để kết quả quét Smart Scan và Space Lens hiển thị dữ liệu sinh động.
- [ ] **Giao diện:** Đặt chế độ màn hình Dark Mode chuẩn của hệ điều hành để tôn vinh tối đa thiết kế Navy/Slate và Electric Cyan của VXUtilities Master Theme.
