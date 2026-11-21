import React from 'react';

export default function Pagination({
  currentPage = 1,
  totalItems = 0,
  pageSize = 20,
  onPageChange,
  isLoading = false
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalPages <= 1) return null;

  // Nearby sliding window algorithm for desktop
  const getDesktopPages = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 3) {
      return [1, 2, 3, 4, '...', totalPages];
    }
    if (currentPage >= totalPages - 2) {
      return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  };

  const desktopPages = getDesktopPages();
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <nav
      role="navigation"
      aria-label="Pagination Navigation"
      className={`flex flex-col items-center gap-3 pt-6 pb-4 select-none ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}
    >
      {/* 1. Mobile Controls (< 640px): Simple [Previous] Page X of Y [Next] */}
      <div className="flex sm:hidden items-center justify-between w-full max-w-sm px-2 gap-3">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || isLoading}
          aria-label="Previous page"
          className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border bg-slate-900/80 border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none active:scale-95 shadow-sm"
        >
          <i className="ri-arrow-left-s-line text-base"></i>
          <span>Previous</span>
        </button>

        <span className="text-xs font-semibold text-slate-400 tabular-nums select-none">
          Page <span className="font-bold text-slate-100">{currentPage}</span> of{' '}
          <span className="font-bold text-slate-100">{totalPages}</span>
        </span>

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || isLoading}
          aria-label="Next page"
          className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border bg-slate-900/80 border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none active:scale-95 shadow-sm"
        >
          <span>Next</span>
          <i className="ri-arrow-right-s-line text-base"></i>
        </button>
      </div>

      {/* 2. Desktop Controls (>= 640px): [Previous] 1 … 2 [3] 4 … 18 [Next] */}
      <div className="hidden sm:flex items-center justify-center gap-1.5 flex-wrap">
        {/* Previous Page Button */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || isLoading}
          aria-label="Previous page"
          className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border bg-slate-900/60 dark:bg-slate-900/80 border-slate-700/60 dark:border-slate-800 text-slate-300 dark:text-slate-200 hover:text-white hover:bg-slate-800 hover:border-slate-600 disabled:opacity-30 disabled:pointer-events-none active:scale-95 shadow-sm"
        >
          <i className="ri-arrow-left-s-line text-base"></i>
          <span>Previous</span>
        </button>

        {/* Nearby Numbered Page Buttons with quiet active state */}
        {desktopPages.map((p, idx) => {
          if (p === '...') {
            return (
              <span
                key={`ellipsis-${idx}`}
                className="w-8 text-center text-slate-500 font-bold text-sm tracking-widest select-none"
              >
                &hellip;
              </span>
            );
          }

          const isCurrent = p === currentPage;
          return (
            <button
              key={`page-${p}`}
              type="button"
              onClick={() => onPageChange(p)}
              disabled={isLoading}
              aria-current={isCurrent ? 'page' : undefined}
              aria-label={`Page ${p}`}
              className={`min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center border ${
                isCurrent
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-400 font-bold shadow-sm'
                  : 'bg-slate-900/60 dark:bg-slate-900/80 border-slate-700/60 dark:border-slate-800 text-slate-300 dark:text-slate-300 hover:text-white hover:bg-slate-800 hover:border-slate-600 active:scale-95 shadow-sm'
              }`}
            >
              {p}
            </button>
          );
        })}

        {/* Next Page Button */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || isLoading}
          aria-label="Next page"
          className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border bg-slate-900/60 dark:bg-slate-900/80 border-slate-700/60 dark:border-slate-800 text-slate-300 dark:text-slate-200 hover:text-white hover:bg-slate-800 hover:border-slate-600 disabled:opacity-30 disabled:pointer-events-none active:scale-95 shadow-sm"
        >
          <span>Next</span>
          <i className="ri-arrow-right-s-line text-base"></i>
        </button>
      </div>

      {/* Desktop Range Metric: e.g. 41–60 of 346 */}
      {totalItems > 0 && (
        <p className="hidden sm:block text-xs font-medium text-slate-400 tabular-nums tracking-wide text-center pt-1">
          <span className="font-bold text-slate-200">{startItem}&ndash;{endItem}</span> of{' '}
          <span className="font-bold text-slate-200">{totalItems}</span>
        </p>
      )}
    </nav>
  );
}
