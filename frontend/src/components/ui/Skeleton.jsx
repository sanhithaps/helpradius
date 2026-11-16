import React from 'react';

export function Skeleton({ className = '', ...props }) {
  return (
    <div
      className={`animate-pulse bg-slate-200/80 rounded-2xl ${className}`}
      {...props}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-2xl" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-16 w-full rounded-2xl" />
      <div className="flex gap-2">
        <Skeleton className="h-10 w-1/2 rounded-xl" />
        <Skeleton className="h-10 w-1/2 rounded-xl" />
      </div>
    </div>
  );
}

export default Skeleton;
