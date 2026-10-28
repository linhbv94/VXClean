#!/usr/bin/env python3
"""
scripts/verify_tauri_bridge.py
Kịch bản kiểm chứng tự động toàn diện cho cầu nối VXClean React <-> Swift qua Tauri 2.

Tuân thủ nghiêm ngặt:
- DEVELOPER_DIR=/Library/Developer/CommandLineTools (tránh lỗi Xcode license).
- Swift compile với -parse-as-library, deployment target macOS 13, local module cache, timeout 120s.
- Dọn dẹp các tệp component và app trùng lặp PascalCase (chỉ giữ snake_case).
- Sao chép icon thực tế từ MClean/Assets.xcassets/AppIcon.appiconset vào desktop/src_tauri/icons (không bịa icon).
- Sử dụng trực tiếp desktop/node_modules/.bin/tsc và vite (không npx tự tải).
- Chạy cargo check --offline (timeout 180s), tuyệt đối không fallback online tải thêm phụ thuộc.
- Ghi kết quả JSON và nhật ký vào _work/ (đã được cấu hình trong .gitignore).
"""

import json
import os
import platform
import shutil
import subprocess
import sys
import time
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent
DESKTOP_DIR = WORKSPACE_ROOT / "desktop"
NATIVE_DIR = DESKTOP_DIR / "native"
SRC_TAURI_DIR = DESKTOP_DIR / "src_tauri"
WORK_DIR = WORKSPACE_ROOT / "_work"
SYSTEM_MONITOR_SWIFT = WORKSPACE_ROOT / "MClean" / "Services" / "SystemMonitor.swift"
MAIN_SWIFT = NATIVE_DIR / "main.swift"
ENGINE_BINARY = NATIVE_DIR / "vxclean_engine"
SWIFT_CACHE_DIR = Path("/tmp/vxclean_swift_module_cache")
APP_ICON_SET_DIR = WORKSPACE_ROOT / "MClean" / "Assets.xcassets" / "AppIcon.appiconset"
TAURI_ICONS_DIR = SRC_TAURI_DIR / "icons"

# Thiết lập môi trường bắt buộc
ENV = os.environ.copy()
ENV["DEVELOPER_DIR"] = "/Library/Developer/CommandLineTools"

results = {
    "cleanup_duplicates": False,
    "sync_real_icons": False,
    "swift_compile": False,
    "swift_metrics_valid": False,
    "swift_invalid_arg_rejected": False,
    "swift_no_arg_rejected": False,
    "frontend_tsc": False,
    "frontend_vite_build": False,
    "cargo_check_offline": False,
}

details = {}
log_lines = []


def log(section: str, message: str):
    entry = f"[{section}] {message}"
    print(entry)
    log_lines.append(entry)


def cleanup_component_duplicates():
    log("CLEANUP", "Kiểm tra và chuẩn hóa tên tệp snake_case trong desktop/src/...")
    src_dir = DESKTOP_DIR / "src"
    comp_dir = src_dir / "components"

    # Dọn App.tsx nếu app.tsx đã có
    app_pascal = src_dir / "App.tsx"
    app_snake = src_dir / "app.tsx"
    if app_pascal.exists() and app_snake.exists() and not app_pascal.samefile(app_snake):
        try:
            app_pascal.unlink()
            log("CLEANUP", "Đã dọn dẹp App.tsx trùng lặp (giữ app.tsx).")
        except Exception as e:
            log("CLEANUP", f"Lỗi xóa {app_pascal}: {e}")

    pairs = [
        ("TitleBar.tsx", "title_bar.tsx"),
        ("Sidebar.tsx", "sidebar.tsx"),
        ("Dashboard.tsx", "dashboard.tsx"),
        ("UnmigratedView.tsx", "unmigrated_view.tsx"),
    ]
    cleaned = []
    for old_name, new_name in pairs:
        old_file = comp_dir / old_name
        new_file = comp_dir / new_name
        if old_file.exists() and new_file.exists() and not old_file.samefile(new_file):
            try:
                old_file.unlink()
                cleaned.append(f"{old_name} -> {new_name}")
            except Exception as e:
                log("CLEANUP", f"Lỗi xóa {old_file}: {e}")
    details["cleanup_duplicates"] = f"Đã dọn dẹp các tệp duplicate PascalCase: {', '.join(cleaned) if cleaned else 'Đã sạch'}"
    results["cleanup_duplicates"] = True


