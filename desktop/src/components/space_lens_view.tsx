import {useCleanText} from '../services/ui_language';
import {isScanAccessDeferred} from '../services/scan_access';
import { useConfirmation } from './confirmation_dialog';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Compass,
  Folder,
  File,
  ChevronRight,
  RefreshCw,
  Trash2,
  ExternalLink,
  Copy,
  Terminal,
  CircleDot,
  List,
  Lock,
  Package,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';
import { SpaceLensNode, SpaceLensResponse } from '../types';
import * as bridge from '../services/tauri_bridge';
import { formatBytes } from '../services/mock_engine';
import { packCircles } from './circle_packing';
import { FolderScanCache } from '../services/folder_scan_cache';
import { scanRetention } from '../services/scan_retention';
import { RecentButton } from './recent_button';
import { addRecentItem } from '../services/recent_service';
import { PageHeader } from './page_header';

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  path: string;
}

const CIRCLE_PALETTE = [
  { fill: 'rgba(6, 182, 212, 0.25)', stroke: '#06b6d4' },
  { fill: 'rgba(99, 102, 241, 0.25)', stroke: '#6366f1' },
  { fill: 'rgba(168, 85, 247, 0.25)', stroke: '#a855f7' },
  { fill: 'rgba(245, 158, 11, 0.25)', stroke: '#f59e0b' },
  { fill: 'rgba(16, 185, 129, 0.25)', stroke: '#10b981' },
  { fill: 'rgba(244, 63, 94, 0.25)', stroke: '#f43f5e' },
  { fill: 'rgba(56, 189, 248, 0.25)', stroke: '#38bdf8' },
];

function truncateName(name: string, radius: number): string {
  const maxChars = Math.max(4, Math.floor(radius / 4.5));
  if (name.length <= maxChars) return name;
  return name.slice(0, maxChars - 1) + '…';
}

