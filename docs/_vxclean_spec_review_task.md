# Nhiệm Vụ Tham Vấn & Review Bộ Đặc Tả VXClean

> **Chỉ tham vấn/review chỉ đọc; không sửa nguồn; không gọi agent khác.**

---

## 1. Bối cảnh
Anti đã khởi tạo và hoàn thiện trọn bộ tài liệu đặc tả chuẩn mực cho dự án **VXClean** (`cleaner_for_mac`) tại thư mục `docs/spec/`:
- `docs/spec/00_system_overview.md`: Tổng quan hệ thống, kiến trúc 3 tầng (React Tailwind ↔ Rust Bridge ↔ Swift CLI `vxclean_engine`), ma trận độ khó.
- `docs/spec/01_business_process.md`: Sơ đồ Swimlane 5 chủ thể, ma trận quyết định xóa tệp minh bạch (Xóa trực tiếp `removeItem`/admin vs Chuyển vào `Trash` theo `safety_audit.md`), ma trận quyền FDA.
- `docs/spec/02_feature_flow.md`: State Machine toàn cục, flow Smart Scan, App Uninstaller (bảo vệ SIP/app tự thân), Space Lens đệ quy, vòng đời cửa sổ (đóng ẩn Dock, giữ Menu Bar, mở lại khôi phục).
- `docs/spec/03_ui_wireframe.md`: Wireframe chi tiết 7 màn hình theo chuẩn Dark Navy/Slate (`#0f1117`), Electric Cyan (`#06b6d4`), Compact Density; kiến trúc reusable component thích ứng Windows; context menu chuột phải cho Breadcrumb.
- `docs/spec/04_api_data.md`: Khế ước IPC Tauri 2 (`invoke`) và JSON contract v1.0 giữa Frontend và Native Engine CLI (`CapabilitiesResponse`, `SystemSnapshotResponse`, `ScanResponse`, `CleanPayload`, `AppsListResponse`, `SpaceLensNode`).
- `docs/spec/05_qa_acceptance.md`: Tiêu chuẩn nghiệm thu Gherkin và ma trận 7 edge cases.
- `docs/spec/06_demo_presentation.md`: Kịch bản trình diễn 5 màn.
- `docs/wireframes/readme.md`: Chỉ mục wireframe và ma trận phân định trạng thái nối engine.

---

## 2. Câu hỏi Trọng tâm Cần Codex Phản Biện & Đánh Giá

1. **Tính sẵn sàng để dựng UI:** Bộ đặc tả này đã đủ chi tiết, rõ ràng và nhất quán để Anti tiến hành dựng toàn bộ UI shell, components, tabs (Smart Scan, Cleaner, Uninstaller, Space Lens, Settings) với Mock Data / DTO Contracts chưa?
2. **Khế ước IPC & Giao tiếp Swift Engine:** Định nghĩa các DTO và JSON Contract v1.0 trong `04_api_data.md` (`metrics`, `scan`, `clean`, `apps`, `lens`) có điểm nào bất cập, thiếu trường dữ liệu, hoặc khó khăn khi Codex sau này nối các Services gốc của Swift (`SystemMonitor`, `ScanEngine`, `CleaningEngine`, `SpaceLensEngine`) vào `vxclean_engine` không?
3. **An toàn & Rủi ro Vận hành:** Các ràng buộc an toàn xóa tệp (theo `safety_audit.md`) và luồng vòng đời cửa sổ (ẩn Dock chuyển sang `.accessory`, hiện lại chuyển `.regular`) trên macOS đã được mô tả chặt chẽ chưa?
4. **Khuyến nghị trước khi code:** Những lưu ý hoặc khuyến nghị cụ thể nào mà Anti cần chú ý trong quá trình code UI để bàn giao lại cho Codex mượt mà nhất?

---

*Yêu cầu báo cáo: Trả về nhận xét súc tích, khách quan, chỉ rõ điểm mạnh, điểm cần lưu ý và kết luận YES/NO xem bộ spec đã sẵn sàng triển khai UI chưa. Tuân thủ AGENTS.md: Tiếng Việt chuyên nghiệp, không LaTeX.*
