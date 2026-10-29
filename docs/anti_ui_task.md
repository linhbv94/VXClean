# Task UI VXClean — thực thi cho Codex chủ trì

Version: 1.0.0 — Ngày: 2026-10-09

User đã yêu cầu Codex giao Anti phần UI và toàn quyền điều phối trong task này. Đây là phiên CLI riêng; không đụng window/conversation Anti user đang dùng cho job khác. Vai trò Anti: thực thi UI, Codex review và sở hữu engine.

Đọc trước docs/anti_ui_context.md (snapshot quy chuẩn root do Codex đã đọc), docs/spec/07_ui_engine_feedback.md, docs/native_engine_integration.md, desktop/src/types.ts, desktop/src/services/tauri_bridge.ts. Chỉ dùng đường dẫn đã biết trong cwd và tool view_file/list_dir tại cwd để đọc source; không cần lệnh shell kiểm kê hay truy cập thư mục cha. Không chạy lại lệnh ls đã bị từ chối. Spec 07 đã cập nhật trước làm, là ground truth cho brief mới. Bridge/types do Codex cập nhật riêng; không sửa hai file này.

Thực hiện toàn bộ phần UI trong spec 07: dashboard auto scan; sort result; cleanup đủ nhóm và gộp Orphans; Finder compact sortable apps ẩn protected; button/summary wrapping; headbar remove theme, Settings System/Light/Dark; SpaceLens packed circles/list compact, default home, native folder picker button + typed path, selection single/double click, progress/cancel/partial permission retry. Có thể tạo helper circle packing thuần TS/SVG, không thêm dependency mạng mới. Theme dựa matchMedia, persist vxclean_theme, tôn trọng dữ liệu light/dark cũ.

Bạn được sửa desktop/src/components/**, desktop/src/app.tsx, CSS/theme và helper mới cho UI. Không sửa desktop/native/**, desktop/src_tauri/**, desktop/src/services/tauri_bridge.ts, desktop/src/types.ts, scanner Swift, spec 07, root work_log hoặc script tests: Codex đang sửa độc lập những file này. Không bỏ kiểm tra engine/snapshot/method/confirmation, không đổi cách chọn mặc định item và không mock desktop.

Tuân thủ AGENTS.md, tiếng Việt UTF-8, snake_case; tôn trọng preexisting changes. Không commit/push/release, không dọn dữ liệu thật, không sửa project khác. Trong runner không gọi CLI agent khác; mục C tham vấn: gửi câu hỏi/bằng chứng về Codex chủ trì, không chuỗi agent. Ngân sách vòng: lượt đầu hiện tại, 2 vòng sửa/review còn lại; vòng phục hồi công cụ 1/3 (lượt đầu bị lỗi ls, chưa sửa source); 0 lần tham vấn đã dùng. Lưu bộ đếm vào báo cáo.

Chạy npm run build trong desktop khi bridge đã có các API; nếu lỗi do API chưa tới ghi đúng lý do, tiếp tục phần UI. Báo cáo docs/anti_ui_handoff.md: implementation, files, checks, limitations, câu hỏi cần Codex. Không sửa docs/spec cũ mâu thuẫn trong lúc Codex đang cập nhật; ghi danh sách cần đồng bộ trong report. Exit 0 không tự coi nghiệm thu.

Bổ sung user ngay sau dispatch: thứ tự master sidebar BẮT BUỘC Tổng quan → Quét nhanh → Space Lens → Gỡ ứng dụng → Dọn rác chi tiết. Trước báo hoàn tất đọc lại spec 07/task để nhận bổ sung này.

Lượt tiếp theo sau review lỗi công cụ: tiếp tục thực thi UI với context trong cwd, không chạy shell inventory (ls/git status/cat). Dùng view_file/list_dir/grep_search và write_to_file/multi_replace_file_content. Nếu chạy build dùng chính xác CommandLine `npm run build`, Cwd đường dẫn desktop; hoặc `cd desktop && npm run build` tại root. Không chạy dev server/browser từ CLI; Codex sẽ QA native. Phải thực hiện sửa source và báo cáo, không dừng chỉ vì không có shell kiểm kê.
