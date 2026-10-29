import {useCleanText} from '../services/ui_language';
import React from 'react';

export interface PageHeaderProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconColorClass?: string;
  iconBgClass?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  icon: Icon,
  iconColorClass = 'text-cyan-600 dark:text-cyan-400',
  iconBgClass = 'bg-cyan-500/10 border-cyan-500/30',
  title,
  subtitle,
  actions,
  className = '',
}) => {
  const ct = useCleanText();

  return (
    <div
      className={`p-4 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/60 dark:bg-[#0f1117]/60 flex items-center justify-between shrink-0 select-none ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${iconBgClass} ${iconColorClass}`}
        >
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-slate-900 dark:text-white tracking-wide truncate">
            {ct(title)}
          </h1>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {ct(subtitle)}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0 ml-4">
          {actions}
        </div>
      )}
    </div>
  );
};
