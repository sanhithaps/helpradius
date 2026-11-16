import React from 'react';
import { Clock, CheckCircle2, XCircle, AlertTriangle, Radio, Info } from 'lucide-react';

export default function StatusChip({ status, label, className = '' }) {
  const norm = (status || '').toLowerCase().replace('-', '_');

  const configs = {
    searching: {
      bg: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: Radio,
      text: label || 'Searching Helpers',
      pulse: true
    },
    accepted: {
      bg: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: Clock,
      text: label || 'Helper En Route',
      pulse: false
    },
    in_progress: {
      bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      icon: Radio,
      text: label || 'In Progress',
      pulse: true
    },
    completed: {
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: CheckCircle2,
      text: label || 'Completed',
      pulse: false
    },
    cancelled: {
      bg: 'bg-slate-100 text-slate-600 border-slate-200',
      icon: XCircle,
      text: label || 'Cancelled',
      pulse: false
    },
    expired: {
      bg: 'bg-rose-50 text-rose-700 border-rose-200',
      icon: AlertTriangle,
      text: label || 'Expired',
      pulse: false
    },
    simulated: {
      bg: 'bg-slate-100 text-slate-600 border-slate-200',
      icon: Info,
      text: label || 'Simulated (Demo)',
      pulse: false
    },
    emergency: {
      bg: 'bg-red-50 text-red-700 border-red-200',
      icon: AlertTriangle,
      text: label || 'Emergency SOS',
      pulse: true
    }
  };

  const conf = configs[norm] || {
    bg: 'bg-slate-50 text-slate-700 border-slate-200',
    icon: Info,
    text: label || status,
    pulse: false
  };

  const Icon = conf.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${conf.bg} ${className}`}
    >
      <Icon className={`w-3.5 h-3.5 ${conf.pulse ? 'animate-pulse' : ''}`} />
      <span>{conf.text}</span>
    </span>
  );
}
