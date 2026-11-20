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

  // Sliding window algorithm for page numbers
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  };

  const pages = getPageNumbers();
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <nav
      role="navigation"
      aria-label="Pagination Navigation"
      className="flex flex-col items-center gap-3 pt-8 pb-6 select-none"
    >
      {/* Pagination Controls Row */}
      <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
        {/* Previous Page Button */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || isLoading}
          aria-label="Previous page"
          className="min-h-[38px] px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border bg-slate-900/60 dark:bg-slate-900/80 border-slate-700/60 dark:border-slate-800 text-slate-300 dark:text-slate-200 hover:text-white hover:bg-slate-800 hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-900/60 disabled:hover:text-slate-400 active:scale-95 shadow-sm"
        >
          <i className="ri-arrow-left-s-line text-sm"></i>
          <span className="hidden sm:inline">Prev</span>
        </button>

        {/* Numbered Page Buttons */}
        {pages.map((p, idx) => {
          if (p === '...') {
            return (
              <span
                key={`ellipsis-${idx}`}
                className="w-7 sm:w-9 text-center text-slate-500 font-bold text-sm tracking-widest select-none"
              >
                …
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
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center border ${
                isCurrent
                  ? 'bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 border-rose-500 text-white font-black shadow-lg shadow-rose-600/30 scale-105'
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
          className="min-h-[38px] px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border bg-slate-900/60 dark:bg-slate-900/80 border-slate-700/60 dark:border-slate-800 text-slate-300 dark:text-slate-200 hover:text-white hover:bg-slate-800 hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-900/60 disabled:hover:text-slate-400 active:scale-95 shadow-sm"
        >
          <span className="hidden sm:inline">Next</span>
          <i className="ri-arrow-right-s-line text-sm"></i>
        </button>
      </div>

      {/* Pagination Status Text */}
      {totalItems > 0 && (
        <p className="text-[11px] font-medium text-slate-400 dark:text-slate-400 tracking-wide text-center">
          Showing <span className="font-bold text-slate-200 dark:text-slate-100">{startItem}–{endItem}</span> of{' '}
          <span className="font-bold text-rose-400">{totalItems}</span> Streams (Page{' '}
          <span className="font-bold text-slate-200 dark:text-slate-100">{currentPage}</span> of{' '}
          <span className="font-bold text-slate-200 dark:text-slate-100">{totalPages}</span>)
        </p>
      )}
    </nav>
  );
}