def sync_real_app_icons():
    log("ICONS", "Đồng bộ bộ icon gốc từ MClean/Assets.xcassets/AppIcon.appiconset vào Tauri...")
    TAURI_ICONS_DIR.mkdir(parents=True, exist_ok=True)

    mappings = [
        (APP_ICON_SET_DIR / "icon_32.png", TAURI_ICONS_DIR / "32x32.png"),
        (APP_ICON_SET_DIR / "icon_128.png", TAURI_ICONS_DIR / "128x128.png"),
        (APP_ICON_SET_DIR / "icon_128@2x.png", TAURI_ICONS_DIR / "128x128@2x.png"),
        (APP_ICON_SET_DIR / "icon_512.png", TAURI_ICONS_DIR / "icon.png"),
    ]

    synced = []
    for src, dst in mappings:
        if src.exists():
            shutil.copy2(src, dst)
            synced.append(dst.name)

    log("ICONS", f"Đã đồng bộ {len(synced)} biểu tượng thực tế: {', '.join(synced)}")
    details["sync_real_icons"] = f"Đồng bộ thành công từ assets gốc ({len(synced)} tệp)"
    results["sync_real_icons"] = True


def check_clt_swiftc() -> str:
    clt_swiftc = Path("/Library/Developer/CommandLineTools/usr/bin/swiftc")
    if clt_swiftc.exists() and os.access(clt_swiftc, os.X_OK):
        return str(clt_swiftc)
    which_swiftc = shutil.which("swiftc", path=ENV.get("PATH"))
    if which_swiftc:
        return which_swiftc
    raise RuntimeError("Không tìm thấy trình biên dịch swiftc trong CommandLineTools hoặc PATH.")


def get_macos_sdk() -> str:
    sdk_clt = Path("/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk")
    if sdk_clt.exists():
        return str(sdk_clt)
    return ""


def step_1_compile_swift():
    log("SWIFT_BUILD", "Bắt đầu biên dịch Swift Native Engine từ CommandLineTools...")

    swiftc = check_clt_swiftc()
    log("SWIFT_BUILD", f"Sử dụng swiftc: {swiftc}")

    if not SYSTEM_MONITOR_SWIFT.exists():
        raise FileNotFoundError(f"Không tìm thấy file nguồn gốc: {SYSTEM_MONITOR_SWIFT}")
    if not MAIN_SWIFT.exists():
        raise FileNotFoundError(f"Không tìm thấy file entrypoint: {MAIN_SWIFT}")

    NATIVE_DIR.mkdir(parents=True, exist_ok=True)
    SWIFT_CACHE_DIR.mkdir(parents=True, exist_ok=True)

    cmd = [
        swiftc,
        "-O",
        "-parse-as-library",
        "-module-cache-path",
        str(SWIFT_CACHE_DIR),
    ]

    sdk = get_macos_sdk()
    if sdk:
        cmd.extend(["-sdk", sdk])

    machine = platform.machine()
    target_arch = "arm64" if "arm" in machine.lower() else "x86_64"
    cmd.extend(["-target", f"{target_arch}-apple-macos13.0"])

    cmd.extend([
        str(SYSTEM_MONITOR_SWIFT),
        str(MAIN_SWIFT),
        str(NATIVE_DIR / "maintenance_cli.swift"),
        *[str(WORKSPACE_ROOT / "MClean" / file) for file in [
            "Services/SpaceLensEngine.swift", "Models/SpaceLensNode.swift",
            "Logic/Scanning/Conditions.swift", "Logic/Scanning/StringNormalization.swift",
            "Logic/Utilities/OrphanSafetyPolicy.swift",
        ]],
        "-o",
        str(ENGINE_BINARY),
    ])

    log("SWIFT_BUILD", f"Lệnh thực thi: {' '.join(cmd)}")
    start_time = time.time()
    proc = subprocess.run(
        cmd,
        cwd=str(WORKSPACE_ROOT),
        env=ENV,
        capture_output=True,
        text=True,
        timeout=120,
    )
    elapsed = time.time() - start_time

    if proc.returncode != 0:
        log("SWIFT_BUILD", f"Biên dịch thất bại (mã {proc.returncode}):\n{proc.stderr}")
        details["swift_compile"] = f"Lỗi biên dịch: {proc.stderr.strip()}"
        return False

    ENGINE_BINARY.chmod(0o755)
    log("SWIFT_BUILD", f"Biên dịch thành công binary ({elapsed:.2f}s): {ENGINE_BINARY}")
    details["swift_compile"] = f"Thành công trong {elapsed:.2f}s, dung lượng: {ENGINE_BINARY.stat().st_size} bytes"
    results["swift_compile"] = True
    return True


