import React, { useState } from 'react';

export default function Navbar({
  searchQuery,
  onSearchChange,
  onOpenBookmarks,
  bookmarkCount,
  onNavigateHome,
  onNavigateAdmin,
  isDevMode,
  onToggleDevMode,
  theme,
  onToggleTheme
}) {
  const [isSearchOpenMobile, setIsSearchOpenMobile] = useState(false);

  const handlePanicExit = () => {
    window.location.replace('https://www.google.com');
  };

  const isDark = theme === 'dark';

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-4">
        {/* Brand Logo (Clean, no overglow) */}
        <div
          onClick={onNavigateHome}
          className="flex items-center gap-2.5 cursor-pointer group shrink-0"
        >
          <div className="w-9 h-9 rounded-xl overflow-hidden shadow-md shadow-rose-600/20 group-hover:scale-105 transition-all shrink-0">
            <img src="/icon.svg" alt="HornyLeaks" className="w-full h-full object-cover" />
          </div>
          <div>
            <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center">
              Horny<span className="text-rose-500">Leaks</span>
            </span>
            <span className="block text-[8px] uppercase font-bold tracking-widest text-slate-400">
              Free Video Streams
            </span>
          </div>
        </div>

        {/* Desktop Search Bar (Glassmorphic) */}
        <div className="hidden md:flex flex-1 max-w-md mx-3">
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <i className="ri-search-line not-italic text-xs"></i>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search streams, categories, tags..."
              className="w-full pl-9 pr-9 py-2 bg-slate-100/70 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] rounded-full text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-rose-500 dark:focus:border-rose-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <i className="ri-close-line not-italic text-sm"></i>
              </button>
            )}
          </div>
        </div>

        {/* Action Controls (All 44px+ Accessible Touch Targets) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Mobile Search Toggle */}
          <button
            onClick={() => setIsSearchOpenMobile(!isSearchOpenMobile)}
            className="md:hidden w-11 h-11 flex items-center justify-center rounded-full glass-button text-xs shrink-0 active:scale-95 transition-all"
            title="Search"
            aria-label="Toggle search"
          >
            <i className="ri-search-line not-italic text-base"></i>
          </button>

          {/* Theme Toggle (Dark / Light with smooth micro-animation) */}
          <button
            onClick={onToggleTheme}
            className="group relative min-h-[44px] min-w-[44px] px-3 py-2 rounded-full glass-button flex items-center justify-center gap-1.5 text-xs font-bold active:scale-95 transition-all"
            title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            aria-label="Toggle visual theme"
          >
            <i className={`${isDark ? 'ri-sun-line text-amber-400 group-hover:rotate-90' : 'ri-moon-line text-indigo-500 group-hover:-rotate-45'} not-italic text-sm transition-transform duration-300`}></i>
            <span className="hidden sm:inline font-bold">{isDark ? 'Light' : 'Dark'}</span>
          </button>

          {/* Saved / Bookmarks Drawer Toggle */}
          <button
            onClick={onOpenBookmarks}
            className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-full glass-button flex items-center justify-center gap-1.5 text-xs font-semibold active:scale-95 transition-all"
            title="Saved videos"
            aria-label="Saved videos"
          >
            <i className="ri-bookmark-fill not-italic text-rose-500 text-xs"></i>
            <span className="hidden sm:inline">Saved</span>
            {bookmarkCount > 0 && (
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-bold">
                {bookmarkCount}
              </span>
            )}
          </button>

          {/* Admin Dashboard Button */}
          <button
            onClick={onNavigateAdmin}
            className="hidden sm:flex min-h-[44px] items-center gap-1 px-3 py-2 rounded-full glass-button text-xs font-bold"
            title="Admin Login & Ad Manager"
          >
            <i className="ri-lock-line not-italic text-amber-500 text-xs"></i>
            <span>Admin</span>
          </button>
        </div>
      </div>

      {/* Mobile Search Input Expanded */}
      {isSearchOpenMobile && (
        <div className="md:hidden px-4 pb-3 pt-1 border-t border-slate-200 dark:border-white/[0.08] bg-white/95 dark:bg-obsidian/95 backdrop-blur-xl">
          <div className="relative w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search streams..."
              autoFocus
              className="w-full pl-9 pr-9 py-2 bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 rounded-full text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-rose-500"
            />
            <i className="ri-search-line not-italic text-slate-400 absolute left-3 top-2.5 text-xs"></i>
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-2.5 text-slate-400"
              >
                <i className="ri-close-line not-italic text-sm"></i>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
