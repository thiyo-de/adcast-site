import React, { useState, useEffect } from 'react';
import VideoCard from '../components/VideoCard';
import AdSlot from '../components/AdSlot';
import { store } from '../services/store';
import { resetDefaultSEO } from '../utils/seo';

const CATEGORIES = ['All', 'Trending', 'Cinematic', 'Music', 'Action', 'Tutorials', 'Featured'];

export default function Home({ videos, onSelectVideo, onBookmarkToggle, isBookmarked, searchQuery }) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [durationFilter, setDurationFilter] = useState('all');
  const [sortBy, setSortBy] = useState('trending');
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

  // Filter and Sort Videos
  let processedVideos = videos.filter((v) => {
    const matchesCategory = selectedCategory === 'All' || v.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.tags && v.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));

    let matchesDuration = true;
    const durMin = v.durationMinutes || 10;
    if (durationFilter === 'short') matchesDuration = durMin < 10;
    if (durationFilter === 'medium') matchesDuration = durMin >= 10 && durMin <= 20;
    if (durationFilter === 'long') matchesDuration = durMin > 20;

    return matchesCategory && matchesSearch && matchesDuration;
  });

  processedVideos = [...processedVideos].sort((a, b) => {
    if (sortBy === 'top_rated') return (b.rating || 0) - (a.rating || 0);
    if (sortBy === 'views') return (b.views || 0) - (a.views || 0);
    if (sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at);
    return (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
      {/* 1. Category Pill Row (Glassmorphic & Momentum Touch Scrolling) */}
      <div
        className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {CATEGORIES.map((cat) => {
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

        {/* Sorting Dropdown */}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1">
            <i className="ri-equalizer-line not-italic text-sm"></i> Sort:
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-1.5 bg-slate-100/90 dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-rose-500 cursor-pointer dark:[color-scheme:dark]"
          >
            <option value="trending" className="bg-white dark:bg-[#0F111A] text-slate-800 dark:text-slate-200">Trending 🔥</option>
            <option value="top_rated" className="bg-white dark:bg-[#0F111A] text-slate-800 dark:text-slate-200">Top Rated ⭐</option>
            <option value="views" className="bg-white dark:bg-[#0F111A] text-slate-800 dark:text-slate-200">Most Viewed 👁</option>
            <option value="newest" className="bg-white dark:bg-[#0F111A] text-slate-800 dark:text-slate-200">Newest Uploads ⚡</option>
          </select>
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
        <div className="p-12 text-center rounded-2xl glass-card space-y-2">
          <i className="ri-movie-line not-italic text-4xl text-slate-400 mb-2 block"></i>
          <p className="text-base font-bold text-slate-700 dark:text-slate-300">
            {videos.length === 0 ? 'No video streams in catalog' : 'No streams match your filter'}
          </p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {videos.length === 0
              ? 'The catalog is currently empty. Use the admin panel to sync streams from your crawler sources.'
              : 'Try changing the duration or category filter, or reset your search query.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {processedVideos.map((video, index) => {
            const showNativeAd = index > 0 && index % 6 === 0;

            return (
              <React.Fragment key={video.id}>
                {showNativeAd && (
                  <div className="col-span-1">
                    <AdSlot slotId="slot_native_feed" className="h-full rounded-2xl overflow-hidden" />
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
