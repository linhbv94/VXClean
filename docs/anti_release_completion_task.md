# VXClean — Thực thi UI và menubar cho bản local

Ngày: 2026-10-10. User yêu cầu làm nốt và mở app. Anti thực thi; Codex chủ trì review và đồng thời làm engine trong các file riêng. Đọc AGENTS global/root, `_summary/standard_docs/desktop_ui_standards.md`, `_summary/standard_docs/master_theme.md`, work log tại VXUtilities; trong cleaner_for_mac đọc handoff và spec 00/04/05/11/12/14/15/16. Tiếng Việt, UTF-8, snake_case, không LaTeX. Không gọi agent khác; câu hỏi ghi báo cáo cho chủ trì. Initial execution, correction rounds used 0/3; consult 0/2 (lượt này không gọi).

## Phạm vi file

Sửa frontend desktop/src; Rust lib.rs, engine_bridge.rs, models.rs, module menubar mới; Cargo.toml, capabilities, tauri.conf.json, assets menubar và scripts tests UI/tray. KHÔNG sửa maintenance_bridge.rs, desktop/native/*.swift, MClean/*, docs/spec/*, work_log hoặc research/dictionary JSON: Codex đang làm engine. Giữ dirty changes/titlebar đã bỏ Bản thử. Không commit/push/tag/publish, không admin/FDA, không xóa dữ liệu user, không đóng real Chrome/Adobe. Checks trong repo được phép.

## Mục tiêu

1. Menubar macOS thật theo spec16: raster đúng SVG user ra18/36alpha, template icon; trái toggle panel340px metrics/theme/status/actions, clickngoài/Esc đóng, clamp monitor. Rightmenu Open/Settings/Quit. Mainred/CmdW hide+Accessory/Dockẩn khi tray initialized; reopen main regular/focus; CmdQ/trayQuittrueexit. Trayfailkeepmain. Một main; không autostart. Panel metrics/navigation only. Capability tray chỉ true sau initialized.
2. Shared metrics singleflight+cache5s trong engine_bridge, dashboard/panel không nhân đôi child. Register owned metrics child, kill/reap shutdown. Lastgood/error/stale honest. Không tự scan. Native Quit coordination: Codex sẽ thêm EngineState pub(crate) shutdown()->void và is_mutating()->bool; shutdown cancel-before-next-target; đợi safe boundary hữu hạn rồi exit. Không kill target apps.
3. Detail UI dictionary/consequence từ DTO, local/global Select all xuyên nhóm; noncleanable disabled; review hậu quả. Item mới: rule_id, safety_level, consequence_vi, blocked_reason. Category thêm chrome/media_apps; ai_apps vẫn có thể blocked/empty. Không dùng JSON dictionary design-only để cấp quyền. Unknown fallback read-only. Preserve Lens/dashboard/order behavior. Quick tray mở main Quick và scan read-only; disable mutation conflicts. Quick backend3groups Codex làm.
4. In-use app flow phải honest: popup giải thích nếu backend chưa có prepare/restore adapter thì blocked, không simulate Quit/session restore. Codex gate app đang chạy. Không history/images mutation.
5. tsc/frontendbuild và tests thích hợp; báo checks thực, sourcechanged/blockers/untested trong docs/anti_release_completion_report.md. Codex build bundle sau integration. Không đổi version.

## Coordination backend

ScanResponse mới operation_scope, protocol_version=2.0, platform=macos, policy_version=1.0.0. Metadata item như trên; is_cleanable false cho unknown/protected/info; Quick3cats; Detail exact chrome/media cache. API Rust maintenance hiện có giữ nguyên. Codex thêm get_operation_status()->{mutation_active,read_active}; mutations main-only WebviewWindow checks. Panel dùng safe menu/navigation commands. EngineState shutdown()/is_mutating() như trên.

## Công cụ và giới hạn

Dùng CLI model current, không override. DEVELOPER_DIR=/Library/Developer/CommandLineTools. npm/cargo/python/node checks trong repo được giao; crate APIs local trước. Không bypass permission. Max3 correction rounds, dừng2round no progress; task này initial. Không mở app user trước final integration. Không sửa file Codex sở hữu. Không coi build thành GUI pass.

## Lượt sửa 1/3 — sau lỗi công cụ đầu lượt
Lượt đầu 81d4cc20-c233-4f40-807f-13554237ac9c đã kết thúc, chưa sửa code: git status headless thiếu quyền, runner đã restore. Không gọi lại git status hoặc cách tương đương; Codex đã đọc hiện trạng và cung cấp docs/anti_current_git_status.txt để bạn đọc. Repo root /Users/vic/_Work/VXUtilities/cleaner_for_mac, VXUtilities không phải Git repo. Tiếp tục việc độc lập bằng file tools; không dừng vì thiếu command đọc không thiết yếu. Correction used1/3, còn2. Không tự gọi agent. Nếu run_command bị thiếu grant, báo chính xác lệnh trong report; không bypass.
