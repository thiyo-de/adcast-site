import React, { useState, useRef, useEffect } from 'react';

/**
 * CustomSelect - Dark luxury glassmorphic dropdown
 * Replaces native browser <select> elements with accessible, theme-consistent menus.
 */
export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select option...',
  label,
  className = '',
  disabled = false,
  icon
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Normalize options to { value, label, icon, badge, color }
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === 'string' || typeof opt === 'number') {
      return { value: opt, label: String(opt) };
    }
    return {
      value: opt.value,
      label: opt.label || String(opt.value),
      icon: opt.icon,
      badge: opt.badge,
      color: opt.color
    };
  });

  const selectedOption = normalizedOptions.find((opt) => String(opt.value) === String(value)) || normalizedOptions[0];

  return (
    <div className={`relative ${isOpen ? 'z-30' : 'z-0'} ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full min-h-[42px] px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 transition-all cursor-pointer border ${
          isOpen
            ? 'border-rose-500 bg-rose-50 dark:bg-rose-500/15 shadow-md shadow-rose-500/10 dark:shadow-rose-500/20'
            : 'bg-slate-100/90 hover:bg-slate-200/90 dark:bg-[#101422] dark:hover:bg-[#161c30] border-slate-300 hover:border-slate-400 dark:border-white/10 dark:hover:border-white/20 shadow-sm'
        } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 min-w-0">
          {(selectedOption?.icon || icon) && (
            <i className={`${selectedOption?.icon || icon} text-rose-500 text-sm shrink-0`}></i>
          )}
          <span className={`truncate font-semibold ${
            isOpen ? 'text-rose-600 dark:text-white' : 'text-slate-900 dark:text-white'
          }`}>
            {selectedOption?.label || placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {selectedOption?.badge && (
            <span className="text-[10px] font-sans font-bold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 border border-slate-300 dark:bg-white/10 dark:text-slate-300 dark:border-white/10">
              {selectedOption.badge}
            </span>
          )}
          <i
            className={`ri-arrow-down-s-line text-sm text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-rose-500' : ''
            }`}
          ></i>
        </div>
      </button>

      {/* Floating Glassmorphic Popover Menu */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute z-[80] left-0 right-0 mt-1.5 max-h-60 overflow-y-auto rounded-2xl bg-white dark:bg-[#0D111D] border border-slate-200 dark:border-white/15 shadow-2xl shadow-slate-900/15 dark:shadow-black/95 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150 scrollbar-none"
        >
          {normalizedOptions.map((opt) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <button
                key={String(opt.value)}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full min-h-[38px] px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between gap-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 font-extrabold'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-200 dark:hover:text-white dark:hover:bg-white/[0.08]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {opt.icon && (
                    <i className={`${opt.icon} text-sm ${isSelected ? 'text-white' : opt.color || 'text-rose-500'}`}></i>
                  )}
                  <span className="truncate">{opt.label}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {opt.badge && (
                    <span
                      className={`text-[10px] font-sans font-bold tabular-nums px-1.5 py-0.5 rounded-full ${
                        isSelected
                          ? 'bg-black/25 text-white'
                          : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-white/10 dark:text-slate-300 dark:border-white/10'
                      }`}
                    >
                      {opt.badge}
                    </span>
                  )}
                  {isSelected && (
                    <i className="ri-check-line text-sm text-white shrink-0"></i>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
