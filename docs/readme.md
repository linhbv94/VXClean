# Thư Mục Tài Liệu Kỹ Thuật VXClean (Documentation Index)

**Phát hành hiện tại:** đọc [hướng dẫn release](desktop_release.md) và [QA1.0.23](release_1_0_23_review.md). Các mục spike/handoff phía dưới có thể là thông tin lịch sử.

Thư mục này tập trung toàn bộ tài liệu đặc tả, báo cáo kiểm định kỹ thuật, hồ sơ nguồn gốc mã nguồn và lịch sử quy trình phối hợp phát triển dự án **VXClean**.

Scope mới nhất: [Quick ba nhóm và Dọn chi tiết từng nhóm/toàn bộ lựa chọn](spec/14_quick_detailed_scope.md). Đã triển khai Quick3groups và một phần policy/Detail/tray; trạng thái thực và nhánh blocked ở [implementation local](spec/17_local_implementation_status.md). Implementation hiện tại: [truth engine](spec/13_engine_behavior_truth.md). Bằng chứng review: [audit engine](engine_scope_audit_2026_10_10.md) và [fixture rà Quick](quick_scope_recheck_evidence.json). Đọc scope mới trước khi dùng các yêu cầu “giữ nguyên Quick” trong tài liệu/lịch sử cũ.

Contract chuẩn bị release: [policy backend](spec/15_cleanup_protection_policy.md), [JSON bảo vệ](cleanup_protection_contract.json), [menubar/Dock/head bar](spec/16_menubar_release_ui.md), [handoff triển khai](release_preparation_handoff.md). Spec 00–06 đã thay API/defaults/QA/demo cũ mâu thuẫn, giữ nguyên văn bản trước ở [spec history](spec_history/readme.md). Policy/tray local đã có source; build/runtime evidence ở [báo cáo local](local_completion_report.md), còn blockers được ghi rõ. Chưa publish.

---

## 1. Quy Trình Vận Hành & Phối Hợp Đa Agent (Dual-Agent Workflow)

Dự án được triển khai theo quy trình phối hợp khép kín giữa hai tác nhân AI trên nền tảng Antigravity CLI và Codex:
* **Codex (Planning & Review):** Phân tích kiến trúc từ First Principles, bóc tách vấn đề, thiết lập phạm vi nhiệm vụ (`task_01`, `task_02`, `task_03`) và thực hiện đánh giá phản biện độc lập (Stress-testing / Code Review) sau mỗi đợt triển khai. Với các tác vụ ngắn hoặc vi mô, Codex có thể trực tiếp xử lý nhanh.
* **Antigravity (Execution Engine):** Nhận đặc tả và nhiệm vụ đã chốt từ Codex, trực tiếp thực thi thao tác sửa đổi tệp tin mã nguồn, batch script chuyển đổi thương hiệu, đồng bộ hóa localization đa ngôn ngữ, và xây dựng kịch bản kiểm chứng tự động.
* **Nguyên tắc an toàn:** Giao tiếp đơn hướng (depth = 1), tuyệt đối không đệ quy CLI lồng nhau, mọi bằng chứng kiểm thử dựa trên mã nguồn sản xuất thực tế.

---

## 2. Danh Mục Tài Liệu Kỹ Thuật

| Tài liệu | Mô tả nội dung | Liên kết |
| :--- | :--- | :--- |
| **Nguồn gốc Upstream** | Ghi nhận xuất xứ repository gốc, remote URL, commit hash cơ sở và trạng thái xác minh. | [upstream_provenance.md](upstream_provenance.md) |
| **Baseline Build & Test** | Báo cáo hiện trạng công cụ phát triển (CLT vs Xcode) và kết quả thử nghiệm biên dịch ban đầu. | [baseline_build_test.md](baseline_build_test.md) |
| **Đối soát An toàn Xóa tệp** | Phân tích chi tiết bằng chứng mã nguồn về cơ chế xóa tệp (`removeItem`, `rm -rf`, `trashItem`). | [safety_audit.md](safety_audit.md) |
| **Báo cáo Kiểm chứng Mã nguồn** | Báo cáo chi tiết kết quả chạy kiểm tra tự động cú pháp, kiểu dữ liệu, scheme và giới hạn runtime. | [verification.md](verification.md) |

---

> [!NOTE]
> **Hiện trạng bản dựng & Kiểm thử:**
> Tệp `dist/MClean.app` vẫn là binary upstream. Đã tạo debug `VXClean.app` từ bản thử Tauri trong `desktop/src_tauri/target/debug/bundle/macos/` và kiểm chứng GUI dashboard/refresh đọc dữ liệu Swift thật. Chưa có bản native SwiftUI mới; `xcodebuild`, `XCTest`, FDA, các chức năng dọn dẹp và menu bar/Dock của bản Tauri chưa được kiểm chứng runtime.

---

## 3. Hồ Sơ Đặc Tả Nhiệm Vụ (Task Specifications)

Các tài liệu lưu trữ quá trình phân tích và bàn giao nhiệm vụ:
* [_vxclean_handoff.md](_vxclean_handoff.md): Kế hoạch chuyển đổi tổng thể từ MClean sang VXClean.
* [_vxclean_review.md](_vxclean_review.md): Biên bản đánh giá phản biện kỹ thuật của Codex đối với giai đoạn 1.
* [_vxclean_task_02.md](_vxclean_task_02.md): Đặc tả chi tiết triển khai Menu Bar Monitor và App Lifecycle Policy.
* [_vxclean_task_03.md](_vxclean_task_03.md): Đặc tả hoàn thiện thương hiệu, đồng bộ localization 5 ngôn ngữ và nghiệm thu.
* [_vxclean_final_review.md](_vxclean_final_review.md): Các lỗi Codex yêu cầu sửa sau khi review source và báo cáo.
* [_vxclean_final_review.md](_vxclean_final_review.md): Biên bản rà soát kỹ thuật và chỉ đạo sửa lỗi dứt điểm từ Codex.

---

## 4. Tài Liệu Lưu Trữ Upstream (Archival Docs)

Toàn bộ tài liệu gốc và tệp hỗ trợ phát hành nguyên bản của dự án MClean được bảo lưu trong thư mục `docs_upstream/`:
* [docs_upstream/readme_original.md](../docs_upstream/readme_original.md): Tệp README gốc ban đầu.
* [docs_upstream/release_support/](../docs_upstream/release_support/): Các tập tin cấu hình phát hành và Homebrew formula gốc.

## Bản thử Tauri + React

- [Log phát triển và bàn giao wireframe cho Anti](development_log.md).
- [Kết quả build và review dashboard React ↔ Swift](tauri_bridge_verification.md).
- [Quyết định kiến trúc và phạm vi bản thử](tauri_bridge_task.md).
