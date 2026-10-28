#!/usr/bin/env python3
"""Regression destructive commands only inside a temporary synthetic home.
ENGINE_TESTING is compiled into a separate binary; production cannot override the home.
"""
import json
import os
from pathlib import Path
import plistlib
import subprocess
import tempfile
import uuid
import shutil
import time

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ["desktop/native/app_lifecycle.swift", "desktop/native/operation_journal.swift", "desktop/native/cleanup_policy.swift", "desktop/native/compact_lens_scanner.swift", 'MClean/Services/ScanEngine.swift', 'MClean/Models/Models.swift', 'MClean/Logic/Utilities/Logger.swift', 'MClean/Logic/Utilities/FileSize.swift', "desktop/native/main.swift", "desktop/native/maintenance_cli.swift", "desktop/native/manager_cleanup.swift", "MClean/Services/SystemMonitor.swift", "MClean/Services/SpaceLensEngine.swift", "MClean/Models/SpaceLensNode.swift", "MClean/Logic/Scanning/Conditions.swift", "MClean/Logic/Scanning/StringNormalization.swift", "MClean/Logic/Utilities/OrphanSafetyPolicy.swift"]

def run_tests():
    with tempfile.TemporaryDirectory(prefix=".vxclean_fixture_", dir=ROOT / "desktop/native") as temp:
        base = Path(temp).resolve()
        fixture = base / "home"
        fixture.mkdir()
        marker = ("vxclean_fixture_" + uuid.uuid4().hex).encode()
        env = dict(os.environ, VXCLEAN_TEST_HOME=str(fixture))
        binary = base / "fixture_engine"
        sdk = subprocess.check_output(["/usr/bin/xcrun", "--sdk", "macosx", "--show-sdk-path"], env=env, text=True).strip()
        compiled = subprocess.run(["/usr/bin/xcrun", "swiftc", "-D", "ENGINE_TESTING", "-parse-as-library", "-sdk", sdk, "-module-cache-path", "/tmp/vxclean_swift_module_cache", *[str(ROOT / f) for f in SOURCES], "-o", str(binary)], env=env, capture_output=True, timeout=120)
        assert compiled.returncode == 0, compiled.stderr.decode()
        # Independent baseline: compile the original imported MClean scanner,
        # not the modified VXClean scanner. Only remap roots to our synthetic home.
        original = subprocess.check_output(["git", "show", "42cf1f8:MClean/Services/ScanEngine.swift"], cwd=ROOT, text=True)
        reference_source = original.replace("private let home = FileManager.default.homeDirectoryForCurrentUser.path", 'private let home = ProcessInfo.processInfo.environment["VXCLEAN_TEST_HOME"]!')
        for original_root in ["/Library/Caches", "/Library/Logs", "/private/var/log", "/tmp", "/private/var/tmp"]:
            reference_source = reference_source.replace('"' + original_root + '"', '"\\(home)/system' + original_root + '"')
        reference_swift = base / "mclean_reference.swift"
        reference_swift.write_text(reference_source)
        driver = base / "reference_main.swift"
        driver.write_text('import Foundation\n@main struct ReferenceMain { static func main() async throws { let r = await ScanEngine().scanCategory(.systemJunk); let rows = r.items.map { ["path":$0.path,"size_bytes":$0.size,"selected":$0.isSelected] as [String:Any] }; FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject:rows)) } }')
        reference_binary = base / "mclean_reference"
        reference_compile = subprocess.run(["/usr/bin/xcrun", "swiftc", "-parse-as-library", "-sdk", sdk, "-module-cache-path", "/tmp/vxclean_swift_module_cache", str(reference_swift), str(driver), str(ROOT / "MClean/Models/Models.swift"), str(ROOT / "MClean/Logic/Utilities/Logger.swift"), str(ROOT / "MClean/Logic/Utilities/FileSize.swift"), "-o", str(reference_binary)], env=env, capture_output=True, timeout=120)
        assert reference_compile.returncode == 0, reference_compile.stderr.decode()
        checks = []
        trash_outcomes = []
        memory_checks=[]
        def invoke(args, payload=None, timeout=30, measure_memory=False):
            if payload is not None:
                payload = dict(payload)
                payload.setdefault("protocol_version", "2.0")
                payload.setdefault("platform", "macos")
                payload.setdefault("policy_version", "1.0.0")
                payload.setdefault("operation_id", str(uuid.uuid4()))
                payload.setdefault("operation_scope", {"clean":"detailed_cleanup", "uninstall":"uninstall", "clean_orphans":"orphan_cleanup", "trash_lens":"lens_trash"}.get(args[0], ""))
                requested = payload.get("selected_paths", []) + [t["path"] for t in payload.get("targets", [])]
                payload.setdefault("content_snapshots", {p: manifest(Path(p), root_only=payload.get("operation_scope") == "uninstall" or payload.get("operation_scope") == "quick_cleanup" and "/system/" in p or payload.get("operation_scope") == "quick_cleanup" and "/Library/Logs/" in p) for p in requested if Path(p).exists() and not Path(p).is_symlink()})
                payload.setdefault("operation_scope", {"clean":"detailed_cleanup", "uninstall":"uninstall", "clean_orphans":"orphan_cleanup", "trash_lens":"lens_trash"}.get(args[0], ""))
            proc = subprocess.run((["/usr/bin/time","-l"] if measure_memory else [])+[str(binary), *args], input=json.dumps(payload).encode() if payload else None, capture_output=True, env=env, timeout=timeout)
            assert proc.returncode == 0, proc.stderr.decode()
            if measure_memory:
                rss=next(int(line.split()[0]) for line in proc.stderr.decode().splitlines() if "maximum resident set size" in line)
                memory_checks.append({"scenario":"native_chrome_7000_cache_files","peak_rss_bytes":rss})
            return json.loads(proc.stdout)
        def make(path, content=b"f" * 2048):
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
            return path
        def manifest(path, root_only=False):
            entries = [path]
            if path.is_dir() and not root_only:
                for parent, dirs, files in os.walk(path, followlinks=False):
                    entries += [Path(parent) / n for n in dirs + files]
            rows=[]
            for p in sorted(entries, key=str):
                st=p.lstat()
                rows.append(dict(path=str(p), device=st.st_dev, inode=st.st_ino, mode=st.st_mode, size=st.st_size, modified_s=st.st_mtime_ns//1000000000, modified_ns=st.st_mtime_ns%1000000000, changed_s=st.st_ctime_ns//1000000000, changed_ns=st.st_ctime_ns%1000000000))
            return rows
        def identities(paths):
            return {str(p): [p.stat().st_dev, p.stat().st_ino] for p in paths}
        def clean(path, method="remove_item", confirm=True, stamp=None, scope="detailed_cleanup", timeout=30, measure_memory=False):
            return invoke(["clean", "--stdin"], {"operation_scope":scope, "targets": [{"path": str(path), "deletion_method": method}], "confirm_direct_delete": confirm, "identities": stamp or identities([path])}, timeout=timeout, measure_memory=measure_memory)
        empty_scan = invoke(["scan", "--all"])
        assert not any(c["category"] == "xcode_junk" for c in empty_scan["categories"])
        detailed = invoke(["scan", "--all", "--include-empty"])
        assert len(detailed["categories"]) == 12
        assert {c["category"] for c in detailed["categories"]} == {"large_files", "mail_downloads", "trash_bin", "brew_cache", "node_cache", "docker_cache", "ai_apps", "system_junk", "xcode_junk", "user_caches", "chrome", "media_apps"}
        checks.append("detailed_scan_has_twelve_categories_with_policy_metadata")
        # Actual Foundation disk layout, cold cache reads, native cleanup and regeneration.
        http_root = fixture / "Library/Caches/com.apple.helpd"
        http_root.mkdir(parents=True)
        def http_cache(action):
            out = subprocess.check_output(["/usr/bin/xcrun", "swift", "-module-cache-path", "/tmp/vxclean_swift_module_cache", str(ROOT / "scripts/urlcache_fixture.swift"), action, str(http_root)], env=env, timeout=30, text=True)
            return int(out.strip())
        assert http_cache("store") == 500000 and http_cache("read") == 500000
        state = make(http_root / "Preferences", b"keep-state")
        db_before = {str(p): p.read_bytes() for p in http_root.glob("Cache.db*")}
        quick_http = invoke(["scan", "--scope", "quick_cleanup", "--include-empty"])
        http_items = [i for c in quick_http["categories"] for i in c["items"] if i["path"].startswith(str(http_root))]
        payload_dir = http_root / "fsCachedData"
        assert next(i for i in http_items if i["path"] == str(payload_dir))["is_cleanable"]
        assert next(i for i in quick_http["excluded_items"] if i["path"] == str(http_root))["is_cleanable"] is False
        assert sum(i["size_bytes"] for i in http_items + [i for i in quick_http["excluded_items"] if i["path"].startswith(str(http_root))]) == sum(p.stat().st_size for p in http_root.rglob("*") if p.is_file())
        result = invoke(["clean", "--stdin"], {"operation_scope":"quick_cleanup", "targets":[{"path":str(payload_dir),"deletion_method":"remove_item"}],"confirm_direct_delete":True,"identities":identities([payload_dir])})
        assert result["success_count"] == 1 and state.read_bytes() == b"keep-state"
        assert all(Path(p).read_bytes() == data for p, data in db_before.items())
        assert http_cache("read") == -1 and http_cache("store") == 500000 and http_cache("read") == 500000
        assert clean(http_root)["failure_count"] == 1
        foreign = make(payload_dir / "project.db")
        assert clean(payload_dir)["failure_count"] == 1 and foreign.exists()
        foreign.unlink()
        checks.append("foundation_http_payload_cold_miss_regeneration_database_and_state_preserved")
        old_report = make(fixture / "Library/Logs/DiagnosticReports/old.ips")
        os.utime(old_report, (time.time()-8*86400, time.time()-8*86400))
        new_report = make(old_report.parent / "new.ips")
        other_report = make(old_report.parent / "project.db")
        nested_report = make(old_report.parent / "keep/nested.ips")
        os.utime(nested_report, (time.time()-8*86400, time.time()-8*86400))
        report_scan = invoke(["scan", "--scope", "quick_cleanup", "--include-empty"])
        reports = {i["path"]:i for c in report_scan["categories"] for i in c["items"]}
        assert str(old_report.parent) in reports
        assert reports[str(old_report.parent)]["is_cleanable"] is True
        assert not any(i["path"] == str(old_report.parent) for i in report_scan["excluded_items"])
        assert clean(old_report)["failure_count"] == 1 and old_report.exists()
        assert clean(new_report)["failure_count"] == 1 and clean(other_report)["failure_count"] == 1
        assert clean(nested_report)["failure_count"] == 1
        checks.append("quick_owns_diagnostics_detailed_cannot_borrow_child_authority")
        cache = make(fixture / "Library/Caches/org.fixture.safe/payload.bin")
        archive = make(fixture / "Library/Developer/Xcode/Archives/release.xcarchive/dsym.bin")
        trash = make(fixture / ".Trash/old.bin")
        document = make(fixture / "Documents/keep.txt")
        (fixture / "Library/Caches/redirect").symlink_to(document.parent)
        scan = invoke(["scan", "--all"])
        items = [item for cat in scan["categories"] for item in cat["items"]]
        assert all(item["name"] != "redirect" for item in items)
        assert next(item for item in items if item["category"] == "xcode_junk")["is_selected_by_default"] is False
        assert next(item for item in items if item["category"] == "trash_bin")["is_selected_by_default"] is False
        system_cache = make(fixture / "system/Library/Caches/org.fixture.system/payload")
        user_log = make(fixture / "Library/Logs/org.fixture.logs/log")
        node = make(fixture / ".npm/_cacache/data")
        ai_log = make(fixture / "Library/Application Support/Antigravity IDE/logs/server.log")
        history = make(fixture / ".codex/sessions/history.jsonl")
        large = make(fixture / "Downloads/large.bin")
        with large.open("r+b") as f: f.truncate(101 * 1024 * 1024)
        scan = invoke(["scan", "--all"])
        items = [item for cat in scan["categories"] for item in cat["items"]]
        by_path = {item["path"].replace("/var/", "/private/var/", 1) if item["path"].startswith("/var/") else item["path"]: item for item in items}
        assert str(user_log.parent) not in by_path
        assert str(system_cache.parent) not in by_path
        assert by_path[str(node.parent)]["category"] == "node_cache"
        assert any(item["category"] == "node_cache" for item in items)
        assert by_path[str(history.parent)]["is_selected_by_default"] is False
        assert by_path[str(history.parent)]["is_cleanable"] is False
        assert str(large) not in by_path
        quick_large = invoke(["scan", "--scope", "quick_cleanup"])
        large_row = next(i for c in quick_large["categories"] for i in c["items"] if i["path"] == str(large))
        assert not large_row["is_selected_by_default"] and large_row["deletion_method"] == "trash"
        checks.append("scope_groups_ai_history_protected_large_files_opt_in_symlink_exclusion")
        result = clean(cache.parent, confirm=False, scope="quick_cleanup")
        assert result["failure_count"] == 1 and cache.exists()
        assert clean(document)["failure_count"] == 1 and document.exists()
        assert clean(archive.parent)["failure_count"] == 1 and archive.exists()
        assert clean(fixture / "Library/Caches/redirect")["failure_count"] == 1 and document.exists()
        assert clean(cache.parent, stamp={str(cache.parent): [0, 0]}, scope="quick_cleanup")["failure_count"] == 1
        checks.append("reject_missing_confirmation_outside_roots_wrong_method_symlinks_identity")
        result = clean(cache.parent, scope="quick_cleanup")
        assert result["success_count"] == 1 and result["permanently_freed_bytes"] == 2048 and not cache.exists() and cache.parent.exists(), result
        assert result["trashed_bytes"] == 0
        assert clean(trash)["failure_count"] == 1 and trash.exists()
        assert clean(system_cache.parent, scope="quick_cleanup")["success_count"] == 1 and not system_cache.exists()
        assert clean(user_log.parent)["failure_count"] == 1 and user_log.exists()
        result = invoke(["clean", "--stdin"], {"targets": [
            {"path": str(node.parent.parent), "deletion_method": "remove_item"},
            {"path": str(node.parent), "deletion_method": "remove_item"}],
            "confirm_direct_delete": True, "identities": identities([node.parent.parent, node.parent])})
        assert result["success_count"] == 0 and result["failure_count"] == 1 and node.exists(), result
        result = clean(node.parent)
        assert result["success_count"] == 1 and result["permanently_freed_bytes"] == 2048 and not node.exists(), result
        checks.append("maintained_system_cache_removed_fresh_logs_trash_and_mixed_npm_blocked")
        # Maintained MClean quick roots; mixed protected children are partitioned, never wiped.
        ordinary = make(fixture / "Library/Caches/org.fixture.ordinary/http/payload")
        mixed = make(fixture / "Library/Caches/org.fixture.mixed/http/disposable")
        critical = make(fixture / "Library/Caches/org.fixture.mixed/Projects/keep")
        runtime = make(fixture / "Library/Caches/org.fixture.mixed/node_modules/keep")
        active = make(fixture / "system/tmp/session/active.lock")
        aged = make(active.parent / "old.bin")
        old_log = make(fixture / "Library/Logs/org.fixture.logs/old.log")
        for old in [aged, old_log]: os.utime(old,(time.time()-2*86400,time.time()-2*86400))
        quick = invoke(["scan", "--scope", "quick_cleanup", "--include-empty"])
        quick_rows = {i["path"]:i for c in quick["categories"] for i in c["items"]}
        assert quick_rows[str(ordinary.parent.parent)]["is_selected_by_default"] is True
        assert next(i for i in quick["excluded_items"] if i["path"] == str(mixed.parent.parent))["is_cleanable"] is False
        assert quick_rows[str(mixed.parent)]["is_cleanable"] is True
        assert quick_rows[str(active.parent)]["is_cleanable"] is True
        assert quick_rows[str(active.parent)]["is_cleanable"] is True and quick_rows[str(old_log.parent)]["is_cleanable"] is True
        assert clean(mixed.parent.parent)["failure_count"] == 1
        for target in [ordinary.parent.parent,mixed.parent,active.parent,old_log.parent]:
            result = invoke(["clean", "--stdin"], {"operation_scope":"quick_cleanup","targets":[{"path":str(target),"deletion_method":"remove_item"}],"confirm_direct_delete":True,"identities":identities([target])})
            assert result["success_count"] == 1, result
        assert not ordinary.exists() and not mixed.exists() and not aged.exists() and not old_log.exists()
        assert critical.exists() and runtime.exists() and not active.exists()
        structural = fixture / "Library/Caches"
        assert clean(structural)["failure_count"] == 1
        os_critical = make(fixture / "system/System/Library/keep")
        assert clean(os_critical)["failure_count"] == 1 and os_critical.exists()
        excluded = make(fixture / "Library/Caches/com.fixture.updater/pending/payload")
        assert clean(excluded.parent.parent)["failure_count"] == 1 and excluded.exists()
        temp_tool = make(fixture / "system/tmp/vx_release_setup/cli/bin/tool")
        temp_exec = make(fixture / "system/tmp/old_executable")
        temp_ipc = make(fixture / "system/tmp/boost_interprocess/shared")
        temp_exec.chmod(0o755)
        for keep in []:
            os.utime(keep,(time.time()-2*86400,time.time()-2*86400))
            assert clean(keep)["failure_count"] == 1 and keep.exists()
        tool_scan = invoke(["scan", "--scope", "quick_cleanup", "--include-empty"])
        tool_rows = [i for c in tool_scan["categories"] for i in c["items"]]
        for disposable in [temp_tool,temp_exec,temp_ipc]:
            advertised = next(i for i in tool_rows if str(disposable) == i["path"] or str(disposable).startswith(i["path"] + "/"))
            target = Path(advertised["path"])
            result = invoke(["clean", "--stdin"], {"operation_scope":"quick_cleanup","targets":[{"path":str(target),"deletion_method":"remove_item"}],"confirm_direct_delete":True,"identities":identities([target])})
            assert result["success_count"] == 1 and not disposable.exists(), result
        after = invoke(["scan", "--scope", "quick_cleanup", "--include-empty"])
        after_rows = {i["path"]:i for c in after["categories"] for i in c["items"]}
        assert str(ordinary.parent.parent) not in after_rows or after_rows[str(ordinary.parent.parent)]["size_bytes"] == 0
        assert critical.exists() and runtime.exists() and not active.exists()
        checks.append("mclean_system_junk_full_temp_rules_user_cache_protection_unchanged")
        # Recursive removal can fail after deleting children; retain an unknown outcome.
        partial_root = fixture / "system/tmp/partial_remove"
        removed = make(partial_root / "removed.bin")
        retained = make(partial_root / "retained.bin", b"must-stay" * 400)
        env["VXCLEAN_TEST_PARTIAL_SYSTEM_REMOVE"] = str(partial_root)
        try:
            partial = clean(partial_root, scope="quick_cleanup")
        finally:
            env.pop("VXCLEAN_TEST_PARTIAL_SYSTEM_REMOVE")
        assert partial["success_count"] == 0 and partial["failure_count"] == 1
        assert partial["details"][0]["status"] == "outcome_unknown" and partial["permanently_freed_bytes"] == 0
        assert not removed.exists() and retained.exists()
        journal = json.loads((fixture / "Library/Application Support/com.vxclean.desktop/operations" / partial["operation_id"] / "result.json").read_text())
        assert journal["targets"][0]["status"] == "outcome_unknown" and journal["automatic_replay"] is False
        checks.append("system_recursive_partial_failure_keeps_unknown_journal_no_false_skip_or_replay")
        # Isolated full-result parity: every advertised Quick target is actually cleaned.
        prior_env = env
        parity_home = base / "parity_home"
        parity_home.mkdir()
        env = dict(prior_env, VXCLEAN_TEST_HOME=str(parity_home))
        try:
            cache_paths = [
                parity_home / "system/tmp/session/new.lock",
                parity_home / "system/tmp/profile_copy/Default/Bookmarks",
                parity_home / "system/tmp/boost_interprocess/shared.db",
                parity_home / "Library/Caches/Google/Chrome/Default/Cache/Cache_Data/body",
                parity_home / "Library/Caches/Adobe/Premiere Pro/cache/body",
                parity_home / "Library/Caches/Codex/Default/Cache/Cache_Data/body",
                parity_home / "Library/Caches/org.fixture.other/body",
                parity_home / "system/Library/Caches/org.fixture.os/body",
                parity_home / "system/tmp/vxclean_npm_cache/_cacache/content-v2/hash",
                parity_home / "system/tmp/vxclean_swift_module_cache/module.pcm",
                parity_home / "system/tmp/vx_release_setup/cli/bin/tool",
                parity_home / "system/tmp/vxclean_signature_check/target/debug/lib.rlib",
                parity_home / "system/tmp/vx_video_playback_qa/swift_cache/module.pcm",
                parity_home / "system/tmp/build_env/node_modules/pkg/runtime.js",
                parity_home / "system/tmp/build_env/config.json",
                parity_home / "system/tmp/build_env/compile.swift",
            ]
            for disposable in cache_paths: make(disposable, b"cache" * 4000)
            (parity_home / "system/tmp/vx_release_setup/cli/bin/tool").chmod(0o755)
            many = parity_home / "system/tmp/many_entries"
            many.mkdir()
            for n in range(20001): (many / str(n)).write_bytes(b"x")
            make(many / "payload", b"large-directory" * 1000)
            cache_paths.append(many / "payload")
            xcode_copy = make(parity_home / "system/tmp/qa/Library/Developer/Xcode/Archives/Projects/BookMarks", b"temporary-copy" * 1000)
            cache_paths.append(xcode_copy)
            kept = [
                make(parity_home / "Library/Caches/Google/Chrome/Default/History", b"unique-history"),
                make(parity_home / "Library/Caches/Codex/Default/Local Storage/leveldb/state", b"unique-state"),
                make(parity_home / "Library/Caches/com.google.antigravity/update.zip", b"active-update" * 1000),
                make(parity_home / "Library/Caches/com.google.antigravity/pending/update.zip", b"pending-update" * 1000),
                make(parity_home / "Library/Caches/com.google.antigravity.ShipIt/update.current/App.app/Contents/MacOS/app", b"updater-staging" * 1000),
                make(parity_home / "Library/Caches/org.fixture.other/Projects/keep", b"project"),

            ]
            foundation_root = parity_home / "Library/Caches/com.apple.helpd"
            foundation_root.mkdir(parents=True)
            def parity_http(action):
                return int(subprocess.check_output(["/usr/bin/xcrun", "swift", "-module-cache-path", "/tmp/vxclean_swift_module_cache", str(ROOT / "scripts/urlcache_fixture.swift"), action, str(foundation_root)], env=env, timeout=30, text=True).strip())
            assert parity_http("store") == 500000 and parity_http("read") == 500000
            kept.append(make(foundation_root / "Preferences", b"keep-preferences"))
            alias = make(parity_home / "Documents/hardlink_source", b"outside-alias" * 1000)
            linked = parity_home / "system/tmp/hardlinked/object.o"
            linked.parent.mkdir(parents=True); os.link(alias, linked)
            cache_paths.append(linked); kept.append(alias)
            kept_bytes = {str(path): path.read_bytes() for path in kept}
            reference_rows = json.loads(subprocess.check_output([str(reference_binary)], env=env, timeout=30))
            parity = invoke(["scan", "--scope", "quick_cleanup", "--include-empty"])
            actual_system = next(c for c in parity["categories"] if c["category"] == "system_junk")["items"]
            expected_map = {row["path"]:row["size_bytes"] for row in reference_rows}
            actual_map = {row["path"]:row["size_bytes"] for row in actual_system}
            assert actual_map == expected_map, (actual_map, expected_map)
            assert all(row["is_cleanable"] and row["is_selected_by_default"] for row in actual_system)
            checks.append("system_junk_exact_path_size_default_selection_parity_with_independent_original_mclean_42cf1f8_reference")
            advertised = [item for category in parity["categories"] for item in category["items"]]
            assert advertised and all(item["is_cleanable"] and item["size_bytes"] > 0 for item in advertised)
            assert parity["total_cleanable_bytes"] == sum(category["total_bytes"] for category in parity["categories"]) == sum(item["size_bytes"] for item in advertised)
            for disposable in cache_paths:
                assert any(str(disposable) == item["path"] or str(disposable).startswith(item["path"] + "/") for item in advertised), disposable
            assert any("ShipIt" in item["path"] for item in parity["excluded_items"])
            targets = [dict(path=item["path"], deletion_method=item["deletion_method"]) for item in advertised]
            result = invoke(["clean", "--stdin"], dict(operation_scope="quick_cleanup", targets=targets, confirm_direct_delete=True, identities=identities([Path(target["path"]) for target in targets])))
            assert result["failure_count"] == 0 and result["success_count"] == len(targets), result
            assert result["permanently_freed_bytes"] == parity["total_cleanable_bytes"], result
            after = invoke(["scan", "--scope", "quick_cleanup", "--include-empty"])
            assert after["total_cleanable_bytes"] == 0, after
            assert all(not disposable.exists() for disposable in cache_paths)
            assert all(Path(path).read_bytes() == data for path, data in kept_bytes.items())
            assert all(not category["items"] for category in after["categories"])
            assert parity_http("read") == -1 and parity_http("store") == 500000 and parity_http("read") == 500000
            checks.append("quick_all_advertised_targets_cleaned_exact_bytes_profile_copy_lock_ipc_hardlink_external_alias_preserved")
        finally:
            env = prior_env
        # Untrusted CLI destinations: no destructive command may accept Documents/Home.
        npm_cli = make(fixture / ".local/bin/npm", b"#!/bin/sh\nprintf '%s\\n' '" + str(document.parent).encode() + b"'\n")
        npm_cli.chmod(0o755)
        custom = invoke(["scan", "--all"])
        assert not any(i["path"] == str(document.parent) for c in custom["categories"] for i in c["items"])
        assert str(document.parent) in custom["unsupported_cache_paths"]
        assert "node_cache" not in custom["fda_limited_categories"]
        assert clean(document.parent)["failure_count"] == 1 and document.read_bytes() == b"f" * 2048
        valid_node = make(fixture / ".cache/npm/_cacache/data")
        npm_cli.write_text("#!/bin/sh\nprintf '%s\\n' '" + str(valid_node.parent.parent) + "'\n")
        custom = invoke(["scan", "--all"])
        assert any(Path(i["path"]).resolve() == valid_node.parent for c in custom["categories"] if c["category"] == "node_cache" for i in c["items"])
        for bad_path in [str(fixture), "/System", "relative/cache", str(fixture / "Documents/../Documents"), str(fixture / ".cache/npm_link")]:
            npm_cli.write_text("#!/bin/sh\nprintf '%s\\n' '" + bad_path + "'\n")
            custom = invoke(["scan", "--all"])
            assert not any(i["path"] == bad_path for c in custom["categories"] if c["category"] == "node_cache" for i in c["items"])
        (fixture / ".cache/npm_link").symlink_to(document.parent)
        npm_cli.write_text("#!/bin/sh\nprintf '%s\\n' '" + str(fixture / ".cache/npm_link") + "'\n")
        assert clean(fixture / ".cache/npm_link")["failure_count"] == 1 and document.exists()
        quick_marker = fixture / "npm_was_probed"
        npm_cli.write_text("#!/bin/sh\necho probe >> '" + str(quick_marker) + "'\nprintf '%s\\n' '" + str(fixture / ".npm") + "'\n")
        quick = invoke(["scan", "--scope", "quick_cleanup", "--include-empty"])
        assert [c["category"] for c in quick["categories"]] == ["system_junk", "user_caches", "large_files"]
        assert not quick_marker.exists()
        safe_quick = make(fixture / "Library/Caches/org.fixture.safe/quick.bin")
        quick_result = invoke(["clean", "--stdin"], {"operation_scope":"quick_cleanup", "targets":[{"path":str(safe_quick.parent),"deletion_method":"remove_item"}],"confirm_direct_delete":True,"identities":identities([safe_quick.parent])})
        assert quick_result["success_count"] == 1 and not quick_marker.exists()
        chrome_root = fixture / "Library/Caches/Google/Chrome"
        live_payload = make(chrome_root / "Default/Cache/Cache_Data/live", marker * 40)
        old_chrome_manifest = manifest(chrome_root)
        root_stamp = identities([chrome_root])
        live_payload.write_bytes(marker * 100)
        new_payload = make(chrome_root / "Profile 1/Code Cache/new", marker * 40)
        chrome_profile = make(fixture / "Library/Application Support/Google/Chrome/Default/Cookies", marker)
        env["VXCLEAN_TEST_LIVE_CHROME_APPEND"] = str(live_payload)
        try:
            live_result = invoke(["clean", "--stdin"], {"operation_scope":"quick_cleanup", "targets":[{"path":str(chrome_root),"deletion_method":"remove_item"}],"confirm_direct_delete":True,"identities":root_stamp,"content_snapshots":{str(chrome_root):old_chrome_manifest}})
        finally:
            env.pop("VXCLEAN_TEST_LIVE_CHROME_APPEND")
        assert live_result["success_count"] == 1 and not live_payload.exists() and not new_payload.exists(), live_result
        assert chrome_root.is_dir() and chrome_profile.read_bytes() == marker
        assert live_result["permanently_freed_bytes"] == len(marker) * 140 + 4
        for malicious in ["symlink", "hardlink", "Cookies"]:
            kept = make(chrome_root / "Default/Cache/Cache_Data/keep", marker * 40)
            proof = manifest(chrome_root)
            injected = chrome_root / "Default/Cache/Cache_Data" / malicious
            if malicious == "symlink": injected.symlink_to(chrome_profile)
            elif malicious == "hardlink": os.link(chrome_profile, injected)
            else: injected.write_bytes(marker)
            rejection = invoke(["clean", "--stdin"], {"operation_scope":"quick_cleanup", "targets":[{"path":str(chrome_root),"deletion_method":"remove_item"}],"confirm_direct_delete":True,"identities":identities([chrome_root]),"content_snapshots":{str(chrome_root):proof}})
            assert rejection["failure_count"] == 1 and kept.exists() and chrome_profile.read_bytes() == marker
            injected.unlink()
        assert clean(chrome_root)["failure_count"] == 1 and kept.exists()
        assert clean(chrome_root, scope="quick_cleanup")["success_count"] == 1 and not kept.exists()
        checks.append("live_chrome_quick_cache_refresh_preserves_profile_rejects_links_and_state_detailed_stays_strict")
        codex_root = fixture / "Library/Caches/Codex"
        codex_body = make(codex_root / "Default/Cache/Cache_Data/body", marker * 40)
        codex_proof = manifest(codex_root)
        codex_stamp = identities([codex_root])
        codex_body.write_bytes(marker * 100)
        codex_new = make(codex_root / "Default/Code Cache/new", marker * 40)
        codex_state = make(fixture / "Library/Application Support/Codex/User/globalStorage/state.vscdb", marker)
        codex_runtime = make(fixture / ".codex/plugins/cache/runtime", marker)
        env["VXCLEAN_TEST_LIVE_CHROME_APPEND"] = str(codex_body)
        try:
            codex_result = invoke(["clean", "--stdin"], {"operation_scope":"quick_cleanup", "targets":[{"path":str(codex_root),"deletion_method":"remove_item"}],"confirm_direct_delete":True,"identities":codex_stamp,"content_snapshots":{str(codex_root):codex_proof}})
        finally:
            env.pop("VXCLEAN_TEST_LIVE_CHROME_APPEND")
        assert codex_result["success_count"] == 1 and not codex_body.exists() and not codex_new.exists(), codex_result
        assert codex_result["permanently_freed_bytes"] == len(marker) * 140 + 4
        assert codex_state.read_bytes() == marker and codex_runtime.read_bytes() == marker
        kept_codex = make(codex_root / "Default/Cache/Cache_Data/keep", marker * 40)
        before = manifest(codex_root)
        injected_codex = make(codex_root / "Default/Local Storage/leveldb/state", marker)
        denied = invoke(["clean", "--stdin"], {"operation_scope":"quick_cleanup", "targets":[{"path":str(codex_root),"deletion_method":"remove_item"}],"confirm_direct_delete":True,"identities":identities([codex_root]),"content_snapshots":{str(codex_root):before}})
        assert denied["failure_count"] == 1 and kept_codex.exists() and injected_codex.read_bytes() == marker
        injected_codex.unlink(); injected_codex.parent.rmdir(); injected_codex.parent.parent.rmdir()
        old_codex_stamp = identities([codex_root]); moved_codex = codex_root.with_name("codex_moved_fixture")
        codex_root.rename(moved_codex)
        replacement_codex = make(codex_root / "Default/Cache/Cache_Data/new", marker * 40)
        assert clean(codex_root, stamp=old_codex_stamp, scope="quick_cleanup")["failure_count"] == 1 and replacement_codex.exists()
        checks.append("live_codex_quick_cache_preserves_history_runtime_rejects_state_injection_and_root_replacement")
        wifi = make(fixture / "system/private/var/log/wifi.log", marker * 40)
        rotated_wifi = make(wifi.with_name("wifi.log.0.bz2"), marker * 40)
        wifi_scan = invoke(["scan", "--scope", "quick_cleanup", "--include-empty"])
        assert not any(i["path"] == str(wifi) for c in wifi_scan["categories"] for i in c["items"])
        assert not any(i["path"] == str(wifi) for i in wifi_scan["excluded_items"])
        assert any(i["path"] == str(rotated_wifi) and i["is_cleanable"] for c in wifi_scan["categories"] for i in c["items"])
        assert clean(wifi, scope="quick_cleanup")["failure_count"] == 1 and wifi.read_bytes() == marker * 40
        assert clean(rotated_wifi, scope="quick_cleanup")["success_count"] == 1 and not rotated_wifi.exists() and wifi.exists()
        checks.append("active_wifi_log_absent_from_quick_scope_and_revalidation_rotated_log_still_cleanable")
        runtime = make(fixture / ".npm/_npx/tool/runtime", marker)
        assert clean(runtime.parent.parent.parent)["failure_count"] == 1 and runtime.read_bytes() == marker
        cef = fixture / "Movies/CapCut/User Data/CEF/Cache"
        http = make(cef / "Cache/payload", marker)
        cookie = make(cef / "Cookies", marker)
        project = make(fixture / "Movies/CapCut/User Data/Projects/keep", marker)
        media_scan = invoke(["scan", "--scope", "detailed_cleanup", "--include-empty"])
        media_rows = next(c for c in media_scan["categories"] if c["category"] == "media_apps")["items"]
        assert next(i for i in media_rows if Path(i["path"]).resolve()==http.parent)["is_cleanable"] is True
        assert clean(cef)["failure_count"] == 1
        assert clean(http.parent)["success_count"] == 1 and not http.exists()
        assert cookie.read_bytes() == marker and project.read_bytes() == marker
        stale = make(cef / "Cache/stale", marker)
        snapshot_before = manifest(stale.parent)
        injected = make(stale.parent / "Cookies", marker)
        stale_result = invoke(["clean","--stdin"], {"targets":[{"path":str(stale.parent),"deletion_method":"remove_item"}],"confirm_direct_delete":True,"identities":identities([stale.parent]),"content_snapshots":{str(stale.parent):snapshot_before}})
        assert stale_result["failure_count"] == 1 and stale.exists() and injected.read_bytes() == marker
        hard_source=make(fixture / "Library/Caches/org.fixture.safe/hard",marker)
        hard_alias=fixture / "Documents/hard_alias";os.link(hard_source,hard_alias)
        assert clean(hard_source.parent)["failure_count"] == 1 and hard_alias.read_bytes() == marker
        hard_alias.unlink();hard_source.unlink()
        journals=list((fixture / "Library/Application Support/com.vxclean.desktop/operations").glob("*/result.json"))
        assert journals and any(json.loads(p.read_text())["status"] == "completed" for p in journals)
        assert all(json.loads(p.read_text())["automatic_replay"] is False for p in journals)
        checks.append("quick_scan_and_revalidation_no_specialized_cli")
        checks.append("capcut_exact_http_only_preserves_profile_project_new_child_and_hardlinks")
        checks.append("durable_journal_no_automatic_replay")
        checks.append("node_cli_custom_allowlist_and_rejection_preserves_documents")
        # Recycle a fixture file only. Remove its exact resulting fixture entry from Trash after the check.
        trash_dir = Path.home() / ".Trash"
        def recycle_fixture(args, payload, source):
            was_directory = source.is_dir()
            result = invoke(args, payload)
            if result["success_count"]:
                assert not source.exists() and result["trashed_bytes"] > 0 and result["permanently_freed_bytes"] == 0
                p = Path(result["details"][0]["test_trash_path"])
                assert p.parent.resolve() == trash_dir.resolve() and marker.decode() in p.name and not p.is_symlink()
                if was_directory:
                    assert (p / "Contents/fixture_marker").read_bytes() == marker
                    shutil.rmtree(p)
                else:
                    assert p.read_bytes() == marker
                    p.unlink()
            else:
                assert source.exists() and result["failure_count"] == 1
                assert result["details"][0]["status"] == "permission_denied", result
            trash_outcomes.append({"success_count": result["success_count"], "failure_count": result["failure_count"], "details": result["details"]})
            return result
        lens_file = make(fixture / "Documents" / (marker.decode() + ".txt"), marker)
        tree = invoke(["lens", "--path", str(document.parent), "--depth", "4"])
        assert tree["root_node"]["can_trash"] is False
        assert any(n["can_trash"] for n in tree["root_node"]["children"])
        assert tree["is_partial"] is False
        external = make(base / "external/read_only.txt")
        external_tree = invoke(["lens", "--path", str(external.parent), "--depth", "1"])
        assert all(n["can_trash"] is False for n in external_tree["root_node"]["children"])
        assert clean(external, method="trash")["failure_count"] == 1 and external.exists()
        denied = fixture / "Documents/denied"
        make(denied / "file")
        denied.chmod(0)
        try:
            partial = invoke(["lens", "--path", str(document.parent), "--depth", "1"])
            assert partial["is_partial"] is True
        finally: denied.chmod(0o700)
        assert b'"event":"lens_progress"' in subprocess.run([str(binary), "lens", "--path", str(document.parent), "--depth", "1"], capture_output=True, env=env, timeout=30).stderr
        size_dir = fixture / "Downloads/allocated_fixture"
        source = make(size_dir / "source.bin", b"s" * 8192)
        os.link(source, size_dir / "hard_link.bin")
        (size_dir / "soft_link.bin").symlink_to(source)
        allocated_tree = invoke(["lens", "--path", str(size_dir), "--depth", "1"])
        assert allocated_tree["total_analyzed_bytes"] == source.stat().st_blocks * 512 + (size_dir / "soft_link.bin").lstat().st_blocks * 512
        assert next(n for n in allocated_tree["root_node"]["children"] if n["name"] == "soft_link.bin")["can_trash"] is False
        parent_tree = invoke(["lens", "--path", str(size_dir.parent), "--depth", "1"])
        assert next(n for n in parent_tree["root_node"]["children"] if n["name"] == "allocated_fixture")["item_count"] == 3
        checks.append("lens_root_external_read_only_partial_progress_allocated_hardlinks_symlinks")
        assert tree["root_node"]["is_directory"] and tree["total_analyzed_bytes"] > 0
        package = fixture / "Documents/test.app"
        make(package / "Contents/file")
        tree = invoke(["lens", "--path", str(document.parent), "--depth", "4"])
        assert next(n for n in tree["root_node"]["children"] if n["name"] == "test.app")["is_package"]
        recycle_fixture(["trash_lens", "--stdin"], {"targets": [{"path": str(lens_file), "deletion_method": "trash"}], "identities": identities([lens_file])}, lens_file)
        checks.append("lens_package_and_real_trash_or_permission_failure")
        apple = make(fixture / "Library/Caches/com.apple.protected/file")
        orphan = make(fixture / "Library/Caches/org.fixture.safe/file")
        support = make(fixture / "Library/Application Support/org.fixture.data/file")
        groups = invoke(["orphans"])["orphans"]
        assert all(g["original_app_name"] != "com.apple.protected" for g in groups)
        assert next(g for g in groups if g["original_app_name"] == "org.fixture.safe")["items"][0]["is_safe_candidate"] is True
        assert next(g for g in groups if g["original_app_name"] == "org.fixture.data")["items"][0]["is_safe_candidate"] is False
        res = invoke(["clean_orphans", "--stdin"], {"targets": [{"path": str(support.parent), "deletion_method": "remove_item"}], "confirm_direct_delete": True, "identities": identities([support.parent])})
        assert res["failure_count"] == 1 and support.exists()
        res = invoke(["clean_orphans", "--stdin"], {"targets": [{"path": str(orphan.parent), "deletion_method": "remove_item"}], "confirm_direct_delete": True, "identities": identities([orphan.parent])})
        assert res["success_count"] == 1 and apple.exists()
        checks.append("orphan_policy_protects_apple_and_personal_data")
        app = fixture / "Applications/Vendor" / (marker.decode() + ".app")
        info = app / "Contents/Info.plist"
        info.parent.mkdir(parents=True)
        info.write_bytes(plistlib.dumps({"CFBundleIdentifier": "org.fixture.installed", "CFBundleName": "Fixture", "CFBundlePackageType": "APPL", "CFBundleVersion": "1"}))
        external_link_target=make(fixture / "external_app_marker",marker)
        os.symlink(str(external_link_target),str(app / "Contents/external_link"))
        make(app / "Contents/fixture_marker", marker)
        make(fixture / "Library/Caches/org.fixture.installed/file")
        make(fixture / "Library/Containers/org.fixture.installed/file")
        make(fixture / "Library/Application Scripts/org.fixture.installed/file")
        make(fixture / "Library/Containers/org.fixture.installed.other/file")
        (fixture / "Applications/link.app").symlink_to(app, target_is_directory=True)
        discovered = make(fixture / "Movies" / app.stem / "User Data/Projects/keep.bin", marker)
        make(fixture / "Movies" / (app.stem + " tutorial") / "keep.bin")
        (fixture / "Pictures").mkdir(exist_ok=True)
        (fixture / "Pictures" / app.stem).symlink_to(discovered.parent, target_is_directory=True)
        installed = invoke(["apps", "--include-residuals"])["apps"]
        assert len(installed) == 1 and len(installed[0]["associated_files"]) == 5, installed
        assert {f["file_type"] for f in installed[0]["associated_files"]} == {"bundle", "cache", "container", "app_scripts", "discovered"}
        assert all(not f["path"].endswith("org.fixture.installed.other") for f in installed[0]["associated_files"])
        assert all(g["original_app_name"] != "org.fixture.installed" for g in invoke(["orphans"])["orphans"])
        candidate = next(f for f in installed[0]["associated_files"] if f["file_type"] == "discovered")
        assert candidate["is_selected_by_default"] is False and Path(candidate["path"]).resolve() == fixture / "Movies" / app.stem
        assert discovered.read_bytes() == marker
        cleanup_scan = invoke(["scan", "--scope", "detailed_cleanup"])
        cleanup_paths = {i["path"] for c in cleanup_scan["categories"] for i in c["items"]}
        assert candidate["path"] not in cleanup_paths
        assert clean(Path(candidate["path"]), method="trash")["failure_count"] == 1
        assert discovered.read_bytes() == marker
        for wrong in ["uninstall", "orphan_cleanup", "lens_trash", ""]:
            proc = subprocess.run([str(binary), "clean", "--stdin"], input=json.dumps({"operation_scope":wrong, "targets":[{"path":candidate["path"], "deletion_method":"trash"}], "identities":identities([Path(candidate["path"])])}).encode(), capture_output=True, env=env, timeout=30)
            assert proc.returncode != 0 and discovered.read_bytes() == marker
        allowed_uninstall = invoke(["uninstall", "--stdin"], {"app_id":installed[0]["id"], "authorized_app":installed[0], "selected_paths":[candidate["path"]], "allow_admin_fallback":False, "identities":identities([Path(candidate["path"])])})
        assert allowed_uninstall["details"][0]["method_used"] == "trash"
        # Sandbox may refuse Trash; reaching that permission outcome proves association validation passed.
        if allowed_uninstall["failure_count"]:
            assert allowed_uninstall["details"][0]["status"] == "permission_denied", allowed_uninstall
            assert discovered.read_bytes() == marker
        else:
            assert not discovered.exists()
            recycled = Path(allowed_uninstall["details"][0]["test_trash_path"])
            assert recycled.parent.resolve() == (Path.home() / ".Trash").resolve()
            assert (recycled / "User Data/Projects/keep.bin").read_bytes() == marker
            shutil.rmtree(recycled)
        checks.append("cleanup_cannot_delete_uninstall_project_root_or_borrow_operation_scope")
        checks.append("uninstall_broad_discovery_exact_names_unselected_no_symlinks")
        bad = dict(installed[0], bundle_id="com.apple.fixture")
        proc = subprocess.run([str(binary), "uninstall", "--stdin"], input=json.dumps({"app_id": str(app), "authorized_app": bad, "selected_paths": [str(app)], "allow_admin_fallback": True}).encode(), capture_output=True, env=env, timeout=30)
        assert proc.returncode != 0 and app.exists()
        recycle_fixture(["uninstall", "--stdin"], {"app_id": installed[0]["id"], "authorized_app": installed[0], "selected_paths": [installed[0]["bundle_path"]], "allow_admin_fallback": False, "identities": identities([Path(installed[0]["bundle_path"])])}, app)
        assert external_link_target.read_bytes()==marker
        checks.append("apps_exact_residual_matching_sip_rejection_and_uninstall")
        checks.append("uninstall_unit_bundle_does_not_follow_external_symlink")
        for args in [[], ["scan", "--unsafe"], ["lens", "--path", str(fixture), "--depth", "99"], ["shell", "echo"], ["lens", "--path", "/", "--depth", "1"], ["lens", "--path", "/System", "--depth", "1"]]:
            proc = subprocess.run([str(binary), *args], capture_output=True, env=env, timeout=10)
            assert proc.returncode != 0
        checks.append("invalid_commands_fail_closed")
        make(fixture / "Library/Caches/org.fixture.safe/host_native_fixture", marker)
        integration_env=dict(env, VXCLEAN_FIXTURE_BINARY=str(binary))
        integrated=subprocess.run(["cargo","test","--offline","--lib","payload_native_roundtrip"],cwd=ROOT / "desktop/src_tauri",env=integration_env,capture_output=True,text=True,timeout=180)
        assert integrated.returncode == 0, integrated.stdout + integrated.stderr
        checks.append("rust_quick_orphan_uninstall_producers_to_native_consumers_identity_manifest_scope")
        # Real AppKit normal Quit/Cancel/reopen against our own disposable fixture app.
        ai_cache = make(fixture / "Library/Application Support/Antigravity IDE/GPUCache/disposable", marker)
        ai_state = make(fixture / "Library/Application Support/Antigravity IDE/User/globalStorage/state.vscdb", marker)
        ai_runtime = make(fixture / ".codex/plugins/cache/keep.js", marker)
        ai_scan = invoke(["scan", "--scope", "detailed_cleanup", "--include-empty"])
        ai_rows = next(c for c in ai_scan["categories"] if c["category"] == "ai_apps")["items"]
        assert next(r for r in ai_rows if r["path"] == str(ai_cache.parent))["is_cleanable"] is True
        assert clean(ai_cache.parent)["success_count"] == 1 and not ai_cache.exists()
        assert ai_state.read_bytes() == marker and ai_runtime.read_bytes() == marker and history.read_bytes() == b"f" * 2048
        assert clean(ai_state.parent)["failure_count"] == 1 and clean(ai_runtime.parent)["failure_count"] == 1
        checks.append("ai_frontend_exact_cache_preserves_history_state_plugins_runtime")
        bulk = fixture / "Library/Caches/Google/Chrome/Default/Cache"
        bulk.mkdir(parents=True, exist_ok=True)
        for index in range(7000): (bulk / f"entry_{index:05d}").write_bytes(marker)
        keep_profile=make(fixture / "Library/Application Support/Google/Chrome/Default/Preferences", marker)
        started=time.monotonic(); bulk_result=clean(bulk.parent.parent, scope="quick_cleanup", timeout=180, measure_memory=True); elapsed=time.monotonic()-started
        assert bulk_result["success_count"] == 1 and bulk_result["failure_count"] == 0
        assert not any(p.is_file() for p in bulk.iterdir()) and keep_profile.read_bytes()==marker
        operation=fixture / "Library/Application Support/com.vxclean.desktop/operations" / bulk_result["operation_id"]
        records=[json.loads(line) for line in (operation / "events.jsonl").read_text().splitlines()]
        assert len(records)==14002
        for index in range(1,14001,2):
            assert records[index]["phase"]=="intent" and records[index+1]["phase"]=="outcome"
            assert records[index]["target"]["path"]==records[index+1]["target"]["path"]
        assert json.loads((operation / "result.json").read_text())["status"]=="completed"
        print(f"Chrome 7000-file durable journal: {elapsed:.3f}s", flush=True)
        assert elapsed<180
        checks.append("chrome_7000_cache_files_durable_journal_preserves_profile_under_180s")
        # Exceed both former 20k-entry and 3MiB full-proof limits. Root ticket stays small.
        for index in range(25001): make(bulk / f"large_{index:05d}", b"cache-data")
        large_scan=invoke(["scan", "--scope", "quick_cleanup", "--include-empty"], timeout=120)
        large_rows=[item for cat in large_scan["categories"] for item in cat["items"] if item["path"]==str(bulk.parent.parent)]
        assert len(large_rows)==1 and large_rows[0]["is_cleanable"], large_rows
        small_proof=manifest(bulk.parent.parent,root_only=True)
        assert len(json.dumps(small_proof))<4096
        started=time.monotonic()
        large_result=invoke(["clean","--stdin"], {"operation_scope":"quick_cleanup", "targets":[{"path":str(bulk.parent.parent),"deletion_method":"remove_item"}],"confirm_direct_delete":True,"identities":identities([bulk.parent.parent]),"content_snapshots":{str(bulk.parent.parent):small_proof}},timeout=240,measure_memory=True)
        assert large_result["success_count"]==1 and large_result["failure_count"]==0,large_result
        assert not any(p.is_file() for p in bulk.iterdir()) and keep_profile.read_bytes()==marker
        print(f"Chrome 25001-file root proof + streaming cleanup: {time.monotonic()-started:.3f}s",flush=True)
        checks.append("chrome_25001_files_scan_selectable_streaming_cleanup_preserves_profile")


        # Deferred permission failures share exactly one admin invocation.
        for admin_mode in ["success", "cancel"]:
            roots = [fixture / "system/tmp" / ("admin_"+admin_mode+str(i)+"_'\n") for i in range(3)]
            for root in roots: make(root / "cache.bin", marker*100)
            env["VXCLEAN_TEST_ADMIN_REQUIRED"]="|".join(map(str,roots))
            env["VXCLEAN_TEST_ADMIN_MODE"]=admin_mode
            response=invoke(["clean","--stdin"],{"operation_scope":"quick_cleanup","confirm_direct_delete":True,"targets":[{"path":str(root),"deletion_method":"remove_item"} for root in roots],"identities":identities(roots)})
            assert response["test_admin_invocations"]==1, response
            assert response["success_count"]==(3 if admin_mode=="success" else 0),response
            assert all(root.exists()==(admin_mode=="cancel") for root in roots)
            if admin_mode=="cancel": assert all(d["status"]=="admin_not_started" for d in response["details"]),response
            del env["VXCLEAN_TEST_ADMIN_REQUIRED"];del env["VXCLEAN_TEST_ADMIN_MODE"]
        root=fixture / "system/tmp/admin_identity"
        make(root / "cache.bin",marker*100)
        env.update(VXCLEAN_TEST_ADMIN_REQUIRED=str(root),VXCLEAN_TEST_ADMIN_MODE="success",VXCLEAN_TEST_ADMIN_REPLACE_PATH=str(root))
        response=invoke(["clean","--stdin"],{"operation_scope":"quick_cleanup","confirm_direct_delete":True,"targets":[{"path":str(root),"deletion_method":"remove_item"}],"identities":identities([root])})
        assert response["test_admin_invocations"]==1 and response["success_count"]==0 and (root / "keep").read_text()=="replacement" and (Path(str(root)+".original") / "cache.bin").exists(),response
        for key in ["VXCLEAN_TEST_ADMIN_REQUIRED","VXCLEAN_TEST_ADMIN_MODE","VXCLEAN_TEST_ADMIN_REPLACE_PATH"]:del env[key]
        env["VXCLEAN_TEST_ADMIN_MODE"]="success"
        aliases=invoke(["fixture_admin_alias"])
        del env["VXCLEAN_TEST_ADMIN_MODE"]
        assert aliases["success_count"]==2 and aliases["test_admin_invocations"]==1 and aliases["all_removed"],aliases
        checks.append("admin_guard_raw_tmp_var_tmp_uses_physical_realpath")
        checks.append("single_admin_pass_success_cancel_quoting_identity_guard")
        for key in ["VXCLEAN_TEST_ADMIN_MISSING_PARENT","VXCLEAN_TEST_ADMIN_REMOVE_PARENT","VXCLEAN_TEST_ADMIN_MODIFY_ROOT"]:
            roots=[fixture / ("system/tmp/"+key+"_changed"), fixture / ("system/private/var/tmp/"+key+"_valid")]
            for root in roots: make(root / "cache.bin",marker*100)
            env.update(VXCLEAN_TEST_ADMIN_REQUIRED="|".join(map(str,roots)),VXCLEAN_TEST_ADMIN_MODE="success")
            env[key]=str(roots[0].parent if key.endswith("PARENT") else roots[0])
            response=invoke(["clean","--stdin"],{"operation_scope":"quick_cleanup","confirm_direct_delete":True,"targets":[{"path":str(root),"deletion_method":"remove_item"} for root in roots],"identities":identities(roots)})
            assert response["test_admin_invocations"]==1 and response["success_count"]==1,response
            assert response["details"][0]["status"]=="guard_rejected" and response["details"][1]["status"]=="success",response
            assert not roots[1].exists()
            if key.endswith("ROOT"): assert (roots[0] / "cache.bin").exists()
            for name in [key,"VXCLEAN_TEST_ADMIN_REQUIRED","VXCLEAN_TEST_ADMIN_MODE"]:del env[name]
        checks.append("admin_changed_parent_or_metadata_does_not_abort_valid_sibling")


        env["VXCLEAN_TEST_STALL_LARGE_FILES"]="1"
        started=time.monotonic()
        partial=invoke(["scan","--scope","detailed_cleanup","--include-empty"])
        del env["VXCLEAN_TEST_STALL_LARGE_FILES"]
        assert partial["is_partial"] and partial["timed_out_categories"]==["large_files"] and time.monotonic()-started<10
        assert next(c for c in partial["categories"] if c["category"]=="ai_apps")["items"]
        checks.append("blocked_large_file_worker_timeout_preserves_other_scan_categories")

        lifecycle_app = fixture / "Applications/VXCleanLifecycleFixture.app"
        executable = lifecycle_app / "Contents/MacOS/fixture_app"
        executable.parent.mkdir(parents=True)
        lifecycle_info = {"CFBundleIdentifier":"com.lemon.lvoverseas", "CFBundleName":"VXClean Lifecycle Fixture", "CFBundlePackageType":"APPL", "CFBundleExecutable":"fixture_app", "CFBundleVersion":"1", "LSUIElement":True}
        (lifecycle_app / "Contents/Info.plist").write_bytes(plistlib.dumps(lifecycle_info))
        trace = fixture / "fixture_lifecycle_trace"
        cancel_quit = fixture / "cancel_fixture_quit"
        source = base / "lifecycle_fixture.swift"
        source.write_text("""import AppKit
import Foundation
func note(_ value:String) { let u=URL(fileURLWithPath:TRACE); let old=(try? String(contentsOf:u,encoding:.utf8)) ?? ""; try? (old+value+"\\n").write(to:u,atomically:true,encoding:.utf8) }
class Delegate:NSObject,NSApplicationDelegate {
 func applicationDidFinishLaunching(_ n:Notification){note("started:"+String(ProcessInfo.processInfo.processIdentifier))}
 func applicationShouldTerminate(_ app:NSApplication)->NSApplication.TerminateReply {note("quit_requested"); return FileManager.default.fileExists(atPath:CANCEL) ? .terminateCancel : .terminateNow}
 func applicationWillTerminate(_ n:Notification){note("terminated")}
}
let delegate=Delegate(); let app=NSApplication.shared; app.delegate=delegate; app.setActivationPolicy(.accessory); app.run()
""".replace("TRACE",json.dumps(str(trace))).replace("CANCEL",json.dumps(str(cancel_quit))))
        app_build = subprocess.run(["/usr/bin/xcrun","swiftc","-sdk",sdk,"-module-cache-path","/tmp/vxclean_swift_module_cache",str(source),"-o",str(executable)],capture_output=True,env=env,timeout=60)
        assert app_build.returncode == 0, app_build.stderr.decode()
        launched = invoke(["fixture_app_launch","--path",str(lifecycle_app)])
        def wait_trace(fragment):
            deadline=time.monotonic()+5
            while time.monotonic()<deadline:
                if trace.exists() and fragment in trace.read_text(): return
                time.sleep(.05)
            raise AssertionError("fixture app event missing: "+fragment)
        try:
            wait_trace("started:")
            cache=make(fixture / "Movies/CapCut/User Data/CEF/Cache/GPUCache/fixture_cache",marker)
            request={"operation_scope":"detailed_cleanup","confirm_app_quit":True,"targets":[{"path":str(cache.parent),"category":"media_apps"}]}
            cancel_quit.touch()
            cancelled=invoke(["prepare_apps","--stdin"],request)
            assert cancelled["status"] == "cancelled" and cache.read_bytes()==marker, cancelled
            assert cancelled["apps"] and not cancelled["apps"][0]["closed"], cancelled
            wait_trace("quit_requested")
            unchanged=invoke(["finish_apps","--stdin"],{"operation_id":cancelled["operation_id"]})
            assert not unchanged["apps"][0]["reopened"] and "terminated" not in trace.read_text()
            cancel_quit.unlink()
            prepared=invoke(["prepare_apps","--stdin"],request)
            assert prepared["status"] == "ready_for_rescan" and prepared["apps"][0]["closed"], prepared
            wait_trace("terminated")
            cleaned=clean(cache.parent)
            assert cleaned["success_count"] == 1 and not cache.exists(), cleaned
            passive=invoke(["finish_apps","--stdin"],{"operation_id":prepared["operation_id"],"reconcile_only":True})
            assert not passive["apps"][0]["reopened"] and trace.read_text().count("started:")==1,passive
            reopened=invoke(["finish_apps","--stdin"],{"operation_id":prepared["operation_id"]})
            assert reopened["apps"][0]["reopened"], reopened
            # Repeated Finish must not create another instance.
            deadline=time.monotonic()+5
            while trace.read_text().count("started:")<2 and time.monotonic()<deadline: time.sleep(.05)
            assert trace.read_text().count("started:")==2, trace.read_text()
            before=trace.read_text().count("started:")
            again=invoke(["finish_apps","--stdin"],{"operation_id":prepared["operation_id"]})
            assert again["apps"][0]["reopened"] and trace.read_text().count("started:")==before
            life_file=fixture / "Library/Application Support/com.vxclean.desktop/operations" / prepared["operation_id"] / "lifecycle.json"
            life=json.loads(life_file.read_text());life["status"]="reopen_pending";life["apps"][0]["reopened"]=False;life["apps"][0]["version"]="old-version"
            life_file.write_text(json.dumps(life))
            reconciled=invoke(["finish_apps","--stdin"],{"operation_id":prepared["operation_id"],"reconcile_only":True})
            assert reconciled["status"]=="reopened" and reconciled["apps"][0]["reopened"],reconciled
            assert trace.read_text().count("started:")==before
            checks.append("passive_reconcile_running_updated_app_without_duplicate_launch")
            checks.append("appkit_fixture_quit_cancel_rescan_cleanup_reopen_no_duplicate")
            # Quick caches stay usable without terminating the running app.
            quick_file=make(fixture / "Library/Caches/com.lemon.lvoverseas/Cache/fixture_cache",marker*100)
            quick_scan=invoke(["scan","--scope","quick_cleanup"])
            quick_row=next(i for c in quick_scan["categories"] for i in c["items"] if i["path"]==str(quick_file.parent.parent))
            assert quick_row["is_cleanable"] and not quick_row["requires_app_quit"],quick_row
            terminations=trace.read_text().count("terminated")
            cleaned=clean(quick_file.parent.parent,scope="quick_cleanup")
            assert cleaned["success_count"]==1 and not quick_file.exists(),cleaned
            assert trace.read_text().count("terminated")==terminations
            checks.append("quick_live_cache_no_quit_detailed_lifecycle_preserved")
        finally:
            cancel_quit.unlink(missing_ok=True)
            try:
                make(cache)
                invoke(["prepare_apps","--stdin"],request)
            except Exception:
                pass
        print(json.dumps({"passed": checks, "count": len(checks), "trash_outcomes": trash_outcomes, "memory_checks":memory_checks}, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    run_tests()
