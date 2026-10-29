import {useCleanText} from '../services/ui_language';
import { useEffect, useRef, useState } from 'react';
type Choice = 'quit' | 'skip' | 'cancel';
export function useAppQuitDialog() {
  const ct = useCleanText();

  const [names,setNames]=useState<string[] | null>(null);
  const pending=useRef<((choice:Choice)=>void) | null>(null);
  const cancel=useRef<HTMLButtonElement>(null);
  const finish=(choice:Choice)=>{ pending.current?.(choice); pending.current=null; setNames(null); };
  useEffect(()=>()=>{pending.current?.('cancel');},[]);
  useEffect(()=>{if(!names)return; cancel.current?.focus(); const key=(e:KeyboardEvent)=>{if(e.key==='Escape')finish('cancel');}; window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[names]);
  const ask=(apps:string[])=>new Promise<Choice>(resolve=>{pending.current?.('cancel');pending.current=resolve;setNames(apps);});
  const dialog=names && <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={()=>finish('cancel')}>
    <div role="alertdialog" aria-modal="true" aria-labelledby="quit_title" className="w-full max-w-md rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141821] p-5 shadow-xl" onClick={e=>e.stopPropagation()}>
      <h2 id="quit_title" className="text-sm font-semibold">{ct("Đóng ứng dụng trước khi dọn")}</h2>
      <p className="text-xs leading-relaxed my-4">{names.join(', ')} {ct("sẽ được đóng tạm bằng Quit bình thường. Hãy lưu project nếu app hỏi; Cancel hoặc không thoát sau 30 giây → không dọn. VXClean chờ helper, quét lại rồi mở lại app vốn chạy. Chrome yêu cầu phục hồi phiên thường; tab ẩn danh và form ngoài phạm vi.")}</p>
      <div className="flex justify-end flex-wrap gap-2 text-xs">
        <button ref={cancel} onClick={()=>finish('cancel')} className="px-3 py-2 rounded-lg border border-slate-400">{ct("Hủy")}</button>
        <button onClick={()=>finish('skip')} className="px-3 py-2 rounded-lg border border-slate-400">{ct("Bỏ qua app đang mở")}</button>
        <button onClick={()=>finish('quit')} className="px-3 py-2 rounded-lg bg-rose-600 text-white">{ct("Đóng và dọn")}</button>
      </div>
    </div>
  </div>;
  return {ask,dialog};
}