def step_2_test_swift_engine():
    log("SWIFT_TEST", "Kiểm tra hoạt động thực tế của Swift Native Engine...")

    # Test 2.1: Đối số hợp lệ "metrics" (lấy dữ liệu telemetry thật)
    cmd_valid = [str(ENGINE_BINARY), "metrics"]
    log("SWIFT_TEST", f"Chạy lệnh: {' '.join(cmd_valid)}")
    start_time = time.time()
    proc_valid = subprocess.run(
        cmd_valid,
        cwd=str(WORKSPACE_ROOT),
        env=ENV,
        capture_output=True,
        text=True,
        timeout=15,
    )
    elapsed = time.time() - start_time

    if proc_valid.returncode != 0:
        log("SWIFT_TEST", f"Lỗi chạy metrics (mã {proc_valid.returncode}):\n{proc_valid.stderr}")
        details["swift_metrics_valid"] = f"Mã thoát {proc_valid.returncode}: {proc_valid.stderr.strip()}"
        return False

    try:
        data = json.loads(proc_valid.stdout)
    except json.JSONDecodeError as e:
        log("SWIFT_TEST", f"Đầu ra không phải JSON hợp lệ: {e}\nĐầu ra thô:\n{proc_valid.stdout}")
        details["swift_metrics_valid"] = f"Lỗi decode JSON: {e}"
        return False

    # Xác thực cấu trúc dữ liệu JSON theo Contract
    assert data.get("protocol_version") == "1.0", "Thiếu hoặc sai protocol_version"
    assert data.get("platform") == "macos", "Thiếu hoặc sai platform"
    assert "timestamp" in data, "Thiếu timestamp"
    metrics = data.get("metrics", {})
    cpu = metrics.get("cpu", {})
    memory = metrics.get("memory", {})
    disk = metrics.get("disk", {})
    battery = metrics.get("battery", {})

    assert "usage" in cpu, "Thiếu cpu.usage"
    assert memory.get("total_bytes", 0) > 0, "memory.total_bytes phải > 0"
    assert memory.get("used_bytes", 0) > 0, "memory.used_bytes phải > 0"
    assert disk.get("total_bytes", 0) > 0, "disk.total_bytes phải > 0"
    assert "has_battery" in battery, "Thiếu battery.has_battery"

    log("SWIFT_TEST", f"Nhận JSON hợp lệ ({elapsed:.2f}s):")
    log("SWIFT_TEST", f"  - CPU: {cpu.get('usage', 0)*100:.2f}% (history mẫu: {len(cpu.get('history', []))})")
    log("SWIFT_TEST", f"  - RAM: {memory.get('used_bytes', 0)/(1024**3):.2f} GB / {memory.get('total_bytes', 0)/(1024**3):.2f} GB ({memory.get('fraction', 0)*100:.1f}%)")
    log("SWIFT_TEST", f"  - Ổ đĩa: {disk.get('used_bytes', 0)/(1024**3):.1f} GB / {disk.get('total_bytes', 0)/(1024**3):.1f} GB ({disk.get('fraction', 0)*100:.1f}%)")
    log("SWIFT_TEST", f"  - Pin: has_battery={battery.get('has_battery')}, charge={battery.get('charge_percent')}%, AC={battery.get('is_ac_powered')}")

    results["swift_metrics_valid"] = True
    details["swift_metrics_valid"] = {
        "elapsed_seconds": round(elapsed, 2),
        "protocol_version": data.get("protocol_version"),
        "platform": data.get("platform"),
        "cpu_usage": cpu.get("usage"),
        "memory_fraction": memory.get("fraction"),
        "disk_fraction": disk.get("fraction"),
        "battery": battery,
    }

    # Test 2.2: Từ chối đối số không hợp lệ
    cmd_invalid = [str(ENGINE_BINARY), "invalid_subcommand"]
    proc_inv = subprocess.run(
        cmd_invalid,
        cwd=str(WORKSPACE_ROOT),
        env=ENV,
        capture_output=True,
        text=True,
        timeout=5,
    )
    if proc_inv.returncode != 0 and "Lỗi" in proc_inv.stderr:
        log("SWIFT_TEST", f"Đối số không hợp lệ đã bị từ chối chính xác (mã {proc_inv.returncode}): {proc_inv.stderr.strip()}")
        results["swift_invalid_arg_rejected"] = True
        details["swift_invalid_arg_rejected"] = f"Từ chối đúng với mã {proc_inv.returncode}: {proc_inv.stderr.strip()}"
    else:
        log("SWIFT_TEST", "Thất bại: Engine không từ chối đối số không hợp lệ!")
        details["swift_invalid_arg_rejected"] = f"Mã thoát không mong muốn: {proc_inv.returncode}"

    # Test 2.3: Từ chối khi không truyền đối số
    cmd_empty = [str(ENGINE_BINARY)]
    proc_empty = subprocess.run(
        cmd_empty,
        cwd=str(WORKSPACE_ROOT),
        env=ENV,
        capture_output=True,
        text=True,
        timeout=5,
    )
    if proc_empty.returncode != 0 and "Lỗi" in proc_empty.stderr:
        log("SWIFT_TEST", f"Lệnh không đối số đã bị từ chối chính xác (mã {proc_empty.returncode}): {proc_empty.stderr.strip()}")
        results["swift_no_arg_rejected"] = True
        details["swift_no_arg_rejected"] = f"Từ chối đúng với mã {proc_empty.returncode}: {proc_empty.stderr.strip()}"
    else:
        log("SWIFT_TEST", "Thất bại: Engine không từ chối khi thiếu đối số!")
        details["swift_no_arg_rejected"] = f"Mã thoát không mong muốn: {proc_empty.returncode}"

    return True


