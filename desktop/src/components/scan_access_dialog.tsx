import {commonText} from '../services/common_copy';
import React,{useEffect,useSyncExternalStore} from 'react';
import {Shield,CheckCircle2,AlertTriangle,X,FolderOpen,RefreshCw} from 'lucide-react';
import {scanAccess,openFullDiskAccessSettings,revealInFileManager} from '../services/tauri_bridge';
import type {AccessScope} from '../services/scan_access';
const scopeNames:Record<AccessScope,string>={quick:'Quét nhanh',detailed:'Dọn rác chi tiết',uninstaller:'Gỡ ứng dụng',orphans:'Tệp mồ côi',space_lens:'Space Lens'};
const button='inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50';
export function ScanAccessPanel({refreshOnMount=true,language="vi"}:{refreshOnMount?:boolean;language?:"vi"|"en"}={}){
  const snapshot=useSyncExternalStore(scanAccess.subscribe,scanAccess.getSnapshot);
  const status=snapshot.status;
  const confirmed=status?.status==='access_confirmed';
  useEffect(()=>{if(refreshOnMount)void scanAccess.refresh();const focus=()=>{void scanAccess.refresh();};window.addEventListener('focus',focus);return()=>window.removeEventListener('focus',focus);},[refreshOnMount]);
  const handleSettings=async()=>{try{await openFullDiskAccessSettings();}catch{void scanAccess.refresh();}};
  const handleReveal=async()=>{if(status?.app_bundle_path)await revealInFileManager(status.app_bundle_path).catch(()=>{});};
  if(status?.status==='not_required')return <p className="text-xs text-slate-600 dark:text-slate-300">{commonText("Hệ điều hành này không dùng Full Disk Access của macOS.",language)}</p>;
  return <div className="space-y-4 text-xs">
    <div className={`flex items-start gap-2 p-3 rounded-lg border ${confirmed?'border-emerald-500/30 bg-emerald-500/10':'border-amber-500/30 bg-amber-500/10'}`}>
      {confirmed?<CheckCircle2 size={16} className="text-emerald-500 shrink-0"/>:<AlertTriangle size={16} className="text-amber-500 shrink-0"/>}
      <div><p className="font-semibold text-slate-900 dark:text-slate-100">{snapshot.checking?commonText("Đang kiểm tra quyền truy cập…",language):confirmed?commonText("Đã kiểm chứng quyền đọc dữ liệu được bảo vệ",language):status?.status==='restricted'?commonText("Chưa có quyền truy cập cần thiết",language):commonText("Chưa xác minh được quyền truy cập",language)}</p>
      <p className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">{commonText("VXClean cần Full Disk Access để quét dữ liệu của các ứng dụng khác mà không hỏi quyền từng mục. Quyền này không thay thế quyền quản trị khi dọn.",language)}</p></div>
    </div>
    <ol className="list-decimal pl-5 space-y-2 leading-relaxed text-slate-700 dark:text-slate-300">
      <li>{commonText("Mở",language)}<strong>{commonText("Cài đặt hệ thống → Quyền riêng tư &amp; Bảo mật → Full Disk Access",language)}</strong>.</li>
      <li>{commonText("Nếu chưa có VXClean, nhấn",language)}<strong>+</strong>{commonText("và chọn ứng dụng đang chạy ở đường dẫn dưới đây.",language)}</li>
      <li>{commonText("Bật quyền cho",language)}<strong>VXClean</strong>{commonText(". Nếu macOS yêu cầu thoát ứng dụng, thoát rồi mở lại.",language)}</li>
      <li>{commonText("Quay về VXClean để kiểm tra quyền và tiếp tục quét.",language)}</li>
    </ol>
    {status?.app_bundle_path&&<div className="rounded-lg border border-slate-200 dark:border-white/10 p-3 bg-slate-50 dark:bg-black/20"><p className="text-[11px] text-slate-500 mb-1">{commonText("Ứng dụng đang chạy",language)}</p><p className="font-mono text-[11px] break-all text-slate-700 dark:text-slate-300">{status.app_bundle_path}</p></div>}
    {status?.signing_kind==='ad_hoc'&&<p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">{commonText("Bản hiện tại có thể cần cấp lại quyền sau cập nhật. Nếu đã bật nhưng vẫn bị hỏi, gỡ mục VXClean cũ khỏi danh sách FDA rồi thêm lại ứng dụng ở đường dẫn trên.",language)}</p>}
    {status?.status==='restricted'&&status.signing_kind!=='ad_hoc'&&<p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">{commonText("Nếu đã bật quyền nhưng vẫn chưa truy cập được, thoát rồi mở lại VXClean. Nếu vẫn lỗi sau khi cập nhật, gỡ mục VXClean cũ khỏi danh sách Full Disk Access rồi thêm lại ứng dụng ở đường dẫn trên.",language)}</p>}
    {snapshot.error&&<p role="alert" className="text-rose-600 dark:text-rose-300 break-words">{commonText("Không kiểm tra được quyền:",language)} {snapshot.error}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={()=>void handleSettings()} className={`${button} bg-cyan-600 hover:bg-cyan-500 text-white`}>{commonText("Mở cài đặt Full Disk Access",language)}</button>
      <button type="button" onClick={()=>void handleReveal()} disabled={!status?.app_bundle_path} className={`${button} border border-slate-300 dark:border-white/15 hover:bg-slate-100 dark:hover:bg-white/10`}><FolderOpen size={14}/>{commonText("Hiện ứng dụng trong Finder",language)}</button>
      <button type="button" onClick={()=>void scanAccess.refresh()} disabled={snapshot.checking} className={`${button} border border-slate-300 dark:border-white/15 hover:bg-slate-100 dark:hover:bg-white/10`}><RefreshCw size={14} className={snapshot.checking?'animate-spin':''}/>{commonText("Kiểm tra lại quyền",language)}</button>
    </div>
  </div>;
}
export function ScanAccessDialog({language="vi"}:{language?:"vi"|"en"}={}){
  const snapshot=useSyncExternalStore(scanAccess.subscribe,scanAccess.getSnapshot);
  const open=snapshot.requestedScopes.length>0;
  useEffect(()=>{
    if(!open)return;
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.stopImmediatePropagation();scanAccess.defer();}};
    window.addEventListener('keydown',key,true);
    return()=>{window.removeEventListener('keydown',key,true);};
  },[open]);
  const dialogRef=React.useRef<HTMLDivElement>(null);
  useEffect(()=>{if(open)dialogRef.current?.focus();},[open]);
  const trapTab=(event:React.KeyboardEvent)=>{if(event.key!=='Tab')return;const items=dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');if(!items?.length)return;const first=items[0],last=items[items.length-1];if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialogRef.current)){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}};
  if(!open)return null;
  return <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center">
    <div ref={dialogRef} tabIndex={-1} onKeyDown={trapTab} role="dialog" aria-modal="true" aria-labelledby="scan_access_title" className="w-full max-w-xl max-h-[calc(100dvh-32px)] overflow-y-auto bg-white dark:bg-[#141821] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl text-slate-800 dark:text-slate-200 outline-none">
      <div className="flex items-center gap-2 p-4 border-b border-slate-200 dark:border-white/10"><Shield size={16} className="text-cyan-500"/><h2 id="scan_access_title" className="text-sm font-semibold flex-1">{commonText("Cấp quyền trước khi quét",language)}</h2><button type="button" aria-label={commonText("Để sau, hủy quét đang chờ",language)} onClick={scanAccess.defer} className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-white/10"><X size={16}/></button></div>
      <div className="p-4 space-y-4"><p className="text-xs text-slate-500 dark:text-slate-400">{commonText("Đang chờ:",language)} {snapshot.requestedScopes.map(scope=>commonText(scopeNames[scope],language)).join(', ')}{commonText('. Chưa bắt đầu đọc dữ liệu của ứng dụng khác.',language)}</p><ScanAccessPanel refreshOnMount={false} language={language}/></div>
      <div className="p-4 border-t border-slate-200 dark:border-white/10 flex justify-end"><button type="button" onClick={scanAccess.defer} className={`${button} border border-slate-300 dark:border-white/15 hover:bg-slate-100 dark:hover:bg-white/10`}>{commonText("Để sau",language)}</button></div>
    </div>
  </div>;
}
