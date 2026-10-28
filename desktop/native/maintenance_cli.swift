import AppKit
import Foundation

// Shared path context required by the existing orphan policy and Conditions.
#if ENGINE_TESTING
  let testHomePath = ProcessInfo.processInfo.environment["VXCLEAN_TEST_HOME"] ?? FileManager.default.homeDirectoryForCurrentUser.path
  let home = testHomePath.hasPrefix("/var/") ? "/private" + testHomePath : testHomePath
#else
  let home = FileManager.default.homeDirectoryForCurrentUser.path
#endif

let userHome = home

/// DTO adapter for the desktop host. No caller-supplied deletion method or shell command is trusted.
struct MaintenanceCLI {
  struct AdminTarget {
    let index:Int; let path:String; let bytes:Int64; let device:String; let inode:String
    let stamp:String?
    init(_ index:Int,_ path:String,_ bytes:Int64,_ device:String,_ inode:String) {
      self.index=index;self.path=path;self.bytes=bytes;self.device=device;self.inode=inode
      var st=stat()
      stamp=lstat(path,&st)==0 ? "\(device):\(inode):\(String(st.st_mode,radix:8)):\(st.st_size):\(st.st_mtimespec.tv_sec):\(st.st_ctimespec.tv_sec)" : nil
    }
  }
  static let fm = FileManager.default
  #if ENGINE_TESTING
  static var testAdminInvocations = 0
  #endif
  static var home: String { userHome }
  static func failure(_ message: String) -> NSError {
    NSError(domain: "VXClean", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
  }
  static func json(_ value: Any, to handle: FileHandle = .standardOutput) throws {
    var data = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
    data.append(10)
    handle.write(data)
  }
  static func event(_ name: String, _ payload: [String: Any]) {
    try? json(["event": name, "payload": payload], to: .standardError)
  }
  static func url(_ path: String) -> URL {
    let expanded = (path as NSString).expandingTildeInPath
    let canonical = expanded.hasPrefix("/tmp/") || expanded.hasPrefix("/var/log/") || expanded.hasPrefix("/var/tmp/") ? "/private" + expanded : expanded
    return URL(fileURLWithPath: canonical).standardizedFileURL
  }
  static func unchanged(_ path: String) -> Bool {
    url(path).path == url(path).resolvingSymlinksInPath().path
  }
  static func children(_ path: String) throws -> [URL] {
    try fm.contentsOfDirectory(
      at: url(path), includingPropertiesForKeys: [.isSymbolicLinkKey], options: [])
  }
  static func size(_ u: URL, onDenied: (() -> Void)? = nil) -> Int64 {
    guard
      let v = try? u.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey, .fileSizeKey])
    else {
      onDenied?()
      return 0
    }
    if v.isSymbolicLink == true { return 0 }
    if v.isDirectory != true { return Int64(v.fileSize ?? 0) }
    do { return try children(u.path).reduce(0) { $0 + size($1, onDenied: onDenied) } } catch {
      onDenied?()
      return 0
    }
  }
  static var scanCategories: [CleaningCategory] {
    let preferred: [CleaningCategory] = [.largeFiles, .mailAttachments, .trashBins,
      .brewCache, .nodeCache, .dockerCache, .aiApps, .systemJunk, .xcodeJunk, .userCache]
    return preferred.filter { CleaningCategory.scannable.contains($0) }
      + CleaningCategory.scannable.filter { !preferred.contains($0) }
  }
  static func categoryID(_ category: CleaningCategory) -> String {
    switch category {
    case .systemJunk: return "system_junk"
    case .userCache: return "user_caches"
    case .aiApps: return "ai_apps"
    case .mailAttachments: return "mail_downloads"
    case .trashBins: return "trash_bin"
    case .largeFiles: return "large_files"
    case .xcodeJunk: return "xcode_junk"
    case .brewCache: return "brew_cache"
    case .nodeCache: return "node_cache"
    case .dockerCache: return "docker_cache"
    default: return "unsupported"
    }
  }
  static func deletionMethod(_ item: CleanableItem) -> String {
    if item.category == .largeFiles || item.category == .mailAttachments
      || item.path.contains("/Xcode/Archives")
      || item.path.hasSuffix("/.ollama/history")
      || item.path.hasSuffix("/.lmstudio/conversations") { return "trash" }
    return "remove_item"
  }
  static func isCleanable(_ item: CleanableItem) -> Bool {
    // Docker reclaimable bytes are informational; never delete the Docker executable.
    item.category != .dockerCache || !item.name.hasPrefix("Reclaimable")
  }
  @MainActor
  static func scan(includeEmpty: Bool = false, scope: String = "detailed_cleanup", coverageOnly: Bool = false) async throws -> [String: Any] {
    guard ["quick_cleanup", "detailed_cleanup"].contains(scope) else { throw failure("scope_mismatch") }
    let start = Date()
    var quickCoverage = [[String:Any]]()
    if scope == "detailed_cleanup" {
      let quick = try await scan(scope: "quick_cleanup", coverageOnly: true)
      quickCoverage = (quick["categories"] as? [[String:Any]] ?? []).flatMap { $0["items"] as? [[String:Any]] ?? [] }.filter { $0["is_cleanable"] as? Bool == true }
    }
    var categories = [[String: Any]]()
    var limited = [String]()
    var excludedItems = [[String:Any]]()
    var unsupportedCaches = [String]()
    var timedOut = [String]()
    // Reuse the original scanner, thresholds, exclusions and default item selections.
    let selectedCategories: [CleaningCategory] = scope == "quick_cleanup" ? (coverageOnly ? [.systemJunk, .userCache] : [.systemJunk, .userCache, .largeFiles]) : scanCategories.filter { $0 != .aiApps }
    for (index, category) in selectedCategories.enumerated() {
      let engine = ScanEngine()
      let scannedBytes = categories.reduce(Int64(0)) { $0 + ($1["total_bytes"] as? Int64 ?? 0) }
      let result: CategoryResult
      if category == .largeFiles {
        let bounded = await boundedLargeFiles(); result = bounded.0
        if bounded.1 { timedOut.append("large_files") }; if bounded.2 { limited.append("large_files") }
      } else {
      result = await engine.scanCategory(category, quickOnly: scope == "quick_cleanup") { path in
        if !coverageOnly { event("scan_progress", ["current_category": category.rawValue, "current_path": path,
          "progress_fraction": Double(index) / Double(selectedCategories.count), "scanned_bytes": scannedBytes]) }
      }
      }
      let id = categoryID(category)
      if !(await engine.unreadablePaths()).isEmpty { limited.append(id) }
      unsupportedCaches += await engine.unsupportedCachePaths()
      var candidates = result.items.filter { unchanged($0.path) && !CleanupPolicy.excludedQuickTarget($0.path, category:id, scope:scope) }
      // Generic pip parent contains layouts we have not validated; emit only exact disposable children.
      if category == .userCache {
        candidates = candidates.flatMap { item -> [CleanableItem] in
          if item.path.hasSuffix("/.cache/pip") || item.path.hasSuffix("/Library/Caches/pip") {
            return ["http-v2", "wheels"].compactMap { leaf in
              let p = item.path + "/" + leaf
              guard fm.fileExists(atPath: p) else { return nil }
              return CleanableItem(name: "pip " + leaf, path: p, size: size(url(p)), category: .userCache, isSelected: true, lastModified: nil)
            }
          }
          return [item]
        }
      }
      var items: [[String: Any]] = candidates.map { item in
        var row: [String: Any] = ["id": url(item.path).path, "target_id": url(item.path).path,
          "path": url(item.path).path, "name": item.name, "size_bytes": category == .systemJunk && scope == "quick_cleanup" ? item.size : size(url(item.path)),
          "category": id, "requires_admin": !fm.isWritableFile(atPath: item.path),
          "deletion_method": category == .systemJunk && scope == "quick_cleanup" ? "remove_item" : deletionMethod(item), "operation_scope": scope]
        row.merge(CleanupPolicy.metadata(item.path, category: id, scope: scope)) { _, new in new }
        return row
      }
      // Split validated leaves from mixed roots; retain informational remainder without double-counting.
      if category == .userCache || (category == .systemJunk && scope != "quick_cleanup") {
        items = items.flatMap { parent -> [[String: Any]] in
          guard let p = parent["path"] as? String else { return [parent] }
          var paths = [String]()
          if parent["is_cleanable"] as? Bool == true { return [parent] }
          if category == .userCache { paths += ManagerCleanup.installerPaths.filter { $0.hasPrefix(p + "/") && CleanupPolicy.rule($0, category:id, scope:scope).enabled } }
          if category == .userCache {
            let child = p + "/fsCachedData"
            if CleanupPolicy.rule(child, category:id, scope:scope).enabled, fm.fileExists(atPath:child) { paths = [child] }
          } else if p == home + "/Library/Logs/DiagnosticReports" {
            paths = ((try? children(p)) ?? []).map(\.path).filter { CleanupPolicy.rule($0, category:id, scope:scope).enabled }
          }
          if CleanupPolicy.maintenanceRoot(p, category:id) != nil,
             CleanupPolicy.rule(p, category:id, scope:scope).safety != "protected" {
            var pending = (try? children(p).map(\.path)) ?? []
            let deadline = Date().addingTimeInterval(4)
            var visited = 0
            while let child = pending.popLast(), visited < 20000, Date() < deadline {
              visited += 1
              guard unchanged(child), CleanupPolicy.rule(child, category:id, scope:scope).safety != "protected" else { continue }
              let row = policyItem(child, category:id, scope:scope)
              if row["is_cleanable"] as? Bool == true { paths.append(child) }
              else if (try? fm.attributesOfItem(atPath:child)[.type] as? FileAttributeType) == .typeDirectory {
                pending += (try? children(child).map(\.path)) ?? []
              }
            }
            if !pending.isEmpty { limited.append(id) }
          }
          let uniquePaths = Array(Set(paths)).sorted()
          let minimalPaths = uniquePaths.filter { path in !uniquePaths.contains { path.hasPrefix($0 + "/") } }
          let leaves = minimalPaths.map { policyItem($0, category:id, scope:scope) }
          guard !leaves.isEmpty else { return [parent] }
          let removed = leaves.reduce(Int64(0)) { $0 + ($1["size_bytes"] as? Int64 ?? 0) }
          var remainder = parent
          remainder["name"] = (parent["name"] as? String ?? "") + " — phần giữ lại"
          remainder["size_bytes"] = max(0, (parent["size_bytes"] as? Int64 ?? 0) - removed)
          return leaves + [remainder]
        }
      }
      // Homebrew only downloaded archives, never grant its mixed root.
      if category == .brewCache {
        let p = home + "/Library/Caches/Homebrew/downloads"
        items = ((try? children(p)) ?? []).map { policyItem($0.path, category: id, scope: scope) }
      }
      if scope == "quick_cleanup" {
        excludedItems += items.filter { $0["is_cleanable"] as? Bool != true }
        items = items.filter { $0["is_cleanable"] as? Bool == true && ($0["size_bytes"] as? Int64 ?? 0) > 0 }
      }
      if category == .nodeCache, scope == "detailed_cleanup", let plan = ManagerCleanup.plan() {
        items.removeAll { ($0["name"] as? String) == "pnpm content-addressable store" }
        var row = policyItem(plan.store, category: id, scope: scope)
        row["name"] = "pnpm — dọn package không còn tham chiếu"
        row["store_size_bytes"] = row["size_bytes"]; row["size_bytes"] = Int64(0)
        row["deletion_method"] = "pnpm_prune"; row["is_selected_by_default"] = false
        items.append(row)
        for old in (try? children(plan.base)) ?? [] where old.path != plan.store && old.lastPathComponent.range(of: "^v[0-9]+$", options: .regularExpression) != nil && unchanged(old.path) {
          var legacy = policyItem(old.path, category: id, scope: scope)
          legacy["name"] = "pnpm — store phiên bản cũ (" + old.lastPathComponent + ")"
          legacy["is_cleanable"] = false; legacy["can_delete"] = false; legacy["is_selected_by_default"] = false
          legacy["blocked_reason"] = "CLI hiện tại quản lý " + url(plan.store).lastPathComponent + "; store cũ cần pnpm tương thích để prune. VXClean không xóa hộ."
          items.append(legacy)
        }
      }
      // Empty optional tool categories do not appear as discovered junk.
      if includeEmpty || !items.isEmpty {
        categories.append(["category": id, "title": category.rawValue,
          "description": category.description, "total_bytes": items.reduce(Int64(0)) { $0 + ($1["size_bytes"] as? Int64 ?? 0) },
          "item_count": items.count, "items": items])
      }
      if !coverageOnly { event("scan_progress", ["current_category": category.rawValue, "current_path": "",
        "progress_fraction": Double(index + 1) / Double(selectedCategories.count),
        "scanned_bytes": categories.reduce(Int64(0)) { $0 + ($1["total_bytes"] as? Int64 ?? 0) }]) }
    }
    if scope == "detailed_cleanup" {
      categories += detailedAppCategories(scope: scope)
      categories = categories.compactMap { category in
        var copy = category
        let rows = (category["items"] as? [[String:Any]] ?? []).compactMap { row -> [String:Any]? in
          // Large Files has the same scanner/rule in Quick; its eligible targets belong there.
          if category["category"] as? String == "large_files", row["is_cleanable"] as? Bool == true { return nil }
          guard let rawPath = row["path"] as? String else { return row }
          let path = url(rawPath).path
          if quickCoverage.contains(where: { guard let raw = $0["path"] as? String else { return false }; let q = url(raw).path; return path == q || path.hasPrefix(q + "/") }) { return nil }
          let children = quickCoverage.filter { guard let raw = $0["path"] as? String else { return false }; return url(raw).path.hasPrefix(path + "/") }
          if children.isEmpty { return row }
          var remainder = row
          remainder["size_bytes"] = max(0, (row["size_bytes"] as? Int64 ?? 0) - children.reduce(Int64(0)) { $0 + ($1["size_bytes"] as? Int64 ?? 0) })
          if remainder["size_bytes"] as? Int64 == 0 { return nil }
          remainder["is_cleanable"] = false; remainder["can_delete"] = false; remainder["is_selected_by_default"] = false
          remainder["rule_id"] = "quick_scope_remainder"
          remainder["blocked_reason"] = "Phần có thể dọn đã thuộc Quét nhanh; không cấp quyền dọn parent bao phủ các target Quick."
          remainder["name"] = (row["name"] as? String ?? "") + " — phần ngoài Quick"
          return remainder
        }
        if !includeEmpty && rows.isEmpty { return nil }
        copy["items"] = rows; copy["item_count"] = rows.count
        copy["total_bytes"] = rows.reduce(Int64(0)) { $0 + ($1["size_bytes"] as? Int64 ?? 0) }
        return copy
      }
    }
    return ["operation_scope": scope, "scan_id": UUID().uuidString, "duration_ms": Int(Date().timeIntervalSince(start) * 1000),
      "categories": categories, "excluded_items": excludedItems, "protocol_version": "2.0", "platform": "macos", "policy_version": CleanupPolicy.version, "dictionary_version": "0.1.0", "is_partial": !limited.isEmpty || !timedOut.isEmpty, "timed_out_categories": timedOut, "size_kind": "logical_estimate", "total_cleanable_bytes": categories.flatMap { $0["items"] as? [[String: Any]] ?? [] }.filter { $0["is_cleanable"] as? Bool == true }.reduce(Int64(0)) { $0 + ($1["size_bytes"] as? Int64 ?? 0) },
      "fda_limited_categories": limited, "unsupported_cache_paths": unsupportedCaches]
  }
  /// OS/provider directory reads can block in the kernel; isolate this read-only scanner.
  static func boundedLargeFiles() async -> (CategoryResult, Bool, Bool) {
    let empty = CategoryResult(category: .largeFiles, items: [], totalSize: 0)
    let file = fm.temporaryDirectory.appendingPathComponent("vxclean_large_scan_" + UUID().uuidString)
    guard fm.createFile(atPath: file.path, contents: nil, attributes: [.posixPermissions:0o600]), let output = try? FileHandle(forWritingTo: file) else { return (empty, true, false) }
    defer { try? output.close(); try? fm.removeItem(at: file) }
    let process = Process(); process.executableURL = URL(fileURLWithPath:CommandLine.arguments[0]); process.arguments=["scan_large_files"]
    process.standardOutput=output; process.standardError=FileHandle.nullDevice; process.standardInput=FileHandle.nullDevice
    do { try process.run() } catch { return (empty, true, false) }
    #if ENGINE_TESTING
    let timeout: TimeInterval = ProcessInfo.processInfo.environment["VXCLEAN_TEST_STALL_LARGE_FILES"] == "1" ? 1 : 20
    #else
    let timeout: TimeInterval = 20
    #endif
    let deadline=Date().addingTimeInterval(timeout)
    while process.isRunning && Date()<deadline && getppid() != 1 { try? await Task.sleep(nanoseconds:50_000_000) }
    if process.isRunning {
      kill(process.processIdentifier, SIGKILL)
      let reapDeadline=Date().addingTimeInterval(2)
      while process.isRunning && Date()<reapDeadline { try? await Task.sleep(nanoseconds:20_000_000) }
      if !process.isRunning { process.waitUntilExit() }
      return (empty, true, false)
    }
    process.waitUntilExit(); try? output.synchronize()
    guard process.terminationStatus==0, (try? file.resourceValues(forKeys:[.fileSizeKey]).fileSize).map({$0<=16*1024*1024}) == true,
      let data=try? Data(contentsOf:file), let response=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any], let rows=response["items"] as? [[String:Any]] else { return (empty, true, false) }
    let items=rows.compactMap { row -> CleanableItem? in
      guard let path=row["path"] as? String, let name=row["name"] as? String, let size=row["size"] as? Int64 else {return nil}
      return CleanableItem(name:name,path:path,size:size,category:.largeFiles,isSelected:false,lastModified:(row["modified"] as? Double).map(Date.init(timeIntervalSince1970:)))
    }
    return (CategoryResult(category:.largeFiles,items:items,totalSize:items.reduce(0){$0+$1.size}),response["timed_out"] as? Bool ?? false, response["is_partial"] as? Bool ?? true)
  }
  /// One provider-blocked root must not discard other roots or block the whole scan.
  static func scanLargeFilesParallel() async throws -> [String:Any] {
    var workers = [(Process, URL, FileHandle, String)]()
    for leaf in ["Downloads", "Documents", "Desktop"] {
      let root = home + "/" + leaf
      let file = fm.temporaryDirectory.appendingPathComponent("vxclean_large_root_" + UUID().uuidString)
      guard fm.createFile(atPath:file.path, contents:nil, attributes:[.posixPermissions:0o600]) else { throw failure("worker_output") }
      let output = try FileHandle(forWritingTo:file)
      let process = Process(); process.executableURL = URL(fileURLWithPath:CommandLine.arguments[0]); process.arguments = ["scan_large_root", "--path", root]
      process.standardOutput=output; process.standardError=FileHandle.nullDevice; process.standardInput=FileHandle.nullDevice
      do { try process.run() } catch { try? output.close(); try? fm.removeItem(at:file); throw error }
      workers.append((process,file,output,root))
    }
    defer { for (process,file,output,_) in workers { if process.isRunning { kill(process.processIdentifier,SIGKILL) }; try? output.close(); try? fm.removeItem(at:file) } }
    let deadline = Date().addingTimeInterval(5)
    while workers.contains(where:{$0.0.isRunning}) && Date() < deadline && getppid() != 1 { try? await Task.sleep(nanoseconds:50_000_000) }
    var rows = [[String:Any]](); var limited = [String](); var timed = [String]()
    for (process,file,output,root) in workers {
      if process.isRunning { kill(process.processIdentifier,SIGKILL); timed.append(root); limited.append(root); continue }
      process.waitUntilExit(); try? output.synchronize()
      guard process.terminationStatus == 0, let data = try? Data(contentsOf:file), data.count < 16*1024*1024,
        let response = (try? JSONSerialization.jsonObject(with:data)) as? [String:Any], let items=response["items"] as? [[String:Any]] else { limited.append(root); continue }
      rows += items; limited += response["unreadable_paths"] as? [String] ?? []
    }
    rows.sort { ($0["size"] as? Int64 ?? 0) > ($1["size"] as? Int64 ?? 0) }
    return ["items":rows,"is_partial":!limited.isEmpty,"unreadable_paths":limited,"timed_out":!timed.isEmpty,"timed_out_paths":timed]
  }
  /// POSIX metadata avoids NSURL resource/provider queries for every entry.
  /// The worker remains killable for filesystem operations blocked by the OS.
  static func scanLargeFilesLocal(root: String) -> (CategoryResult, [String]) {
    let defaults = UserDefaults.standard
    let minSize = Int64(max(1, defaults.object(forKey:"settings.cleaning.largeFileThreshold") as? Int ?? 100)) * 1024 * 1024
    let cutoff = Calendar.current.date(byAdding:.month, value: -max(1, defaults.object(forKey:"settings.cleaning.oldFileMonths") as? Int ?? 12), to:Date()) ?? .distantPast
    let excluded = (defaults.stringArray(forKey:"settings.cleaning.largeFileExcludedFolders") ?? []).map { url($0).path }
    let skipHidden = defaults.object(forKey:"settings.cleaning.skipHiddenFiles") as? Bool ?? true
    let packages: Set<String> = ["app", "bundle", "framework", "plugin", "photoslibrary", "photolibrary", "xcodeproj", "xcworkspace", "rtfd", "pages", "numbers", "key"]
    var pending = [root]
    var items = [CleanableItem]()
    var limited = [String]()
    while let path = pending.popLast() {
      if excluded.contains(where: { path == $0 || path.hasPrefix($0 + "/") }) { continue }
      var st = stat()
      guard lstat(path, &st) == 0 else { if errno != ENOENT { limited.append(path) }; continue }
      if (st.st_mode & S_IFMT) == S_IFDIR {
        if packages.contains(url(path).pathExtension.lowercased()) { continue }
        event("large_directory", ["current_path":path])
        guard let directory = opendir(path) else { limited.append(path); continue }
        defer { closedir(directory) }
        while let entry = readdir(directory) {
          let name = withUnsafePointer(to: &entry.pointee.d_name) { pointer in
            pointer.withMemoryRebound(to:CChar.self, capacity:Int(MAXNAMLEN)+1) { String(cString:$0) }
          }
          if name == "." || name == ".." || (skipHidden && name.hasPrefix(".")) { continue }
          pending.append(path + "/" + name)
        }
      } else if (st.st_mode & S_IFMT) == S_IFREG {
        let modified = Date(timeIntervalSince1970:TimeInterval(st.st_mtimespec.tv_sec))
        if st.st_size > minSize || (modified < cutoff && st.st_size > 10*1024*1024) {
          items.append(CleanableItem(name:url(path).lastPathComponent, path:path, size:Int64(st.st_size), category:.largeFiles, isSelected:false, lastModified:modified))
        }
      }
    }
    items.sort { $0.size > $1.size }
    return (CategoryResult(category:.largeFiles, items:items, totalSize:items.reduce(0){$0+$1.size}), limited)
  }
  static func policyItem(_ path: String, category: String, scope: String) -> [String: Any] {
    var row: [String: Any] = ["id": path, "target_id": path, "path": path, "name": url(path).lastPathComponent,
      "category": category, "size_bytes": size(url(path)), "deletion_method": "remove_item",
      "requires_admin": !fm.isWritableFile(atPath: path), "operation_scope": scope]
    row.merge(CleanupPolicy.metadata(path, category: category, scope: scope)) { _, new in new }
    return row
  }
  static func detailedAppCategories(scope: String) -> [[String: Any]] {
    var chrome = [String](), media = [String]()
    let chromeRoot = home + "/Library/Caches/Google/Chrome"
    for profile in (try? children(chromeRoot)) ?? [] where profile.lastPathComponent == "Default" || profile.lastPathComponent.hasPrefix("Profile ") {
      for leaf in ["Cache", "Code Cache", "GPUCache", "DawnCache", "GraphiteDawnCache", "ShaderCache"] { chrome.append(profile.path + "/" + leaf) }
    }
    for leaf in ["GPUCache", "DawnCache", "GraphiteDawnCache", "GrShaderCache", "ShaderCache"] { chrome.append(home + "/Library/Application Support/Google/Chrome/" + leaf) }
    let cef = home + "/Movies/CapCut/User Data/CEF/"
    for leaf in ["Cache/Cache", "Cache/Code Cache", "Cache/GPUCache", "Cache/DawnCache", "GrShaderCache", "GraphiteDawnCache", "ShaderCache"] { media.append(cef + leaf) }
    for folder in ["Media Cache Files", "Peak Files"] {
      let root = home + "/Library/Application Support/Adobe/Common/" + folder
      // Unsupported extensions remain visible but cannot be selected/deleted.
      media += ((try? children(root)) ?? []).map(\.path)
    }
    var ai = [String]()
    for root in ["Library/Caches/Codex/Default", "Library/Application Support/Codex", "Library/Application Support/Antigravity", "Library/Application Support/Antigravity IDE", "Library/Application Support/com.openai.chat"] {
      for leaf in ["Cache", "Code Cache", "GPUCache", "DawnCache", "GraphiteDawnCache", "DawnGraphiteCache", "DawnWebGPUCache", "CachedData", "logs"] { ai.append(home + "/" + root + "/" + leaf) }
    }
    for root in ["Library/Caches/com.openai.codex", "Library/Caches/com.google.antigravity", "Library/Caches/com.google.antigravity.ShipIt", "Library/Caches/com.google.antigravity-ide.ShipIt", "Library/Application Support/com.openai.chat"] { ai.append(home+"/"+root) }
    // History/attachments/runtime are informational. No ownership mapping => no deletion grant.
    for root in [".codex/sessions", ".codex/archived_sessions", ".codex/plugins/cache", ".gemini/antigravity/brain", ".gemini/antigravity/browser_recordings"] { ai.append(home + "/" + root) }
    return [("chrome", "Chrome", chrome), ("media_apps", "Media Apps — CapCut / Adobe", media), ("ai_apps", "AI Apps — Codex / Antigravity / ChatGPT", ai)].map { id, title, paths in
      let rows = paths.filter { fm.fileExists(atPath: $0) && unchanged($0) }.map { policyItem($0, category: id, scope: scope) }
      return ["category": id, "title": title, "description": "Rule chính xác; giữ project và dữ liệu trạng thái chưa xác minh.", "items": rows, "item_count": rows.count, "total_bytes": rows.reduce(Int64(0)) { $0 + ($1["size_bytes"] as? Int64 ?? 0) }]
    }
  }
  static var applicationRoots: [String] {
    #if ENGINE_TESTING
      return [home + "/Applications"]
    #else
      return [
        "/Applications", home + "/Applications", "/System/Applications",
        "/System/Applications/Utilities",
      ]
    #endif
  }
  static func appURLs() -> [URL] {
    var result = [URL]()
    for root in applicationRoots {
      var pending = [(url(root), 0)]
      while let (folder, depth) = pending.popLast() {
        for entry in (try? children(folder.path)) ?? [] {
          guard !entry.lastPathComponent.hasPrefix("."), unchanged(entry.path),
            let values = try? entry.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey, .isPackageKey]),
            values.isSymbolicLink != true, values.isDirectory == true else { continue }
          if entry.pathExtension == "app" { result.append(entry) }
          else if depth < 3 && values.isPackage != true { pending.append((entry, depth + 1)) }
        }
      }
    }
    return Array(Set(result)).sorted { $0.path < $1.path }
  }
  // Bounded, metadata-only index reused across every app in this native invocation.
  static var discoveryIncomplete = false
  static let discoveryIndex: [URL] = {
    let roots = ["Movies", "Documents", "Downloads", "Desktop", "Music", "Pictures",
      "Library/Application Support", "Library/Caches", "Library/Logs", "Library/Containers", "Library/Application Scripts"]
    let deadline = Date().addingTimeInterval(3)
    var pending = roots.map { (url(home + "/" + $0), 0) }
    var result = [URL]()
    var visited = 0
    var cursor = 0
    while cursor < pending.count {
      let (parent, depth) = pending[cursor]
      cursor += 1
      guard Date() < deadline, visited < 20000 else { discoveryIncomplete = true; break }
      guard unchanged(parent.path) else { continue }
      guard let entries = try? children(parent.path) else {
        if fm.fileExists(atPath: parent.path) { discoveryIncomplete = true }; continue
      }
      for entry in entries {
        visited += 1
        guard Date() < deadline, visited <= 20000 else { discoveryIncomplete = true; break }
        guard !entry.lastPathComponent.hasPrefix("."), unchanged(entry.path),
          let v = try? entry.resourceValues(forKeys: [.isDirectoryKey, .isPackageKey, .isSymbolicLinkKey]),
          v.isDirectory == true, v.isPackage != true, v.isSymbolicLink != true else { continue }
        result.append(entry)
        if depth < 2 { pending.append((entry, depth + 1)) }
      }
    }
    return result.sorted { $0.path < $1.path }
  }()
  static func discovered(_ bundle: URL, _ id: String, known: [String]) -> [[String: Any]] {
    let display = Bundle(url: bundle)?.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String
    let names = Set([bundle.deletingPathExtension().lastPathComponent, display ?? "", id]
      .map { $0.lowercased() }.filter { $0.count >= 4 })
    var accepted = known.map { url($0).path }
    var result = [[String: Any]]()
    for entry in discoveryIndex where names.contains(entry.lastPathComponent.lowercased()) {
      let candidatePath = url(entry.path).path
      guard !accepted.contains(where: { candidatePath == $0 || candidatePath.hasPrefix($0 + "/") || $0.hasPrefix(candidatePath + "/") }) else { continue }
      accepted.append(candidatePath)
      result.append(["path": entry.path, "file_type": "discovered",
        "size_bytes": FileSizeCalculator.size(of: entry) ?? 0, "is_essential": false,
        "is_selected_by_default": false, "deletion_method": "trash",
        "discovery_reason": "Tên thư mục trùng tên ứng dụng hoặc bundle ID; có thể chứa project cá nhân"])
    }
    return result
  }
  static func associated(_ bundle: URL, _ id: String) -> [[String: Any]] {
    var result: [[String: Any]] = [
      [
        "path": bundle.path, "file_type": "bundle", "size_bytes": FileSizeCalculator.size(of: bundle) ?? 0,
        "is_essential": true, "deletion_method": "trash",
      ]
    ]
    // Exact bundle-ID matches remain separate from optional, unselected discovery candidates.
    for (folder, type, suffix) in [
      ("Application Support", "app_support", ""), ("Caches", "cache", ""),
      ("Preferences", "preferences", ".plist"),
      ("Saved Application State", "saved_state", ".savedState"), ("Logs", "logs", ""),
      ("Containers", "container", ""), ("Application Scripts", "app_scripts", ""),
    ] {
      let path = home + "/Library/" + folder + "/" + id + suffix
      if fm.fileExists(atPath: path), unchanged(path) {
        result.append([
          "path": path, "file_type": type, "size_bytes": FileSizeCalculator.size(of: url(path)) ?? 0, "is_essential": false,
          "deletion_method": "trash",
        ])
      }
    }
    result += discovered(bundle, id, known: result.compactMap { $0["path"] as? String })
    return result
  }
  static func apps() -> [String: Any] {
    let list: [[String: Any]] = appURLs().compactMap { u in
      guard let b = Bundle(url: u), let id = b.bundleIdentifier, !id.contains("/"), !id.isEmpty,
        !id.hasPrefix("com.apple."), !u.path.hasPrefix("/System/")
      else { return nil }
      let files = associated(u, id)
      let architectures = (b.executableArchitectures ?? []).compactMap { n -> String? in
        n.intValue == 0x0100_000c ? "arm64" : (n.intValue == 0x0100_0007 ? "x86_64" : nil)
      }
      return [
        "id": u.path,
        "name": b.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String
          ?? u.deletingPathExtension().lastPathComponent,
        "bundle_id": id,
        "version": b.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "",
        "bundle_path": u.path, "architectures": architectures,
        "total_size_bytes": files.reduce(Int64(0)) { $0 + ($1["size_bytes"] as? Int64 ?? 0) },
        "is_system_protected": id.hasPrefix("com.apple.") || u.path.hasPrefix("/System/"),
        "is_self_app": id == "com.vxclean.desktop"
          || u.lastPathComponent.lowercased() == "vxclean.app", "associated_files": files,
      ]
    }
    return ["apps": list, "total_apps": list.count, "discovery_incomplete": discoveryIncomplete]
  }
  static func orphans() -> [String: Any] {
    let installed = Set(appURLs().compactMap { Bundle(url: $0)?.bundleIdentifier })
    var groups = [[String: Any]]()
    for (folder, type) in [
      ("Caches", "cache"), ("Logs", "logs"), ("Application Support", "app_support"),
      ("Preferences", "preferences"),
    ] {
      for u in (try? children(home + "/Library/" + folder)) ?? [] {
        let id =
          folder == "Preferences"
          ? u.deletingPathExtension().lastPathComponent : u.lastPathComponent
        guard id.contains("."), !id.hasPrefix("com.apple."), !installed.contains(id),
          unchanged(u.path)
        else { continue }
        let bytes = size(u)
        guard bytes > 0 else { continue }
        // Absence from /Applications is only a candidate, never proof that app data is disposable.
        let safe = CleanupPolicy.rule(u.path, category: "user_caches", scope: "detailed_cleanup").enabled && (try? CleanupPolicy.snapshot(u.path)) != nil
        groups.append([
          "id": u.path, "original_app_name": id, "bundle_id_guess": id, "total_size_bytes": bytes,
          "items": [
            [
              "id": u.path, "path": u.path, "size_bytes": bytes, "residual_type": type,
              "is_safe_candidate": safe,
            ]
          ],
        ])
      }
    }
    return [
      "orphans": groups, "total_count": groups.count,
      "total_bytes": groups.reduce(Int64(0)) { $0 + ($1["total_size_bytes"] as? Int64 ?? 0) },
    ]
  }
  @MainActor
  static func clean(
    _ payload: [String: Any], uninstall: Bool = false, orphan: Bool = false, lens: Bool = false
  ) async throws -> [String: Any] {
    guard payload["protocol_version"] as? String == "2.0", payload["platform"] as? String == "macos",
      payload["policy_version"] as? String == CleanupPolicy.version else { throw failure("protocol_mismatch") }
    let scope = payload["operation_scope"] as? String ?? ""
    let expectedScope = uninstall ? "uninstall" : orphan ? "orphan_cleanup" : lens ? "lens_trash" : scope
    guard scope == expectedScope,
      uninstall || orphan || lens || ["quick_cleanup", "detailed_cleanup"].contains(scope)
    else { throw failure("scope_mismatch") }
    // A cleanup command must never accept app association authority.
    if !uninstall && payload["authorized_app"] != nil { throw failure("scope_mismatch") }
    try OperationJournal.configure(payload, scope: scope)
    let start = Date()
    var details = [[String: Any]]()
    var freed: Int64 = 0
    var trashed: Int64 = 0
    var targets = payload["targets"] as? [[String: Any]] ?? []
    if uninstall {
      guard let id = payload["app_id"] as? String,
        let app = payload["authorized_app"] as? [String: Any], app["id"] as? String == id,
        let bundleID = app["bundle_id"] as? String, !bundleID.isEmpty, !bundleID.contains("/"),
        !bundleID.hasPrefix("com.apple."),
        let bundlePath = app["bundle_path"] as? String,
        applicationRoots.filter { !$0.hasPrefix("/System/") }.contains(where: {
          url(bundlePath).path.hasPrefix(url($0).path + "/")
        }), (appURLs().contains(where: { url($0.path).path == url(bundlePath).path })
          || (payload["remaining_only"] as? Bool == true && !fm.fileExists(atPath: bundlePath))),
        url(bundlePath).pathExtension == "app",
        url(bundlePath).lastPathComponent.lowercased() != "vxclean.app",
        bundleID != "com.vxclean.desktop",
        app["is_system_protected"] as? Bool == false, app["is_self_app"] as? Bool == false
      else { throw failure("Ứng dụng được bảo vệ hoặc không hợp lệ") }
      if fm.fileExists(atPath: bundlePath), (Bundle(url: url(bundlePath))?.bundleIdentifier != bundleID || (Bundle(url:url(bundlePath))?.object(forInfoDictionaryKey:"CFBundleShortVersionString") as? String ?? "") != (app["version"] as? String ?? "")) { throw failure("identity_changed: app bundle") }
      if payload["remaining_only"] as? Bool == true, (payload["selected_paths"] as? [String] ?? []).contains(bundlePath) { throw failure("scope_changed: bundle already removed") }
      guard NSRunningApplication.runningApplications(withBundleIdentifier: bundleID).isEmpty else {
        throw failure("Hãy thoát ứng dụng trước khi gỡ cài đặt")
      }
      let expected = Set(
        associated(url(bundlePath), bundleID).compactMap { $0["path"] as? String }.map {
          url($0).path
        })
      let allowed = Set(
        (app["associated_files"] as? [[String: Any]] ?? []).compactMap { $0["path"] as? String }.map
        { url($0).path })
      let paths = payload["selected_paths"] as? [String] ?? []
      guard paths.allSatisfy({ allowed.contains(url($0).path) && expected.contains(url($0).path) })
      else {
        throw failure("Đường dẫn không thuộc ứng dụng")
      }
      targets = paths.map { ["path": $0, "deletion_method": "trash"] }
    }
    let allTargets = targets
    targets = allTargets.filter { target in
      guard let path = target["path"] as? String else { return true }
      return !allTargets.contains { parent in
        guard let parentPath = parent["path"] as? String else { return false }
        return path.hasPrefix(parentPath + "/") && parent["deletion_method"] as? String == target["deletion_method"] as? String
      }
    }
    var seenTargets = Set<String>()
    targets = targets.filter { seenTargets.insert($0["path"] as? String ?? "").inserted }
    var scanAllowed: [String: String] = [:]
    var scanCategoriesByPath: [String:String] = [:]
    var scanSizesByPath: [String:Int64] = [:]
    let authorizedFiles = (payload["authorized_app"] as? [String: Any])?["associated_files"] as? [[String: Any]] ?? []
    let discoveryPaths = Set(authorizedFiles.filter { $0["file_type"] as? String == "discovered" }.compactMap { $0["path"] as? String })
    if !uninstall && !lens && !orphan {
      let fresh = try await scan(scope: scope)
      for category in fresh["categories"] as? [[String: Any]] ?? [] {
        for item in category["items"] as? [[String: Any]] ?? [] where item["is_cleanable"] as? Bool == true {
          if let path = item["path"] as? String, let method = item["deletion_method"] as? String {
            scanAllowed[url(path).path] = method
            scanCategoriesByPath[url(path).path] = category["category"] as? String
            scanSizesByPath[url(path).path] = item["size_bytes"] as? Int64
          }
        }
      }
    }
    guard targets.count <= 10000 else { throw failure("Quá nhiều mục được chọn") }
    var adminPending: [AdminTarget] = []
    for (index, target) in targets.enumerated() {
      if OperationJournal.cancelled() {
        for remaining in targets.dropFirst(index) { details.append(["path":remaining["path"] as? String ?? "", "status":"skipped", "affected_bytes":Int64(0), "method_used":remaining["deletion_method"] as? String ?? "remove_item", "error_message":"cancelled: chưa bắt đầu mục này"]) }
        break
      }
      guard let path = target["path"] as? String, let method = target["deletion_method"] as? String
      else { throw failure("Payload không hợp lệ") }
      var recycledURL: NSURL?
      var status = "success"
      var message: String?
      var bytes: Int64 = 0
      let usedMethod = method
      var systemRemovalStarted = false
      do {
        guard !CleanupPolicy.excludedQuickTarget(path, category:"system_junk", scope:scope) else { throw failure("protected_target: Wi-Fi log đang ghi nằm ngoài phạm vi dọn") }
        guard unchanged(path) else { throw failure("Từ chối đường dẫn symlink") }
        if let stamps = payload["identities"] as? [String: [NSNumber]], let expected = stamps[path]
        {
          let attrs = try fm.attributesOfItem(atPath: path)
          guard expected.count == 2,
            (attrs[.systemNumber] as? NSNumber)?.uint64Value == expected[0].uint64Value,
            (attrs[.systemFileNumber] as? NSNumber)?.uint64Value == expected[1].uint64Value
          else { throw failure("Định danh tệp đã thay đổi") }
        } else {
          throw failure("Thiếu định danh tệp từ host")
        }
        if lens {
          guard lensTrashAllowed(path, root: home), method == "trash" else {
            throw failure("Mục được bảo vệ hoặc ngoài phạm vi dọn; hãy kiểm tra trong Finder")
          }
        }
        guard var manifest = (payload["content_snapshots"] as? [String:[[String:Any]]])?[path] else { throw failure("scope_changed: missing manifest") }
        let liveCache = CleanupPolicy.rule(path, category:scanCategoriesByPath[url(path).path] ?? "unknown", scope:scope).executionMode(category:scanCategoriesByPath[url(path).path] ?? "unknown",scope:scope) == "live_cache_root"
        let current = try CleanupPolicy.snapshot(path, allowLinks:uninstall || lens, mcleanSystem:method == "pnpm_prune" || (scope == "quick_cleanup" && scanCategoriesByPath[url(path).path] == "system_junk"), rootOnly:uninstall || liveCache)
        if liveCache {manifest=current} else {guard CleanupPolicy.sameSnapshot(manifest,current) else {throw failure("scope_changed")}}
        if !uninstall && !lens {
          let safeOrphan = orphan && CleanupPolicy.rule(path, category: "user_caches", scope: "detailed_cleanup").enabled
          let expected = safeOrphan ? "remove_item" : scanAllowed[url(path).path]
          guard let expected else { throw failure("Đường dẫn ngoài kết quả quét hiện tại") }
          guard method == expected else { throw failure("Phương thức xóa không khớp") }
          _ = try CleanupPolicy.validate(path, category: orphan ? "user_caches" : (scanCategoriesByPath[url(path).path] ?? "unknown"), scope: orphan ? "detailed_cleanup" : scope, expected: manifest, current:current)
          if method != "trash", payload["confirm_direct_delete"] as? Bool != true {
            throw failure("Thiếu xác nhận xóa vĩnh viễn")
          }
          if scanCategoriesByPath[url(path).path] != "system_junk", path.contains("/Library/Developer/Xcode/"),
            !NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.dt.Xcode")
              .isEmpty
          {
            throw failure("Hãy đóng Xcode trước khi dọn dữ liệu Xcode")
          }
        }
        guard !OperationJournal.cancelled() else { throw failure("cancelled") }
        try OperationJournal.intent(path, method: method)
        bytes = scope == "quick_cleanup" && scanCategoriesByPath[url(path).path] == "system_junk" ? (scanSizesByPath[url(path).path] ?? 0) : size(url(path))
        if method == "pnpm_prune" {
          bytes = try ManagerCleanup.prune(path); freed += bytes
          message = "pnpm đã chạy prune thành công; dung lượng là chênh lệch logic của store, không phải toàn store."
        } else if method == "trash" {
          do {
            try fm.trashItem(at: url(path), resultingItemURL: &recycledURL)
            trashed += bytes
          } catch {
            let e = error as NSError
            guard uninstall, !discoveryPaths.contains(path), payload["allow_admin_fallback"] as? Bool == true,
              [NSFileWriteNoPermissionError, NSFileReadNoPermissionError].contains(e.code),
              unchanged(path)
            else { throw error }
            let expected = (payload["identities"] as! [String:[NSNumber]])[path]!
            adminPending.append(AdminTarget(index,path,bytes,expected[0].stringValue,expected[1].stringValue))
            status = "awaiting_admin"
          }
        } else {
          if scope == "quick_cleanup", scanCategoriesByPath[url(path).path] == "system_junk" {
            // Item deletion and admin retry only after the granted authority is revalidated.
            systemRemovalStarted = true
            do {
              #if ENGINE_TESTING
              if ProcessInfo.processInfo.environment["VXCLEAN_TEST_PARTIAL_SYSTEM_REMOVE"] == path {
                let child = url(path).appendingPathComponent("removed.bin")
                try fm.removeItem(at: child)
                throw failure("fixture_partial_system_remove")
              }
              #endif
              #if ENGINE_TESTING
              if (ProcessInfo.processInfo.environment["VXCLEAN_TEST_ADMIN_REQUIRED"] ?? "").split(separator: "|").contains(Substring(path)) {
                throw NSError(domain:NSCocoaErrorDomain, code:NSFileWriteNoPermissionError)
              }
              #endif
              try fm.removeItem(at: url(path))
            }
            catch {
              let e = error as NSError
              guard [NSFileWriteNoPermissionError, NSFileReadNoPermissionError].contains(e.code) || (e.domain == NSPOSIXErrorDomain && [Int(EACCES), Int(EPERM)].contains(e.code)) else { throw error }
              let expected = (payload["identities"] as! [String:[NSNumber]])[path]!
              adminPending.append(AdminTarget(index,path,bytes,expected[0].stringValue,expected[1].stringValue))
              status = "awaiting_admin"
            }
          } else if liveCache {
            bytes = try CleanupPolicy.removeLiveCacheTree(path, category:scanCategoriesByPath[url(path).path] ?? "unknown",scope:scope)
          } else { bytes = try CleanupPolicy.removeCacheFiles(manifest) }
          if status != "awaiting_admin" { freed += bytes }
        }
      } catch {
        let e = error as NSError
        status =
          (e.code == NSFileWriteNoPermissionError || e.code == NSFileReadNoPermissionError)
          ? "permission_denied" : "skipped"
        message = error.localizedDescription
        if method == "pnpm_prune", (OperationJournal.state["targets"] as? [[String:Any]] ?? []).contains(where: { $0["path"] as? String == path }) {
          status = "outcome_unknown"
          message = "pnpm có thể đã dọn một phần; kết quả chưa xác minh. Quét lại, không tự chạy lại. " + (message ?? "")
        }
        if systemRemovalStarted {
          status = "outcome_unknown"
          message = "Mục System Junk có thể đã bị xóa một phần; chưa xác minh dung lượng. Quét lại và kiểm tra lịch sử, không tự chạy lại. " + (message ?? "")
        }
        if method == "remove_item" {
          let known = OperationJournal.state["targets"] as? [[String:Any]] ?? []
          bytes = known.filter { row in
            guard let p = row["path"] as? String else { return false }
            return (p == path || p.hasPrefix(path + "/")) && row["status"] as? String == "success"
          }.reduce(Int64(0)) { $0 + ($1["affected_bytes"] as? Int64 ?? 0) }
          if bytes > 0 { freed += bytes; message = "Đã dọn một phần; " + (message ?? "") }
        } else { bytes = 0 }
      }
      var result: [String: Any] = [
        "path": path, "status": status, "affected_bytes": bytes, "method_used": usedMethod,
      ]
      #if ENGINE_TESTING
        if let recycledURL { result["test_trash_path"] = recycledURL.path }
      #endif
      if let message { result["error_message"] = message }
      details.append(result)
      if status != "awaiting_admin" { try OperationJournal.outcome(result) }
      event(
        "clean_progress",
        [
          "current_item": path, "progress_fraction": Double(index + 1) / Double(targets.count),
          "trashed_bytes": trashed, "freed_bytes": freed,
        ])
    }
    if !adminPending.isEmpty {
      var outcomes: [Int:String] = [:]
      var adminError: String?
      do { outcomes = try adminRemoveBatch(adminPending) }
      catch { adminError = error.localizedDescription }
      for pending in adminPending {
        let adminStatus = outcomes[pending.index] ?? "outcome_unknown"
        let success = adminStatus == "success"
        var result: [String:Any] = ["path":pending.path,"status":adminStatus, "affected_bytes":success ? pending.bytes : Int64(0),"method_used":"admin_shell"]
        if success { freed += pending.bytes }
        else { result["error_message"] = adminError ?? "\(adminStatus): mục chưa hoàn tất; không tự chạy lại."; result["prior_removal_may_be_partial"]=true }
        details[pending.index] = result
        try OperationJournal.outcome(result)
      }
    }
    let success = details.filter { $0["status"] as? String == "success" }.count
    let response: [String:Any] = [
      "protocol_version":"2.0", "policy_version":CleanupPolicy.version, "platform":"macos", "operation_scope":scope, "operation_id":payload["operation_id"] as? String ?? "", "size_kind":"logical_estimate",
      "permanently_freed_bytes": freed, "trashed_bytes": trashed,
      "total_affected_bytes": freed + trashed,
      "success_count": success, "failure_count": details.count - success,
      "duration_ms": Int(Date().timeIntervalSince(start) * 1000), "details": details,
    ]
    #if ENGINE_TESTING
    var fixtureResponse = response
    fixtureResponse["test_admin_invocations"] = testAdminInvocations
    try OperationJournal.finish(fixtureResponse)
    return fixtureResponse
    #else
    try OperationJournal.finish(response)
    return response
    #endif
  }
  static func adminRemoveBatch(_ items: [AdminTarget]) throws -> [Int:String] {
    #if ENGINE_TESTING
    testAdminInvocations += 1
    #endif
    if OperationJournal.cancelled() { return Dictionary(uniqueKeysWithValues:items.map {($0.index,"admin_not_started")}) }
    func quote(_ value:String)->String {"'" + value.replacingOccurrences(of:"'",with:"'\"'\"'") + "'"}
    func output(_ index:Int,_ status:String)->String {"/usr/bin/printf '%s\t%s\n' '" + String(index) + "' '" + status + "'"}
    #if ENGINE_TESTING
    if let parent=ProcessInfo.processInfo.environment["VXCLEAN_TEST_ADMIN_MISSING_PARENT"] {try fm.removeItem(atPath:parent)}
    #endif
    let lines=items.map {item -> String in
      let parent=url(item.path).deletingLastPathComponent().path
      guard let stamp=item.stamp, let physical=realpath(parent,nil) else {return output(item.index,"guard_rejected")}
      let expectedParent=String(cString:physical);free(physical)
      let path=quote(item.path)
      // Grant is a selected root. Check its metadata again after authentication.
      // No descendant snapshot is claimed for recursive System Junk.
      return "if ! /bin/kill -0 " + String(ProcessInfo.processInfo.processIdentifier)
        + " || test -e " + quote(OperationJournal.cancelPath ?? "/dev/null")
        + "; then " + output(item.index,"admin_not_started")
        + "; elif test ! -L " + path
        + " && test \"$(cd " + quote(parent) + " && /bin/pwd -P)\" = " + quote(expectedParent)
        + " && test \"$(/usr/bin/stat -f '%d:%i:%p:%z:%m:%c' " + path + ")\" = " + quote(stamp)
        + "; then if /bin/rm -rf -- " + path + " && test ! -e " + path + " && test ! -L " + path
        + "; then " + output(item.index,"success") + "; else " + output(item.index,"partial")
        + "; fi; else " + output(item.index,"guard_rejected") + "; fi"
    }
    let shell=lines.joined(separator:"\n")
    func parse(_ text:String)->[Int:String] {
      var result=[Int:String]()
      for line in text.split(whereSeparator:{$0.isNewline}) {
        let fields=line.split(separator:"\t");guard fields.count==2, let index=Int(fields[0]),items.contains(where:{$0.index==index}),["success","partial","guard_rejected","admin_not_started"].contains(String(fields[1])) else {continue}
        result[index]=String(fields[1])
      }
      return result
    }
    #if ENGINE_TESTING
    if let mode=ProcessInfo.processInfo.environment["VXCLEAN_TEST_ADMIN_MODE"] {
      if mode=="cancel" {return Dictionary(uniqueKeysWithValues:items.map {($0.index,"admin_not_started")})}
      guard mode=="success" else {throw failure("invalid fixture admin mode")}
      if let replace=ProcessInfo.processInfo.environment["VXCLEAN_TEST_ADMIN_REPLACE_PATH"] {
        try fm.moveItem(atPath:replace,toPath:replace+".original");try fm.createDirectory(atPath:replace,withIntermediateDirectories:true);try Data("replacement".utf8).write(to:url(replace).appendingPathComponent("keep"))
      }
      if let parent=ProcessInfo.processInfo.environment["VXCLEAN_TEST_ADMIN_REMOVE_PARENT"] {try fm.removeItem(atPath:parent)}
      if let path=ProcessInfo.processInfo.environment["VXCLEAN_TEST_ADMIN_MODIFY_ROOT"] {
        var times=[timeval(tv_sec:time(nil)-30,tv_usec:0),timeval(tv_sec:time(nil)-30,tv_usec:0)];utimes(path,&times)
      }
      let process=Process();process.executableURL=URL(fileURLWithPath:"/bin/sh");process.arguments=["-c",shell];let pipe=Pipe();process.standardOutput=pipe;try process.run();let data=pipe.fileHandleForReading.readDataToEndOfFile();process.waitUntilExit();return parse(String(decoding:data,as:UTF8.self))
    }
    #endif
    let escaped=shell.replacingOccurrences(of:"\\",with:"\\\\").replacingOccurrences(of:"\"",with:"\\\"").replacingOccurrences(of:"\n",with:"\\n").replacingOccurrences(of:"\r",with:"\\r")
    guard let script=NSAppleScript(source:"do shell script \"" + escaped + "\" with administrator privileges") else {throw failure("Không tạo được yêu cầu quản trị")}
    var error:NSDictionary?;let result=script.executeAndReturnError(&error)
    if let error {
      if (error[NSAppleScript.errorNumber] as? NSNumber)?.intValue == -128 {return Dictionary(uniqueKeysWithValues:items.map {($0.index,"admin_not_started")})}
      throw failure("Xác thực hoặc thao tác quản trị thất bại: \(error)")
    }
    return parse(result.stringValue ?? "")
  }
  static func lensRootAllowed(_ path: String) -> Bool {
    let path = url(path).resolvingSymlinksInPath().path
    #if ENGINE_TESTING
      let fixtureHome = url(home).resolvingSymlinksInPath().path
      let externalFixture = url(home).deletingLastPathComponent().resolvingSymlinksInPath().path + "/external"
      if path.hasPrefix(fixtureHome + "/") || path == fixtureHome || path == externalFixture || path.hasPrefix(externalFixture + "/") { return true }
    #endif
    return [home, "/Users", "/Volumes", "/Applications", "/opt"].contains { path == $0 || path.hasPrefix($0 + "/") }
      && !["/System", "/private", "/dev", "/proc", "/usr", "/Library"].contains { path == $0 || path.hasPrefix($0 + "/") }
  }
  static func lensTrashAllowed(_ path: String, root: String) -> Bool {
    let path = url(path).path
    let root = url(root).path
    guard path != root, path.hasPrefix(home + "/"), unchanged(path) else { return false }
    let first = String(path.dropFirst(home.count + 1)).split(separator: "/").first.map(String.init) ?? ""
    guard !first.hasPrefix("."), !["Library", "Applications"].contains(first),
      !highRiskHomeDotPaths.contains(where: { path == $0 || path.hasPrefix($0 + "/") }),
      !url(CommandLine.arguments[0]).path.hasPrefix(path + "/") else { return false }
    return !NSWorkspace.shared.runningApplications.contains { app in
      guard let bundle = app.bundleURL else { return false }
      let bundlePath = url(bundle.path).path
      return bundlePath == path || bundlePath.hasPrefix(path + "/")
    }
  }
  static func hasDenied(_ n: SpaceLensNode) -> Bool {
    n.isAccessDenied || n.hasAccessDeniedDescendants || n.children.contains(where: hasDenied)
  }
  static func node(_ n: SpaceLensNode, depth: Int, root: String) -> [String: Any] {
    var value: [String: Any] = ["name": n.name, "path": url(n.url.path).path, "size_bytes": n.size,
      "is_directory": n.isDirectory, "is_package": n.isPackage, "is_access_denied": n.isAccessDenied,
      "can_trash": !hasDenied(n) && lensTrashAllowed(n.url.path, root: root),
      "item_count": n.children.count + n.prunedCount]
    if depth > 0 { value["children"] = n.children.map { node($0, depth: depth - 1, root: root) } }
    return value
  }
  @MainActor
  static func run() async throws {
    let args = Array(CommandLine.arguments.dropFirst())
    guard let command = args.first else { throw failure("Thiếu lệnh") }
    switch command {
    case "scan":
      let scoped = args.count >= 3 && args[1] == "--scope"
      let scope = scoped ? args[2] : "detailed_cleanup"
      let scanArgs = scoped ? ["scan", "--all"] + Array(args.dropFirst(3)) : args
      guard scanArgs == ["scan", "--all"] || scanArgs == ["scan", "--all", "--include-empty"] else { throw failure("Sai đối số scan") }
      try json(await scan(includeEmpty: args.contains("--include-empty"), scope: scope))
    case "apps":
      guard args == ["apps", "--include-residuals"] else { throw failure("Sai đối số apps") }
      try json(apps())
    case "scan_large_files", "scan_large_root":
      guard command == "scan_large_files" ? args == [command] : args.count == 3 && args[1] == "--path" && ["Downloads", "Documents", "Desktop"].map({home + "/" + $0}).contains(args[2]) else { throw failure("invalid_request") }
      // A killed parent must not leave a worker blocked on an OS/provider read.
      Task.detached(priority:.background) {
        while getppid() != 1 { try? await Task.sleep(nanoseconds:250_000_000) }
        kill(getpid(),SIGKILL)
      }
      #if ENGINE_TESTING
      if ProcessInfo.processInfo.environment["VXCLEAN_TEST_STALL_LARGE_FILES"] == "1" { try await Task.sleep(nanoseconds:60_000_000_000) }
      #endif
      if command == "scan_large_files" { try json(await scanLargeFilesParallel()); return }
      let result=scanLargeFilesLocal(root:args[2])
      let rows=result.0.items.map { item -> [String:Any] in
        var row:[String:Any] = ["name":item.name,"path":item.path,"size":item.size]
        if let modified=item.lastModified {row["modified"]=modified.timeIntervalSince1970}
        return row
      }
      FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject:["items":rows,"is_partial":!result.1.isEmpty,"unreadable_paths":result.1]))
    case "orphans":
      guard args == ["orphans"] else { throw failure("Sai đối số orphans") }
      try json(orphans())
    #if ENGINE_TESTING
    case "fixture_admin_alias":
      guard args == [command], ProcessInfo.processInfo.environment["VXCLEAN_TEST_ADMIN_MODE"] == "success" else { throw failure("invalid fixture admin mode") }
      try OperationJournal.configure(["operation_id":UUID().uuidString],scope:"quick_cleanup")
      let paths = ["/tmp/", "/var/tmp/"].map { $0 + "vxclean_admin_alias_" + UUID().uuidString }
      defer { for path in paths { try? fm.removeItem(atPath:path) } }
      var pending: [AdminTarget] = []
      for (index,path) in paths.enumerated() {
        try Data(repeating:42,count:4096).write(to:URL(fileURLWithPath:path))
        let attrs=try fm.attributesOfItem(atPath:path)
        pending.append(AdminTarget(index,path,4096,(attrs[.systemNumber] as! NSNumber).stringValue,(attrs[.systemFileNumber] as! NSNumber).stringValue))
      }
      let outcomes=try adminRemoveBatch(pending)
      try json(["success_count":outcomes.values.filter {$0 == "success"}.count,"test_admin_invocations":testAdminInvocations,"all_removed":paths.allSatisfy { !fm.fileExists(atPath:$0) }])
    case "fixture_app_launch":
      guard args.count==3, args[1]=="--path", args[2].hasPrefix(home+"/Applications/"), unchanged(args[2]), Bundle(path:args[2])?.bundleIdentifier=="com.lemon.lvoverseas" else { throw failure("invalid_fixture: root=\(home), path=\(args.last ?? ""), args=\(args.count), boundary=\(args.count > 2 && args[2].hasPrefix(home+"/Applications/")), canonical=\(args.count > 2 && unchanged(args[2])), bundle=\(args.count > 2 ? Bundle(path:args[2])?.bundleIdentifier ?? "nil" : "nil")") }
      let configuration=NSWorkspace.OpenConfiguration(); configuration.activates=false; configuration.createsNewApplicationInstance=true
      let app=try await NSWorkspace.shared.openApplication(at:url(args[2]),configuration:configuration)
      try json(["pid":Int(app.processIdentifier)])
    #endif
    case "prepare_apps", "finish_apps":
      guard args == [command, "--stdin"] else { throw failure("invalid_request") }
      let data=FileHandle.standardInput.readDataToEndOfFile()
      guard data.count < 4*1024*1024, let payload=try JSONSerialization.jsonObject(with:data) as? [String:Any] else { throw failure("invalid_request") }
      if command == "prepare_apps" { try json(await AppLifecycle.prepare(payload)) }
      else { try json(await AppLifecycle.finish(payload)) }
    case "clean", "uninstall", "clean_orphans", "trash_lens":
      guard args == [command, "--stdin"] else { throw failure("Sai đối số dọn dẹp") }
      let data = FileHandle.standardInput.readDataToEndOfFile()
      guard data.count < 64 * 1024 * 1024,
        let payload = try JSONSerialization.jsonObject(with: data) as? [String: Any]
      else { throw failure("Payload quá lớn hoặc sai định dạng") }
      try json(
        await clean(
          payload, uninstall: command == "uninstall", orphan: command == "clean_orphans",
          lens: command == "trash_lens"))
    case "lens":
      guard args.count == 5, args[1] == "--path", args[3] == "--depth", let depth = Int(args[4]),
        (1...8).contains(depth)
      else { throw failure("Sai đối số lens") }
      let root = url(args[2]).resolvingSymlinksInPath()
      guard lensRootAllowed(root.path) else { throw failure("Chọn thư mục dữ liệu trong Home, Users, Applications hoặc ổ đĩa ngoài; không quét root/system") }
      var isDir: ObjCBool = false
      guard fm.fileExists(atPath: root.path, isDirectory: &isDir), isDir.boolValue else {
        throw failure("Thư mục không tồn tại")
      }
      let tree = try await CompactLensScanner().scan(root: root, onProgress: { p in
        event("lens_progress", ["current_path": p.currentPath, "scanned_bytes": p.scannedBytes, "item_count": p.itemCount])
      })
      try json([
        "root_path": root.path, "total_analyzed_bytes": tree.size,
        "root_node": node(tree, depth: depth, root: root.path), "is_partial": hasDenied(tree),
      ])
    default: throw failure("Lệnh không được hỗ trợ")
    }
  }
}
