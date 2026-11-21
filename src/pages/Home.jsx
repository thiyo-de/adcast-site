import React, { useState, useEffect } from 'react';
import VideoCard from '../components/VideoCard';
import AdSlot from '../components/AdSlot';
import Pagination from '../components/Pagination';
import { store } from '../services/store';
import { resetDefaultSEO } from '../utils/seo';

const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest Uploads', icon: 'ri-flashlight-line' },
  { id: 'trending', label: 'Trending', icon: 'ri-fire-line' },
  { id: 'top_rated', label: 'Top Rated', icon: 'ri-star-line' },
  { id: 'views', label: 'Most Viewed', icon: 'ri-eye-line' }
];

export default function Home({
  videos = [],
  totalVideos = 0,
  page = 1,
  pageSize = 20,
  isLoadingVideos = false,
  onPageChange,
  sortBy = 'newest',
  onSortChange,
  onSelectVideo,
  onBookmarkToggle,
  isBookmarked,
  searchQuery,
  onClearSearch,
  selectedCategory = 'All',
  onSelectCategory
}) {
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [history, setHistory] = useState(() => store.getHistory());

  useEffect(() => {
    resetDefaultSEO();
    setHistory(store.getHistory());
  }, []);

  const handleClearHistory = (e) => {
    e.stopPropagation();
    store.clearHistory();
    setHistory([]);
  };

  const handleRemoveHistoryItem = (e, videoId) => {
    e.stopPropagation();
    const updated = store.removeFromHistory(videoId);
    setHistory(updated);
  };

  // Server-paginated slice is rendered directly
  const processedVideos = videos || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-4 space-y-5">
      {/* 1. Top Leaderboard Banner (Fully Responsive Container) */}
      <div className="w-full min-w-0 my-2 flex justify-center">
        <div className="w-full min-w-0 flex justify-center">
          <AdSlot slotId="slot_top_banner" className="w-full" />
        </div>
      </div>

      {/* 2.5 Pick Up Where You Left Off (Recently Watched Shelf) */}
      {!searchQuery && history.length > 0 && (
        <section className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <i className="ri-history-line not-italic text-rose-500 text-base"></i>
              Pick Up Where You Left Off
              <span className="text-[10px] font-sans font-bold tabular-nums px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
                {history.length}
              </span>
            </h3>
            <button
              onClick={handleClearHistory}
              className="text-[11px] font-bold text-slate-400 hover:text-rose-500 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <i className="ri-delete-bin-line not-italic text-xs"></i> Clear History
            </button>
          </div>

          <div
            className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {history.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectVideo(item.id)}
                className="group relative shrink-0 w-44 sm:w-52 rounded-2xl glass-card overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-black/80">
                  <img
                    src={item.thumbnail_url}
                    alt={item.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all flex items-center justify-center">
                    <div className="w-9 h-9 rounded-full bg-rose-600/90 text-white flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-110">
                      <i className="ri-play-fill not-italic text-lg ml-0.5"></i>
                    </div>
                  </div>
                  {/* Single item remove button */}
                  <button
                    onClick={(e) => handleRemoveHistoryItem(e, item.id)}
                    className="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-full bg-black/70 hover:bg-rose-600 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 cursor-pointer shadow-md"
                    title="Remove from history"
                    aria-label="Remove from history"
                  >
                    <i className="ri-close-line text-xs"></i>
                  </button>
                  {/* Progress Indicator Bar (rendered only for actual recorded playback progress) */}
                  {item.progressPercent > 0 && (
                    <div className="absolute bottom-0 inset-x-0 h-1 bg-black/60">
                      <div
                        className="h-full bg-gradient-to-r from-rose-600 to-rose-400"
                        style={{ width: `${Math.min(100, Math.max(0, item.progressPercent))}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-rose-400 transition-colors">
                    {item.title}
                  </h4>
                  <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400 font-medium">
                    <span className="text-rose-500 dark:text-rose-400 font-bold uppercase tracking-wider">{item.category || 'Stream'}</span>
                    <span className="font-sans font-semibold tabular-nums">{item.duration || 'Resume'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Stream Feed Header & Sorting Bar */}
      <div id="catalog-feed" className="relative z-30 p-3 sm:p-3.5 rounded-2xl glass-panel flex flex-wrap items-center justify-between gap-2 sm:gap-3 text-xs">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <h2 className="text-xs sm:text-sm md:text-base font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5 shrink-0 whitespace-nowrap">
            <i className="ri-movie-2-line not-italic text-rose-500 text-sm sm:text-base"></i>
            <span>{selectedCategory === 'All' ? 'Curated Streams' : `${selectedCategory}`}</span>
          </h2>
          {selectedCategory !== 'All' && (
            <button
              type="button"
              onClick={() => onSelectCategory && onSelectCategory('All')}
              className="text-[10px] font-bold text-slate-400 hover:text-rose-500 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Reset to All Streams"
            >
              <i className="ri-close-line text-xs"></i>
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
          <span className="text-[10px] font-sans font-bold tabular-nums text-rose-500 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">
            {totalVideos > 0 ? totalVideos : processedVideos.length}
            <span className="hidden sm:inline ml-1 font-semibold">Streams</span>
          </span>
        </div>

        {/* Custom Glassmorphic Sorting Dropdown (No emojis, CDN icons only - UX01) */}
        <div className="relative shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="hidden sm:inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 font-semibold">
              <i className="ri-equalizer-line not-italic text-sm"></i> Sort:
            </span>
            <button
              type="button"
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-slate-100/90 dark:bg-white/[0.05] hover:bg-slate-200/90 dark:hover:bg-white/[0.1] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 transition-all active:scale-95 cursor-pointer shadow-sm shrink-0 whitespace-nowrap"
              aria-expanded={isSortOpen}
            >
              <i className={`${SORT_OPTIONS.find((o) => o.id === sortBy)?.icon || 'ri-flashlight-line'} not-italic text-rose-500 text-xs`}></i>
              <span>{SORT_OPTIONS.find((o) => o.id === sortBy)?.label || 'Newest'}</span>
              <i className={`ri-arrow-down-s-line not-italic text-slate-400 transition-transform duration-200 ${isSortOpen ? 'rotate-180 text-rose-500' : ''}`}></i>
            </button>
          </div>

          {/* Floating Dropdown Popover */}
          {isSortOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsSortOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-48 py-1.5 rounded-2xl bg-white/95 dark:bg-[#0F111A]/95 backdrop-blur-2xl border border-slate-200 dark:border-white/10 shadow-2xl z-50 space-y-0.5 animate-in fade-in zoom-in-95 duration-150">
                {SORT_OPTIONS.map((opt) => {
                  const isSelected = sortBy === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        if (typeof onSortChange === 'function') {
                          onSortChange(opt.id);
                        }
                        setIsSortOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2 text-xs font-bold transition-all text-left ${
                        isSelected
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <i className={`${opt.icon} not-italic text-sm ${isSelected ? 'text-rose-500' : 'text-slate-400'}`}></i>
                        <span>{opt.label}</span>
                      </div>
                      {isSelected && (
                        <i className="ri-check-line not-italic text-rose-500 text-sm"></i>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 4. Responsive Video Grid with Native Ads */}
      {isLoadingVideos ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 animate-pulse">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="flex flex-col h-full rounded-2xl glass-card overflow-hidden">
              <div className="aspect-video w-full bg-slate-800/40" />
              <div className="p-3.5 space-y-2.5 flex-1">
                <div className="w-16 h-2.5 bg-slate-800/60 rounded" />
                <div className="w-full h-3.5 bg-slate-800/60 rounded" />
                <div className="w-2/3 h-3.5 bg-slate-800/60 rounded" />
                <div className="pt-2 border-t border-slate-800/40 flex justify-between">
                  <div className="w-12 h-2.5 bg-slate-800/50 rounded" />
                  <div className="w-10 h-2.5 bg-slate-800/50 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : processedVideos.length === 0 ? (
        <div className="min-h-[50vh] sm:min-h-[55vh] flex flex-col items-center justify-center py-6 sm:py-10">
          <div className="relative overflow-hidden w-full max-w-lg p-8 sm:p-12 text-center rounded-3xl glass-card border border-slate-200/60 dark:border-white/[0.08] shadow-2xl backdrop-blur-2xl space-y-4 mx-auto">
            {/* Subtle Ambient Radial Backlight */}
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-48 bg-gradient-to-b from-rose-500/20 via-purple-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

            {/* Modernized Curved Icon Badge */}
            <div className="relative mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-rose-500/15 via-purple-500/10 to-rose-500/20 border border-rose-500/30 dark:border-white/10 flex items-center justify-center shadow-lg shadow-rose-600/10">
              <div className="absolute inset-0 rounded-2xl bg-rose-500/10 blur-sm" />
              <i className="ri-movie-2-line not-italic text-3xl sm:text-4xl text-rose-500 relative z-10"></i>
            </div>

            <div className="space-y-1.5 relative z-10">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-white tracking-tight">
                {videos.length === 0 ? 'Updating Stream Library' : 'No streams match your filter'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                {videos.length === 0
                  ? 'Our streaming network is refreshing content feeds. Check back shortly or browse popular categories.'
                  : 'Try selecting another category or clear your search filter.'}
              </p>
            </div>

            {(selectedCategory !== 'All' || searchQuery) ? (
              <div className="pt-2 relative z-10">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof onSelectCategory === 'function') onSelectCategory('All');
                    if (typeof onClearSearch === 'function') onClearSearch();
                  }}
                  className="px-6 py-2.5 rounded-full bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white text-xs font-bold shadow-lg shadow-rose-600/25 transition-all active:scale-95 flex items-center gap-1.5 mx-auto cursor-pointer"
                >
                  <i className="ri-refresh-line not-italic text-xs"></i>
                  <span>Clear all filters</span>
                </button>
              </div>
            ) : (
              <div className="pt-2 relative z-10 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="px-6 py-2.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <i className="ri-refresh-line not-italic text-xs"></i>
                  <span>Refresh Streams</span>
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {processedVideos.map((video, index) => {
            const showNativeAd = index > 0 && index % 6 === 0;

            return (
              <React.Fragment key={video.id}>
                {showNativeAd && (
                  <AdSlot
                    slotId="slot_native_feed"
                    className="col-span-1"
                    devBadge={false}
                  />
                )}

                <VideoCard
                  video={video}
                  onSelect={onSelectVideo}
                  onBookmarkToggle={onBookmarkToggle}
                  isBookmarked={isBookmarked(video.id)}
                />
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Numbered Pagination Controls */}
      <Pagination
        currentPage={page}
        totalItems={totalVideos}
        pageSize={pageSize}
        onPageChange={onPageChange}
        isLoading={isLoadingVideos}
      />
    </div>
  );
}
