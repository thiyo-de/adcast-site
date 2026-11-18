import React, { useState, useEffect } from 'react';
import VideoCard from '../components/VideoCard';
import AdSlot from '../components/AdSlot';
import { store, parseDurationToSeconds } from '../services/store';
import { resetDefaultSEO } from '../utils/seo';

const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest Uploads', icon: 'ri-flashlight-line' },
  { id: 'trending', label: 'Trending', icon: 'ri-fire-line' },
  { id: 'top_rated', label: 'Top Rated', icon: 'ri-star-line' },
  { id: 'views', label: 'Most Viewed', icon: 'ri-eye-line' }
];

export default function Home({ videos = [], onSelectVideo, onBookmarkToggle, isBookmarked, searchQuery, onClearSearch }) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [durationFilter, setDurationFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [history, setHistory] = useState(() => store.getHistory());

  useEffect(() => {
    resetDefaultSEO();
    setHistory(store.getHistory());
  }, []);

  // Derive categories dynamically from actual published records (UX02)
  const categories = React.useMemo(() => {
    const set = new Set();
    (videos || []).forEach((v) => {
      if (v.category && typeof v.category === 'string' && v.category.trim()) {
        set.add(v.category.trim());
      }
    });
    const sorted = Array.from(set).sort((a, b) => a.localeCompare(b));
    return ['All', ...sorted];
  }, [videos]);

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

  // Filter and Sort Videos
  const q = (searchQuery || '').trim().toLowerCase();
  let processedVideos = (videos || []).filter((v) => {
    const matchesCategory = selectedCategory === 'All' || v.category === selectedCategory;
    const matchesSearch =
      !q ||
      (v.title && v.title.toLowerCase().includes(q)) ||
      (v.category && v.category.toLowerCase().includes(q)) ||
      (v.tags && Array.isArray(v.tags) && v.tags.some((t) => typeof t === 'string' && t.toLowerCase().includes(q)));

    let matchesDuration = true;
    const durSec = v.duration_seconds || parseDurationToSeconds(v.duration);
    const durMin = durSec / 60;
    if (durationFilter === 'short') matchesDuration = durMin < 10;
    if (durationFilter === 'medium') matchesDuration = durMin >= 10 && durMin <= 20;
    if (durationFilter === 'long') matchesDuration = durMin > 20;

    return matchesCategory && matchesSearch && matchesDuration;
  });

  processedVideos = [...processedVideos].sort((a, b) => {
    if (sortBy === 'top_rated') return (b.rating || 0) - (a.rating || 0);
    if (sortBy === 'views') return (b.views || 0) - (a.views || 0);
    if (sortBy === 'newest') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    return (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
      {/* 1. Category Pill Row (Glassmorphic & Momentum Touch Scrolling) */}
      <div
        className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`min-h-[44px] px-4 py-2.5 rounded-full text-xs font-bold whitespace-nowrap active:scale-95 transition-all duration-200 ${
                isSelected
                  ? 'bg-rose-600 text-white shadow-sm scale-105'
                  : 'glass-button'
              }`}
            >
              {cat === 'Trending' && '🔥 '}
              {cat === 'Featured' && '✦ '}
              {cat}
            </button>
          );
        })}
      </div>

      {/* 2. Top Leaderboard Banner (Slot 1: TrafficFactory) */}
      <div className="w-full my-2 flex justify-center">
        <AdSlot slotId="slot_top_banner" className="w-full max-w-4xl" />
      </div>

      {/* 2.5 Pick Up Where You Left Off (Recently Watched Shelf) */}
      {!searchQuery && history.length > 0 && (
        <section className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <i className="ri-history-line not-italic text-rose-500 text-base"></i>
              Pick Up Where You Left Off
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 font-bold">
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
                  {/* Progress Indicator Bar */}
                  <div className="absolute bottom-0 inset-x-0 h-1 bg-black/60">
                    <div
                      className="h-full bg-gradient-to-r from-rose-600 to-rose-400"
                      style={{ width: `${item.progressPercent || 25}%` }}
                    />
                  </div>
                </div>
                <div className="p-2.5">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-rose-400 transition-colors">
                    {item.title}
                  </h4>
                  <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400 font-medium">
                    <span className="text-cyan-400 font-semibold">{item.category || 'Stream'}</span>
                    <span className="font-mono">{item.duration || 'Resume'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Duration Filter & Sorting Bar (Frosted Glass Panel) */}
      <div className="p-3.5 rounded-2xl glass-panel flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Duration Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          <span className="text-slate-500 dark:text-slate-400 font-semibold mr-1 flex items-center gap-1">
            <i className="ri-time-line not-italic text-sm"></i> Duration:
          </span>
          {[
            { id: 'all', label: 'All' },
            { id: 'short', label: '< 10 min' },
            { id: 'medium', label: '10–20 min' },
            { id: 'long', label: '20+ min' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setDurationFilter(item.id)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                durationFilter === item.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Custom Glassmorphic Sorting Dropdown (No emojis, CDN icons only - UX01) */}
        <div className="relative ml-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1">
              <i className="ri-equalizer-line not-italic text-sm"></i> Sort:
            </span>
            <button
              type="button"
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-100/90 dark:bg-white/[0.05] hover:bg-slate-200/90 dark:hover:bg-white/[0.1] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 transition-all active:scale-95 cursor-pointer shadow-sm"
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
                className="fixed inset-0 z-30"
                onClick={() => setIsSortOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-48 py-1.5 rounded-2xl bg-white/95 dark:bg-[#0F111A]/95 backdrop-blur-2xl border border-slate-200 dark:border-white/10 shadow-2xl z-40 space-y-0.5 animate-in fade-in zoom-in-95 duration-150">
                {SORT_OPTIONS.map((opt) => {
                  const isSelected = sortBy === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSortBy(opt.id);
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

      {/* 4. Stream Catalog Count */}
      <div className="flex items-center justify-between pt-1">
        <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          {selectedCategory === 'All' ? 'Curated Streams' : `${selectedCategory} Streams`}
          <span className="text-[10px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-full">
            {processedVideos.length} Available
          </span>
        </h2>
      </div>

      {/* 5. Responsive Video Grid with Native Ads */}
      {processedVideos.length === 0 ? (
        <div className="p-12 text-center rounded-2xl glass-card space-y-3">
          <i className="ri-movie-line not-italic text-4xl text-slate-400 mb-2 block"></i>
          <p className="text-base font-bold text-slate-700 dark:text-slate-300">
            {videos.length === 0 ? 'No video streams in catalog' : 'No streams match your filter'}
          </p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {videos.length === 0
              ? 'The catalog is currently empty. Use the admin panel to sync streams from your crawler sources.'
              : 'Try changing the duration or category filter, or reset your search query.'}
          </p>
          {(selectedCategory !== 'All' || durationFilter !== 'all' || searchQuery) && (
            <div className="pt-2">
              <button
                onClick={() => {
                  setSelectedCategory('All');
                  setDurationFilter('all');
                  if (typeof onClearSearch === 'function') onClearSearch();
                }}
                className="px-4 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md transition-all active:scale-95"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 items-start">
          {processedVideos.map((video, index) => {
            const showNativeAd = index > 0 && index % 6 === 0;

            return (
              <React.Fragment key={video.id}>
                {showNativeAd && (
                  <div className="group relative flex flex-col rounded-2xl glass-card overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:hover:shadow-2xl col-span-1 self-start">
                    {/* 1. Thumbnail Container (16:9) framing the ad creative */}
                    <div className="relative aspect-video w-full overflow-hidden bg-slate-950 flex items-center justify-center">
                      <AdSlot slotId="slot_native_feed" className="w-full h-full flex items-center justify-center" devBadge={false} />

                      {/* Promoted Badge */}
                      <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10 pointer-events-none">
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black tracking-wider uppercase bg-amber-500 text-black shadow-sm">
                          Promoted
                        </span>
                      </div>

                      <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[10px] font-mono font-bold text-white border border-white/10 z-10 pointer-events-none">
                        Ad
                      </div>
                    </div>

                    {/* 2. Matching Card Info Section */}
                    <div className="p-3.5 flex flex-col gap-2.5">
                      <div>
                        <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-rose-500 dark:text-rose-400 mb-0.5">
                          SPONSORED
                        </span>
                        <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-rose-500 dark:group-hover:text-white line-clamp-2 leading-snug transition-colors">
                          Featured Partner Media Stream
                        </h3>
                      </div>

                      {/* Matching Meta Stats Bar */}
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/60 dark:border-white/[0.06]">
                        <div className="flex items-center gap-1 font-semibold text-amber-500 dark:text-amber-400">
                          <i className="ri-external-link-line not-italic text-xs"></i>
                          <span>Visit Partner</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-400">
                          <i className="ri-shield-check-line not-italic text-xs text-emerald-500"></i>
                          <span>Verified</span>
                        </div>
                      </div>
                    </div>
                  </div>
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
    </div>
  );
}
