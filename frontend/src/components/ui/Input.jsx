import React from 'react';

export function Input({
  label,
  error,
  helperText,
  id,
  className = '',
  required = false,
  ...props
}) {
  const inputId = id || props.name || Math.random().toString(36).substring(7);

  return (
    <div className="space-y-1.5 text-left w-full">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-bold text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <input
        id={inputId}
        required={required}
        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-slate-900 ${
          error
            ? 'border-red-300 bg-red-50/30 text-red-900 focus:ring-red-500'
            : 'border-slate-300 bg-white text-slate-900 hover:border-slate-400'
        } ${className}`}
        {...props}
      />
      {error ? (
        <p className="text-[11px] font-semibold text-red-600 mt-1">{error}</p>
      ) : helperText ? (
        <p className="text-[11px] text-slate-500 mt-1">{helperText}</p>
      ) : null}
    </div>
  );
}

export function Textarea({
  label,
  error,
  helperText,
  id,
  className = '',
  required = false,
  rows = 3,
  ...props
}) {
  const inputId = id || props.name || Math.random().toString(36).substring(7);

  return (
    <div className="space-y-1.5 text-left w-full">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-bold text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <textarea
        id={inputId}
        rows={rows}
        required={required}
        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-slate-900 ${
          error
            ? 'border-red-300 bg-red-50/30 text-red-900 focus:ring-red-500'
            : 'border-slate-300 bg-white text-slate-900 hover:border-slate-400'
        } ${className}`}
        {...props}
      />
      {error ? (
        <p className="text-[11px] font-semibold text-red-600 mt-1">{error}</p>
      ) : helperText ? (
        <p className="text-[11px] text-slate-500 mt-1">{helperText}</p>
      ) : null}
    </div>
  );
}

export default Input;
