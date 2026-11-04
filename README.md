# VXClean — Trình Dọn Dẹp & Quản Lý Hệ Thống macOS

[![Release](https://img.shields.io/github/v/release/linhbv94/VXClean?style=flat-square&color=06b6d4)](https://github.com/linhbv94/VXClean/releases/latest)
[![Platform](https://img.shields.io/badge/platform-macOS-0284c7?style=flat-square)](https://github.com/linhbv94/VXClean/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](LICENSE)
[![Ecosystem](https://img.shields.io/badge/part%20of-VXUtilities-0ea5e9?style=flat-square)](../_summary/master_overview.md)

**VXClean** là ứng dụng tiện ích quản trị, phân tích dung lượng và dọn dẹp hệ thống dành riêng cho macOS, được phát triển và tối ưu hóa dựa trên nền tảng mã nguồn mở [MClean](https://github.com/maclifevn/MClean). Ứng dụng cung cấp các công cụ trực quan giúp người dùng kiểm soát tài nguyên phần cứng, giải phóng dung lượng ổ đĩa và gỡ cài đặt ứng dụng triệt để.

> **Tôn chỉ:** *Kiểm soát phần cứng trực quan, dọn dẹp bộ nhớ đệm an toàn, minh bạch cơ chế xóa tệp.*  
> **Phiên bản hiện tại:** `v1.0.23` — Thành viên trong hệ sinh thái [VXUtilities](../_summary/master_overview.md).

---

## 1. Phạm Vi Tính Năng Cốt Lõi

* **Dọn dẹp hệ thống (System Cleanup):**
  Quét và loại bỏ bộ nhớ đệm (User/System Caches), nhật ký hệ thống (System Logs), tệp Xcode DerivedData, và các tệp tải về tạm thời.
* **Gỡ cài đặt ứng dụng (App Uninstaller & Orphan Finder):**
  Gỡ bỏ hoàn toàn ứng dụng kèm theo toàn bộ tệp tàn dư liên quan (Application Support, Caches, Preferences, Saved Application State). Tự động phát hiện các tệp mồ côi từ những ứng dụng đã bị xóa trước đó.
* **Bản đồ dung lượng trực quan (Space Lens):**
  Phân tích cấu trúc thư mục dạng đồ thị bong bóng (Bubble map), giúp định vị nhanh các thư mục và tập tin chiếm dụng nhiều dung lượng nhất trên ổ đĩa.
* **Theo dõi hệ thống thời gian thực (Menu Bar Monitor):**
  Hiển thị trực quan mức tải CPU (kèm đồ thị lịch sử 1 phút), trạng thái bộ nhớ chi tiết (Active Pages, Wired, Compressed), dung lượng khả dụng theo macOS (có thể bao gồm purgeable space), và tình trạng pin trong (Internal Battery).
* **Tự động cập nhật trực tiếp (Auto-Update):** Tích hợp thông báo cập nhật góc dưới màn hình, tải và cài đặt phiên bản mới chỉ với 1-click.

---

## 2. Tải xuống & Cài đặt

Tải bản phát hành mới nhất dành cho macOS tại [GitHub Releases](https://github.com/linhbv94/VXClean/releases/latest):

* **macOS (Apple Silicon & Intel):** Tải tệp `.dmg` hoặc `.app.tar.gz`. Kéo ứng dụng vào thư mục `/Applications`.

---

## 3. Hành Vi Cửa Sổ & Vòng Đời Nền (Window & Lifecycle Policy)

Nhằm tối ưu hóa trải nghiệm người dùng tiện ích thanh menu, VXClean áp dụng chính sách vòng đời ứng dụng linh hoạt:

1. **Chế độ chạy nền (Background Accessory Mode):**
   Khi tính năng **Menu Bar Monitor** được bật trong Cài đặt, việc đóng cửa sổ thông thường cuối cùng (gồm cửa sổ chính và Cài đặt) sẽ chuyển ứng dụng sang chế độ nền (`.accessory`). Ứng dụng sẽ ẩn khỏi Dock nhưng tiến trình vẫn tiếp tục duy trì để cập nhật các chỉ số trên thanh menu.
2. **Kích hoạt lại cửa sổ chính:**
   Người dùng có thể nhấp vào biểu tượng thanh menu và chọn **Open VXClean**, hoặc mở lại ứng dụng từ Finder/Launchpad để đưa ứng dụng trở lại chế độ cửa sổ thông thường (`.regular`).
3. **Mở Cài đặt từ nền:**
   Mục **Settings…** trong popover thanh menu hỗ trợ mở trực tiếp giao diện Cài đặt trên macOS 14+ thông qua cơ chế capture `openSettings` của SwiftUI, đồng thời duy trì selector tương thích cho macOS 13.

---

## 4. Cảnh Báo An Toàn Thao Tác Xóa Tệp (Safety Notice)

Khác với các tuyên bố trong tài liệu upstream ban đầu, **không phải mọi thao tác xóa tệp đều chuyển vào Thùng rác (Trash)**:
* **Xóa vĩnh viễn:** Các tác vụ dọn dẹp bộ nhớ đệm hệ thống, dọn tệp mồ côi và dọn dẹp tự động theo lịch sử dụng trực tiếp `FileManager.removeItem` hoặc quyền quản trị viên `/bin/rm -rf`. Dữ liệu này bị xóa vĩnh viễn và không thể khôi phục từ Thùng rác.
* **Chuyển vào Thùng rác:** Thao tác xóa thủ công trong phân hệ **Space Lens** sử dụng `FileManager.trashItem`, cho phép người dùng khôi phục tệp nếu cần.

Chi tiết đối soát mã nguồn được trình bày tại [docs/safety_audit.md](docs/safety_audit.md).

---

## 5. Hướng Dẫn Xây Dựng Từ Mã Nguồn (Build From Source)

### 1. Phân hệ Desktop (Tauri v2 + React)
```bash
cd desktop
npm install
npm run build
npm run tauri build -- --bundles app
```

### 2. Phân hệ Native SwiftUI
Yêu cầu macOS 13.0+, Xcode đầy đủ và [XcodeGen](https://github.com/yonaskolb/XcodeGen):
```bash
brew install xcodegen
xcodegen generate
open MClean.xcodeproj
```

---

## 6. Mục Lục Tài Liệu Kỹ Thuật (Docs Index)

Toàn bộ tài liệu kỹ thuật, báo cáo đối soát và hồ sơ chuyển giao được lưu trữ trong thư mục `docs/`:

* [docs/readme.md](docs/readme.md): Tổng quan và chỉ mục chi tiết toàn bộ tài liệu dự án.
* [docs/upstream_provenance.md](docs/upstream_provenance.md): Hồ sơ nguồn gốc mã nguồn upstream, remote URL và commit cơ sở.
* [docs/baseline_build_test.md](docs/baseline_build_test.md): Báo cáo hiện trạng công cụ biên dịch và kiểm thử tại thời điểm tiếp nhận.
* [docs/safety_audit.md](docs/safety_audit.md): Báo cáo đối soát chi tiết cơ chế xóa tệp trong mã nguồn.
* [docs/verification.md](docs/verification.md): Báo cáo kết quả kiểm chứng tự động mã nguồn và các giới hạn runtime.
* [docs/_vxclean_handoff.md](docs/_vxclean_handoff.md): Đặc tả phân tích và kế hoạch triển khai ban đầu.
* [docs/_vxclean_review.md](docs/_vxclean_review.md): Biên bản đánh giá phản biện kỹ thuật từ Codex.
* [docs/_vxclean_final_review.md](docs/_vxclean_final_review.md): Biên bản rà soát kỹ thuật và chỉ đạo sửa lỗi dứt điểm từ Codex.

---

## 7. Giấy Phép & Ghi Nhận Bản Quyền (License & Attribution)

Dự án được phân phối dưới giấy phép mã nguồn mở **MIT License**.  
Dựa trên mã nguồn gốc MClean.

Bản quyền © 2026 Viet Linh Bui  
Bản quyền © 2026 MClean Contributors  
Xem toàn văn giấy phép tại tệp [LICENSE](LICENSE).
