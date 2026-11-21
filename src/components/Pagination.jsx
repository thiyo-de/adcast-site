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

  // Compact sliding window for mobile (< 640px) allowing direct 1-tap jumps
  const getMobilePages = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 3) {
      return [1, 2, 3, '...', totalPages];
    }
    if (currentPage >= totalPages - 2) {
      return [1, '...', totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', currentPage, '...', totalPages];
  };

  const desktopPages = getDesktopPages();
  const mobilePages = getMobilePages();
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <nav
      role="navigation"
      aria-label="Pagination Navigation"
      className={`flex flex-col items-center gap-3 pt-6 pb-4 select-none ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}
    >
      {/* 1. Mobile Numeric Controls (< 640px): [‹] [1] [2] [3] ... [10] [›] */}
      <div className="flex sm:hidden flex-col items-center gap-2 w-full px-2">
        <div className="flex items-center justify-center gap-1.5 w-full flex-wrap">
          {/* Previous Page Button */}
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1 || isLoading}
            aria-label="Previous page"
            className="w-10 h-10 rounded-xl text-xs font-bold transition-all flex items-center justify-center border bg-slate-900/80 border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none active:scale-95 shadow-sm"
          >
            <i className="ri-arrow-left-s-line text-lg"></i>
          </button>

          {/* Numbered Page Buttons */}
          {mobilePages.map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`m-ellipsis-${idx}`}
                  className="w-6 text-center text-slate-500 font-bold text-xs select-none"
                >
                  &hellip;
                </span>
              );
            }

            const isCurrent = p === currentPage;
            return (
              <button
                key={`m-page-${p}`}
                type="button"
                onClick={() => onPageChange(p)}
                disabled={isLoading}
                aria-current={isCurrent ? 'page' : undefined}
                aria-label={`Page ${p}`}
                className={`min-w-[40px] h-10 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center border ${
                  isCurrent
                    ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white font-extrabold border-rose-400/40 shadow-md shadow-rose-500/25'
                    : 'bg-slate-900/80 border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 shadow-sm'
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
            className="w-10 h-10 rounded-xl text-xs font-bold transition-all flex items-center justify-center border bg-slate-900/80 border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none active:scale-95 shadow-sm"
          >
            <i className="ri-arrow-right-s-line text-lg"></i>
          </button>
        </div>

        {/* Mobile Page Indicator */}
        <span className="text-[11px] font-medium text-slate-400 tabular-nums select-none pt-0.5">
          Page <span className="font-bold text-slate-200">{currentPage}</span> of{' '}
          <span className="font-bold text-slate-200">{totalPages}</span>
        </span>
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
