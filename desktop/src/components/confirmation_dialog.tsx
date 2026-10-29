import {useCleanText} from '../services/ui_language';
import { useEffect, useRef, useState } from 'react';

/** Native WebViews do not consistently implement window.confirm. */
export function useConfirmation(language?: "vi" | "en") {
  const ct = useCleanText();
  const label = (vi: string, en: string) => language === undefined ? ct(vi) : language === "vi" ? vi : en;
  const [message, setMessage] = useState<string | null>(null);
  const pending = useRef<((value: boolean) => void) | null>(null);
  const accept = useRef<HTMLButtonElement>(null);
  const finish = (value: boolean) => {
    pending.current?.(value); pending.current = null; setMessage(null);
  };
  useEffect(() => () => { pending.current?.(false); }, []);
  useEffect(() => {
    if (!message) return;
    accept.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') finish(false); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [message]);
  const confirm = (text: string) => new Promise<boolean>((resolve) => {
    pending.current?.(false); pending.current = resolve; setMessage(text);
  });
  const dialog = message && (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={() => finish(false)}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm_title" aria-describedby="confirm_message" className="w-full max-w-md rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141821] p-5 text-slate-800 dark:text-slate-100 shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 id="confirm_title" className="text-sm font-semibold">{label("Xác nhận thao tác", "Confirm operation")}</h2>
        <p id="confirm_message" className="text-xs leading-relaxed my-4 whitespace-pre-line">{message}</p>
        <div className="flex justify-end gap-2 text-xs">
          <button ref={accept} onClick={() => finish(false)} className="px-3 py-2 rounded-lg border border-slate-400">{label("Hủy", "Cancel")}</button>
          <button onClick={() => finish(true)} className="px-3 py-2 rounded-lg bg-rose-600 text-white">{label("Xác nhận", "Confirm")}</button>
        </div>
      </div>
    </div>
  );
  return { confirm, dialog };
}
