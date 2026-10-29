import {useCleanText} from '../services/ui_language';
import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Folder, File, ChevronDown } from 'lucide-react';
import { getRecentItems, getShortPathName } from '../services/recent_service';

export interface RecentButtonProps {
  type: 'folder' | 'file'; storageKey: string; label: string; title?: string;
  icon?: React.ReactNode; disabled?: boolean; onMainClick: () => void;
  onSelectRecent: (path: string) => void; className?: string; buttonClassName?: string;
  dropdownAlign?: 'left' | 'right'; emptyLabel?: string; showChevron?: boolean;
}
export const RecentButton: React.FC<RecentButtonProps> = ({ type, storageKey, label, title, icon,
  disabled = false, onMainClick, onSelectRecent, className = '', buttonClassName,
  dropdownAlign = 'left', emptyLabel = "Chưa có mục gần đây", showChevron = true }) => {
  const ct = useCleanText();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<string[]>(() => getRecentItems(storageKey));
  const [position, setPosition] = useState({ left: 8, top: 32, width: 256 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  const enter = () => { cancelClose(); if (!disabled) setOpen(true); };
  const leave = () => { cancelClose(); timer.current = setTimeout(() => setOpen(false), 220); };
  const reload = useCallback(() => setItems(getRecentItems(storageKey)), [storageKey]);
  useEffect(() => {
    reload();
    const storage = (event: StorageEvent) => { if (!event.key || event.key === storageKey) reload(); };
    const update = (event: Event) => { if ((event as CustomEvent<{key: string}>).detail?.key === storageKey) reload(); };
    window.addEventListener('storage', storage); window.addEventListener('vx_recent_update', update);
    return () => { window.removeEventListener('storage', storage); window.removeEventListener('vx_recent_update', update); cancelClose(); };
  }, [storageKey, reload]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect(); if (!rect) return;
      const width = Math.min(256, window.innerWidth - 16);
      const left = Math.max(8, Math.min(dropdownAlign === 'right' ? rect.right - width : rect.left, window.innerWidth - width - 8));
      const menuHeight = menuRef.current?.offsetHeight ?? 72;
      const top = rect.bottom + 4 + menuHeight > window.innerHeight - 8 && rect.top > menuHeight + 8
        ? rect.top - menuHeight - 4 : rect.bottom + 4;
      setPosition({ left, top, width });
    };
    place(); window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, dropdownAlign, items.length]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      const node = event.target as Node;
      if (!wrapperRef.current?.contains(node) && !menuRef.current?.contains(node)) setOpen(false);
    };
    window.addEventListener('mousedown', outside);
    return () => window.removeEventListener('mousedown', outside);
  }, [open]);
  const blur = (event: React.FocusEvent) => {
    const next = event.relatedTarget as Node | null;
    if (!wrapperRef.current?.contains(next) && !menuRef.current?.contains(next)) setOpen(false);
  };
  const keyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); triggerRef.current?.focus(); setOpen(false); }
    if (event.key === 'ArrowDown' && !disabled) {
      event.preventDefault(); event.stopPropagation(); setOpen(true);
      requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus());
    }
  };
  const menuKeys = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { keyDown(event); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const buttons = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    if (!buttons.length) return;
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 :
      (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
  };
  return <div ref={wrapperRef} data-no-drag style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    className={`relative inline-flex items-center shrink-0 ${className}`} onMouseEnter={enter} onMouseLeave={leave}
    onFocus={enter} onBlur={blur} onKeyDown={keyDown}>
    <button ref={triggerRef} type="button" disabled={disabled} aria-label={label || title} aria-haspopup="menu" aria-expanded={open}
      onClick={(event) => { event.stopPropagation(); cancelClose(); setOpen(false); onMainClick(); }} title={title || label}
      className={buttonClassName || 'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors text-slate-700 dark:text-slate-200 bg-slate-200/60 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer'}>
      {icon}{label && <span>{ct(label)}</span>}{showChevron && <ChevronDown className="w-3 h-3 shrink-0" />}
    </button>
    {open && !disabled && createPortal(<div ref={menuRef} data-no-drag role="menu" aria-label={`${label || title} — recent`}
      style={{ position: 'fixed', ...position, WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      className="z-[120] rounded-xl bg-white/95 dark:bg-[#141821]/95 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-2xl p-1 select-none"
      onMouseEnter={enter} onMouseLeave={leave} onFocus={cancelClose} onBlur={blur} onKeyDown={menuKeys}
      onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
      <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-white/10 mb-1">
        {/Open/i.test(label) ? 'Recent' : ct("Gần đây")} ({items.length}/5)
      </div>
      {!items.length ? <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{ct(emptyLabel)}</div> :
        <div className="flex flex-col gap-0.5 max-h-56 overflow-y-auto">
        {items.map((path) => <button key={path} role="menuitem" type="button" title={path}
          onClick={(event) => { event.stopPropagation(); cancelClose(); setOpen(false); onSelectRecent(path); }}
          className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-xs text-slate-800 dark:text-slate-200 hover:bg-cyan-50 dark:hover:bg-cyan-500/20 cursor-pointer focus-visible:outline-cyan-500">
          {type === 'folder' ? <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" /> : <File className="w-3.5 h-3.5 text-cyan-500 shrink-0" />}
          <span className="truncate">{getShortPathName(path)}</span></button>)}
        </div>}
    </div>, document.body)}
  </div>;
};
