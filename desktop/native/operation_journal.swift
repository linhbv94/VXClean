import Foundation
import Darwin

/// Durable outcomes only; a restart never replays deletion.
struct OperationJournal {
  static var directory: URL?
  static var cancelPath: String?
  static var state = [String: Any]()
  static var eventFD: Int32 = -1
  static var eventBytes = 0
  static func appendEvent(_ phase: String, _ target: [String:Any]) throws {
    var data = try JSONSerialization.data(withJSONObject: ["phase":phase,"target":target], options: [.sortedKeys]); data.append(10)
    guard eventFD >= 0, eventBytes + data.count <= 128*1024*1024 else { throw MaintenanceCLI.failure("journal_limit: chưa xác minh đầy đủ") }
    try data.withUnsafeBytes { bytes in
      var offset=0
      while offset < bytes.count {
        let count=Darwin.write(eventFD,bytes.baseAddress!.advanced(by:offset),bytes.count-offset)
        guard count > 0 else { throw MaintenanceCLI.failure("journal_write_failed") }; offset += count
      }
    }
    guard fsync(eventFD)==0 else { throw MaintenanceCLI.failure("journal_sync_failed") }
    eventBytes += data.count
  }
  static func configure(_ payload: [String: Any], scope: String) throws {
    guard let id = payload["operation_id"] as? String, UUID(uuidString: id) != nil else { throw MaintenanceCLI.failure("invalid_request: operation_id") }
    let root = MaintenanceCLI.url(MaintenanceCLI.home + "/Library/Application Support/com.vxclean.desktop/operations")
    let target = root.appendingPathComponent(id)
    guard MaintenanceCLI.unchanged(root.path), MaintenanceCLI.unchanged(target.path) else { throw MaintenanceCLI.failure("path_changed: journal") }
    try FileManager.default.createDirectory(at: target, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
    if eventFD >= 0 { close(eventFD) }
    eventFD = open(target.appendingPathComponent("events.jsonl").path, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0o600)
    guard eventFD >= 0 else { throw MaintenanceCLI.failure("path_changed: event journal") }
    eventBytes = 0
    directory = target
    cancelPath = target.appendingPathComponent("cancel").path
    state = ["operation_id":id, "operation_scope":scope, "status":"revalidating", "started_at":Date().timeIntervalSince1970, "targets":[] as [[String:Any]], "reopen_obligations":[] as [String], "automatic_replay":false]
    try save()
  }
  static func save() throws {
    guard let directory else { throw MaintenanceCLI.failure("invalid_request: journal") }
    let file = directory.appendingPathComponent("result.json")
    guard MaintenanceCLI.unchanged(file.path) else { throw MaintenanceCLI.failure("path_changed: journal") }
    let data = try JSONSerialization.data(withJSONObject: state, options: [.sortedKeys])
    try data.write(to: file, options: .atomic)
    try FileManager.default.setAttributes([.posixPermissions:0o600], ofItemAtPath:file.path)
  }
  static func cancelled() -> Bool {
    (cancelPath.map { FileManager.default.fileExists(atPath:$0) } ?? false) || getppid() == 1
  }
  static func intent(_ path: String, method: String) throws {
    guard !cancelled() else { throw MaintenanceCLI.failure("cancelled") }
    var targets = state["targets"] as? [[String:Any]] ?? []
    let entry:[String:Any] = ["path":path, "method":method, "status":"outcome_unknown", "intent_at":Date().timeIntervalSince1970]
    targets.append(entry)
    let first = state["status"] as? String != "mutating"
    state["targets"] = targets; state["status"] = "mutating"
    if first { try save() }
    try appendEvent("intent",entry)
  }
  static func outcome(_ result: [String:Any]) throws {
    var targets = state["targets"] as? [[String:Any]] ?? []
    if let i = targets.lastIndex(where: { $0["path"] as? String == result["path"] as? String }) { targets[i] = result }
    else { targets.append(result) }
    // Every exact event is durable on disk. Bound successful in-memory history;
    // never discard unresolved/error targets from recovery state.
    while targets.filter({$0["status"] as? String == "success"}).count > 200,
      let first=targets.firstIndex(where:{$0["status"] as? String == "success"}) {targets.remove(at:first)}
    state["targets"] = targets
    try appendEvent("outcome",result)
  }
  static func finish(_ result: [String:Any]) throws {
    state["status"] = cancelled() ? "cancelled" : ((result["failure_count"] as? Int ?? 0) > 0 ? "partial" : "completed")
    state["result"] = result; state["finished_at"] = Date().timeIntervalSince1970
    try save()
  }
}