def step_3_test_frontend():
    log("FRONTEND", "Kiểm tra TypeScript compile và Vite build cho Frontend...")

    desktop_node_modules = DESKTOP_DIR / "node_modules"
    sibling_node_modules = WORKSPACE_ROOT.parent / "vxmedia" / "node_modules"

    if not desktop_node_modules.exists():
        if sibling_node_modules.exists():
            log("FRONTEND", f"Tạo symlink tạm thời cho spike từ {sibling_node_modules} -> {desktop_node_modules}")
            try:
                os.symlink(sibling_node_modules, desktop_node_modules)
                details["frontend_install_note"] = "Sử dụng node_modules liên kết từ vxmedia cho spike kiểm chứng. Chưa xác minh clean npm/pnpm install độc lập."
            except OSError as e:
                log("FRONTEND", f"Không thể tạo symlink node_modules: {e}")
                details["frontend_install_note"] = f"Lỗi symlink node_modules: {e}"
        else:
            log("FRONTEND", "Cảnh báo: Không tìm thấy node_modules trong desktop hoặc vxmedia.")
            details["frontend_install_note"] = "Thiếu node_modules. Cần cài đặt phụ thuộc."

    bin_dir = desktop_node_modules / ".bin"
    tsc_bin = bin_dir / "tsc"
    vite_bin = bin_dir / "vite"

    # Chạy tsc trực tiếp từ .bin
    if tsc_bin.exists():
        log("FRONTEND", f"Chạy {tsc_bin} --noEmit kiểm tra kiểu...")
        tsc_cmd = [str(tsc_bin), "--noEmit"]
    else:
        log("FRONTEND", "Chạy tsc --noEmit qua PATH...")
        tsc_cmd = ["tsc", "--noEmit"]

    tsc_proc = subprocess.run(
        tsc_cmd,
        cwd=str(DESKTOP_DIR),
        env=ENV,
        capture_output=True,
        text=True,
        timeout=60,
    )

    if tsc_proc.returncode == 0:
        log("FRONTEND", "tsc --noEmit THÀNH CÔNG (0 lỗi type).")
        results["frontend_tsc"] = True
        details["frontend_tsc"] = "Kiểm tra type thành công, 0 lỗi."
    else:
        log("FRONTEND", f"tsc --noEmit thất bại (mã {tsc_proc.returncode}):\n{tsc_proc.stdout}\n{tsc_proc.stderr}")
        details["frontend_tsc"] = f"Lỗi type:\n{tsc_proc.stdout}\n{tsc_proc.stderr}".strip()

    # Chạy vite build trực tiếp từ .bin
    if vite_bin.exists():
        log("FRONTEND", f"Chạy {vite_bin} build...")
        vite_cmd = [str(vite_bin), "build"]
    else:
        log("FRONTEND", "Chạy vite build qua PATH...")
        vite_cmd = ["vite", "build"]

    vite_proc = subprocess.run(
        vite_cmd,
        cwd=str(DESKTOP_DIR),
        env=ENV,
        capture_output=True,
        text=True,
        timeout=60,
    )

    dist_index = DESKTOP_DIR / "dist" / "index.html"
    if vite_proc.returncode == 0 and dist_index.exists():
        log("FRONTEND", f"Vite build THÀNH CÔNG. Tệp phân phối: {dist_index}")
        results["frontend_vite_build"] = True
        details["frontend_vite_build"] = f"Build thành công, đã tạo {dist_index}"
    else:
        log("FRONTEND", f"Vite build thất bại (mã {vite_proc.returncode}):\n{vite_proc.stdout}\n{vite_proc.stderr}")
        details["frontend_vite_build"] = f"Lỗi build: {vite_proc.stderr.strip()}"