export const SpaceLensView: React.FC = () => {
  const ct = useCleanText();

  const { confirm, dialog } = useConfirmation();
  const [lensId, setLensId] = useState('');
  const [isTrashing, setIsTrashing] = useState(false);
  const [currentPath, setCurrentPath] = useState('~/');
  const [loading, setLoading] = useState<boolean>(true);
  const [currentNode, setCurrentNode] = useState<SpaceLensNode | null>(null);
  const [viewMode, setViewMode] = useState<'circles' | 'list'>('circles');
  const [selectedNode, setSelectedNode] = useState<SpaceLensNode | null>(null);
  const [, setHistory] = useState<SpaceLensNode[]>([]);
  const [isPartial, setIsPartial] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<{
    current_path?: string;
    scanned_bytes?: number;
    item_count?: number;
  } | null>(null);

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    path: '',
  });
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const contextMenuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 640,
    height: 420,
  });

  const proofRoot = useRef<string>('');
  const navigationTicket = useRef<string>('');
  const folderCache = useRef(new FolderScanCache<SpaceLensResponse>());
  const generation = useRef(0);
  const isMountedRef = useRef(true);
  const isCancelledRef = useRef<boolean>(false);

  // ResizeObserver đo đạc kích thước container cho packed circles SVG
  useEffect(() => {
    if (!containerRef.current) return;
    const updateDimensions = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (clientWidth > 50 && clientHeight > 50) {
          setDimensions({
            width: Math.round(clientWidth),
            height: Math.round(clientHeight),
          });
        }
      }
    };
    updateDimensions();

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 50 && height > 50) {
          setDimensions({
            width: Math.round(width),
            height: Math.round(height),
          });
        }
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [viewMode]);

  useEffect(() => {
    let revision = scanRetention.revision;
    return scanRetention.subscribe(() => {
      if (revision !== scanRetention.revision) {revision = scanRetention.revision; folderCache.current.clear(); navigationTicket.current='';}
    });
  }, []);
  const analyzePath = async (target: string, force = false): Promise<boolean> => {
    if (force) {folderCache.current.clear();navigationTicket.current='';}
    const revision = scanRetention.revision;
    const queryGeneration=++generation.current;
    let cached:SpaceLensResponse|undefined;
    try {cached=await folderCache.current.resolve(target,revision,navigationTicket.current,bridge.fetchLensFolder);}
    catch(error){if(queryGeneration===generation.current)setActionMessage(bridge.errorText(error));return false;}
    if(queryGeneration!==generation.current || revision!==scanRetention.revision)return false;
    if (cached) {
      generation.current++; isCancelledRef.current = true;
      setCurrentPath(cached.root_path); setCurrentNode(cached.root_node);
      proofRoot.current=cached.scan_root_path??cached.root_path;navigationTicket.current=cached.lens_id??'';
      setLensId(cached.lens_id ?? 'mock_lens'); setHistory([cached.root_node]);
      setSelectedNode(null); setLoading(false); setScanProgress(null);setActionMessage(null);
      setIsPartial(Boolean(cached.is_partial) || Boolean(cached.root_node.children?.some(c=>c.is_access_denied)));
      setContextMenu(prev=>({...prev,visible:false})); return true;
    }
    const runId = ++generation.current;
    isCancelledRef.current = false;
    setLoading(true);
    setScanProgress(null);
    setActionMessage(null);
    setIsPartial(false);
    setCurrentPath(target);
    setCurrentNode(null);
    setSelectedNode(null);
    setLensId('');
    setContextMenu((prev) => ({ ...prev, visible: false }));

    try {
      const res: SpaceLensResponse = await bridge.runAnalyzeSpaceLens(
        target,
        (progressEvent) => {
          if (runId === generation.current && !isCancelledRef.current) {
            setScanProgress(progressEvent);
          }
        },
        () => runId !== generation.current || isCancelledRef.current
      );

      if (runId !== generation.current || isCancelledRef.current) return false;

      if (revision !== scanRetention.revision) {setActionMessage(ct("Dữ liệu đã thay đổi; hãy quét lại folder."));return false;}
      folderCache.current.put([target,res.root_path],res,revision);
      proofRoot.current=res.scan_root_path??res.root_path;navigationTicket.current=res.lens_id??'';
      setLensId(res.lens_id ?? 'mock_lens');
      setCurrentPath(res.root_path);
      setCurrentNode(res.root_node);
      setHistory([res.root_node]);
      setSelectedNode(null);

      // Kiểm tra quét một phần / bị từ chối truy cập
      const partialCheck =
        Boolean(res.is_partial) ||
        Boolean(res.root_node.children?.some((c) => c.is_access_denied));
      setIsPartial(partialCheck);
      return true;
    } catch (e) {
      if (runId !== generation.current || isCancelledRef.current) return false;
      setActionMessage(isScanAccessDeferred(e)?null:bridge.errorText(e));
      return false;
    } finally {
      if (runId === generation.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    const timer = setTimeout(() => { void analyzePath(currentPath,true); }, 0);
    return () => {
      clearTimeout(timer);
      isMountedRef.current = false;
      generation.current++;
      isCancelledRef.current = true;
    };
  }, []);

  const handleCancelScan = () => {
    generation.current++;
    isCancelledRef.current = true;
    setLoading(false);
    setActionMessage(ct("Đã hủy quét phân tích dung lượng."));
  };

  const openRecentRoot = async (path: string) => {
    if (loading || isTrashing || !isMountedRef.current) return;
    if (await analyzePath(path, true)) addRecentItem('vxclean_recent_lens_folders', path);
  };
  const handlePickFolder = async () => {
    if (loading || isTrashing) return;
    try {
      const picked = await bridge.chooseScanFolder();
      if (!isMountedRef.current || !picked) return;
      await openRecentRoot(picked);
    } catch (error) { setActionMessage(bridge.errorText(error)); }
  };

  const handleOpenFDA = async () => {
    try {
      await bridge.openFullDiskAccessSettings();
    } catch (e) {
      setActionMessage(bridge.errorText(e));
    }
  };

  // Đóng context menu khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Xây dựng danh sách breadcrumbs từ currentNode.path
  const breadcrumbs = useMemo(() => {
    if (!currentNode) return [];
    const parts = currentNode.path.split('/').filter(Boolean);
    return parts.map((part, index) => {
      const subPath = '/' + parts.slice(0, index + 1).join('/');
      return {
        name: part,
        path: subPath,
      };
    });
  }, [currentNode]);

  // Retained subtree navigation; only unretained branches require a scan.
  const handleDrillDown = async (node: SpaceLensNode) => {
    if (!node.is_directory || node.is_package || node.is_access_denied) return;
    setCurrentPath(node.path);
    await analyzePath(node.path);
  };

  const handleNavigateBreadcrumb = (index: number) => {
    const crumb = breadcrumbs[index];
    if (crumb) void analyzePath(crumb.path);
  };

  const handleContextMenu = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      path,
    });
  };

  // Fail-closed: Chỉ cho phép chuyển vào Thùng rác nếu backend trả cờ can_trash === true rõ ràng
  const canTrashNode = (node: SpaceLensNode): boolean => {
    return node.can_trash === true;
  };

  const handleMoveToTrash = async (node: SpaceLensNode) => {
    if(isTrashing)return;
    let ticket=lensId;
    let confirmedNode=node;
    // Deep navigation does not grant mutation authority. Refresh current parent before confirmation.
    if(proofRoot.current!==currentPath) {
      setIsTrashing(true);
      try {const fresh=await bridge.runAnalyzeSpaceLens(currentPath);
        const refreshedNode=fresh.root_node.children?.find(child=>child.path===node.path && child.can_trash===true);
        if(!refreshedNode)throw new Error(ct("Mục đã thay đổi hoặc không được phép chuyển vào Thùng rác."));
        confirmedNode=refreshedNode;
        ticket=fresh.lens_id??'';
      } catch(error) {setActionMessage(bridge.errorText(error));setIsTrashing(false);return;}
      setIsTrashing(false);
    }
    if (
      isTrashing ||
      !(await confirm(
        (ct("Chuyển \"") + (confirmedNode.name) + ct("\" (") + (formatBytes(
          confirmedNode.size_bytes
        )) + ct(") vào Thùng rác? Dữ liệu sẽ còn trên đĩa cho tới khi làm rỗng Thùng rác."))
      ))
    )
      return;
    setIsTrashing(true);
    try {
      const result = await bridge.trashLensItem(ticket, node.path);
      await analyzePath(currentPath,true);
      setActionMessage(
        result.failure_count
          ? result.details
              .map((d) => d.error_message)
              .filter(Boolean)
              .join('; ')
          : (ct("Đã chuyển ") + (formatBytes(result.trashed_bytes)) + ct(" vào Thùng rác."))
      );
    } catch (e) {
      setActionMessage(bridge.errorText(e));
    } finally {
      setIsTrashing(false);
    }
  };

  const sortedChildren = useMemo(() => {
    if (!currentNode || !currentNode.children) return [];
    return [...currentNode.children].sort((a, b) => b.size_bytes - a.size_bytes);
  }, [currentNode]);

  const maxChildBytes = useMemo(() => {
    if (!sortedChildren.length) return 0;
    return sortedChildren[0]?.size_bytes || 0;
  }, [sortedChildren]);

  // View chỉ vẽ top ~80 circles để tránh suy giảm hiệu năng; List xem đầy đủ
  const topCircles = useMemo(() => {
    return sortedChildren.slice(0, 80);
  }, [sortedChildren]);

  const packedCircles = useMemo(() => {
    if (viewMode !== 'circles' || !topCircles.length) return [];
    return packCircles(
      topCircles,
      dimensions.width,
      dimensions.height,
      currentNode?.size_bytes || 0
    );
  }, [viewMode, topCircles, dimensions, currentNode]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#0f1117] text-slate-800 dark:text-slate-100">
      {dialog}

      {/* Header bar */}
      <PageHeader
        icon={Compass}
        iconBgClass="bg-cyan-500/10 border-cyan-500/30"
        iconColorClass="text-cyan-600 dark:text-cyan-400"
        title={ct("Kính Không gian (Space Lens)")}
        subtitle={ct("Trực quan hóa bản đồ dung lượng theo bong bóng packed circles và danh sách thu gọn")}
      />

      {/* Lens Toolbar below header */}
      <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800/80 bg-slate-100/60 dark:bg-[#121622]/60 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {/* Native Folder Picker Button & Typed Path */}
          <RecentButton type="folder" storageKey="vxclean_recent_lens_folders"
            label={ct("Chọn thư mục...")} title={ct("Chọn thư mục qua hộp thoại hệ điều hành")}
            icon={<FolderOpen size={13} className="text-cyan-600 dark:text-cyan-400" />}
            disabled={loading || isTrashing} onMainClick={handlePickFolder} onSelectRecent={openRecentRoot}
            buttonClassName="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            emptyLabel={ct("Chưa có thư mục gần đây")} />

          <input
            aria-label={ct("Thư mục cần phân tích")}
            value={currentPath}
            onChange={(e) => setCurrentPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading) void analyzePath(currentPath,true);
            }}
            placeholder={ct("~/ hoặc /Applications")}
            className="w-56 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle: Packed Circles vs Compact List */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-200/60 dark:bg-slate-900 border border-slate-300 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('circles')}
              className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                viewMode === 'circles'
                  ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-xs font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={ct("Bong bóng dung lượng (Packed Circles)")}
            >
              <CircleDot size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-xs font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={ct("Danh sách thu gọn (Compact List)")}
            >
              <List size={14} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => analyzePath(currentPath,true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-white/60 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>{ct("Quét lại")}</span>
          </button>
        </div>
      </div>

      {/* Partial / FDA Permission Warning Banner */}
      {isPartial && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between text-xs text-amber-600 dark:text-amber-400 shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-500 dark:text-amber-400 shrink-0" />
            <span>{ct("Một số thư mục không đọc được. Kiểm tra quyền truy cập hoặc quét lại.")} </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenFDA}
              className="px-2.5 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-[11px] transition-colors cursor-pointer"
            >{ct("Mở Cài đặt FDA")} </button>
            <button
              type="button"
              onClick={() => analyzePath(currentPath,true)}
              className="px-2.5 py-0.5 rounded border border-amber-500/40 text-amber-700 dark:text-amber-300 text-[11px] hover:bg-amber-500/15 transition-colors cursor-pointer"
            >{ct("Quét lại sau cấp quyền")} </button>
          </div>
        </div>
      )}

      {/* Breadcrumb Bar */}
      <div className="px-4 py-1.5 border-b border-slate-200 dark:border-slate-800/80 bg-slate-100/40 dark:bg-[#121622]/40 flex items-center justify-between text-xs overflow-x-auto shrink-0 select-none">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-slate-500 shrink-0 mr-1 flex items-center gap-1">
            <HardDrive size={13} /> {ct("Thư mục:")} </span>

          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={crumb.path}>
                <button
                  onClick={() => handleNavigateBreadcrumb(idx)}
                  onContextMenu={(e) => handleContextMenu(e, crumb.path)}
                  className={`px-2 py-0.5 rounded text-xs font-mono transition-colors flex items-center gap-1 cursor-pointer ${
                    isLast
                      ? 'bg-cyan-500/15 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-400 font-semibold border border-cyan-500/30 dark:border-cyan-800/40'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/40'
                  }`}
                  title={ct("Nhấp để chuyển đến thư mục này")}
                >
                  {crumb.name}
                </button>
                {!isLast && <ChevronRight size={12} className="text-slate-400 dark:text-slate-600 shrink-0" />}
              </React.Fragment>
            );
          })}
        </div>

        {currentNode && (
          <span className="text-xs font-mono text-cyan-600 dark:text-cyan-400 shrink-0 ml-4 font-semibold">
            {formatBytes(currentNode.size_bytes)}
          </span>
        )}
      </div>

      {/* Main Analysis Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left main: Packed Circles Canvas OR Compact Table */}
        <div ref={containerRef} className="flex-1 flex flex-col p-4 overflow-hidden relative">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-xs text-slate-500 dark:text-slate-400 gap-3">
              <RefreshCw size={24} className="animate-spin text-cyan-500" />
              <div className="text-center space-y-1">
                <p className="font-semibold text-slate-800 dark:text-slate-200">{ct("Đang phân tích cấu trúc đệ quy thư mục...")} </p>
                {scanProgress && (
                  <p className="text-[11px] font-mono text-slate-500 truncate max-w-md">
                    {scanProgress.current_path ?? ''}{' '}
                    {scanProgress.scanned_bytes ? `(${formatBytes(scanProgress.scanned_bytes)})` : ''}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleCancelScan}
                className="mt-2 px-3 py-1 rounded-lg border border-rose-500/40 text-rose-500 hover:bg-rose-500/10 text-xs transition-colors cursor-pointer"
              >{ct("Hủy quét")} </button>
            </div>
          ) : !currentNode || sortedChildren.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-xs text-slate-400">
              <Folder size={32} className="mb-2 opacity-40" />
              {currentNode ? ct("Không có mục con đọc được trong lượt quét này") : ct("Chưa có kết quả phân tích. Chọn thư mục hoặc quét lại.")}
            </div>
          ) : viewMode === 'circles' ? (
            /* Mode 1: Packed Circles SVG (Không trùng lặp, diện tích tương ứng dung lượng) */
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between mb-2 shrink-0">
                <span>{ct("Nhấp đơn để chọn kiểm tra • Nhấp đúp vào thư mục để đi sâu")}</span>
                <div className="flex items-center gap-2">
                  {sortedChildren.length > 80 && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">{ct("Đang vẽ top 80/")}{sortedChildren.length} {ct("mục • Chuyển sang Danh sách để xem đầy đủ")} </span>
                  )}
                  <span className="font-mono text-slate-500">
                    {topCircles.length} {ct("mục hiển thị")} </span>
                </div>
              </div>

              <div className="flex-1 w-full h-full rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white/60 dark:bg-[#121622]/40 overflow-hidden flex items-center justify-center relative">
                <svg
                  width={dimensions.width}
                  height={dimensions.height}
                  viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
                  className="w-full h-full select-none"
                  onClick={() => setSelectedNode(null)}
                >
                  <defs>
                    {CIRCLE_PALETTE.map((col, idx) => (
                      <radialGradient
                        id={`lens-grad-${idx}`}
                        key={idx}
                        cx="35%"
                        cy="35%"
                        r="65%"
                      >
                        <stop offset="0%" stopColor={col.stroke} stopOpacity="0.45" />
                        <stop offset="100%" stopColor={col.fill} stopOpacity="0.85" />
                      </radialGradient>
                    ))}
                  </defs>

                  {/* Click nền trống SVG bỏ chọn */}
                  <rect
                    width="100%"
                    height="100%"
                    fill="transparent"
                    onClick={() => setSelectedNode(null)}
                    className="cursor-default"
                  />

                  {packedCircles.map((c, idx) => {
                    const isSelected = selectedNode?.path === c.node.path;
                    const col = CIRCLE_PALETTE[idx % CIRCLE_PALETTE.length];
                    const isDenied = c.node.is_access_denied;

                    return (
                      <g
                        key={c.node.path}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNode(c.node);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          void handleDrillDown(c.node);
                        }}
                        onContextMenu={(e) => handleContextMenu(e, c.node.path)}
                        className="cursor-pointer group"
                      >
                        <circle
                          cx={c.x}
                          cy={c.y}
                          r={c.r}
                          fill={
                            isDenied
                              ? 'rgba(245, 158, 11, 0.2)'
                              : `url(#lens-grad-${idx % CIRCLE_PALETTE.length})`
                          }
                          stroke={
                            isSelected ? '#06b6d4' : isDenied ? '#f59e0b' : col.stroke
                          }
                          strokeWidth={isSelected ? 2.5 : 1}
                          className="transition-all duration-150 group-hover:brightness-110"
                        />

                        {isSelected && (
                          <circle
                            cx={c.x}
                            cy={c.y}
                            r={c.r + 3}
                            fill="none"
                            stroke="#06b6d4"
                            strokeWidth="1.5"
                            strokeDasharray="4 3"
                            className="animate-pulse"
                          />
                        )}

                        {/* Nhãn chính đọc được nếu bán kính đủ lớn: r >= 18 cho tên */}
                        {c.r >= 18 && (
                          <text
                            x={c.x}
                            y={c.r >= 65 ? c.y - 7 : c.y}
                            textAnchor="middle"
                            dominantBaseline="central"
                            className="fill-slate-900 dark:fill-white font-mono text-[11px] font-semibold pointer-events-none select-none drop-shadow-xs"
                          >
                            {truncateName(c.node.name, c.r)}
                          </text>
                        )}

                        {/* Nhãn dung lượng và tỷ lệ %: r >= 65 */}
                        {c.r >= 65 && (
                          <text
                            x={c.x}
                            y={c.y + 9}
                            textAnchor="middle"
                            dominantBaseline="central"
                            className="fill-slate-600 dark:fill-slate-300 font-mono text-[9px] pointer-events-none select-none drop-shadow-xs"
                          >
                            {formatBytes(c.node.size_bytes)} ({c.percentage}%)
                          </text>
                        )}

                        <title>
                          {c.node.name} • {formatBytes(c.node.size_bytes)} ({c.percentage}%)
                          {c.node.is_directory ? ct(" [Thư mục - Nhấp đúp để vào]") : ct(" [Tệp]")}
                        </title>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          ) : (
            /* Mode 2: Compact List View (Hàng thấp, không grid) */
            <div className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white/60 dark:bg-[#121622]/40 overflow-hidden flex flex-col">
              <div className="p-2.5 bg-slate-100 dark:bg-[#161a28]/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 grid grid-cols-12 gap-2 shrink-0 select-none">
                <span className="col-span-7">{ct("TÊN TỆP / THƯ MỤC")}</span>
                <span className="col-span-3 text-right">{ct("DUNG LƯỢNG")}</span>
                <span className="col-span-2 text-right">{ct("TỶ LỆ %")}</span>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800/40">
                {sortedChildren.map((child) => {
                  const percentage =
                    currentNode.size_bytes > 0
                      ? ((child.size_bytes / currentNode.size_bytes) * 100).toFixed(1)
                      : '0';
                  const barPercent =
                    maxChildBytes > 0
                      ? Math.min(100, Math.max(0, (child.size_bytes / maxChildBytes) * 100)).toFixed(1)
                      : '0';
                  const isSelected = selectedNode?.path === child.path;

                  return (
                    <div
                      key={child.path}
                      onDoubleClick={() => handleDrillDown(child)}
                      onContextMenu={(e) => handleContextMenu(e, child.path)}
                      className={`px-3 py-1.5 grid grid-cols-12 gap-2 items-center text-xs transition-colors ${
                        isSelected
                          ? 'bg-cyan-500/15 dark:bg-cyan-950/30 text-cyan-800 dark:text-cyan-300 font-semibold border-l-2 border-cyan-500'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800/30 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {/* Cột 1: Click tên toggle chọn/bỏ chọn; double click drill down */}
                      <div
                        className="col-span-7 flex items-center gap-2 min-w-0 cursor-pointer select-none"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNode((prev) => (prev?.path === child.path ? null : child));
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          void handleDrillDown(child);
                        }}
                      >
                        {child.is_access_denied ? (
                          <Lock size={13} className="text-amber-500 shrink-0" />
                        ) : child.is_package ? (
                          <Package size={13} className="text-indigo-500 shrink-0" />
                        ) : child.is_directory ? (
                          <Folder size={13} className="text-cyan-500 shrink-0" />
                        ) : (
                          <File size={13} className="text-slate-400 shrink-0" />
                        )}
                        <span className="font-mono truncate text-[11px]">{child.name}</span>
                        {child.is_package && (
                          <span className="text-[8px] px-1 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900 font-mono shrink-0">
                            Package
                          </span>
                        )}
                      </div>

                      {/* Cột 2: Dung lượng + Bar mỏng 96px tỷ lệ child/maxChild; click không đổi lựa chọn */}
                      <div
                        className="col-span-3 flex flex-col items-end justify-center cursor-default select-none"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="font-mono text-slate-600 dark:text-slate-300 text-[11px]">
                          {formatBytes(child.size_bytes)}
                        </span>
                        <div className="w-[96px] max-w-full h-1 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden mt-1">
                          <div
                            className="h-full bg-cyan-500 rounded-full transition-all duration-150"
                            style={{ width: `${barPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Cột 3: Tỷ lệ % dung lượng so với thư mục cha; click không đổi lựa chọn */}
                      <div
                        className="col-span-2 text-right font-mono text-cyan-600 dark:text-cyan-400 text-[11px] font-semibold cursor-default select-none"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {percentage}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right inspection sidebar */}
        <div className="w-[300px] border-l border-slate-200 dark:border-slate-800/80 bg-slate-100/40 dark:bg-[#0f1117]/60 p-4 flex flex-col justify-between shrink-0">
          {selectedNode ? (
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">{ct("Chi tiết mục chọn")} </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-mono break-all mt-1">
                  {selectedNode.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono break-all mt-0.5">
                  {selectedNode.path}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">{ct("Dung lượng:")}</span>
                  <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
                    {formatBytes(selectedNode.size_bytes)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">{ct("Loại mục:")}</span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {selectedNode.is_package
                      ? 'Package Bundle'
                      : selectedNode.is_directory
                      ? ct("Thư mục")
                      : ct("Tệp")}
                  </span>
                </div>
                {selectedNode.is_directory && !selectedNode.is_package && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">{ct("Hạng mục con:")}</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {selectedNode.item_count ?? selectedNode.children?.length ?? '—'}
                    </span>
                  </div>
                )}
                {selectedNode.is_access_denied && (
                  <div className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
                    <Lock size={12} />
                    <span>{ct("Bị giới hạn quyền truy cập")}</span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="space-y-2 pt-2">
                {selectedNode.is_directory &&
                  !selectedNode.is_package &&
                  !selectedNode.is_access_denied && (
                    <button
                      onClick={() => handleDrillDown(selectedNode)}
                      className="w-full py-2 px-3 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs text-slate-800 dark:text-slate-200 font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Folder size={14} />{ct("Đi vào thư mục này")} </button>
                  )}

                <button
                  onClick={() => bridge.revealInFileManager(selectedNode.path)}
                  className="w-full py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-white/60 dark:bg-slate-800/40 text-xs text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ExternalLink size={14} />{ct("Mở trong Finder")} </button>

                {canTrashNode(selectedNode) ? (
                  <button
                    disabled={isTrashing || loading}
                    onClick={() => handleMoveToTrash(selectedNode)}
                    className="w-full py-2 px-3 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-300 border border-rose-500/30 dark:border-rose-800/80 text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 size={14} />{ct("Chuyển vào Thùng rác")} </button>
                ) : (
                  <div className="p-2.5 rounded-lg bg-slate-200/50 dark:bg-slate-900 border border-slate-300/60 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed text-center">{ct("Mục này được bảo vệ bởi chính sách an toàn hệ thống (không hỗ trợ chuyển vào Thùng rác).")} </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-xs">
              <Compass size={28} className="mb-2 opacity-40" />{ct("Chọn một tệp hoặc thư mục bất kỳ để xem thông số chi tiết & thao tác dọn dẹp")} </div>
          )}

          {actionMessage && (
            <div className="mt-4 p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 size={15} className="shrink-0" />
              <span>{actionMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* Context Menu for Breadcrumb & Items */}
      {contextMenu.visible && (
        <div
          ref={contextMenuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 bg-white dark:bg-[#141824] border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xl py-1 text-xs text-slate-700 dark:text-slate-200 min-w-[180px] backdrop-blur-md"
        >
          <button
            onClick={() => {
              bridge.revealInFileManager(contextMenu.path);
              setContextMenu((prev) => ({ ...prev, visible: false }));
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-cyan-50 dark:hover:bg-cyan-950/60 hover:text-cyan-700 dark:hover:text-cyan-400 flex items-center gap-2 transition-colors cursor-pointer"
          >
            <ExternalLink size={13} />{ct("Mở trong Finder")} </button>
          <button
            onClick={() => {
              void bridge.copyToClipboard(contextMenu.path);
              setContextMenu((prev) => ({ ...prev, visible: false }));
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-cyan-50 dark:hover:bg-cyan-950/60 hover:text-cyan-700 dark:hover:text-cyan-400 flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Copy size={13} />{ct("Sao chép đường dẫn")} </button>
          <button
            onClick={() => {
              void bridge.openInTerminal(contextMenu.path).catch((e) => setActionMessage(bridge.errorText(e)));
              setContextMenu((prev) => ({ ...prev, visible: false }));
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-cyan-50 dark:hover:bg-cyan-950/60 hover:text-cyan-700 dark:hover:text-cyan-400 flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Terminal size={13} />{ct("Mở trong Terminal")} </button>
        </div>
      )}
    </div>
  );
};
