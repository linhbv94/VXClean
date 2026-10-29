import {useCleanText} from '../services/ui_language';
import {isScanAccessDeferred} from '../services/scan_access';
import { defaultUninstallPaths } from '../services/uninstall_selection';
import { useConfirmation } from './confirmation_dialog';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Trash2,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Package,
  ExternalLink,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { InstalledApp, AssociatedFile } from '../types';
import { fetchInstalledApps, runUninstallApp, formatBytes, revealInFileManager, errorText } from '../services/tauri_bridge';
import { PageHeader } from './page_header';

export const UninstallerView: React.FC = () => {
  const ct = useCleanText();

  const { confirm, dialog } = useConfirmation();
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
  const [isUninstalling, setIsUninstalling] = useState<boolean>(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const isMountedRef = useRef<boolean>(true);
  const loadGeneration = useRef(0);

  const loadApps = async () => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    try {
      const res = await fetchInstalledApps();
      if (!isMountedRef.current || generation !== loadGeneration.current) return;
      setApps(res.apps);
      setResultMessage(res.discovery_incomplete ? ct("Một số vùng chưa quét hết do thiếu quyền hoặc giới hạn tìm kiếm; danh sách có thể chưa đầy đủ.") : null);
      const visible = res.apps.filter((a) => !a.is_system_protected);
      setSelectedAppId((prevId) => {
        if (prevId && visible.some((a) => a.id === prevId)) {
          return prevId;
        }
        return visible.length > 0 ? visible[0].id : null;
      });
    } catch (e) {
      if (isMountedRef.current && generation === loadGeneration.current) setResultMessage(isScanAccessDeferred(e)?null:errorText(e));
    } finally {
      if (isMountedRef.current && generation === loadGeneration.current) setLoading(false);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    const timer = setTimeout(() => { void loadApps(); }, 0);
    return () => {
      clearTimeout(timer);
      isMountedRef.current = false;
      loadGeneration.current++;
    };
  }, []);

  const [sortKey, setSortKey] = useState<'name' | 'size'>('size');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Ẩn app có is_system_protected theo Spec 07
  const visibleApps = useMemo(() => {
    return apps.filter((a) => !a.is_system_protected);
  }, [apps]);

  const filteredAndSortedApps = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const filtered = visibleApps.filter(
      (a) =>
        !query ||
        a.name.toLowerCase().includes(query) ||
        a.bundle_id.toLowerCase().includes(query)
    );
    return filtered.sort((a, b) => {
      if (sortKey === 'size') {
        return sortOrder === 'desc'
          ? b.total_size_bytes - a.total_size_bytes
          : a.total_size_bytes - b.total_size_bytes;
      } else {
        return sortOrder === 'desc'
          ? b.name.localeCompare(a.name)
          : a.name.localeCompare(b.name);
      }
    });
  }, [visibleApps, searchQuery, sortKey, sortOrder]);

  // Sau search nếu app hiện tại không trong kết quả, không để thao tác gỡ cho app vô hình
  const selectedApp = useMemo(() => {
    if (!selectedAppId) return null;
    return filteredAndSortedApps.find((a) => a.id === selectedAppId) || null;
  }, [filteredAndSortedApps, selectedAppId]);

  // Tự động clear selection nếu app đang chọn bị ẩn khỏi kết quả search
  useEffect(() => {
    if (selectedAppId && !filteredAndSortedApps.some((a) => a.id === selectedAppId)) {
      setSelectedAppId(null);
    }
  }, [filteredAndSortedApps, selectedAppId]);

  // Chỉ chọn mặc định dữ liệu đã nhận diện; discovery luôn cần user chọn.
  useEffect(() => {
    if (selectedApp) {
      if (selectedApp.is_system_protected || selectedApp.is_self_app) {
        setSelectedPaths(new Set());
      } else {
        setSelectedPaths(defaultUninstallPaths(selectedApp.associated_files));
      }
    } else {
      setSelectedPaths(new Set());
    }
  }, [selectedApp]);

  const toggleSort = (key: 'name' | 'size') => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder(key === 'size' ? 'desc' : 'asc');
    }
  };

  const toggleFilePath = (path: string) => {
    if (selectedApp?.is_system_protected || selectedApp?.is_self_app) return;
    const next = new Set(selectedPaths);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    setSelectedPaths(next);
  };

  const totalSelectedSize = useMemo(() => {
    if (!selectedApp) return 0;
    return selectedApp.associated_files
      .filter((f) => selectedPaths.has(f.path))
      .reduce((sum, f) => sum + f.size_bytes, 0);
  }, [selectedApp, selectedPaths]);

  const hasProtectedFilesSelected = useMemo(() => {
    if (!selectedApp) return false;
    return selectedApp.associated_files.some(
      (f) => selectedPaths.has(f.path) && f.deletion_method === 'admin_shell'
    );
  }, [selectedApp, selectedPaths]);

  const handleStartUninstall = async () => {
    if (!selectedApp || selectedPaths.size === 0 || isUninstalling) return;
    if (!await confirm((ct("Chuyển ") + (selectedPaths.size) + ct(" mục của ") + (selectedApp.name) + ct(" vào Thùng rác?")))) return;

    // Nếu có file yêu cầu admin shell hoặc cần fallback -> mở modal xác nhận
    if (hasProtectedFilesSelected) {
      setShowAdminModal(true);
    } else {
      executeUninstall(false);
    }
  };

  const executeUninstall = async (allowAdmin: boolean) => {
    if (!selectedApp) return;
    setShowAdminModal(false);
    setIsUninstalling(true);
    setResultMessage(null);

    try {
      const res = await runUninstallApp({
        app_id: selectedApp.id,
        selected_paths: Array.from(selectedPaths),
        allow_admin_fallback: allowAdmin,
      });

      if (!allowAdmin && res.details.some(d => d.status === 'permission_denied')) {
        setSelectedPaths(new Set(res.details.filter(d => d.status === 'permission_denied').map(d => d.path)));
        setShowAdminModal(true);
      }
      setResultMessage(
        (ct("Đã xử lý ") + (res.success_count) + ct(" mục, ") + (res.failure_count) + ct(" mục thất bại. Đã chuyển ") + (formatBytes(res.trashed_bytes)) + ct(" vào Thùng rác") + (res.permanently_freed_bytes > 0
            ? ` và xóa vĩnh viễn ${formatBytes(res.permanently_freed_bytes)} (Admin).`
            : '.') + ct(""))
      );
      // Refresh list
      if (allowAdmin || !res.details.some(d => d.status === 'permission_denied')) await loadApps();
    } catch (err: any) {
      setResultMessage((ct("Lỗi khi gỡ bỏ: ") + (errorText(err)) + ct("")));
    } finally {
      setIsUninstalling(false);
    }
  };

  const getFileTypeBadge = (type: AssociatedFile['file_type']) => {
    switch (type) {
      case 'discovered':
        return <span className="text-[10px] text-amber-600 dark:text-amber-400">{ct("Có thể liên quan")}</span>;
      case 'bundle':
        return <span className="px-1.5 py-0.5 text-[10px] rounded bg-cyan-50/80 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-400 border border-cyan-200/60 dark:border-cyan-800/60 font-mono">Bundle (.app)</span>;
      case 'app_support':
        return <span className="px-1.5 py-0.5 text-[10px] rounded bg-indigo-50/80 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 font-mono">App Support</span>;
      case 'cache':
        return <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-50/80 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60 font-mono">Caches</span>;
      case 'preferences':
        return <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-50/80 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60 font-mono">Preferences</span>;
      case 'container':
        return <span className="px-1.5 py-0.5 text-[10px] rounded bg-cyan-50 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800/60 font-mono">Container</span>;
      case 'app_scripts':
        return <span className="px-1.5 py-0.5 text-[10px] rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-mono">App Scripts</span>;
      case 'logs':
        return <span className="px-1.5 py-0.5 text-[10px] rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-mono">Logs</span>;
      default:
        return <span className="px-1.5 py-0.5 text-[10px] rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono">{type}</span>;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#0b0d13] text-slate-800 dark:text-slate-200">
      {dialog}
      {/* Header bar */}
      <PageHeader
        icon={Package}
        iconBgClass="bg-indigo-500/10 border-indigo-500/30"
        iconColorClass="text-indigo-600 dark:text-indigo-400"
        title={ct("Trình gỡ Cài đặt Ứng dụng")}
        subtitle={ct("Quét sạch tận gốc ứng dụng cùng toàn bộ tệp Caches, App Support và Preferences còn sót lại")}
        actions={
          <button
            type="button"
            onClick={loadApps}
            disabled={loading || isUninstalling}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-100/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>{ct("Làm mới")}</span>
          </button>
        }
      />

      {/* Main 2-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Apps List */}
        <div className="w-[340px] border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col bg-slate-50/80 dark:bg-[#0b0d13]/80">
          {/* Search box & Finder compact sort header */}
          <div className="p-3 border-b border-slate-200/60 dark:border-slate-800/60 space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder={ct("Tìm ứng dụng hoặc Bundle ID...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-[#141822] border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 transition-colors"
              />
            </div>
            {/* Finder compact sort bar */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-0.5">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleSort('name')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
                    sortKey === 'name'
                      ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 font-semibold border border-cyan-500/30'
                      : 'hover:bg-slate-100/60 dark:hover:bg-slate-800/60 text-slate-500 dark:text-slate-400'
                  }`}
                  title={ct("Sắp xếp theo tên ứng dụng")}
                >
                  <span>{ct("Tên")}</span>
                  {sortKey === 'name' && (
                    sortOrder === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => toggleSort('size')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
                    sortKey === 'size'
                      ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 font-semibold border border-cyan-500/30'
                      : 'hover:bg-slate-100/60 dark:hover:bg-slate-800/60 text-slate-500 dark:text-slate-400'
                  }`}
                  title={ct("Sắp xếp theo dung lượng tệp")}
                >
                  <span>{ct("Dung lượng")}</span>
                  {sortKey === 'size' && (
                    sortOrder === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
                  )}
                </button>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {filteredAndSortedApps.length} / {visibleApps.length}
              </span>
            </div>
          </div>

          {/* App list items - Compact Finder style */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                <RefreshCw size={16} className="animate-spin text-cyan-700 dark:text-cyan-400" />{ct("Đang nạp danh sách ứng dụng...")} </div>
            ) : filteredAndSortedApps.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">{ct("Không tìm thấy ứng dụng phù hợp")} </div>
            ) : (
              filteredAndSortedApps.map((app) => {
                const isSelected = app.id === selectedAppId;
                return (
                  <button
                    key={app.id}
                    onClick={() => setSelectedAppId(app.id)}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors ${
                      isSelected
                        ? 'bg-cyan-50/30 dark:bg-cyan-950/30 border-l-2 border-cyan-400'
                        : 'hover:bg-slate-100/30 dark:hover:bg-slate-800/30'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300/80 dark:border-slate-700/80 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-xs shrink-0">
                      {app.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                          {app.name}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
                          {formatBytes(app.total_size_bytes)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-slate-500 truncate font-mono flex-1">
                          {app.bundle_id}
                        </span>
                        {app.architectures.includes('arm64') && (
                          <span className="text-[8px] px-1 py-0.2 rounded bg-cyan-50/60 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400 border border-cyan-200/60 dark:border-cyan-900/60 font-mono shrink-0">
                            arm64
                          </span>
                        )}
                        {app.is_self_app && (
                          <span className="text-[8px] px-1 py-0.2 rounded bg-amber-50/60 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/60 shrink-0 font-medium">{ct("Tự thân")} </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: App Details & File Tree */}
        <div className="flex-1 flex flex-col bg-slate-50/30 dark:bg-[#0f1117]/30 overflow-hidden">
          {selectedApp ? (
            <>
              {/* App Summary Card */}
              <div className="p-4 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/40 dark:bg-[#121622]/40">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-500/30 flex items-center justify-center text-cyan-700 dark:text-cyan-300 font-black text-xl shadow-inner">
                      {selectedApp.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">{selectedApp.name}</h2>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">v{selectedApp.version}</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{selectedApp.bundle_path}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-semibold text-cyan-700 dark:text-cyan-400 font-mono">
                      {formatBytes(selectedApp.total_size_bytes)}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {selectedApp.associated_files.length} {ct("hạng mục liên quan")} </div>
                  </div>
                </div>

                {/* Protection Notices */}
                {selectedApp.is_system_protected && (
                  <div className="mt-3 p-2.5 rounded-lg bg-rose-50/30 dark:bg-rose-950/30 border border-rose-200/50 dark:border-rose-800/50 flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-300">
                    <ShieldAlert size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />
                    <span>
                      <strong>{ct("Bảo vệ bởi macOS SIP (System Integrity Protection):")}</strong> {ct("Ứng dụng này là thành phần cốt lõi của hệ thống Apple và không thể gỡ bỏ để tránh hỏng hệ điều hành.")} </span>
                  </div>
                )}

                {selectedApp.is_self_app && (
                  <div className="mt-3 p-2.5 rounded-lg bg-amber-50/30 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/50 flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                    <ShieldAlert size={16} className="text-amber-700 dark:text-amber-400 shrink-0" />
                    <span>
                      <strong>{ct("Khóa bảo vệ tự thân:")}</strong> {ct("Không thể gỡ bỏ ứng dụng VXClean khi chính nó đang được khởi chạy và làm việc.")} </span>
                  </div>
                )}
              </div>

              {/* Associated Files List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400 px-1 mb-1">
                  <span>{ct("DANH SÁCH TỆP & THƯ MỤC CẤU THÀNH (")}{selectedApp.associated_files.length})</span>
                  <span>{ct("Đã chọn:")} {formatBytes(totalSelectedSize)}</span>
                </div>

                <div className="space-y-1.5">
                  {selectedApp.associated_files.map((file) => {
                    const isChecked = selectedPaths.has(file.path);
                    const isDisabled = selectedApp.is_system_protected || selectedApp.is_self_app;

                    return (
                      <div
                        key={file.path}
                        onClick={() => toggleFilePath(file.path)}
                        className={`p-2.5 rounded-lg border transition-all flex items-center justify-between gap-3 ${
                          isDisabled
                            ? 'bg-slate-100/30 dark:bg-slate-900/30 border-slate-200/40 dark:border-slate-800/40 opacity-60 cursor-not-allowed'
                            : isChecked
                            ? 'bg-slate-100/40 dark:bg-slate-800/40 border-cyan-500/40 hover:border-cyan-500/60 cursor-pointer'
                            : 'bg-slate-100/40 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isDisabled}
                            onChange={() => toggleFilePath(file.path)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-cyan-500 focus:ring-0 focus:ring-offset-0 bg-slate-100 dark:bg-slate-900 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-medium text-slate-800 dark:text-slate-200 truncate">
                                {file.path.split('/').pop()}
                              </span>
                              {getFileTypeBadge(file.file_type)}
                              {file.deletion_method === 'admin_shell' && (
                                <span className="px-1 py-0.2 text-[9px] rounded bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                                  Root/Admin
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                              {file.path}
                            </p>
                            {file.discovery_reason && <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">{file.discovery_reason}</p>}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-mono text-slate-600 dark:text-slate-300">
                            {formatBytes(file.size_bytes)}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              revealInFileManager(file.path);
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

              {/* Footer action bar */}
              <div className="p-4 border-t border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-[#121622]/80 flex items-center justify-between">
                <div>
                  {resultMessage ? (
                    <div className={`flex items-center gap-2 text-xs font-medium ${(resultMessage.startsWith("Lỗi khi gỡ bỏ:") || resultMessage.startsWith("Uninstall error:")) ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {(resultMessage.startsWith("Lỗi khi gỡ bỏ:") || resultMessage.startsWith("Uninstall error:")) ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                      {resultMessage}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
                      {selectedApp.is_system_protected || selectedApp.is_self_app ? (
                        <span className="text-rose-600 dark:text-rose-400">{ct("Ứng dụng này đang bị khóa bởi hệ thống")}</span>
                      ) : (
                        <div>
                          <div>{ct("Dung lượng thu hồi dự kiến:")} <strong className="text-cyan-700 dark:text-cyan-400 font-mono">{formatBytes(totalSelectedSize)}</strong>
                          </div>
                          <div className="text-[11px] text-slate-500">{ct("(chuyển vào Thùng rác an toàn)")} </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleStartUninstall}
                  disabled={
                    selectedApp.is_system_protected ||
                    selectedApp.is_self_app ||
                    selectedPaths.size === 0 ||
                    isUninstalling
                  }
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-lg shadow-rose-950/40 flex items-center gap-2 transition-all whitespace-nowrap shrink-0"
                >
                  {isUninstalling ? (
                    <>
                      <RefreshCw size={14} className="animate-spin shrink-0" />
                      <span className="whitespace-nowrap">{ct("Đang gỡ bỏ...")}</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} className="shrink-0" />
                      <span className="whitespace-nowrap">{ct("Gỡ bỏ triệt để (")}{selectedPaths.size} {ct("mục)")}</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs">
              <Package size={32} className="mb-2 opacity-40" />{ct("Chọn một ứng dụng từ danh sách bên trái để xem phân rã chi tiết")} </div>
          )}
        </div>
      </div>

      {/* Admin Fallback Confirmation Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121622] border border-rose-200/80 dark:border-rose-800/80 rounded-xl max-w-md w-full p-5 shadow-2xl text-slate-800 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 mb-3">
              <div className="w-10 h-10 rounded-lg bg-rose-50/80 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{ct("Yêu cầu Quyền Quản trị viên (Admin)")}</h3>
                <p className="text-xs text-rose-600 dark:text-rose-400">{ct("Cảnh báo thay đổi phương thức xóa")}</p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-100/60 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
              <p>{ct("Một số tệp của ứng dụng này nằm trong phân vùng thuộc quyền sở hữu của")} <strong>{ct("root/hệ thống")}</strong>.
              </p>
              <div className="p-2 rounded bg-rose-50/40 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-[11px] text-rose-700 dark:text-rose-300 space-y-1">
                <strong>{ct("QUAN TRỌNG:")}</strong>
                <div>{ct("• Hành động này sẽ chuyển phương thức từ")} <strong>{ct("Chuyển vào Thùng rác (trashItem)")}</strong> sang <strong>{ct("XÓA VĨNH VIỄN (rm -rf)")}</strong>.</div>
                <div>{ct("• Tệp bị xóa bằng quyền quản trị sẽ")} <strong>{ct("KHÔNG THỂ KHÔI PHỤC")}</strong>.</div>
                <div>{ct("• Hệ thống macOS sẽ yêu cầu Touch ID hoặc Mật khẩu quản trị viên.")}</div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setShowAdminModal(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-700 transition-colors"
              >{ct("Hủy thao tác")} </button>
              <button
                onClick={() => executeUninstall(true)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950 transition-colors flex items-center gap-1.5"
              >
                <ShieldAlert size={14} />{ct("Xác nhận & Cấp quyền Root")} </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
