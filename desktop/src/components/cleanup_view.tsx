import {useCleanText} from '../services/ui_language';
import {isScanAccessDeferred} from '../services/scan_access';
import { useAppQuitDialog } from './app_quit_dialog';
import { useConfirmation } from './confirmation_dialog';
import React, { useState, useEffect, useRef } from 'react';
import {
  HardDrive,
  FileCode,
  Archive,
  FileText,
  Trash2,
  FolderOpen,
  ExternalLink,
  RotateCw,
  Check,
  Sparkles,
  Inbox,
  FileQuestion,
  Layers,
} from 'lucide-react';
import { ScanResponse, JunkCategoryType, ScanCategorySummary, CleanPayload } from '../types';
import * as bridge from '../services/tauri_bridge';
import { formatBytes } from '../services/mock_engine';
import { OrphansView } from './orphans_view';
import { RetainedScreen } from './retained_screen';
import { scanRetention } from '../services/scan_retention';

interface CategoryDefinition {
  category: JunkCategoryType;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ALL_10_CATEGORIES: CategoryDefinition[] = [
  {category: 'chrome', title: 'Chrome', description: 'HTTP, code và graphics cache; giữ profile và dữ liệu offline.', icon: HardDrive},
  {category: 'media_apps', title: 'Media Apps', description: 'CapCut / Adobe: cache đã phân loại; giữ project và media.', icon: Layers},
  {
    category: 'system_junk',
    title: 'Rác hệ thống',
    description: 'Tệp tạm, bộ nhớ đệm hệ thống và các tệp nhật ký cũ.',
    icon: FileText,
  },
  {
    category: 'user_caches',
    title: 'Bộ nhớ đệm người dùng',
    description: 'Cache của các ứng dụng người dùng chạy thường ngày.',
    icon: HardDrive,
  },
  {
    category: 'large_files',
    title: 'Tệp lớn & cũ',
    description: 'Các tệp có dung lượng lớn hoặc lâu ngày chưa truy cập.',
    icon: FolderOpen,
  },
  {
    category: 'node_cache',
    title: 'Bộ nhớ đệm Node.js',
    description: 'Cache npm, yarn, pnpm.',
    icon: FileCode,
  },
  {
    category: 'brew_cache',
    title: 'Bộ nhớ đệm Homebrew',
    description: 'Các gói đã tải về từ brew cleanup và cask downloads.',
    icon: HardDrive,
  },
  {
    category: 'ai_apps',
    title: 'AI Apps',
    description: 'Các mục chưa xác minh vẫn chỉ xem; giữ lịch sử, ảnh, runtime và plugin.',
    icon: Sparkles,
  },
  {
    category: 'mail_downloads',
    title: 'Tệp đính kèm Mail',
    description: 'Tệp đính kèm thư điện tử đã tải xuống máy tính.',
    icon: Inbox,
  },
  {
    category: 'trash_bin',
    title: 'Thùng rác hệ thống',
    description: 'Các mục hiện đang nằm trong Thùng rác của bạn.',
    icon: Trash2,
  },
  {
    category: 'xcode_junk',
    title: 'Rác phát triển Xcode',
    description: 'DerivedData, Archives cũ và caches của Xcode.',
    icon: FileCode,
  },
  {
    category: 'docker_cache',
    title: 'Bộ nhớ đệm Docker',
    description: 'Build cache và các layer container tạm thời của Docker.',
    icon: Layers,
  },
];

export const CleanupView: React.FC<{ active?: boolean }> = ({ active = true }) => {
  const ct = useCleanText();

  const { confirm, dialog } = useConfirmation();
  const appQuit=useAppQuitDialog();
  const [activeTab, setActiveTab] = useState<'categories' | 'orphans'>('categories');
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ScanResponse | null>(null);
  const [selectedCat, setSelectedCat] = useState<JunkCategoryType>('system_junk');
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCleaning, setIsCleaning] = useState<boolean>(false);
  const [lifecycleInfo, setLifecycleInfo] = useState<string | null>(null);
  const [cleanedSuccess, setCleanedSuccess] = useState<boolean>(false);

