import AppKit
import Foundation
import Darwin

/// Executable registry. A folder called Cache is not by itself a deletion grant.
struct CleanupRule {
  let id: String
  let safety: String
  let consequence: String
  let enabled: Bool
  let apps: [String]
  func executionMode(category:String, scope:String) -> String {
    scope == "quick_cleanup" && category == "user_caches" && ["chrome_quick_cache", "ai_frontend_quick_cache"].contains(id) ? "live_cache_root" : "strict_snapshot"
  }
  static let unknown = CleanupRule(id: "unvalidated", safety: "unknown", consequence: "Chưa xác minh cấu trúc dữ liệu; giữ lại để tránh mất project, cấu hình hoặc runtime.", enabled: false, apps: [])
}
struct CleanupPolicy {
  static let version = "1.0.0"
  static let fm = FileManager.default
  static let protectedNames: Set<String> = ["local storage", "history", "history-journal", "bookmarks", "bookmarks.bak", "web data", "web data-journal", "cookies", "cookies-journal", "login data", "local state", "preferences", "sessions", "session storage", "indexeddb", "service worker", "file system", "extensions", "projects", "project", "drafts", "recovery", "autosave", "auth.json", "state.vscdb", "_npx", "node_modules", "models", "plugins", "skills", "updater", "pending", "staging", ".git", ".codex", ".gemini", ".antigravity", ".venv", "venv"]
  static func rebuildable(_ id: String, _ consequence: String, apps: [String] = []) -> CleanupRule {
    CleanupRule(id: id, safety: "rebuildable", consequence: consequence, enabled: true, apps: apps)
  }
  /// Approved quick-cleanup roots only. Structural roots themselves never receive a grant.
  static func maintenanceRoot(_ path: String, category: String) -> String? {
    let h = MaintenanceCLI.home
    #if ENGINE_TESTING
    let system = h + "/system"
    #else
    let system = ""
    #endif
    let roots = category == "user_caches" ? [h + "/Library/Caches"] : category == "system_junk" ?
      [system + "/Library/Caches", system + "/Library/Logs", system + "/private/var/log", system + "/var/log", h + "/Library/Logs", system + "/private/tmp", system + "/tmp", system + "/private/var/tmp", system + "/var/tmp"] : []
    return roots.first { path.hasPrefix($0 + "/") }
  }
  static func maintainedRule(_ p: String, category: String, scope: String) -> CleanupRule? {
    guard let root = maintenanceRoot(p, category:category) else { return nil }
    let parts = String(p.dropFirst(root.count+1)).split(separator:"/").map(String.init)
    guard let owner = parts.first else { return nil }
    let lower = owner.lowercased()
    if category == "user_caches", lower == "pip" { return nil } // Keep exact pip child adapters.
    if category == "user_caches", lower.contains("shipit") || lower.contains("antigravity") || lower.contains("updater") {
      return CleanupRule(id:"updater_state", safety:"protected", consequence:"Gói cập nhật/pending/ShipIt đang thuộc cơ chế cập nhật ứng dụng; không tính là cache frontend để dọn.", enabled:false, apps:[])
    }
    if category == "user_caches", scope == "quick_cleanup", lower == "google" {
      guard parts.count > 1, parts[1] == "Chrome" else { return .unknown }
      return rebuildable("chrome_quick_cache", "Chrome tải lại cache web/code/GPU trong Library/Caches; giữ profile, cookie, mật khẩu và phiên tab trong Application Support. Có thể dọn khi Chrome đang mở; cache có thể sinh lại.", apps:["com.google.Chrome"])
    }
    if category == "user_caches", scope == "quick_cleanup", lower.contains("capcut") || lower.contains("lvoverseas") {
      return rebuildable("capcut_quick_cache", "CapCut tạo lại cache trong Library/Caches; giữ Movies/CapCut/project/media. Cache có thể sinh lại khi app đang mở.", apps:["com.lemon.lvoverseas"])
    }
    if category == "user_caches", scope == "quick_cleanup", lower == "codex" {
      return rebuildable("ai_frontend_quick_cache", "Codex tạo lại cache frontend trong Library/Caches; giữ lịch sử, đăng nhập, plugin/MCP/runtime. Cache có thể sinh lại khi app đang mở.", apps:["com.openai.codex"])
    }
    let dedicated = ["google", "adobe", "homebrew", "yarn", "pip", "ollama", "com.electron.ollama"]
    if category == "user_caches", scope != "quick_cleanup", dedicated.contains(lower) || ["antigravity", "codex", "chatgpt", "capcut", "lvoverseas", "shipit", "xcode", "docker", "pnpm", "npm", "updater", "com.vxclean", "com.adobe"].contains(where:lower.contains) { return .unknown }
    // Preserve the narrower Foundation adapters already tested; never grant their DB/state parent.
    if category == "user_caches", ["com.apple.helpd", "com.apple.tipsd", "com.apple.AMPLibraryAgent"].contains(owner) { return nil }
    let components = parts.map { $0.lowercased() }
    if components.contains(where: { protectedComponent($0, path:p, category:category, scope:scope) || $0.contains("shipit") || $0.contains("updater") || $0.hasPrefix(".vxclean_remove_") }) { return .unknown }
    if category == "user_caches" || root.hasSuffix("/Library/Caches") {
      return rebuildable("mclean_maintained_cache", "Dọn nội dung bộ nhớ đệm ứng dụng; app/OS có thể tải, index hoặc build lại và chậm hơn lần đầu. Giữ directory, state/runtime được bảo vệ.")
    }
    if p.hasPrefix(MaintenanceCLI.home + "/Library/Logs/DiagnosticReports/") { return nil }
    if scope == "quick_cleanup" {
      let components = parts.map { $0.lowercased() }
      let leaf = MaintenanceCLI.url(p).lastPathComponent.lowercased()
      let ext = MaintenanceCLI.url(p).pathExtension.lowercased()
      // IPC/credentials/live locks are not rebuildable cache. Build tools and libraries are.
      if components.contains("boost_interprocess") || ["lock", "pid", "sock", "socket", "sqlite", "sqlite3", "db", "wal", "shm", "pem", "key"].contains(ext) || leaf.contains("lock") { return .unknown }
      return rebuildable("mclean_quick_junk", "Dọn log/tệp tạm trong phạm vi quét nhanh, kể cả cache/build/công cụ kiểm thử. Khi cần có thể phải tải, build hoặc tạo lại; tiến trình đang dùng có thể phải chạy lại.")
    }
    guard let attrs = try? fm.attributesOfItem(atPath:p), let modified = attrs[.modificationDate] as? Date,
      modified <= Date().addingTimeInterval(-86400) else { return .unknown }
    let ext = MaintenanceCLI.url(p).pathExtension.lowercased()
    let leaf = MaintenanceCLI.url(p).lastPathComponent.lowercased()
    if root.hasSuffix("/tmp") {
      let runtimeNames: Set<String> = ["bin", "lib", "lib64", "target", "boost_interprocess", "vx_release_setup", "vx_video_playback_qa"]
      if components.contains(where: { runtimeNames.contains($0) }) || ["exe", "dll", "dylib", "so"].contains(ext) ||
        (attrs[.type] as? FileAttributeType == .typeRegular && ((attrs[.posixPermissions] as? NSNumber)?.intValue ?? 0) & 0o111 != 0) { return .unknown }
    }
    if root.hasSuffix("/tmp"), ["lock", "pid", "sock", "socket", "sqlite", "sqlite3", "db", "wal", "shm", "pem", "key", "swift", "rs", "py", "js", "ts", "tsx", "json", "jsonl", "toml"].contains(ext) || leaf.contains("lock") { return .unknown }
    if root.hasSuffix("/Logs") || root.hasSuffix("/log") {
      guard attrs[.type] as? FileAttributeType == .typeDirectory || ["log", "gz", "bz2", "asl", "ips", "crash", "diag", "txt"].contains(ext) else { return .unknown }
    }
    return rebuildable("mclean_maintained_aged_junk", "Xóa log hoặc tệp tạm đã cũ ≥24 giờ; mất dữ liệu chẩn đoán cũ. Giữ mục mới, lock/socket và state/runtime.")
  }
  static func protectedComponent(_ name: String, path: String, category: String, scope: String) -> Bool {
    let rebuildableEnvironment: Set<String> = ["node_modules", ".venv", "venv"]
    let temp = maintenanceRoot(path, category:category)?.hasSuffix("/tmp") == true
    if scope == "quick_cleanup", category == "system_junk", temp, rebuildableEnvironment.contains(name) { return false }
    return protectedNames.contains(name)
  }
  static func excludedQuickTarget(_ path: String, category: String, scope: String) -> Bool {
    guard scope == "quick_cleanup", category == "system_junk" else { return false }
    #if ENGINE_TESTING
    let prefix = MaintenanceCLI.home + "/system"
    #else
    let prefix = ""
    #endif
    return [prefix + "/var/log/wifi.log", prefix + "/private/var/log/wifi.log"].contains(MaintenanceCLI.url(path).path)
  }
  static func rule(_ path: String, category: String, scope: String) -> CleanupRule {
    let h = MaintenanceCLI.home
    let p = MaintenanceCLI.url(path).path
    if excludedQuickTarget(path, category:category, scope:scope) {
      return CleanupRule(id:"active_wifi_log", safety:"protected", consequence:"Log Wi-Fi đang ghi được loại khỏi scope dọn theo lựa chọn của user; log đã xoay vòng giữ rule riêng.", enabled:false, apps:[])
    }
    if category == "user_caches", scope == "quick_cleanup", ManagerCleanup.verifiedInstaller(p) {
      return rebuildable("anti_installer_archive", ManagerCleanup.installerAdvice + "Xóa riêng ZIP bộ cài cùng phiên bản đã cài; không xóa app, project hay state updater. Có thể cần tải lại bộ cài.", apps: ["com.google.antigravity"])
    }
    if category == "node_cache", scope == "detailed_cleanup", ManagerCleanup.plan(p) != nil {
      return rebuildable("pnpm_store_prune", "VXClean gọi pnpm store prune; pnpm tự dọn package không còn tham chiếu. Tổng store không phải dung lượng chắc chắn thu hồi; có thể cần tải lại package khi cài sau.")
    }
    if scope == "quick_cleanup", category == "system_junk", maintenanceRoot(p, category:category) != nil, MaintenanceCLI.unchanged(path) {
      return rebuildable("mclean_system_junk", "Dọn toàn mục trong phạm vi System Junk; gồm log, tệp tạm, cache và bản sao tạm. Dữ liệu chỉ nằm trong vùng tạm có thể mất; tiến trình đang dùng có thể cần chạy lại. Khi thiếu quyền ghi, macOS yêu cầu xác thực quản trị.")
    }
    guard MaintenanceCLI.unchanged(path), (p.hasPrefix(h + "/") || maintenanceRoot(p, category:category) != nil),
      !p.contains("/Application Support/com.vxclean.desktop/"), !p.contains("/Caches/com.vxclean.desktop"),
      !p.contains("/Xcode/Archives"), !p.contains("/ShipIt"),
      !p.split(separator: "/").contains(where: { protectedComponent(String($0).lowercased(), path:p, category:category, scope:scope) })
    else { return CleanupRule(id: "protected_state", safety: "protected", consequence: "Dữ liệu hệ thống, trạng thái, project hoặc runtime được giữ lại.", enabled: false, apps: []) }
    if category == "large_files" {
      let protectedExtensions: Set<String> = ["db", "sqlite", "sqlite3", "wal", "shm", "pem", "key", "plist", "xcodeproj", "prproj", "aep", "ts", "tsx", "js", "jsx", "py", "rs", "swift", "lock"]
      if protectedExtensions.contains(MaintenanceCLI.url(p).pathExtension.lowercased()) { return CleanupRule(id:"protected_project_file", safety:"protected", consequence:"Source, project, credential hoặc database được giữ lại.", enabled:false, apps:[]) }
      let roots = ["Documents", "Downloads", "Desktop"].map { h + "/" + $0 + "/" }
      if roots.contains(where: { p.hasPrefix($0) }), (try? fm.attributesOfItem(atPath: p)[.type] as? FileAttributeType) == .typeRegular {
        return CleanupRule(id: "personal_large_file", safety: "user_data", consequence: "Tệp cá nhân sẽ chuyển vào Thùng rác; kiểm tra nội dung trước khi chọn.", enabled: true, apps: [])
      }
      return .unknown
    }
    if let maintained = maintainedRule(p, category:category, scope:scope) { return maintained }
    // Verified Foundation URLCache layout: remove only external response bodies.
    if category == "user_caches" {
      for owner in ["com.apple.helpd", "com.apple.tipsd", "com.apple.AMPLibraryAgent"] {
        let base = h + "/Library/Caches/" + owner
        if owner == "com.apple.helpd", p == base + "/Generated" || p.hasPrefix(base + "/Generated/") || ["CSHelpIndex.plist", "HelpCache.plist"].contains(where: { p == base + "/" + $0 }) {
          return rebuildable("foundation_generated_help", "Cache trang trợ giúp/index của macOS được dựng/tải lại; không xóa tài liệu nguồn, HSTS hoặc Preferences.")
        }
        if ["Cache.db", "Cache.db-wal", "Cache.db-shm", "Cache.db-journal"].contains(where: { p == base + "/" + $0 }),
           (try? fm.attributesOfItem(atPath:p)[.type] as? FileAttributeType) == .typeRegular {
          return rebuildable("foundation_http_database", "Database HTTP cache tạo lại khi cần; cache web phải tải lại. Giữ Preferences, cookie/auth/state ngoài cache; content đang đổi vẫn bị từ chối.")
        }
        let root = h + "/Library/Caches/" + owner + "/fsCachedData"
        if p == root { return rebuildable("foundation_http_payload", "HTTP cache tải lại khi cần; giữ database, HSTS, cấu hình và dữ liệu app. Có thể cần mạng khi xem lại nội dung.") }
        if p.hasPrefix(root + "/") {
          let leaf = String(p.dropFirst(root.count + 1))
          if !leaf.contains("/"), UUID(uuidString: leaf) != nil,
             (try? fm.attributesOfItem(atPath:p)[.type] as? FileAttributeType) == .typeRegular {
            return rebuildable("foundation_http_payload", "HTTP cache tải lại khi cần; giữ database, HSTS, cấu hình và dữ liệu app. Có thể cần mạng khi xem lại nội dung.")
          }
        }
      }
    }
    if category == "system_junk" {
      let root = h + "/Library/Logs/DiagnosticReports/"
      if p.hasPrefix(root), !String(p.dropFirst(root.count)).contains("/"),
         ["ips", "crash", "diag"].contains(MaintenanceCLI.url(p).pathExtension.lowercased()),
         let attrs = try? fm.attributesOfItem(atPath:p), attrs[.type] as? FileAttributeType == .typeRegular,
         let modified = attrs[.modificationDate] as? Date, modified <= Date().addingTimeInterval(-7*86400) {
        return CleanupRule(id: "old_user_diagnostic", safety: "user_data", consequence: "Xóa báo cáo lỗi cá nhân cũ ≥7 ngày; mất bằng chứng chẩn đoán cũ, không xóa project hoặc log đang ghi. Không chọn mặc định.", enabled: true, apps: [])
      }
    }
    let genericRoots = [h + "/.cache/pip/http-v2", h + "/.cache/pip/wheels", h + "/Library/Caches/pip/http-v2", h + "/Library/Caches/pip/wheels"]
    if category == "user_caches", genericRoots.contains(where: { p == $0 || p.hasPrefix($0 + "/") }) {
      return rebuildable("pip_download_cache", "pip sẽ tải lại hoặc build lại gói; không xóa môi trường Python đã cài.")
    }
    if scope == "detailed_cleanup" {
      let npmRoots = [h + "/.npm/_cacache", h + "/.cache/npm/_cacache"]
      if category == "node_cache", npmRoots.contains(where: { p == $0 || p.hasPrefix($0 + "/") }) {
        return rebuildable("npm_download_cache", "npm tải lại gói khi cần; giữ _npx, runtime MCP và project.")
      }
      if category == "brew_cache", p.hasPrefix(h + "/Library/Caches/Homebrew/downloads/") {
        return rebuildable("brew_download_cache", "Homebrew tải lại archive; không xóa Cellar, Cask hoặc runtime đã cài.")
      }
      if category == "ai_apps" {
        let adapters: [(String, String)] = [
          ("Library/Caches/Codex/Default", "com.openai.codex"),
          ("Library/Application Support/Antigravity", "com.google.antigravity"),
          ("Library/Application Support/Antigravity IDE", "com.google.antigravity-ide")
        ]
        let leaves = ["Cache", "Code Cache", "GPUCache", "DawnCache", "GraphiteDawnCache", "DawnGraphiteCache", "DawnWebGPUCache"]
        for (relative, bundleID) in adapters {
          let root = h + "/" + relative + "/"
          if leaves.contains(where: { p == root + $0 || p.hasPrefix(root + $0 + "/") }) {
            return rebuildable("ai_frontend_http_code_graphics", "App tải lại cache web hoặc tạo lại cache code/GPU. Giữ lịch sử, ảnh/artifact, đăng nhập, plugin, MCP và môi trường; cần đóng app cùng helper trước khi dọn.", apps: [bundleID])
          }
        }
      }
      if category == "chrome" {
        let prefix = h + "/Library/Caches/Google/Chrome/"
        if p.hasPrefix(prefix) {
          let parts = String(p.dropFirst(prefix.count)).split(separator: "/").map(String.init)
          if parts.count >= 2, parts[0] == "Default" || parts[0].hasPrefix("Profile "), ["Cache", "Code Cache", "GPUCache", "DawnCache", "GraphiteDawnCache", "ShaderCache"].contains(parts[1]) {
            return rebuildable("chrome_http_code_graphics", "Chrome tải lại web/cache biên dịch; giữ cookie, mật khẩu, lịch sử, profile và dữ liệu web offline.", apps: ["com.google.Chrome"])
          }
        }
        let root = h + "/Library/Application Support/Google/Chrome/"
        if ["GPUCache", "DawnCache", "GraphiteDawnCache", "GrShaderCache", "ShaderCache"].contains(where: { p == root + $0 || p.hasPrefix(root + $0 + "/") }) {
          return rebuildable("chrome_graphics", "Chrome tạo lại cache GPU/shader; giữ profile và phiên tab.", apps: ["com.google.Chrome"])
        }
      }
      if category == "media_apps" {
        let root = h + "/Movies/CapCut/User Data/CEF/"
        let leaves = ["Cache/Cache", "Cache/Code Cache", "Cache/GPUCache", "Cache/DawnCache", "GrShaderCache", "GraphiteDawnCache", "ShaderCache"]
        if leaves.contains(where: { p == root + $0 || p.hasPrefix(root + $0 + "/") }) {
          return rebuildable("capcut_cef_child_cache", "CapCut tạo lại HTTP/code/shader cache; giữ project, media, asset, cookie và IndexedDB.", apps: ["com.lemon.lvoverseas"])
        }
        let common = h + "/Library/Application Support/Adobe/Common/"
        if (p.hasPrefix(common + "Media Cache Files/") && p.hasSuffix(".cfa")) || (p.hasPrefix(common + "Peak Files/") && p.hasSuffix(".pek")) {
          return rebuildable("adobe_generated_audio", "Adobe dựng lại audio conform/waveform khi media nguồn còn tồn tại; không xóa media hoặc project. Chưa xác minh media nguồn: giữ read-only.", apps: ["com.adobe.PremierePro", "com.adobe.AfterEffects", "com.adobe.AdobeMediaEncoder"])
        }
      }
    }
    #if ENGINE_TESTING
    if category == "user_caches", p.hasPrefix(h + "/Library/Caches/org.fixture.safe/" ) || p == h + "/Library/Caches/org.fixture.safe" {
      return rebuildable("fixture_disposable", "Fixture cache tái tạo được.")
    }
    #endif
    return .unknown
  }
  static func isAppBusy(_ rule: CleanupRule) -> Bool {
    if rule.apps.contains(where: { id in
      let running = NSRunningApplication.runningApplications(withBundleIdentifier: id)
      #if ENGINE_TESTING
      return running.contains { $0.bundleURL?.path.hasPrefix(MaintenanceCLI.home + "/Applications/") == true }
      #else
      return !running.isEmpty
      #endif
    }) { return true }
    let needsProcessCheck = !rule.apps.isEmpty || ["npm_download_cache", "brew_download_cache", "pip_download_cache", "pnpm_store_prune"].contains(rule.id)
    guard needsProcessCheck else { return false }
    #if ENGINE_TESTING
    return false
    #else
    // comm contains executable paths, never URLs/forms/credentials; fail closed if unavailable.
    let process = Process(); let pipe = Pipe()
    process.executableURL = URL(fileURLWithPath:"/bin/ps")
    process.arguments = ["-axo", "comm="]; process.standardOutput=pipe; process.standardError=FileHandle.nullDevice
    do { try process.run() } catch { return true }
    let data=pipe.fileHandleForReading.readDataToEndOfFile(); process.waitUntilExit()
    guard process.terminationStatus == 0, data.count < 1024*1024 else { return true }
    let lines=String(data:data,encoding:.utf8)?.lowercased().components(separatedBy:"\n") ?? []
    if rule.id == "pnpm_store_prune" { return lines.contains { $0.contains("/pnpm/") || $0.hasSuffix("/pnpm") } }
    if rule.id == "npm_download_cache" { return lines.contains { ["npm", "node", "yarn", "pnpm"].contains(URL(fileURLWithPath:$0.trimmingCharacters(in:.whitespaces)).lastPathComponent) } }
    if rule.id == "brew_download_cache" { return lines.contains { $0.contains("/homebrew/") && ($0.contains("ruby") || $0.hasSuffix("/brew")) } }
    if rule.id == "pip_download_cache" { return lines.contains { $0.hasSuffix("/pip") || $0.hasSuffix("/pip3") || $0.contains("/python") } }
    if rule.id.hasPrefix("chrome_") { return lines.contains { $0.contains("google chrome.app/") || $0.contains("google chrome helper") } }
    if rule.id == "ai_frontend_http_code_graphics" || rule.id == "ai_frontend_quick_cache" { return lines.contains { line in rule.apps.contains { id in id == "com.openai.codex" ? line.contains("codex.app/") || line.contains("chatgpt.app/") || line.contains("codex helper") : line.contains("antigravity.app/") || line.contains("antigravity ide.app/") || line.contains("antigravity helper") } } }
    if rule.id == "capcut_cef_child_cache" || rule.id == "capcut_quick_cache" { return lines.contains { $0.contains("capcut.app/") || $0.contains("capcut helper") } }
    return false
    #endif
  }
  static func metadata(_ path: String, category: String, scope: String) -> [String: Any] {
    let r = rule(path, category: category, scope: scope)
    // Adobe source association and shared-helper lifecycle need an adapter gate.
    let sourceUnverified = r.id == "adobe_generated_audio"
    let busy = scope == "quick_cleanup" && category == "user_caches" ? false : isAppBusy(r)
    let liveCache = r.executionMode(category:category,scope:scope) == "live_cache_root"
    let content: [[String:Any]]? = r.enabled ? (try? { () throws -> [[String:Any]] in
      if liveCache { try validateLiveCacheTree(path, category:category, scope:scope) }
      return try snapshot(path, mcleanSystem:["mclean_system_junk", "pnpm_store_prune"].contains(r.id), rootOnly:liveCache)
    }()) : nil
    let proofFits = content.flatMap { try? JSONSerialization.data(withJSONObject:$0) }.map { $0.count <= 3*1024*1024 } ?? false
    let valid = !r.enabled || (proofFits && content != nil && (["mclean_system_junk", "pnpm_store_prune"].contains(r.id) || r.safety != "rebuildable" || content!.allSatisfy { rule($0["path"] as! String, category: category, scope: scope).id == r.id }))
    let needsQuit = busy && !r.apps.isEmpty
    let writable = content?.filter { (($0["mode"] as? UInt32 ?? 0) & UInt32(S_IFMT)) == S_IFREG }.allSatisfy { fm.isWritableFile(atPath:MaintenanceCLI.url($0["path"] as! String).deletingLastPathComponent().path) } ?? false
    let enabled = r.enabled && (!busy || needsQuit) && !sourceUnverified && valid && (writable || r.id == "mclean_system_junk")
    var value: [String: Any] = ["rule_id": r.id, "execution_mode":r.executionMode(category:category,scope:scope), "safety_level": r.safety, "effective_safety": r.safety,
      "consequence_vi": r.consequence, "is_cleanable": enabled, "can_delete": enabled,
      "requires_app_quit": needsQuit, "app_bundle_ids": r.apps, "conditions": needsQuit ? ["quit_app_and_helpers", "rescan_selected_targets"] : [],
      "is_selected_by_default": enabled && r.safety == "rebuildable", "size_kind": "logical_estimate"]
    if needsQuit && enabled { value["quit_reason"] = "Đóng ứng dụng bình thường, quét lại vùng đã chọn, dọn rồi mở lại; không force quit." }
    if !enabled { value["blocked_reason"] = sourceUnverified ? "Chưa xác minh media nguồn và helper Adobe; chỉ xem." : r.enabled && valid && !writable ? "Không có quyền ghi trong thư mục chứa tệp; không tự nâng quyền admin." : busy ? "Ứng dụng đang mở; hãy đóng và quét lại. Tự phục hồi phiên chưa được kiểm chứng." : !valid ? "Không xác minh được toàn bộ nội dung, symlink hoặc hardlink; giữ lại." : r.consequence }
    if r.id == "pnpm_store_prune" { value["is_selected_by_default"] = false }
    return value
  }
  /// Full bounded manifest: any new child/same-inode modification invalidates the grant.
  static func snapshot(_ path: String, allowLinks: Bool = false, mcleanSystem: Bool = false, rootOnly:Bool = false) throws -> [[String: Any]] {
    guard MaintenanceCLI.unchanged(path) else { throw MaintenanceCLI.failure("path_changed") }
    var pending = [path]; var rows = [[String: Any]](); let deadline = Date().addingTimeInterval(4)
    while let p = pending.popLast() {
      guard rows.count < 20000, Date() < deadline else { throw MaintenanceCLI.failure("scope_changed: partial manifest") }
      var st = stat()
      guard lstat(p, &st) == 0, (st.st_mode & S_IFMT) == S_IFREG || (st.st_mode & S_IFMT) == S_IFDIR || ((allowLinks || mcleanSystem) && (st.st_mode & S_IFMT) == S_IFLNK) || mcleanSystem else { throw MaintenanceCLI.failure("protected_target: link or special file") }
      let link = (st.st_mode & S_IFMT) == S_IFLNK
      guard link ? MaintenanceCLI.unchanged(MaintenanceCLI.url(p).deletingLastPathComponent().path) : MaintenanceCLI.unchanged(p) else { throw MaintenanceCLI.failure("path_changed") }
      let directory = (st.st_mode & S_IFMT) == S_IFDIR
      guard mcleanSystem || directory || st.st_nlink == 1 else { throw MaintenanceCLI.failure("protected_target: hardlink") }
      rows.append(["path":p, "device":UInt64(st.st_dev), "inode":UInt64(st.st_ino), "mode":UInt32(st.st_mode), "size":Int64(st.st_size), "modified_s":Int64(st.st_mtimespec.tv_sec), "modified_ns":Int64(st.st_mtimespec.tv_nsec), "changed_s":Int64(st.st_ctimespec.tv_sec), "changed_ns":Int64(st.st_ctimespec.tv_nsec)])
      // System Junk deletes the selected item as a unit. Its authority
      // must not depend on a bounded full-subtree cache proof or child names.
      if directory && !mcleanSystem && !rootOnly { pending += try MaintenanceCLI.children(p).map(\.path) }
    }
    return rows.sorted { ($0["path"] as? String ?? "") < ($1["path"] as? String ?? "") }
  }
  static func sameSnapshot(_ a: [[String: Any]], _ b: [[String: Any]]) -> Bool {
    NSDictionary(dictionary: ["rows":a]).isEqual(to: ["rows":b])
  }
  static func validate(_ path: String, category: String, scope: String, expected: [[String: Any]], current: [[String:Any]]? = nil) throws -> CleanupRule {
    let r = rule(path, category: category, scope: scope)
    guard r.enabled, r.id != "adobe_generated_audio", (scope == "quick_cleanup" && category == "user_caches" || !isAppBusy(r)) else { throw MaintenanceCLI.failure("protected_target or app_in_use") }
    let actual = try current ?? snapshot(path, mcleanSystem: ["mclean_system_junk", "pnpm_store_prune"].contains(r.id))
    guard r.executionMode(category:category,scope:scope) == "live_cache_root" || sameSnapshot(expected, actual) else { throw MaintenanceCLI.failure("scope_changed") }
    if r.safety == "rebuildable", !["mclean_system_junk", "pnpm_store_prune"].contains(r.id) {
      for row in actual {
        let p = row["path"] as! String
        guard rule(p, category: category, scope: scope).id == r.id else { throw MaintenanceCLI.failure("protected_target: parent includes unvalidated child") }
      }
    }
    return r
  }
  /// Enumerate without building a full-tree manifest or following symbolic links.
  static func walkLiveCache(_ path:String, category:String, scope:String, visit:([[String:Any]]) throws -> Void) throws {
    let expectedRule = rule(path, category:category, scope:scope)
    guard expectedRule.enabled, expectedRule.executionMode(category:category,scope:scope) == "live_cache_root" else { throw MaintenanceCLI.failure("protected_target: cache root") }
    let rootStamp=try snapshot(path,rootOnly:true)
    if let root=rootStamp.first, ((root["mode"] as! UInt32) & UInt32(S_IFMT)) == S_IFREG {
      guard fm.isWritableFile(atPath:MaintenanceCLI.url(path).deletingLastPathComponent().path) else {throw MaintenanceCLI.failure("permission_denied")}
      try visit(rootStamp);return
    }
    // FileManager's error handler can stop traversal without throwing; capture it explicitly.
    var traversalError:Error?
    guard let entries = fm.enumerator(at:MaintenanceCLI.url(path), includingPropertiesForKeys:nil,
      options:[], errorHandler:{ _,error in traversalError=error; return false }) else { throw MaintenanceCLI.failure("permission_denied") }
    var batch=[[String:Any]]()
    while let child=entries.nextObject() as? URL {
      guard !OperationJournal.cancelled() else {throw MaintenanceCLI.failure("cancelled")}
      guard rule(child.path,category:category,scope:scope).id == expectedRule.id else {throw MaintenanceCLI.failure("protected_target: cache child")}
      let stamp=try snapshot(child.path,rootOnly:true)
      guard let row=stamp.first else {throw MaintenanceCLI.failure("path_changed")}
      if ((row["mode"] as! UInt32) & UInt32(S_IFMT)) == S_IFREG {
        guard fm.isWritableFile(atPath:child.deletingLastPathComponent().path) else {throw MaintenanceCLI.failure("permission_denied")}
        batch.append(row)
        if batch.count == 512 {try visit(batch);batch.removeAll(keepingCapacity:true)}
      }
    }
    if let error=traversalError {throw error}
    if !batch.isEmpty {try visit(batch)}
  }
  static func validateLiveCacheTree(_ path:String, category:String, scope:String) throws {
    try walkLiveCache(path,category:category,scope:scope,visit:{_ in})
  }
  static func removeLiveCacheTree(_ path:String, category:String, scope:String) throws -> Int64 {
    // Reject malicious/protected contents before deleting the first batch.
    let root=try snapshot(path,rootOnly:true).first!
    try validateLiveCacheTree(path,category:category,scope:scope)
    var bytes:Int64=0
    try walkLiveCache(path,category:category,scope:scope,visit:{batch in
      let current=try snapshot(path,rootOnly:true).first!
      guard current["device"] as? UInt64 == root["device"] as? UInt64,
        current["inode"] as? UInt64 == root["inode"] as? UInt64 else {throw MaintenanceCLI.failure("identity_changed: cache root")}
      bytes += try removeCacheFiles(batch,liveCache:true)
    })
    return bytes
  }
  /// Never rm a cache parent. Only granted regular files are removed; new children are retained.
  static func removeCacheFiles(_ manifest: [[String: Any]], liveCache: Bool = false) throws -> Int64 {
    var total: Int64 = 0
    for row in manifest where ((row["mode"] as! UInt32) & UInt32(S_IFMT)) == S_IFREG {
      guard !OperationJournal.cancelled() else { throw MaintenanceCLI.failure("cancelled") }
      let path = row["path"] as! String
      let components = path.split(separator: "/").map(String.init)
      var fd = open("/", O_RDONLY | O_DIRECTORY | O_NOFOLLOW)
      guard fd >= 0 else { throw MaintenanceCLI.failure("permission_denied") }
      for component in components.dropLast() {
        let next = openat(fd, component, O_RDONLY | O_DIRECTORY | O_NOFOLLOW)
        close(fd); fd = next
        if fd < 0 { throw MaintenanceCLI.failure("path_changed") }
      }
      defer { close(fd) }
      let name = components.last!
      #if ENGINE_TESTING
      if liveCache, ProcessInfo.processInfo.environment["VXCLEAN_TEST_LIVE_CHROME_APPEND"] == path {
        let writer = try FileHandle(forWritingTo: MaintenanceCLI.url(path))
        try writer.seekToEnd(); try writer.write(contentsOf:Data("live".utf8)); try writer.close()
      }
      #endif
      var st = stat()
      guard fstatat(fd, name, &st, AT_SYMLINK_NOFOLLOW) == 0,
        UInt64(st.st_dev) == row["device"] as? UInt64, UInt64(st.st_ino) == row["inode"] as? UInt64,
        (st.st_mode & S_IFMT) == S_IFREG, st.st_nlink == 1,
        liveCache || (Int64(st.st_size) == row["size"] as? Int64 &&
        Int64(st.st_mtimespec.tv_sec) == row["modified_s"] as? Int64 &&
        Int64(st.st_mtimespec.tv_nsec) == row["modified_ns"] as? Int64)
      else { throw MaintenanceCLI.failure("identity_changed") }
      try OperationJournal.intent(path, method: "remove_item")
      // Atomic rename isolates the object before unlink. Verify the renamed inode, restore on mismatch.
      let quarantined = ".vxclean_remove_" + UUID().uuidString
      guard renameat(fd, name, fd, quarantined) == 0 else { throw MaintenanceCLI.failure("permission_denied") }
      var moved = stat()
      guard fstatat(fd, quarantined, &moved, AT_SYMLINK_NOFOLLOW) == 0, moved.st_ino == st.st_ino, moved.st_dev == st.st_dev else {
        // Do not overwrite a replacement at the old name.
        if fstatat(fd, name, &st, AT_SYMLINK_NOFOLLOW) != 0 { _ = renameat(fd, quarantined, fd, name) }
        throw MaintenanceCLI.failure("identity_changed: isolated target retained")
      }
      guard unlinkat(fd, quarantined, 0) == 0 else {
        if fstatat(fd, name, &st, AT_SYMLINK_NOFOLLOW) != 0 { _ = renameat(fd, quarantined, fd, name) }
        throw MaintenanceCLI.failure("permission_denied: isolated target retained")
      }
      total += Int64(moved.st_size)
      try OperationJournal.outcome(["path":path, "method":"remove_item", "status":"success", "affected_bytes":Int64(moved.st_size)])
    }
    return total
  }
}
