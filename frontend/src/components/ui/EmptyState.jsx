import React from 'react';
import { Inbox } from 'lucide-react';
import Button from './Button';

export default function EmptyState({
  icon: Icon = Inbox,
  title = 'No items found',
  description = 'There are currently no records to display.',
  actionLabel,
  onAction,
  className = ''
}) {
  return (
    <div className={`py-12 px-4 text-center max-w-sm mx-auto space-y-3 ${className}`}>
      <div className="w-14 h-14 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto shadow-inner">
        <Icon className="w-7 h-7 text-slate-400" />
      </div>
      <h4 className="text-base font-extrabold text-slate-800 tracking-tight">{title}</h4>
      <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <div className="pt-2">
          <Button size="sm" variant="secondary" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