  const isMountedRef = useRef<boolean>(true);
  const scanGeneration = useRef(0);

  const loadData = async () => {
    const runId = ++scanGeneration.current;
    setIsLoading(true);
    setError(null);
    try {
      const res: ScanResponse = await bridge.runDetailedScan(undefined,
        () => !isMountedRef.current || runId !== scanGeneration.current);
      if (!isMountedRef.current || runId !== scanGeneration.current) return;

      setData(res);
      setSelectedCat((current) =>
        res.categories.some((c) => c.category === current)
          ? current
          : (res.categories[0]?.category ?? 'system_junk')
      );

      // Giữ lựa chọn mặc định của từng mục từ engine
      const paths = new Set<string>();
      res.categories.forEach((cat) => {
        cat.items
          .filter((item) => item.is_selected_by_default && item.is_cleanable !== false)
          .forEach((item) => paths.add(item.path));
      });
      setSelectedPaths(paths);
    } catch (e) {
      if (isMountedRef.current && runId === scanGeneration.current) {
        setError(isScanAccessDeferred(e)?null:bridge.errorText(e));
      }
    } finally {
      if (isMountedRef.current && runId === scanGeneration.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    const timer = setTimeout(() => { void loadData(); }, 0);
    return () => {
      clearTimeout(timer);
      isMountedRef.current = false;
      scanGeneration.current++;
    };
  }, []);

  useEffect(() => {
    if (active && activeTab === 'categories' && data && !isLoading && !isCleaning && !scanRetention.reusable('cleanup')) {
      void loadData();
    }
  }, [active, activeTab]);

  const togglePath = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const currentSummary: ScanCategorySummary | undefined = data?.categories.find(
    (c) => c.category === selectedCat
  );

  const toggleAllInCurrent = () => {
    if (!currentSummary) return;
    const cleanable = currentSummary.items.filter((it) => it.is_cleanable !== false);
    const allSelected = cleanable.length > 0 && cleanable.every((it) => selectedPaths.has(it.path));
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      cleanable.forEach((it) => {
        if (allSelected) next.delete(it.path);
        else next.add(it.path);
      });
      return next;
    });
  };

  const eligibleItems = data?.categories.flatMap(c => c.items).filter(i => i.is_cleanable !== false) ?? [];
  const toggleAll = () => {
    const all = eligibleItems.length > 0 && eligibleItems.every(i => selectedPaths.has(i.path));
    setSelectedPaths(previous => { const next = new Set(previous); eligibleItems.forEach(i => all ? next.delete(i.path) : next.add(i.path)); return next; });
  };
  const handleCleanCurrent = async (global = false) => {
    if (!data || isCleaning || (!global && !currentSummary)) return;
    const candidates = global ? data.categories.flatMap(c => c.items) : currentSummary!.items;
    const chosen = [...new Map(candidates.filter(i => i.is_cleanable !== false && selectedPaths.has(i.path)).map(i => [i.path, i])).values()];
    const consequences = [...new Set(chosen.map(i => ct(i.consequence_vi ?? "Xem lại dữ liệu trước khi dọn.")))].join('\n• ');
    const targets: CleanPayload['targets'] = chosen
      .map((it) => ({
        path: it.path,
        deletion_method: it.deletion_method,
      }));

    if (targets.length === 0) return;
    const permanent = targets.filter((item) => item.deletion_method !== 'trash' && item.deletion_method !== 'pnpm_prune').length;
    const prunes = targets.filter(item => item.deletion_method === 'pnpm_prune').length;
    if (
      !(await confirm(
        (ct("Dọn ") + (targets.length) + ct(" mục? ") + (permanent) + ct(" mục sẽ bị xóa vĩnh viễn; ") + (targets.length - permanent - prunes) + ct(" mục chuyển vào Thùng rác. ") + (prunes ? `${prunes}${ct(" thao tác do pnpm tự prune; dung lượng thu hồi chưa biết trước.")}` : '') + ct("") + (chosen.some(i => i.safety_level === 'user_data')
            ? ' Có dữ liệu cá nhân: kiểm tra trước khi dọn.'
            : '') + ct("\n\nHậu quả:\n• ") + (consequences) + ct(""))
      ))
    )
      return;

    setIsCleaning(true);
    setLifecycleInfo(null);
    let lifecycle: bridge.AppLifecycleResult | undefined;
    let cleanScan = data;
    let cleanTargets = targets;
    try {
      if (chosen.some(i => i.requires_app_quit)) {
        const names=[...new Set(chosen.filter(i=>i.requires_app_quit).flatMap(i=>i.app_bundle_ids ?? []).map(id=>id==='com.google.Chrome'?'Chrome':id==='com.lemon.lvoverseas'?'CapCut':id==='com.openai.codex'?'Codex/ChatGPT':id.startsWith('com.google.antigravity')?'Antigravity':id))];
        const choice=await appQuit.ask(names);
        if(choice==='cancel') return;
        if(choice==='skip') {
          cleanTargets=targets.filter(t=>chosen.some(i=>i.path===t.path && !i.requires_app_quit));
          if(!cleanTargets.length){setLifecycleInfo(ct("Đã bỏ qua các app đang mở; không dọn dữ liệu."));return;}
        } else {
        lifecycle = await bridge.prepareCleanupApps(data.scan_id, targets);
        if (lifecycle.status !== 'ready_for_rescan' && lifecycle.status !== 'not_needed') throw new Error(ct("App chưa đóng (Save/Cancel/timeout). Không dọn các mục đã chọn."));
        scanRetention.invalidate();
        cleanScan = await bridge.runDetailedScan(undefined,undefined,false);
        setData(cleanScan);
        const fresh = cleanScan.categories.flatMap(c => c.items);
        cleanTargets = targets.filter(t => fresh.some(i => i.path === t.path && i.deletion_method === t.deletion_method && i.is_cleanable !== false && !i.requires_app_quit));
        if (cleanTargets.length !== targets.length) throw new Error(ct("Dữ liệu hoặc helper còn thay đổi sau khi đóng app. Không dọn; hãy quét và chọn lại."));
        const total = fresh.filter(i => cleanTargets.some(t => t.path === i.path)).reduce((n,i) => n+i.size_bytes,0);
        if (!(await confirm((ct("Sau khi đóng app và quét lại: ") + (cleanTargets.length) + ct(" mục, ") + (formatBytes(total)) + ct(" (ước tính). Dọn đúng các đường dẫn đã chọn?"))))) return;
        }
      }
      const result = await bridge.runClean({
        scan_id: cleanScan.scan_id,
        targets: cleanTargets,
        confirm_direct_delete: true,
      });
      await loadData();
      setCleanedSuccess(result.failure_count === 0);
      if (result.failure_count)
        setError(
          (ct("Dọn được ") + (result.success_count) + ct(" mục; ") + (result.failure_count) + ct(" mục thất bại.\n") + (result.details
            .filter((d) => d.status !== 'success')
            .map((d) => d.error_message)
            .join('\n')) + ct(""))
        );
      setTimeout(() => setCleanedSuccess(false), 2500);
    } catch (e) {
      setError(bridge.errorText(e));
    } finally {
      if (lifecycle?.operation_id) {
        try {
          const restored = await bridge.finishCleanupApps(lifecycle.operation_id);
          setLifecycleInfo(restored.apps.map(a => `${a.bundle_id}: ${a.reopen_status === 'restore_requested_not_verified' ? ct("đã yêu cầu Chrome phục hồi phiên; kiểm tra tab/profile") : a.reopened ? ct("đã mở lại") : a.closed ? ct("chưa mở lại; xem lịch sử thao tác") : ct("giữ nguyên")}`).join(' · '));
        } catch (e) { setLifecycleInfo((ct("Không mở lại được app: ") + (bridge.errorText(e)) + ct(". Mở lại từ lịch sử thao tác."))); }
      }
      scanRetention.invalidate();
      window.dispatchEvent(new Event("vxclean_operation_history_changed"));
      setIsCleaning(false);
    }
  };

  const getCategoryIcon = (cat: JunkCategoryType) => {
    const def = ALL_10_CATEGORIES.find((d) => d.category === cat);
    if (def) return def.icon;
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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-[#0f1117] text-slate-800 dark:text-slate-100">
      {dialog}{appQuit.dialog}
      {lifecycleInfo && <p role="status" className="p-3 text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400">{lifecycleInfo}</p>}

      {/* Top Tab Bar: Danh mục chi tiết (10 nhóm) vs Tệp mồ côi (gộp nội bộ) */}
      <div className="h-10 px-4 border-b border-slate-200 dark:border-white/5 bg-slate-100/60 dark:bg-[#121622]/60 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'categories'
                ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 font-semibold border border-cyan-500/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5 text-cyan-500" />
            <span>{ct("Danh mục Dọn dẹp")}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('orphans')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'orphans'
                ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 font-semibold border border-cyan-500/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <FileQuestion className="w-3.5 h-3.5 text-amber-500" />
            <span>{ct("Tệp Mồ côi (Tàn dư ứng dụng cũ)")}</span>
          </button>
        </div>

        {activeTab === 'categories' && (
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading || isCleaning}
            className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{ct("Quét lại")}</span>
          </button>
        )}
      </div>

      {activeTab === 'categories' && data && !isLoading && <div className="px-4 py-2 border-b border-slate-200 dark:border-white/5 flex items-center gap-3 text-xs">
        <button disabled={isCleaning || eligibleItems.length === 0} onClick={toggleAll} className="px-3 py-1.5 border border-slate-300 dark:border-white/10 rounded-lg disabled:opacity-40">{ct("Chọn tất cả đủ điều kiện")}</button>
        <button disabled={isCleaning || !eligibleItems.some(i => selectedPaths.has(i.path))} onClick={() => void handleCleanCurrent(true)} className="px-3 py-1.5 bg-cyan-500 text-slate-900 rounded-lg font-semibold disabled:opacity-40">{ct("Dọn lựa chọn toàn bộ nhóm")}</button>
        <span className="text-slate-500">{ct("Mục được bảo vệ / chưa xác minh không được chọn.")}</span>
      </div>}
      {activeTab === 'categories' && !!data?.unsupported_cache_paths?.length && <div role="status" className="text-xs text-amber-500 p-3">{ct("Đã bỏ qua cache tùy chỉnh ngoài phạm vi an toàn:")} {data.unsupported_cache_paths.join(', ')}.</div>}
      {activeTab === 'categories' && !isLoading && data && data.fda_limited_categories.length > 0 && (
        <div role="status" className="px-4 py-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 flex items-center justify-between gap-3 shrink-0">
          <span>{ct("Quét chưa đầy đủ do quyền truy cập:")} {data.fda_limited_categories.join(', ')}.</span>
          <button type="button" className="whitespace-nowrap underline cursor-pointer" onClick={() => {
            void bridge.openFullDiskAccessSettings().catch((e) => setError(bridge.errorText(e)));
          }}>{ct("Mở Cài đặt FDA")}</button>
        </div>
      )}

      {activeTab === 'categories' && !isLoading && !!data?.timed_out_categories?.length && <div role="status" className="px-4 py-2 text-xs text-amber-500 bg-amber-500/10">{ct("Quét chưa đầy đủ:")} {data.timed_out_categories.join(', ')} {ct("quá thời gian chờ truy cập thư mục. Kết quả các nhóm khác vẫn dùng được; quét lại sau khi kiểm tra quyền hoặc ổ lưu trữ.")}</div>}
      {/* Main Tab Content */}
      <RetainedScreen active={active && activeTab === 'orphans'} scope="orphans">
        <OrphansView />
      </RetainedScreen>
      {activeTab !== 'categories' ? null : isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
          {error && (
            <div role="alert" className="text-xs text-rose-400 p-3 mb-2">
              {error}
            </div>
          )}
          <RotateCw className="w-8 h-8 animate-spin text-cyan-500 mb-3" />
          <span className="text-xs">{ct("Đang quét các danh mục chi tiết...")}</span>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* CỘT TRÁI: 10 DANH MỤC HỆ THỐNG */}
          <div className="w-72 border-r border-slate-200 dark:border-white/5 bg-slate-100/40 dark:bg-[#141821]/40 flex flex-col p-3 gap-1 shrink-0 overflow-y-auto">
            <div className="px-2 py-1 mb-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">{ct("Danh mục chi tiết")} </h3>
            </div>
            <div className="space-y-1">
              {data?.categories.slice().sort((a, b) => ALL_10_CATEGORIES.findIndex((d) => d.category === a.category) - ALL_10_CATEGORIES.findIndex((d) => d.category === b.category)).map((cat) => {
                const Icon = getCategoryIcon(cat.category);
                const isSelected = selectedCat === cat.category;
                const isArchive = cat.category === 'xcode_archives';
                const isEmpty = cat.items.length === 0;

                return (
                  <button
                    key={cat.category}
                    type="button"
                    onClick={() => setSelectedCat(cat.category)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 font-semibold'
                        : 'hover:bg-slate-200/50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className="w-4 h-4 text-cyan-500 shrink-0" />
                      <span className="text-xs truncate">{ct(cat.title)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isArchive && (
                        <span className="w-2 h-2 rounded-full bg-amber-500" title={ct("Cần lưu ý")} />
                      )}
                      <span
                        className={`text-[11px] font-mono ${
                          isEmpty ? 'text-slate-400 dark:text-slate-600' : 'opacity-80'
                        }`}
                      >
                        {formatBytes(cat.total_bytes)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CỘT PHẢI: CHI TIẾT TỪNG TỆP TRONG DANH MỤC */}
          <div className="flex-1 flex flex-col overflow-hidden p-6">
            {currentSummary ? (
              <>
                <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-white/5 shrink-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold">{ct(currentSummary.title)}</h2>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 font-bold">
                        {formatBytes(currentSummary.total_bytes)}
                      </span>
                      {currentSummary.items.length === 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-500/10 text-slate-400 font-mono">{ct("Trống")} </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {ct(currentSummary.description)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{ct("Đã phát hiện:")} {formatBytes(currentSummary.total_bytes)} {ct("· Có thể chọn dọn:")} {formatBytes(currentSummary.items.filter(item => item.is_cleanable).reduce((sum, item) => sum + item.size_bytes, 0))}
                      {currentSummary.items.some(i => i.deletion_method === 'pnpm_prune') && <span className="block mt-1">Store pnpm: {formatBytes(currentSummary.items.reduce((n,i) => n + (i.store_size_bytes ?? 0),0))} {ct("· Dung lượng thu hồi do pnpm quyết định sau prune.")}</span>}
                    </p>
                  </div>
                  {currentSummary.items.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={toggleAllInCurrent}
                        className="px-2.5 py-1 text-xs rounded border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                      >{ct("Đổi chọn")} </button>
                      <button
                        type="button"
                        disabled={isCleaning || currentSummary.items.filter((it) => selectedPaths.has(it.path)).length === 0}
                        onClick={() => void handleCleanCurrent()}
                        className="px-4 py-1 text-xs font-semibold rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-900 transition-colors cursor-pointer shadow-lg shadow-cyan-500/20 flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isCleaning ? (
                          <>
                            <RotateCw className="w-3.5 h-3.5 animate-spin" />
                            <span>{ct("Đang dọn...")}</span>
                          </>
                        ) : cleanedSuccess ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-800" />
                            <span>{ct("Đã dọn xong")}</span>
                          </>
                        ) : (
                          <span>{ct("Dọn mục đã chọn")}</span>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* DANH SÁCH FILE CON HOẶC TRẠNG THÁI RỖNG */}
                {currentSummary.items.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-3">
                      <Check className="w-6 h-6 text-emerald-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      {(data?.fda_limited_categories.includes(currentSummary.category) || data?.timed_out_categories?.includes(currentSummary.category)) ? ct("Chưa thể quét đầy đủ danh mục này") : ct("Không phát hiện mục cần dọn")}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm">
                      {data?.timed_out_categories?.includes(currentSummary.category) ? ct("Lượt duyệt thư mục quá thời gian chờ; không kết luận danh mục trống. Các nhóm khác vẫn có kết quả.") : data?.fda_limited_categories.includes(currentSummary.category)
                        ? ct("Cấp quyền truy cập trong Cài đặt hệ thống rồi quét lại để kiểm tra phần chưa đọc được.")
                        : (ct("Không có mục được scanner phát hiện trong ") + (currentSummary.title) + ct(" ở lượt quét này."))}
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto py-4 space-y-2 pr-1">
                    {currentSummary.items.map((item) => {
                      const isChecked = selectedPaths.has(item.path);
                      return (
                        <div
                          key={item.id}
                          className="p-3 rounded-xl border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-[#141821]/40 flex items-center justify-between gap-3 hover:border-cyan-500/30 transition-all"
                        >
                          <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={item.is_cleanable === false}
                              onChange={() => togglePath(item.path)}
                              className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-500 shrink-0"
                            />
                            <div className="truncate">
                              <h4 className="text-xs font-semibold truncate">{item.name}</h4>
                              <p className="text-[11px] font-mono text-slate-400 truncate">
                                {item.path}
                              </p>
                              <p className="text-[11px] mt-1 text-slate-500 dark:text-slate-400 whitespace-normal">{ct(item.consequence_vi ?? "Chưa có mô tả rule.")}{item.requires_app_quit ? ct(" Cần đóng app trước dọn; VXClean sẽ mở lại sau thao tác.") : ''}</p>
                              {item.blocked_reason && <p className="text-[11px] mt-1 text-amber-600 dark:text-amber-400 whitespace-normal">{ct(item.blocked_reason)}</p>}
                              <span className="text-[10px] text-slate-500">{item.safety_level === 'rebuildable' ? ct("Cache tái tạo được") : item.safety_level === 'user_data' ? ct("Dữ liệu cá nhân") : item.safety_level === 'protected' ? ct("Được bảo vệ") : ct("Chưa xác minh")}</span>
                            </div>
                          </label>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs font-mono font-semibold text-right">
                              {item.deletion_method === 'pnpm_prune' ? `Store ${formatBytes(item.store_size_bytes ?? 0)}` : formatBytes(item.size_bytes)}
                              <br />
                              <span className="text-[10px] font-normal text-slate-400">
                                {item.is_cleanable === false
                                  ? ct("Không cho dọn")
                                  : item.deletion_method === 'pnpm_prune' ? ct("pnpm tự dọn · thu hồi chưa biết")
                                  : item.deletion_method === 'trash'
                                  ? ct("Thùng rác")
                                  : ct("Xóa vĩnh viễn")}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => bridge.revealInFileManager(item.path)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                              title={ct("Mở trong Finder")}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {currentSummary.items.length > 0 && (
                  <div className="pt-3 border-t border-slate-200 dark:border-white/5 text-[11px] text-slate-400 flex justify-between items-center shrink-0">
                    <span>{ct("Cơ chế xử lý:")}{' '}
                      <strong className="text-slate-300">
                        {currentSummary.category === 'trash_bin'
                          ? ct("Làm rỗng Thùng rác")
                          : currentSummary.items.every((item) => item.deletion_method === 'trash')
                          ? ct("Chuyển vào Thùng rác")
                          : ct("Theo từng mục (xem xác nhận)")}
                      </strong>
                    </span>
                    <span>{ct("Đã chọn")}{' '}
                      <strong className="font-mono text-cyan-500">
                        {
                          currentSummary.items.filter((it) => selectedPaths.has(it.path)).length
                        }{' '}
                        /{' '}
                        {currentSummary.items.length}
                      </strong>{' '}{ct("tệp")} </span>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
