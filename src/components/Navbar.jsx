import React, { useState, useRef, useEffect } from 'react';
import { CORE_CATEGORIES } from '../constants/categories';

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
  onToggleTheme,
  selectedCategory = 'All',
  onSelectCategory,
  categoryCounts = {},
  currentView
}) {
  const isAdmin = currentView === 'admin';
  const [isSearchOpenMobile, setIsSearchOpenMobile] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const categoriesRef = useRef(null);
  const isDark = theme === 'dark';

  // Close categories popup on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (categoriesRef.current && !categoriesRef.current.contains(e.target)) {
        setIsCategoriesOpen(false);
      }
    };
    if (isCategoriesOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isCategoriesOpen]);

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-4">
        {/* Brand Logo (Clean, no overglow) */}
        <div
          onClick={onNavigateHome}
          className="flex items-center gap-2.5 cursor-pointer group shrink-0"
        >
          <div className="w-9 h-9 rounded-xl overflow-hidden shadow-md shadow-rose-600/20 group-hover:scale-105 transition-all shrink-0">
            <img src="/icon.png" alt="HornyLeaks" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center">
                Horny<span className="text-rose-500">Leaks</span>
              </span>
              {isAdmin && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 uppercase tracking-wider">
                  Admin
                </span>
              )}
            </div>
            <span className="block text-[8px] uppercase font-bold tracking-widest text-slate-400">
              {isAdmin ? 'Management Console' : 'Free Video Streams'}
            </span>
          </div>
        </div>

        {/* Desktop Search Bar (Glassmorphic) - Hidden in Admin */}
        {!isAdmin && (
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
        )}

        {/* Action Controls (All 44px+ Accessible Touch Targets) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Mobile Search Toggle - Consumer Only */}
          {!isAdmin && (
            <button
              onClick={() => setIsSearchOpenMobile(!isSearchOpenMobile)}
              className="md:hidden w-11 h-11 flex items-center justify-center rounded-full glass-button text-xs shrink-0 active:scale-95 transition-all"
              title="Search"
              aria-label="Toggle search"
            >
              <i className="ri-search-line not-italic text-base"></i>
            </button>
          )}

          {/* Categories Popover Trigger - Consumer Only */}
          {!isAdmin && (
            <div className="relative" ref={categoriesRef}>
              <button
                onClick={() => setIsCategoriesOpen((prev) => !prev)}
                className={`min-h-[44px] min-w-[44px] px-3 py-2 rounded-full glass-button flex items-center justify-center gap-1.5 text-xs font-bold active:scale-95 transition-all cursor-pointer ${
                  selectedCategory !== 'All' ? 'border-rose-500/50 bg-rose-500/10 text-rose-500' : ''
                }`}
                title="Categories"
                aria-label="Browse categories"
                aria-expanded={isCategoriesOpen}
              >
                <i className="ri-apps-2-line not-italic text-sm text-rose-500"></i>
                <span className="hidden sm:inline font-bold">
                  {selectedCategory === 'All' ? 'Categories' : selectedCategory}
                </span>
                <i className={`ri-arrow-down-s-line not-italic text-xs transition-transform duration-200 ${isCategoriesOpen ? 'rotate-180' : ''}`}></i>
              </button>

              {/* Categories Floating Dropdown Menu */}
              {isCategoriesOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-white/[0.06] mb-1 flex items-center justify-between">
                    <span>Browse Categories</span>
                    <i className="ri-folder-video-line text-xs"></i>
                  </div>
                  <div className="space-y-1">
                    {CORE_CATEGORIES.map((cat) => {
                      const isSelected = selectedCategory === cat.id;
                      const count = categoryCounts[cat.id] ?? 0;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => {
                            if (typeof onSelectCategory === 'function') {
                              onSelectCategory(cat.id);
                            }
                            setIsCategoriesOpen(false);
                          }}
                          className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                              : 'hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <i className={`${cat.icon} text-sm ${isSelected ? 'text-white' : cat.color}`}></i>
                            <span>{cat.label}</span>
                          </div>
                          {count > 0 && (
                            <span
                              className={`text-[10px] font-sans font-bold tabular-nums px-2 py-0.5 rounded-full ${
                                isSelected
                                  ? 'bg-black/25 text-white'
                                  : 'bg-slate-200/60 dark:bg-white/[0.08] text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

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

          {/* Saved / Bookmarks Drawer Toggle - Consumer Only */}
          {!isAdmin ? (
            <button
              onClick={onOpenBookmarks}
              className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-full glass-button flex items-center justify-center gap-1.5 text-xs font-semibold active:scale-95 transition-all"
              title="Saved videos"
              aria-label="Saved videos"
            >
              <i className="ri-bookmark-fill not-italic text-rose-500 text-xs"></i>
              <span className="hidden sm:inline">Saved</span>
              {bookmarkCount > 0 && (
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-sans font-bold tabular-nums">
                  {bookmarkCount}
                </span>
              )}
            </button>
          ) : (
            <button
              onClick={onNavigateHome}
              className="min-h-[44px] px-3.5 py-2 rounded-full glass-button flex items-center justify-center gap-1.5 text-xs font-bold active:scale-95 transition-all text-slate-700 dark:text-slate-300 hover:text-rose-500 cursor-pointer"
              title="Exit to public site"
            >
              <i className="ri-arrow-left-line not-italic text-sm text-rose-500"></i>
              <span className="hidden sm:inline">Exit to Site</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Search Input Expanded - Consumer Only */}
      {!isAdmin && isSearchOpenMobile && (
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
