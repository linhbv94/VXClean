import {useCleanText} from '../services/ui_language';
import React from 'react';
import { TabId } from '../types';
import { Clock, ArrowLeft, ShieldAlert } from 'lucide-react';

interface UnmigratedViewProps {
  tab: TabId;
  onBackToDashboard: () => void;
}

const TAB_TITLES: Record<TabId, { title: string; desc: string }> = {
  dashboard: {
    title: 'Tổng quan Hệ thống',
    desc: 'Bảng điều khiển viễn trắc phần cứng thời gian thực.',
  },
  smart_scan: {
    title: 'Dọn dẹp Thông minh (Smart Scan)',
    desc: 'Quét toàn diện rác ứng dụng, bộ nhớ cache và tệp tạm thời trên macOS.',
  },
  cleanup: {
    title: 'Dọn rác Hệ thống (Cleanup)',
    desc: 'Làm sạch log người dùng, tệp tải về thừa và thùng rác an toàn.',
  },
  uninstaller: {
    title: 'Gỡ ứng dụng (Uninstaller)',
    desc: 'Gỡ bỏ triệt để ứng dụng kèm các tệp liên quan trong Library và Application Support.',
  },
  orphans: {
    title: 'Tệp Mồ côi (Orphans)',
    desc: 'Quét và dọn sạch dữ liệu sót lại từ các ứng dụng đã từng gỡ bỏ thủ công.',
  },
  space_lens: {
    title: 'Không gian Ổ đĩa (Space Lens)',
    desc: 'Trực quan hóa dung lượng tệp lớn và thư mục chiếm nhiều bộ nhớ APFS.',
  },
};

export const UnmigratedView: React.FC<UnmigratedViewProps> = ({
  tab,
  onBackToDashboard,
}) => {
  const ct = useCleanText();

  const info = TAB_TITLES[tab] ?? {
    title: ct("Chức năng"),
    desc: ct("Mô tả chức năng."),
  };

  return (
    <div className="flex-1 h-full p-6 flex flex-col justify-center items-center overflow-y-auto">
      <div className="max-w-md mx-auto w-full flex flex-col items-center text-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400">
          <Clock className="w-6 h-6" />
        </div>

        <div className="flex flex-col gap-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 mx-auto">
            <ShieldAlert className="w-3.5 h-3.5" />{ct("Chưa chuyển")} </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-2">
            {ct(info.title)}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{ct("Chức năng chưa có trong bản thử; dùng bản native hiện tại.")} </p>
        </div>

        <button
          type="button"
          onClick={onBackToDashboard}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />{ct("Quay lại Tổng quan")} </button>
      </div>
    </div>
  );
};
