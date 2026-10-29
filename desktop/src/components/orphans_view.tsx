import {useCleanText} from '../services/ui_language';
import {isScanAccessDeferred} from '../services/scan_access';
import { useConfirmation } from './confirmation_dialog';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileQuestion,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Clock,
  Sparkles,
} from 'lucide-react';
import { OrphanAppGroup, OrphanResidualItem } from '../types';
import {
  errorText,
  fetchOrphans,
  runCleanOrphans,
  formatBytes,
  revealInFileManager,
} from '../services/tauri_bridge';
import { PageHeader } from './page_header';

export const OrphansView: React.FC = () => {
  const ct = useCleanText();

  const { confirm, dialog } = useConfirmation();
  const [orphans, setOrphans] = useState<OrphanAppGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [isCleaning, setIsCleaning] = useState<boolean>(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const mounted = useRef(true);
  const loadGeneration = useRef(0);

  const loadData = async () => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    try {
      const res = await fetchOrphans();
      if (!mounted.current || generation !== loadGeneration.current) return;
      setOrphans(res.orphans);
      setSelectedPaths(new Set());
    } catch (e) {
      if (mounted.current && generation === loadGeneration.current) setResultMessage(isScanAccessDeferred(e)?null:errorText(e));
    } finally {
      if (mounted.current && generation === loadGeneration.current) setLoading(false);
    }
  };

  useEffect(() => {
    mounted.current = true;
    const timer = setTimeout(() => { void loadData(); }, 0);
    return () => { clearTimeout(timer); mounted.current = false; loadGeneration.current++; };
  }, []);

  const totalResidualBytes = useMemo(() => {
    return orphans.reduce((sum, o) => sum + o.total_size_bytes, 0);
  }, [orphans]);

  const selectedBytes = useMemo(() => {
    let sum = 0;
    orphans.forEach((group) => {
      group.items.forEach((item) => {
        if (selectedPaths.has(item.path)) {
          sum += item.size_bytes;
        }
      });
    });
    return sum;
  }, [orphans, selectedPaths]);

  const toggleItem = (path: string) => {
    if (!orphans.some(group => group.items.some(item => item.path === path && item.is_safe_candidate))) return;
    const next = new Set(selectedPaths);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    setSelectedPaths(next);
  };

  const toggleGroup = (group: OrphanAppGroup) => {
    const allGroupPaths = group.items.filter(i => i.is_safe_candidate).map((i) => i.path);
    const isAllSelected = allGroupPaths.length > 0 && allGroupPaths.every((p) => selectedPaths.has(p));
    const next = new Set(selectedPaths);

    if (isAllSelected) {
      allGroupPaths.forEach((p) => next.delete(p));
    } else {
      allGroupPaths.forEach((p) => next.add(p));
    }
    setSelectedPaths(next);
  };

  const handleClean = async () => {
    if (selectedPaths.size === 0 || isCleaning) return;
    if (!await confirm((ct("Xóa vĩnh viễn ") + (selectedPaths.size) + ct(" mục dữ liệu tạm? Danh sách mồ côi chỉ là dự đoán; hãy kiểm tra trước khi tiếp tục.")))) return;
    setIsCleaning(true);
    setResultMessage(null);

    try {
      const res = await runCleanOrphans(Array.from(selectedPaths));
      setResultMessage(
        (ct("Đã dọn ") + (res.success_count) + ct(" mục, ") + (res.failure_count) + ct(" mục thất bại. Thu hồi vĩnh viễn ") + (formatBytes(res.permanently_freed_bytes)) + ct(" dung lượng đĩa từ ") + (res.success_count) + ct(" tệp mồ côi."))
      );
      await loadData();
    } catch (err: any) {
      setResultMessage((ct("Lỗi dọn dẹp: ") + (errorText(err)) + ct("")));
    } finally {
      setIsCleaning(false);
    }
  };

  const getResidualBadge = (type: OrphanResidualItem['residual_type']) => {
    switch (type) {
      case 'app_support':
        return <span className="px-1.5 py-0.5 text-[10px] rounded bg-indigo-50/80 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 font-mono">App Support</span>;
      case 'cache':
        return <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-50/80 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60 font-mono">Caches</span>;
      case 'preferences':
        return <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-50/80 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60 font-mono">Preferences</span>;
      case 'logs':
        return <span className="px-1.5 py-0.5 text-[10px] rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-mono">Logs</span>;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#0b0d13] text-slate-800 dark:text-slate-200">
      {dialog}
      {/* Header bar */}
      <PageHeader
        icon={FileQuestion}
        iconBgClass="bg-cyan-500/10 border-cyan-500/30"
        iconColorClass="text-cyan-700 dark:text-cyan-400"
        title={ct("Tệp Mồ côi & Tàn dư Ứng dụng")}
        subtitle={ct("Phát hiện và dọn dẹp sạch sẽ các thư mục dữ liệu còn sót lại từ các ứng dụng đã từng xóa thủ công")}
        actions={
          <button
            type="button"
            onClick={loadData}
            disabled={loading || isCleaning}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-100/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>{ct("Quét lại")}</span>
          </button>
        }
      />

      {/* Safety Policy Banner */}
      <div className="px-4 py-2.5 bg-cyan-50/20 dark:bg-cyan-950/20 border-b border-cyan-200/30 dark:border-cyan-900/30 flex items-center justify-between text-xs text-cyan-700 dark:text-cyan-300">
        <div className="flex items-center gap-2">
          <ShieldCheck size={15} className="text-cyan-700 dark:text-cyan-400 shrink-0" />
          <span>{ct("Được bảo vệ bởi")} <strong>OrphanSafetyPolicy</strong>{ct(": Danh sách chỉ là dự đoán khi không tìm thấy ứng dụng trong")} <code>/Applications</code>.
          </span>
        </div>
        <span className="text-[11px] text-cyan-700 dark:text-cyan-400 font-mono">{ct("Tổng dữ liệu cần kiểm tra:")} {formatBytes(totalResidualBytes)}
        </span>
      </div>

      {/* Main content list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-xs text-slate-500 gap-2">
            <RefreshCw size={20} className="animate-spin text-cyan-700 dark:text-cyan-400" />{ct("Đang phân tích cấu trúc tàn dư Application Support & Caches...")} </div>
        ) : orphans.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
            <Sparkles size={32} className="text-emerald-400 opacity-60" />
            <p className="font-medium text-slate-600 dark:text-slate-300">{ct("Hệ thống hoàn toàn sạch sẽ!")}</p>
            <p className="text-slate-500">{ct("Không phát hiện tệp mồ côi nào từ các ứng dụng cũ.")}</p>
          </div>
        ) : (
          orphans.map((group) => {
            const allGroupPaths = group.items.filter(i => i.is_safe_candidate).map((i) => i.path);
            const isAllGroupSelected = allGroupPaths.length > 0 && allGroupPaths.every((p) => selectedPaths.has(p));
            const isSomeGroupSelected =
              allGroupPaths.some((p) => selectedPaths.has(p)) && !isAllGroupSelected;

            return (
              <div
                key={group.id}
                className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/50 dark:bg-[#121622]/50 overflow-hidden shadow-sm"
              >
                {/* Group header */}
                <div className="p-3 bg-slate-100/60 dark:bg-[#161a28]/60 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isAllGroupSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = isSomeGroupSelected;
                      }}
                      onChange={() => toggleGroup(group)}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-cyan-500 focus:ring-0 bg-slate-100 dark:bg-slate-900 cursor-pointer"
                    />

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-900 dark:text-white">
                          {group.original_app_name}
                        </span>
                        {group.bundle_id_guess && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                            ({group.bundle_id_guess})
                          </span>
                        )}
                      </div>

                      {group.last_modified && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                          <Clock size={11} />
                          <span>{ct("Lần sửa đổi cuối:")} {group.last_modified}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-mono font-semibold text-cyan-700 dark:text-cyan-400">
                      {formatBytes(group.total_size_bytes)}
                    </span>
                    <p className="text-[10px] text-slate-500">{group.items.length} {ct("tệp tàn dư")}</p>
                  </div>
                </div>

                {/* Items in group */}
                <div className="divide-y divide-slate-800/40 p-1">
                  {group.items.map((item) => {
                    const isChecked = selectedPaths.has(item.path);
                    return (
                      <div
                        key={item.id}
                        onClick={() => toggleItem(item.path)}
                        className={`p-2.5 rounded-lg flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                          isChecked ? 'bg-slate-100/30 dark:bg-slate-800/30 hover:bg-slate-100/50 dark:hover:bg-slate-800/50' : 'hover:bg-slate-100/40 dark:hover:bg-slate-900/40'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            disabled={!item.is_safe_candidate || isCleaning}
                            checked={isChecked}
                            onChange={() => toggleItem(item.path)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-cyan-500 focus:ring-0 bg-slate-100 dark:bg-slate-900 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-slate-800 dark:text-slate-200 truncate">
                                {item.path.split('/').pop()}
                              </span>
                              {getResidualBadge(item.residual_type)}
                              {item.is_safe_candidate && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-900 font-mono">{ct("An toàn")} </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                              {item.path}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-mono text-slate-600 dark:text-slate-300">
                            {formatBytes(item.size_bytes)}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              revealInFileManager(item.path);
                            }}
                            title={ct("Mở trong Finder")}
                            className="p-1 rounded text-slate-500 hover:text-cyan-700 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <ExternalLink size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer bar */}
      <div className="p-4 border-t border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-[#121622]/80 flex items-center justify-between">
        <div>
          {resultMessage ? (
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
              <CheckCircle2 size={15} />
              {resultMessage}
            </div>
          ) : (
            <div className="text-xs text-slate-500 dark:text-slate-400">{ct("Đã chọn:")} <strong className="text-cyan-700 dark:text-cyan-400 font-mono">{formatBytes(selectedBytes)}</strong>{' '}
              ({selectedPaths.size} {ct("mục tàn dư)")} </div>
          )}
        </div>

        <button
          onClick={handleClean}
          disabled={selectedPaths.size === 0 || isCleaning}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-lg shadow-cyan-950/40 flex items-center gap-2 transition-all"
        >
          {isCleaning ? (
            <>
              <RefreshCw size={14} className="animate-spin" />{ct("Đang dọn dẹp...")} </>
          ) : (
            <>
              <Trash2 size={14} />{ct("Dọn sạch Tàn dư (")}{selectedPaths.size} {ct("mục)")} </>
          )}
        </button>
      </div>
    </div>
  );
};
