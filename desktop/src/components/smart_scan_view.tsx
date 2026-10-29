import {useCleanText} from '../services/ui_language';
import {isScanAccessDeferred} from '../services/scan_access';
import { useAppQuitDialog } from './app_quit_dialog';
import { useConfirmation } from './confirmation_dialog';
import { scanRetention } from '../services/scan_retention';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  ArrowRight,
  RotateCw,
  Archive,
  HardDrive,
  FileCode,
  FileText,
  Trash2,
} from 'lucide-react';
import {
  ScanResponse,
  ScanProgressEvent,
  CleanProgressEvent,
  CleanResponse,
  CleanPayload,
  JunkCategoryType,
} from '../types';
import { runSmartScan, runClean, errorText, prepareCleanupApps, finishCleanupApps, AppLifecycleResult } from '../services/tauri_bridge';
import { formatBytes } from '../services/mock_engine';

interface SmartScanViewProps {
  onBackToDashboard: () => void;
  autoStart?: boolean;
  onAutoStartHandled?: () => void;
}

type ScanViewState = 'idle' | 'scanning' | 'results' | 'cleaning' | 'summary';

const PRIORITY_ORDER: JunkCategoryType[] = [
  'system_junk',
  'user_caches',
  'large_files',
  'node_cache',
  'brew_cache',
];

function QuickNotice({ title, details, onDismiss }: { title: string; details: string[]; onDismiss: () => void }) {
  const ct = useCleanText();

  const unique = [...new Set(details.filter(Boolean))];
  return <div role="status" className="w-full mb-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-left text-xs">
    <div className="flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
      <div className="flex-1 min-w-0"><p className="font-semibold">{ct(title)}</p><p className="mt-1 text-slate-500 dark:text-slate-400">{ct("Quét lại để cập nhật dữ liệu. Xem chi tiết nếu vấn đề vẫn tiếp diễn.")}</p></div>
      <button type="button" aria-label={ct("Đóng thông báo")} onClick={onDismiss} className="p-1 rounded hover:bg-slate-500/10 cursor-pointer"><X className="w-4 h-4" /></button>
    </div>
    {unique.length > 0 && <details className="mt-2 ml-6"><summary className="cursor-pointer text-slate-500 dark:text-slate-400">{ct("Xem chi tiết (")}{unique.length})</summary>
      <ul className="mt-2 max-h-32 overflow-y-auto space-y-2 text-slate-500 dark:text-slate-400">{unique.map(detail => <li key={detail} className="break-words [overflow-wrap:anywhere]">{detail}</li>)}</ul>
    </details>}
  </div>;
}