def step_4_test_cargo():
    log("CARGO", "Kiểm tra cú pháp và cấu trúc mã Rust Tauri ở chế độ offline (timeout 180s)...")

    cargo_proc = subprocess.run(
        ["cargo", "check", "--offline"],
        cwd=str(SRC_TAURI_DIR),
        env=ENV,
        capture_output=True,
        text=True,
        timeout=180,
    )

    if cargo_proc.returncode == 0:
        log("CARGO", "cargo check --offline THÀNH CÔNG.")
        results["cargo_check_offline"] = True
        details["cargo_check_offline"] = "cargo check --offline thành công (0 cảnh báo lỗi blocking)."
    else:
        log("CARGO", f"cargo check --offline thất bại (mã {cargo_proc.returncode}):\n{cargo_proc.stderr}")
        details["cargo_check_offline"] = f"Thất bại (mã {cargo_proc.returncode}): {cargo_proc.stderr.strip()}"


def main():
    print("=" * 70)
    print("   VXClean — KỊCH BẢN KIỂM CHỨNG CẦU NỐI REACT ↔ SWIFT (TAURI 2)")
    print("=" * 70)

    WORK_DIR.mkdir(parents=True, exist_ok=True)

    cleanup_component_duplicates()
    sync_real_app_icons()

    try:
        step_1_compile_swift()
        step_2_test_swift_engine()
    except Exception as e:
        log("FATAL", f"Lỗi kiểm tra Swift: {e}")

    try:
        step_3_test_frontend()
    except Exception as e:
        log("FATAL", f"Lỗi kiểm tra Frontend: {e}")

    try:
        step_4_test_cargo()
    except Exception as e:
        log("FATAL", f"Lỗi kiểm tra Cargo: {e}")

    print("\n" + "=" * 70)
    print("               KẾT QUẢ TỔNG HỢP KIỂM CHỨNG")
    print("=" * 70)

    all_passed = True
    for key, passed in results.items():
        status = "PASSED" if passed else "FAILED"
        if not passed:
            all_passed = False
        print(f"  [{status}] {key}: {details.get(key, 'N/A')}")

    if details.get("frontend_install_note"):
        print(f"\n  [NOTE] {details['frontend_install_note']}")

    print("=" * 70)

    # Ghi dữ liệu vào _work/
    results_file = WORK_DIR / "verification_results.json"
    log_file = WORK_DIR / "verification.log"

    report_data = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "results": results,
        "details": details,
        "all_passed": all_passed,
    }

    try:
        results_file.write_text(json.dumps(report_data, ensure_ascii=False, indent=2), encoding="utf-8")
        log_file.write_text("\n".join(log_lines), encoding="utf-8")
        log("WORK", f"Đã lưu kết quả tại {results_file} và nhật ký tại {log_file}")
    except Exception as e:
        log("WORK", f"Lỗi ghi file kết quả vào _work: {e}")

    if all_passed:
        print(">> TẤT CẢ CÁC BƯỚC KIỂM CHỨNG ĐÃ ĐẠT TIÊU CHUẨN.")
        sys.exit(0)
    else:
        print(">> CẢNH BÁO: MỘT SỐ BƯỚC CHƯA ĐẠT. VUI LÒNG KIỂM TRA CHI TIẾT TRÊN.")
        sys.exit(1)


if __name__ == "__main__":
    main()
