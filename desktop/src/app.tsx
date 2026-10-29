import {CleanLanguageProvider} from './services/ui_language';
import {AppUpdates} from './components/app_updates';
import {ScanAccessDialog} from './components/scan_access_dialog';
import { useState, useEffect, useRef, useCallback } from 'react';
import { TabId, Capabilities, SystemSnapshot } from './types';
import {
  fetchCapabilities,
  fetchSystemSnapshot,
  isTauriEnvironment,
  listenNativeMenuEvents,
} from './services/tauri_bridge';
import { OperationHistory } from './components/operation_history';
import { TitleBar } from './components/title_bar';
import { RetainedScreen } from './components/retained_screen';
import { Sidebar } from './components/sidebar';
import { Dashboard } from './components/dashboard';
import { SmartScanView } from './components/smart_scan_view';
import { CleanupView } from './components/cleanup_view';
import { UninstallerView } from './components/uninstaller_view';
import { SpaceLensView } from './components/space_lens_view';
import { SettingsModal, ThemeMode } from './components/settings_modal';

const getInitialThemeMode = (): ThemeMode => {
  const saved = localStorage.getItem('vxclean_theme');
  if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  return 'system';
};

export default function App() {
  const [language, setLanguage] = useState<'vi' | 'en'>(() => localStorage.getItem('vxclean_lang') === 'en' ? 'en' : 'vi');
  useEffect(() => { localStorage.setItem('vxclean_lang',language); document.documentElement.lang = language; if(isTauriEnvironment()) void import('@tauri-apps/api/core').then(m=>m.invoke('set_app_language',{lang:language})).catch(console.error); }, [language]);
  const [updateFocusRequest] = useState(0);
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode);
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if(e.key === 'vxclean_lang') setLanguage(e.newValue === 'en' ? 'en' : 'vi');
      if(e.key === 'vxclean_theme' && ['dark','light','system'].includes(e.newValue || '')) setThemeMode(e.newValue as ThemeMode);
    };
    window.addEventListener('storage',sync);return () => window.removeEventListener('storage',sync);
  }, []);
  const [isDark, setIsDark] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [currentTab, setCurrentTab] = useState<TabId>('dashboard');
  const [autoStartScan, setAutoStartScan] = useState<boolean>(false);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [snapshot, setSnapshot] = useState<SystemSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isBrowserPreview = !isTauriEnvironment();
  const isWindowsDummy = capabilities?.platform === 'windows';
  const isRefreshingRef = useRef<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Theme: System, Light, Dark - theo matchMedia khi System, lưu vxclean_theme
  useEffect(() => {
    const applyTheme = () => {
      let dark = false;
      if (themeMode === 'dark') {
        dark = true;
      } else if (themeMode === 'light') {
        dark = false;
      } else {
        dark =
          typeof window !== 'undefined' &&
          window.matchMedia &&
          window.matchMedia('(prefers-color-scheme: dark)').matches;
      }

      setIsDark(dark);
      const root = document.documentElement;
      if (dark) {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        root.classList.add('light');
        root.classList.remove('dark');
      }
    };

    applyTheme();
    localStorage.setItem('vxclean_theme', themeMode);

    if (themeMode === 'system' && typeof window !== 'undefined' && window.matchMedia) {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, [themeMode]);

  const loadSnapshot = useCallback(async () => {
    if (isRefreshingRef.current || isBrowserPreview) return;
    isRefreshingRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchSystemSnapshot();
      setSnapshot(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : typeof err === 'string'
          ? err
          : 'Không thể lấy dữ liệu hệ thống.'
      );
    } finally {
      setIsLoading(false);
      isRefreshingRef.current = false;
    }
  }, [isBrowserPreview]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;
    listenNativeMenuEvents({
      onRefresh: () => loadSnapshot(),
      onOpenSettings: () => setIsSettingsOpen(true),
      onToggleTheme: () => setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark')),
    }).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });

    return () => {
      disposed = true;
      if (unlisten) unlisten();
    };
  }, [loadSnapshot]);

  useEffect(() => {
    let active = true;
    fetchCapabilities()
      .then((caps) => {
        if (active) setCapabilities(caps);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Lỗi nạp cấu hình.');
      });

    loadSnapshot();

    return () => {
      active = false;
    };
  }, [loadSnapshot]);

  useEffect(() => {
    if (isBrowserPreview) return;
    let stopped = false, dispose: (() => void) | undefined;
    import('@tauri-apps/api/event').then(({ listen }) => listen<string>('menubar-action', event => {
      if (event.payload === 'quick') { setAutoStartScan(true); setCurrentTab('smart_scan'); }
      if (event.payload === 'settings') setIsSettingsOpen(true);
    })).then(fn => { if (stopped) fn(); else dispose = fn; });
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => { if (stopped) return; if (!isWindowsDummy && document.hasFocus()) await loadSnapshot(); timer = setTimeout(tick, 5000); };
    timer = setTimeout(tick, 5000);
    return () => { stopped = true; dispose?.(); clearTimeout(timer); };
  }, [isBrowserPreview, loadSnapshot, isWindowsDummy]);

  const handleStartQuickScan = () => {
    setAutoStartScan(true);
    setCurrentTab('smart_scan');
  };

  return (
    <CleanLanguageProvider value={language}>
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 dark:bg-[#0f1117] text-slate-800 dark:text-slate-100">
      <TitleBar
        language={language}
        isDark={isDark}
        onToggleTheme={() => setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        isBrowserPreview={isBrowserPreview}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onRefresh={loadSnapshot}
      />
      {capabilities?.platform === 'windows' && <div role="status" className="px-4 py-2 text-xs bg-amber-500/10 text-amber-700 dark:text-amber-300">Windows · Bản giao diện. Quét, dọn rác, gỡ ứng dụng và giám sát hệ thống chưa được hỗ trợ.</div>}
      <OperationHistory language={language}/>
      <AppUpdates notice language={language}/>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          capabilities={capabilities}
          isBrowserPreview={isBrowserPreview}
        />
        <main className="flex-1 overflow-hidden flex flex-col">
          {currentTab === 'dashboard' && (
            <Dashboard
              snapshot={snapshot}
              isLoading={isLoading}
              error={error}
              onRefresh={loadSnapshot}
              onStartQuickScan={handleStartQuickScan}
              isBrowserPreview={isBrowserPreview}
            />
          )}
          <RetainedScreen active={currentTab === 'smart_scan'} scope="smart_scan">
            <SmartScanView
              onBackToDashboard={() => setCurrentTab('dashboard')}
              autoStart={autoStartScan}
              onAutoStartHandled={() => setAutoStartScan(false)}
            />
          </RetainedScreen>
          <RetainedScreen active={currentTab === 'cleanup' || currentTab === 'orphans'} scope="cleanup" additionalScope="orphans"><CleanupView active={currentTab === 'cleanup' || currentTab === 'orphans'} /></RetainedScreen>
          <RetainedScreen active={currentTab === 'uninstaller'} scope="uninstaller"><UninstallerView /></RetainedScreen>
          <RetainedScreen active={currentTab === 'space_lens'} scope="space_lens"><SpaceLensView /></RetainedScreen>
        </main>
      </div>

      <ScanAccessDialog language={language}/>
      <SettingsModal
        updateFocusRequest={updateFocusRequest}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        language={language}
        onChangeLanguage={setLanguage}
        themeMode={themeMode}
        onChangeThemeMode={setThemeMode}
      />
    </div>
    </CleanLanguageProvider>
  );
}