export const SmartScanView: React.FC<SmartScanViewProps> = ({
  onBackToDashboard,
  autoStart,
  onAutoStartHandled,
}) => {
  const ct = useCleanText();

  const appQuit = useAppQuitDialog();
  const confirmation = useConfirmation();
  const [scanNoticeDismissed, setScanNoticeDismissed] = useState(false);
  const [cleanupNoticeDismissed, setCleanupNoticeDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<ScanViewState>('idle');
  const [progress, setProgress] = useState<ScanProgressEvent | null>(null);
  const [cleanProgress, setCleanProgress] = useState<CleanProgressEvent | null>(null);
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  const [cleanupWasPartial, setCleanupWasPartial] = useState(false);
  const [cleanResult, setCleanResult] = useState<CleanResponse | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
  const [isUnderstandChecked, setIsUnderstandChecked] = useState<boolean>(false);
  const generation = useRef(0);
  const isCancelledRef = useRef<boolean>(false);

  const handleStartScan = async () => {
    const runId = ++generation.current;
    setError(null);
    setScanNoticeDismissed(false);
    setCleanupNoticeDismissed(false);
    setScanResult(null);
    setState('scanning');
    setProgress(null);
    isCancelledRef.current = false;
    try {
      const res = await runSmartScan(
        (p) => { if (runId === generation.current) setProgress(p); },
        () => runId !== generation.current || isCancelledRef.current
      );
      if (runId !== generation.current) return;
      setScanResult(res);

      // Giữ lựa chọn mặc định theo từng mục, không chọn sẵn tệp lớn hoặc lịch sử AI
      const defaults = new Set<string>();
      res.categories.forEach((c) => {
        c.items.filter(item => item.is_selected_by_default && item.is_cleanable !== false)
          .forEach(item => defaults.add(item.path));
      });
      setSelectedPaths(defaults);
      setState('results');
    } catch (e) {
      if (runId !== generation.current) return;
      if (!isCancelledRef.current && !isScanAccessDeferred(e)) setError(errorText(e));
      setState('idle');
    }
  };

  useEffect(() => {
    return () => {
      isCancelledRef.current = true;
      generation.current++;
    };
  }, []);

  useEffect(() => {
    if (autoStart) {
      const timer = setTimeout(() => {
        // Dashboard is an explicit new scan, even when this screen has cached results.
        // If a job is already running, show it rather than launching a second one.
        if (state !== 'scanning' && state !== 'cleaning') void handleStartScan();
        onAutoStartHandled?.();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [autoStart, state, onAutoStartHandled]);

  const handleCancelScan = () => {
    generation.current++;
    isCancelledRef.current = true;
    setState('idle');
  };

  const visibleCategories = useMemo(() => {
    if (!scanResult) return [];
    // Ưu tiên hiển thị: System Junk → User Cache → Large & Old Files → Node Cache → Brew Cache; nhóm khác theo sau. Nhóm rỗng không hiện.
    return scanResult.categories
      .filter((c) => c.total_bytes > 0 && c.items.length > 0)
      .slice()
      .sort((a, b) => {
        const idxA = PRIORITY_ORDER.indexOf(a.category);
        const idxB = PRIORITY_ORDER.indexOf(b.category);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });
  }, [scanResult]);

  const toggleCategory = (cat: string) => {
    const categorySummary = scanResult?.categories.find((c) => c.category === cat);
    if (!categorySummary) return;
    const cleanableItems = categorySummary.items.filter((item) => item.is_cleanable !== false);
    if (cleanableItems.length === 0) return;

    // Khi user chủ động click checkbox category, toggle toàn bộ cleanable items của category đó
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      const isAllSelected = cleanableItems.every((item) => prev.has(item.path));
      if (isAllSelected) {
        cleanableItems.forEach((item) => next.delete(item.path));
      } else {
        cleanableItems.forEach((item) => next.add(item.path));
      }
      return next;
    });
  };

  const selectDefaults = () => {
    const next = new Set<string>();
    scanResult?.categories.forEach((cat) => {
      cat.items.forEach((item) => {
        if (item.is_cleanable !== false && item.is_selected_by_default) {
          next.add(item.path);
        }
      });
    });
    setSelectedPaths(next);
  };

  const selectAll = () => {
    const next = new Set<string>();
    scanResult?.categories.forEach((cat) => {
      cat.items.forEach((item) => {
        if (item.is_cleanable !== false) {
          next.add(item.path);
        }
      });
    });
    setSelectedPaths(next);
  };

  const deselectAll = () => setSelectedPaths(new Set());
  const selectedItems = scanResult?.categories.flatMap((c) => c.items).filter((item) => selectedPaths.has(item.path)) ?? [];
  const distinctSelectedItems = [...new Map(selectedItems.map((item) => [item.path, item])).values()];
  const uniqueSelectedItems = distinctSelectedItems.filter((item) => !distinctSelectedItems.some((parent) => item.path.startsWith(parent.path + '/') && parent.deletion_method === item.deletion_method));
  const selectedTotalBytes = uniqueSelectedItems.reduce((total, item) => total + item.size_bytes, 0);

  const handleOpenCleanModal = () => {
    if (selectedTotalBytes === 0) return;
    setIsUnderstandChecked(false);
    setIsConfirmOpen(true);
  };

  const handleExecuteClean = async () => {
    if (!scanResult) return;
    setIsConfirmOpen(false);
    setCleanupWasPartial(false);
    setState('cleaning');
    setCleanProgress(null);

    const targets: CleanPayload['targets'] = uniqueSelectedItems.map(item => ({
      path: item.path, deletion_method: item.deletion_method,
    }));

    let lifecycle: AppLifecycleResult | undefined;
    let cleanScan = scanResult;
    let cleanTargets = targets;
    try {
      if (uniqueSelectedItems.some(item => item.requires_app_quit)) {
        const names = [...new Set(uniqueSelectedItems.filter(item => item.requires_app_quit).flatMap(item => item.app_bundle_ids ?? []).map(id => id === 'com.google.Chrome' ? 'Chrome' : id === 'com.openai.codex' ? 'Codex/ChatGPT' : id))];
        const choice = await appQuit.ask(names);
        if (choice === 'cancel') {setState('results'); return;}
        if (choice === 'skip') {
          setCleanupWasPartial(true);
          cleanTargets = targets.filter(target => uniqueSelectedItems.some(item => item.path === target.path && !item.requires_app_quit));
          setError(ct("Đã bỏ qua cache của app đang mở; chưa dọn toàn bộ lựa chọn ban đầu."));
          if (!cleanTargets.length) {setState('results'); return;}
        } else {
          lifecycle = await prepareCleanupApps(scanResult.scan_id, targets);
          if (!['ready_for_rescan', 'not_needed'].includes(lifecycle.status)) throw new Error(ct("App chưa đóng hoặc đã hủy. Chưa dọn các mục đã chọn."));
          scanRetention.invalidate();
          cleanScan = await runSmartScan(undefined,undefined,false);
          setScanResult(cleanScan);
          const fresh = cleanScan.categories.flatMap(category => category.items);
          cleanTargets = targets.filter(target => fresh.some(item => item.path === target.path && item.deletion_method === target.deletion_method && item.is_cleanable !== false && !item.requires_app_quit));
          if (cleanTargets.length !== targets.length) throw new Error(ct("Cache hoặc helper thay đổi sau khi đóng app. Hãy kiểm tra kết quả mới và chọn lại; chưa dọn."));
          const total = fresh.filter(item => cleanTargets.some(target => target.path === item.path)).reduce((sum, item) => sum + item.size_bytes, 0);
          if (!(await confirmation.confirm((ct("Sau khi đóng app và quét lại: ") + (cleanTargets.length) + ct(" mục, ") + (formatBytes(total)) + ct(". Dọn đúng các mục đã chọn?"))))) {setState('results'); return;}
        }
      }
    const res = await runClean(
      {
        scan_id: cleanScan.scan_id,
        targets: cleanTargets,
        confirm_direct_delete: true,
      },
      (p) => setCleanProgress(p)
    );

    setCleanResult(res);
    setState('summary');
    } catch (e) { setError(errorText(e)); setState('results'); }
    finally {
      if (lifecycle?.operation_id) {
        try {
          const restored = await finishCleanupApps(lifecycle.operation_id);
          if (restored.status !== 'reopened') setError(ct("Một số app chưa mở lại được; xem lịch sử thao tác để mở lại."));
        } catch (e) {setError((ct("Chưa mở lại được app: ") + (errorText(e)) + ct(". Xem lịch sử thao tác.")));}
      }
      scanRetention.invalidate();
      window.dispatchEvent(new Event('vxclean_operation_history_changed'));
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'user_caches':
        return HardDrive;
      case 'xcode_junk':
      case 'xcode_derived_data':
        return FileCode;
      case 'xcode_archives':
        return Archive;
      case 'system_junk':
      case 'system_logs':
        return FileText;
      case 'trash_bin':
        return Trash2;
      default:
        return FolderOpen;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-[#0f1117] text-slate-800 dark:text-slate-100 p-6 relative">
      {appQuit.dialog}{confirmation.dialog}
      {error && <QuickNotice key="error" title={ct("Không thể hoàn tất thao tác")} details={[error]} onDismiss={() => setError(null)} />}
      {!scanNoticeDismissed && scanResult && (scanResult.unsupported_cache_paths?.length || scanResult.timed_out_categories?.length || scanResult.fda_limited_categories.length) ? <QuickNotice key="scan" title={ct("Một số vùng chưa được quét đầy đủ")} details={[
        ...(scanResult.unsupported_cache_paths ?? []).map(path => (ct("Cache tùy chỉnh ngoài phạm vi hỗ trợ: ") + (path) + ct(""))),
        ...(scanResult.timed_out_categories ?? []).map(category => (ct("Vượt thời gian chờ: ") + (category) + ct(""))),
        ...scanResult.fda_limited_categories.map(category => (ct("Không đọc được hết hoặc vượt giới hạn duyệt: ") + (category) + ct(". Full Disk Access không thay quyền ghi/admin."))),
      ]} onDismiss={() => setScanNoticeDismissed(true)} /> : null}
      {/* 1. IDLE STATE */}
      {state === 'idle' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center max-w-xl mx-auto">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-cyan-500/20 dark:bg-cyan-500/30 rounded-full blur-2xl animate-pulse" />
            <button
              type="button"
              onClick={handleStartScan}
              className="relative w-36 h-36 rounded-full bg-gradient-to-tr from-cyan-600 to-cyan-400 text-white shadow-xl shadow-cyan-500/25 flex flex-col items-center justify-center gap-1.5 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-8 h-8" />
              <span className="text-sm font-bold tracking-wider uppercase">{ct("QUÉT NHANH")}</span>
            </button>
          </div>
          <h2 className="text-base font-semibold mb-2">{ct("Kiểm tra & Dọn dẹp Toàn diện Hệ thống")}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">{ct("Quét cache ứng dụng, rác hệ thống và tệp lớn/cũ.\n            Tệp lớn/cũ cần tự chọn; cache cần đóng app sẽ có bước xác nhận.")} </p>
          <div className="grid grid-cols-2 gap-3 w-full max-w-md text-left text-xs">
            <div className="p-3 rounded-lg border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-[#141821]/50 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-cyan-500" />
              <span>{ct("Bộ nhớ đệm Safari & App")}</span>
            </div>
            <div className="p-3 rounded-lg border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-[#141821]/50 flex items-center gap-2">
              <FileCode className="w-4 h-4 text-cyan-500" />
              <span>{ct("Cache công cụ đã sử dụng")}</span>
            </div>
            <div className="p-3 rounded-lg border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-[#141821]/50 flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-500" />
              <span>{ct("Nhật ký & Báo cáo lỗi")}</span>
            </div>
            <div className="p-3 rounded-lg border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-[#141821]/50 flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-cyan-500" />
              <span>{ct("Thùng rác hệ thống")}</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. SCANNING STATE */}
      {state === 'scanning' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center w-full max-w-md mx-auto overflow-y-auto">
          <div className="relative w-36 h-36 mb-6 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="42"
                className="stroke-slate-200 dark:stroke-slate-800"
                strokeWidth="6"
                fill="none"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                className="stroke-cyan-500 transition-all duration-300"
                strokeWidth="6"
                strokeDasharray="264"
                strokeDashoffset={264 - 264 * (progress?.progress_fraction ?? 0.1)}
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold font-mono">
                {Math.round((progress?.progress_fraction ?? 0) * 100)}%
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {formatBytes(progress?.scanned_bytes ?? 0)}
              </span>
            </div>
          </div>
          <h3 className="text-sm font-semibold mb-1 truncate w-full">
            {progress?.current_category ?? ct("Đang khởi động phân tích...")}
          </h3>
          <p className="text-[11px] font-mono text-slate-400 mb-6 truncate w-full px-4">
            {progress?.current_path ?? ct("Đang duyệt thư mục hệ thống")}
          </p>
          <button
            type="button"
            onClick={handleCancelScan}
            className="px-4 py-1.5 text-xs rounded-lg border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >{ct("Dừng quét")} </button>
        </div>
      )}

      {/* 3. RESULTS STATE */}
      {state === 'results' && scanResult && (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/5 shrink-0">
            <div>
              <h2 className="text-base font-semibold">{ct("Phát hiện")} <span className="text-cyan-500 font-mono">{formatBytes(scanResult.total_cleanable_bytes)}</span> {ct("dữ liệu có thể dọn")} </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{ct("Mọi mục trong kết quả dưới đây đều có thể chọn dọn. Tệp lớn/cũ không chọn mặc định.")} </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectDefaults}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-2 py-1 rounded cursor-pointer"
                title={ct("Khôi phục các mục lựa chọn an toàn mặc định")}
              >{ct("Chọn mục mặc định")} </button>
              <button
                type="button"
                onClick={selectAll}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-2 py-1 rounded cursor-pointer"
                title={ct("Chọn toàn bộ các mục có thể dọn dẹp")}
              >{ct("Chọn tất cả")} </button>
              <button
                type="button"
                onClick={deselectAll}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-2 py-1 rounded cursor-pointer"
              >{ct("Bỏ chọn")} </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-4 space-y-2.5 pr-1">


            {visibleCategories.map((cat) => {
              const cleanableItems = cat.items.filter(item => item.is_cleanable !== false);
              const isChecked = cleanableItems.length > 0 && cleanableItems.every(item => selectedPaths.has(item.path));
              const Icon = getCategoryIcon(cat.category);
              const isArchive = cat.category === 'xcode_archives';

              return (
                <div
                  key={cat.category}
                  role="group"
                  aria-label={(ct("Chọn hạng mục ") + (cat.title) + ct(""))}
                  tabIndex={cleanableItems.length > 0 ? 0 : undefined}
                  onClick={() => toggleCategory(cat.category)}
                  onKeyDown={event => {
                    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      toggleCategory(cat.category);
                    }
                  }}
                  className={`p-3.5 rounded-xl border transition-all focus-visible:outline-2 focus-visible:outline-cyan-500 ${cleanableItems.length > 0 ? 'cursor-pointer' : ''} ${
                    isChecked
                      ? 'border-cyan-500/40 bg-cyan-500/5 dark:bg-cyan-500/10'
                      : 'border-slate-200 dark:border-white/5 bg-white/40 dark:bg-[#141821]/40'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      ref={input => { if (input) input.indeterminate = !isChecked && cleanableItems.some(item => selectedPaths.has(item.path)); }}
                      disabled={cleanableItems.length === 0}
                      aria-label={(ct("Chọn toàn bộ ") + (cat.title) + ct(""))}
                      onClick={event => event.stopPropagation()}
                      onChange={() => toggleCategory(cat.category)}
                      className="mt-1 w-4 h-4 rounded text-cyan-500 focus:ring-cyan-500 cursor-pointer"
                    />
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-white/5 shrink-0">
                      <Icon className="w-5 h-5 text-cyan-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 truncate">
                          <h4 className="text-xs font-semibold truncate">{ct(cat.title)}</h4>
                          {isArchive && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 font-medium shrink-0">{ct("Cần lưu ý: Không tự tái tạo")} </span>
                          )}
                        </div>
                        <span className="text-xs font-mono font-semibold shrink-0">
                          {formatBytes(cat.total_bytes)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
                        {ct(cat.description)}
                      </p>
                      <div className="flex items-center gap-3 text-[10px] text-slate-400">
                        <span>{cat.items.filter(item => selectedPaths.has(item.path)).length}/{cat.item_count} {ct("mục đã chọn ·")} {formatBytes(cleanableItems.reduce((total, item) => total + item.size_bytes, 0))} {ct("có thể dọn")}</span>
                        <span>•</span>
                        <span>
                          {cat.category === 'trash_bin'
                            ? ct("Làm rỗng Thùng rác")
                            : cat.items.every(item => item.deletion_method === 'trash') ? ct("Chuyển vào Thùng rác") : ct("Xem từng mục trước khi dọn")}
                        </span>
                      </div>
                      <details className="mt-2 text-[11px] cursor-auto" onClick={event => event.stopPropagation()}>
                        <summary className="w-full cursor-pointer text-cyan-600 dark:text-cyan-400">{ct("Xem và chọn từng mục")}</summary>
                        <div className="mt-2 max-h-48 overflow-auto space-y-2">
                          {[...cat.items].sort((a, b) => b.size_bytes - a.size_bytes).map(item => <label key={item.path} className="flex items-start gap-2">
                            <input type="checkbox" checked={selectedPaths.has(item.path)} disabled={item.is_cleanable === false}
                              onChange={() => setSelectedPaths(previous => { const next = new Set(previous); if (next.has(item.path)) next.delete(item.path); else next.add(item.path); return next; })} />
                            <span className="min-w-0 break-all">{item.name} · {formatBytes(item.size_bytes)}<br />
                              <span className="text-slate-500">{item.path} · {item.is_cleanable === false ? (ct("Không cho dọn: ") + (item.blocked_reason ?? 'Chưa xác minh an toàn') + ct("")) : item.deletion_method === 'trash' ? ct("Chuyển vào Thùng rác") : ct("Xóa vĩnh viễn")}</span>
                              {item.is_cleanable !== false && item.consequence_vi && <span className="block text-slate-500">{ct(item.consequence_vi)}</span>}
                            </span>
                          </label>)}
                        </div>
                      </details>
                    </div>
                  </div>
                </div>
              );
            })}

            {!!scanResult.excluded_items?.length && <details className="text-xs text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-white/10 rounded-lg p-3">
              <summary className="cursor-pointer">{ct("Ngoài kết quả dọn:")} {scanResult.excluded_items.length} {ct("mục ·")} {formatBytes(scanResult.excluded_items.reduce((sum,item)=>sum+item.size_bytes,0))} {ct("— xem lý do giữ lại")}</summary>
              <div className="max-h-48 overflow-y-auto mt-2 space-y-2">{[...scanResult.excluded_items].sort((a, b) => b.size_bytes - a.size_bytes).map(item=><p key={item.path}><span className="font-medium">{item.name} · {formatBytes(item.size_bytes)}</span><br/><span className="font-mono text-[10px]">{item.path}</span><br/>{ct(item.blocked_reason ?? item.consequence_vi ?? "")}</p>)}</div>
            </details>}
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-white/5 flex items-center justify-between shrink-0">
            <div>
              <div className="text-xs font-medium">{ct("Đã chọn:")}{' '}
                <span className="text-cyan-500 font-bold font-mono">
                  {formatBytes(selectedTotalBytes)}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">{ct("Thao tác dọn dẹp sẽ thực hiện theo từng cơ chế an toàn cụ thể.")} </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleStartScan}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >{ct("Quét lại")} </button>
              <button
                type="button"
                disabled={selectedTotalBytes === 0}
                onClick={handleOpenCleanModal}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-900 transition-colors disabled:opacity-50 cursor-pointer shadow-lg shadow-cyan-500/20"
              >{ct("Dọn dẹp")} {formatBytes(selectedTotalBytes)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. CLEANING STATE */}
      {state === 'cleaning' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center w-full max-w-md mx-auto overflow-y-auto">
          <RotateCw className="w-10 h-10 text-cyan-500 animate-spin mb-4" />
          <h3 className="text-sm font-semibold mb-2">{ct("Đang dọn dẹp các tệp đã chọn...")}</h3>
          <p className="text-xs text-slate-400 truncate w-full mb-6 font-mono px-4">
            {cleanProgress?.current_item ?? ct("Đang giải phóng dung lượng đĩa...")}
          </p>
          <div className="w-full bg-slate-200 dark:bg-white/5 h-2 rounded-full overflow-hidden mb-3">
            <div
              className="bg-cyan-500 h-full transition-all duration-200"
              style={{ width: `${(cleanProgress?.progress_fraction ?? 0.1) * 100}%` }}
            />
          </div>
          <div className="flex justify-between w-full text-[10px] text-slate-400 font-mono">
            <span>{ct("Đã xóa vĩnh viễn:")} {formatBytes(cleanProgress?.freed_bytes ?? 0)}</span>
            <span>{ct("Chuyển vào Trash:")} {formatBytes(cleanProgress?.trashed_bytes ?? 0)}</span>
          </div>
        </div>
      )}

      {/* 5. SUMMARY STATE */}
      {state === 'summary' && cleanResult && (
        <div className="flex-1 flex flex-col items-center justify-center text-center w-full max-w-md mx-auto overflow-y-auto">
          <div className={`w-16 h-16 shrink-0 rounded-full flex items-center justify-center mb-4 ${(cleanResult.failure_count || cleanupWasPartial) ? "bg-amber-500/15 text-amber-500" : "bg-emerald-500/15 text-emerald-500"}`}>
            {(cleanResult.failure_count || cleanupWasPartial) ? <AlertTriangle className="w-10 h-10 text-amber-500" /> : <CheckCircle2 className="w-10 h-10" />}
          </div>
          <h2 className="text-lg font-bold mb-1">{(cleanResult.failure_count || cleanupWasPartial) ? ct("Chưa dọn hết lựa chọn ban đầu") : ct("Đã dọn các mục đã chọn")}!</h2>
          {cleanResult.failure_count > 0 && !cleanupNoticeDismissed && <QuickNotice key="cleanup" title={(ct("") + (cleanResult.failure_count) + ct(" mục chưa được dọn"))} details={Object.entries(cleanResult.details.filter(d => d.status !== 'success').reduce<Record<string, string[]>>((groups, detail) => {
            const reason = detail.error_message || ct("Chưa xác định được kết quả");
            (groups[reason] ??= []).push(detail.path);
            return groups;
          }, {})).map(([reason, paths]) => (ct("") + (paths.length) + ct(" mục · ") + (reason) + ct(" · ") + (paths.join(' · ')) + ct("")))} onDismiss={() => setCleanupNoticeDismissed(true)} />}
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">{ct("Đã giải phóng thành công dung lượng lưu trữ trên máy Mac của bạn.")} </p>

          <div className="w-full p-4 rounded-xl border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-[#141821]/40 space-y-3 mb-6 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-white/5">
              <span className="text-slate-500">{ct("Dung lượng xóa vĩnh viễn (ước tính):")}</span>
              <span className="font-mono font-bold text-emerald-500 text-sm">
                {formatBytes(cleanResult.permanently_freed_bytes)}
              </span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-white/5">
              <span className="text-slate-500">{ct("Đã di chuyển vào Thùng rác:")}</span>
              <span className="font-mono font-bold text-cyan-500">
                {formatBytes(cleanResult.trashed_bytes)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">{ct("Số tệp xử lý thành công:")}</span>
              <span className="font-mono font-semibold">{cleanResult.success_count} {ct("tệp")}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleStartScan}
              className="px-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >{ct("Quét lại")} </button>
            <button
              type="button"
              onClick={onBackToDashboard}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-900 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>{ct("Về Tổng quan")}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* SAFETY CONFIRMATION MODAL */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141821] shadow-2xl p-5 text-slate-800 dark:text-slate-100">
            <div className="flex items-center gap-2.5 text-amber-500 mb-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold">{ct("Xác nhận Dọn dẹp An toàn")}</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-3 leading-relaxed">{ct("Bạn sắp dọn dẹp")} <strong className="font-mono text-cyan-500">{formatBytes(selectedTotalBytes)}</strong> {ct("dữ liệu đã chọn.")} </p>
            <div className="p-3 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-[11px] space-y-2 mb-4 text-slate-500 dark:text-slate-400">
              <div className="flex items-start gap-1.5">
                <span className="text-rose-400 font-bold">•</span>
                <span>
                  <strong>{ct("Xóa vĩnh viễn:")}</strong> {uniqueSelectedItems.filter(item => item.deletion_method !== 'trash').length} {ct("mục đã chọn. Không thể khôi phục từ Thùng rác.")} </span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-cyan-400 font-bold">•</span>
                <span>
                  <strong>{ct("Chuyển vào Thùng rác:")}</strong> {uniqueSelectedItems.filter(item => item.deletion_method === 'trash').length} {ct("mục đã chọn. Các mục đã chọn bên trong ~/.Trash sẽ bị xóa vĩnh viễn.")} </span>
              </div>
            </div>

            <label className="flex items-start gap-2.5 mb-5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isUnderstandChecked}
                onChange={(e) => setIsUnderstandChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-cyan-500 focus:ring-cyan-500"
              />
              <span className="text-xs text-slate-700 dark:text-slate-300">{ct("Tôi hiểu rằng các tệp bộ nhớ đệm hệ thống đã chọn sẽ bị xóa vĩnh viễn.")} </span>
            </label>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="px-3.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >{ct("Hủy bỏ")} </button>
              <button
                type="button"
                disabled={!isUnderstandChecked}
                onClick={handleExecuteClean}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-rose-500 hover:bg-rose-400 text-white transition-colors disabled:opacity-50 cursor-pointer shadow-lg shadow-rose-500/20"
              >{ct("Xác nhận Dọn dẹp")} </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
