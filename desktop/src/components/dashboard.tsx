import {useCleanText} from '../services/ui_language';
import React from 'react';
import { SystemSnapshot, BatteryMetrics } from '../types';
import { Cpu, HardDrive, Battery, RefreshCw, Layers, Sparkles } from 'lucide-react';
import { PageHeader } from './page_header';
import { formatBytes } from '../services/byte_format';

interface DashboardProps {
  snapshot: SystemSnapshot | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onStartQuickScan: () => void;
  isBrowserPreview: boolean;
}

const fmt = formatBytes;

const getBatteryStatus = (b: BatteryMetrics): string => {
  if (!b.has_battery) return 'Không có pin';
  if (b.is_charged) return 'Đã sạc đầy';
  if (b.is_charging) return 'Đang sạc';
  if (b.is_ac_powered) return 'Nguồn AC';
  return 'Đang dùng pin';
};

export const Dashboard: React.FC<DashboardProps> = ({ snapshot, isLoading, error, onRefresh, onStartQuickScan, isBrowserPreview }) => {
  const ct = useCleanText();

  const m = snapshot?.metrics;
  const cpuPct = m ? (m.cpu.usage > 1 ? m.cpu.usage : m.cpu.usage * 100) : 0;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-[#0f1117] text-slate-800 dark:text-slate-100">
      <PageHeader
        icon={HardDrive}
        iconBgClass="bg-cyan-500/10 border-cyan-500/30"
        iconColorClass="text-cyan-600 dark:text-cyan-400"
        title={ct("Tổng quan Hệ thống")}
        subtitle={
          snapshot
            ? (ct("Lấy mẫu: ") + (new Date(snapshot.timestamp).toLocaleTimeString()) + ct(""))
            : ct("Giám sát chỉ số tài nguyên và hiệu năng phần cứng máy Mac")
        }
        actions={
          !isBrowserPreview ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-100/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{ct("Làm mới")}</span>
            </button>
          ) : undefined
        }
      />

      <div className="flex-1 p-5 overflow-y-auto space-y-5">

      {isBrowserPreview && (
        <div className="p-4 rounded-xl glass-card border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 text-center">{ct("Mở ứng dụng desktop để xem chỉ số hệ thống.")} </div>
      )}

      {error && (
        <div className="p-3 rounded-xl glass-card border border-rose-500/20 text-xs text-rose-500 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={onRefresh} className="px-2.5 py-1 bg-rose-500 text-white rounded text-xs cursor-pointer font-medium">{ct("Thử lại")}</button>
        </div>
      )}

      {isLoading && !m && !isBrowserPreview && <div className="text-xs text-slate-400 py-12 text-center">{ct("Đang tải chỉ số hệ thống...")}</div>}

      {m && (
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card p-4 rounded-xl border border-black/5 dark:border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5 font-medium"><Cpu className="w-3.5 h-3.5 text-cyan-500" /> CPU</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">{cpuPct.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${Math.min(100, cpuPct)}%` }} />
            </div>
          </div>

          <div className="glass-card p-4 rounded-xl border border-black/5 dark:border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5 font-medium"><Layers className="w-3.5 h-3.5 text-cyan-500" /> RAM</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">{fmt(m.memory.used_bytes)} / {fmt(m.memory.total_bytes)}</span>
            </div>
            <div className="h-1.5 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${Math.min(100, m.memory.fraction * 100)}%` }} />
            </div>
            <div className="text-[10px] text-slate-400 flex justify-between font-mono pt-1">
              <span>Active: {fmt(m.memory.active_bytes)}</span>
              <span>Wired: {fmt(m.memory.wired_bytes)}</span>
              <span>Comp: {fmt(m.memory.compressed_bytes)}</span>
            </div>
          </div>

          <div className="glass-card p-4 rounded-xl border border-black/5 dark:border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5 font-medium"><HardDrive className="w-3.5 h-3.5 text-cyan-500" /> {ct("Ổ đĩa")}</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">{fmt(m.disk.used_bytes)} / {fmt(m.disk.total_bytes)}</span>
            </div>
            <div className="h-1.5 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${Math.min(100, m.disk.fraction * 100)}%` }} />
            </div>
            <p className="text-[10px] text-slate-400 pt-0.5">{fmt(m.disk.available_bytes)} {ct("khả dụng (ước tính có thể gồm purgeable)")}</p>
          </div>

          <div className="glass-card p-4 rounded-xl border border-black/5 dark:border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5 font-medium"><Battery className="w-3.5 h-3.5 text-cyan-500" /> {ct("Nguồn & Pin")}</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">{m.battery.has_battery ? `${m.battery.charge_percent}%` : ct("Không có")}</span>
            </div>
            {m.battery.has_battery && (
              <div className="h-1.5 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${Math.min(100, m.battery.charge_percent)}%` }} />
              </div>
            )}
            <p className="text-[10px] text-slate-400 pt-0.5">{ct("Trạng thái:")} {ct(getBatteryStatus(m.battery))}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center justify-center pt-4 pb-6">
        <div className="relative group">
          <div className="absolute inset-0 bg-cyan-500/20 dark:bg-cyan-500/30 rounded-full blur-2xl transition-all duration-300 group-hover:scale-110 group-hover:bg-cyan-500/40" />
          <button
            type="button"
            onClick={onStartQuickScan}
            className="relative w-36 h-36 rounded-full bg-gradient-to-tr from-cyan-600 via-cyan-500 to-cyan-400 text-white shadow-xl shadow-cyan-500/25 flex flex-col items-center justify-center gap-2 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer ring-4 ring-cyan-400/20 hover:ring-cyan-400/40"
          >
            <Sparkles className="w-8 h-8 text-white drop-shadow-md animate-pulse" />
            <span className="text-xs font-bold tracking-wider uppercase drop-shadow-sm">{ct("Quét nhanh")} </span>
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 text-center max-w-sm">{ct("Nhấp một lần để chuyển sang Quét nhanh và tự động phân tích toàn diện hệ thống")} </p>
      </div>
    </div>
  </div>
);
};
