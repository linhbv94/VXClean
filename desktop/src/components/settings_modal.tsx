import {ScanAccessPanel} from './scan_access_dialog';
import { OperationHistory } from './operation_history';
import { UpdatePanel } from './update_panel';
import React, { useState, useEffect } from 'react';
import { X, Shield, Sliders, HardDrive, Info, Sparkles, Coffee, ExternalLink, RotateCcw, Heart } from 'lucide-react';
import { isTauriEnvironment, startDragging } from '../services/tauri_bridge';
import packageInfo from '../../package.json';
import qrImage from '../assets/qr.png';

export type ThemeMode = 'system' | 'light' | 'dark';

interface SettingsModalProps {
  isOpen: boolean;
  updateFocusRequest?: number;
  onClose: () => void;
  themeMode: ThemeMode;
  onChangeThemeMode: (mode: ThemeMode) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  updateFocusRequest = 0,
  onClose,
  themeMode,
  onChangeThemeMode,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'system' | 'updates' | 'history' | 'about' | 'support'>('general');
  useEffect(() => { if(updateFocusRequest > 0) setActiveTab('updates'); }, [updateFocusRequest]);
  const [appVersion, setAppVersion] = useState<string>(packageInfo.version || '0.1.0');

  useEffect(() => {
    let isMounted = true;
    if (isTauriEnvironment()) {
      import('@tauri-apps/api/app')
        .then((m) => m.getVersion())
        .then((ver) => {
          if (isMounted && ver) setAppVersion(ver);
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, []);

  if (!isOpen) return null;

  const handleResetDefaults = () => {
    onChangeThemeMode('system');
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150 select-none text-xs"
    >
      {/* Top 32px Drag Strip across modal backdrop */}
      <div
        data-tauri-drag-region
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        onMouseDown={(e) => {
          if (e.button === 0) startDragging();
        }}
        className="absolute top-0 left-0 w-full h-8 z-10 pointer-events-auto"
      />

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-20 w-full max-w-2xl h-[560px] max-h-[calc(100dvh-32px)] bg-white dark:bg-[#141821] rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col transition-colors duration-200"
      >
        {/* Header */}
        <div
          data-tauri-drag-region
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
          onMouseDown={(e) => {
            if (
              e.button === 0 &&
              !(e.target as HTMLElement).closest('button, input, select, textarea, [role="button"]')
            ) {
              startDragging();
            }
          }}
          className="h-14 px-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50/70 dark:bg-black/20 shrink-0 cursor-default select-none"
        >
          <div className="flex items-center gap-2 pointer-events-none">
            <span className="text-base font-semibold text-slate-900 dark:text-white">
              ⚙️ Cài đặt VXClean
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10 transition-colors pointer-events-auto"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body: Sidebar + Main Content */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Tab Sidebar */}
          <div className="w-48 border-r border-slate-200 dark:border-white/10 p-3 space-y-1.5 bg-slate-50/50 dark:bg-black/20 overflow-y-auto shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-left transition-all ${
                activeTab === 'general'
                  ? 'bg-cyan-50 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/40 font-semibold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Chung (General)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('system')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-left transition-all ${
                activeTab === 'system'
                  ? 'bg-cyan-50 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/40 font-semibold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <HardDrive className="w-4 h-4" />
              <span>Hệ thống (System)</span>
            </button>

            <button type="button" onClick={() => setActiveTab('history')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-left transition-all ${activeTab === 'history' ? 'bg-cyan-50 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/40' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/5'}`}>
              <RotateCcw className="w-4 h-4" /><span>Lịch sử thao tác</span>
            </button>

            <div className="my-2 border-t border-slate-200 dark:border-white/10" />

            <button
              type="button"
              onClick={() => setActiveTab('updates')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-left transition-all ${
                activeTab === 'updates'
                  ? 'bg-cyan-50 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/40 font-semibold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-4 h-4 text-cyan-500" />
              <span>Cập nhật (Updates)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('about')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-left transition-all ${
                activeTab === 'about'
                  ? 'bg-cyan-50 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/40 font-semibold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Info className="w-4 h-4" />
              <span>Giới thiệu (About)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('support')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-left transition-all ${
                activeTab === 'support'
                  ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 font-semibold shadow-2xs'
                  : 'text-amber-700/90 dark:text-amber-400/90 hover:bg-amber-500/10 hover:text-amber-900 dark:hover:text-amber-200'
              }`}
            >
              <Coffee className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="truncate">Ủng hộ tác giả</span>
            </button>
          </div>

          {/* Tab Content Panel */}
          <div className="flex-1 min-h-0 p-6 overflow-y-auto space-y-6 bg-white dark:bg-[#141821]">
            {activeTab === 'history' && <OperationHistory mode="history" />}
            {/* TAB 1: GENERAL */}
            {activeTab === 'general' && (
              <div className="space-y-5">
                <div>
                  <h4 className="text-xs uppercase tracking-wider font-semibold text-cyan-700 dark:text-cyan-400 mb-3">
                    GIAO DIỆN & MÀU SẮC
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    <label
                      className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                        themeMode === 'system'
                          ? 'bg-cyan-50/80 dark:bg-cyan-500/20 border-cyan-500 text-cyan-900 dark:text-cyan-200 shadow-xs ring-1 ring-cyan-500/30 font-semibold'
                          : 'bg-slate-50/70 dark:bg-black/20 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-100/70 dark:hover:bg-white/5'
                      }`}
                    >
                      <input
                        type="radio"
                        name="cleaner_theme"
                        checked={themeMode === 'system'}
                        onChange={() => onChangeThemeMode('system')}
                        className="text-cyan-600 accent-cyan-600"
                      />
                      <span className="font-medium text-xs">Theo hệ thống (System)</span>
                    </label>

                    <label
                      className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                        themeMode === 'light'
                          ? 'bg-cyan-50/80 dark:bg-cyan-500/20 border-cyan-500 text-cyan-900 dark:text-cyan-200 shadow-xs ring-1 ring-cyan-500/30 font-semibold'
                          : 'bg-slate-50/70 dark:bg-black/20 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-100/70 dark:hover:bg-white/5'
                      }`}
                    >
                      <input
                        type="radio"
                        name="cleaner_theme"
                        checked={themeMode === 'light'}
                        onChange={() => onChangeThemeMode('light')}
                        className="text-cyan-600 accent-cyan-600"
                      />
                      <span className="font-medium text-xs">Sáng dịu (Light Clean)</span>
                    </label>

                    <label
                      className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                        themeMode === 'dark'
                          ? 'bg-cyan-50/80 dark:bg-cyan-500/20 border-cyan-500 text-cyan-900 dark:text-cyan-200 shadow-xs ring-1 ring-cyan-500/30 font-semibold'
                          : 'bg-slate-50/70 dark:bg-black/20 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-100/70 dark:hover:bg-white/5'
                      }`}
                    >
                      <input
                        type="radio"
                        name="cleaner_theme"
                        checked={themeMode === 'dark'}
                        onChange={() => onChangeThemeMode('dark')}
                        className="text-cyan-600 accent-cyan-600"
                      />
                      <span className="font-medium text-xs">Tối trầm (Dark #0f1117)</span>
                    </label>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-white/10">
                  <h4 className="text-xs uppercase tracking-wider font-semibold text-cyan-700 dark:text-cyan-400 mb-3">
                    NGÔN NGỮ (LANGUAGE)
                  </h4>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2.5 cursor-pointer group">
                      <input
                        type="radio"
                        name="cleaner_lang"
                        defaultChecked
                        className="text-cyan-600 accent-cyan-600 w-4 h-4"
                      />
                      <span className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-cyan-700 dark:group-hover:text-cyan-300 transition-colors">
                        🇻🇳 Tiếng Việt
                      </span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer group opacity-60">
                      <input
                        type="radio"
                        name="cleaner_lang"
                        disabled
                        className="text-cyan-600 accent-cyan-600 w-4 h-4"
                      />
                      <span className="font-medium text-slate-500 dark:text-slate-400">
                        🇺🇸 English (Sắp ra mắt)
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: SYSTEM */}
            {activeTab === 'system' && <div className="space-y-4"><h4 className="text-xs uppercase tracking-wider font-semibold text-cyan-700 dark:text-cyan-400">QUYỀN TRUY CẬP DỮ LIỆU</h4><ScanAccessPanel/></div>}

            {activeTab === 'updates' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-500/10 via-cyan-500/5 to-transparent border border-cyan-500/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-cyan-500" />
                        <span>Cập nhật ứng dụng</span>
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Kiểm tra phiên bản mới nhất và cập nhật ứng dụng.
                      </p>
                    </div>
                    <span className="px-2.5 py-1 text-xs font-mono font-semibold bg-cyan-100 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 rounded-full border border-cyan-300 dark:border-cyan-500/30">
                      v{appVersion}
                    </span>
                  </div>
                </div>

                <UpdatePanel />
              </div>
            )}

            {/* TAB 4: ABOUT */}
            {activeTab === 'about' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Khung 1: Thông tin ứng dụng */}
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-cyan-500/10 via-cyan-500/5 to-transparent border border-cyan-500/20">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white shrink-0 font-bold text-2xl">
                    <Shield className="w-7 h-7 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        VXClean Desktop
                      </h3>
                      <span className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-cyan-100 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 rounded-full border border-cyan-300 dark:border-cyan-500/30">
                        v{appVersion}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      Ứng dụng giám sát & bảo trì hệ thống macOS siêu nhẹ
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs">
                      <span className="font-semibold text-cyan-700 dark:text-cyan-400">
                        by Viet Linh Bui
                      </span>
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <a
                        href="https://github.com/linhbv94/VXClean"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-cyan-600 dark:text-cyan-400 hover:underline font-mono text-[11px]"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>github.com/linhbv94/VXClean</span>
                      </a>
                    </div>
                  </div>
                </div>

                {/* Khung 2: Giới thiệu ngắn 2-3 câu về công dụng / điểm nổi bật */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/5 space-y-2">
                  <h4 className="text-xs uppercase tracking-wider font-semibold text-cyan-700 dark:text-cyan-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Điểm nổi bật của VXClean</span>
                  </h4>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    VXClean là tiện ích máy tính siêu nhẹ giúp theo dõi trạng thái hệ thống theo thời gian thực. Ứng dụng cung cấp snapshot tức thì về mức sử dụng CPU, dung lượng RAM và không gian ổ đĩa. Thiết kế tối giản, tốc độ cao nhằm phục vụ mục đích kiểm soát tài nguyên máy tính hiệu quả.
                  </p>
                </div>

                {/* Khung 3: Công nghệ cốt lõi */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/5 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">Công nghệ cốt lõi:</div>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Tauri v2 + Swift Native Engine Bridge (Giám sát tài nguyên macOS)</li>
                    <li>React 19 + TypeScript + Tailwind CSS</li>
                    <li>Bảo mật cao: Hoạt động cục bộ 100%, không gửi telemetry</li>
                  </ul>
                </div>
              </div>
            )}

            {/* TAB 5: SUPPORT AUTHOR */}
            {activeTab === 'support' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Banner mở đầu ấm áp */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent border border-amber-500/30 flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
                    <Coffee className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>Mời tôi ly coffee ☕</span>
                      <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      Mỗi đóng góp, dù là một ly cà phê nhỏ, đều là sự khích lệ vô giá để ứng dụng ngày càng hoàn thiện hơn!
                    </p>
                  </div>
                </div>

                {/* Card QR nổi bật căn giữa */}
                <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-white/10 flex flex-col items-center justify-center text-center shadow-sm">
                  {/* Mã QR với nền trắng tương phản cao để quét nhạy */}
                  <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200/80 flex flex-col items-center justify-center">
                    <img
                      src={qrImage}
                      alt="VietQR Code"
                      className="w-52 h-auto object-contain rounded-lg"
                    />
                    <span className="text-[11px] font-semibold text-emerald-800 mt-2 font-mono tracking-wider">
                      VietQR • Napas247
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 max-w-sm leading-relaxed">
                    Mở ứng dụng Ngân hàng bất kỳ để quét mã VietQR và gửi lời nhắn tới tác giả ☕️
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="h-14 px-6 border-t border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50/70 dark:bg-black/30 shrink-0">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors font-medium"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Mặc định</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 font-semibold transition-all shadow-sm active:scale-95"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
