import React from 'react';
import { formatDuration, FALLBACK_THUMB } from '../services/store';

export default function VideoCard({ video, onSelect, onBookmarkToggle, isBookmarked }) {

  const formatViews = (num) => {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const timeAgo = (dateStr) => {
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      if (days <= 0) return 'Today';
      if (days === 1) return 'Yesterday';
      return `${days}d ago`;
    } catch (e) {
      return 'Recent';
    }
  };

  return (
    <div
      role="article"
      tabIndex={0}
      onClick={() => onSelect(video.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(video.id);
        }
      }}
      className="group relative flex flex-col h-full rounded-2xl glass-card overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-rose-500"
    >
      {/* Native clickable link covering the card for SEO & right-click navigation */}
      <a
        href={`/watch/${encodeURIComponent(video.id)}`}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey) return;
          e.preventDefault();
          e.stopPropagation();
          onSelect(video.id);
        }}
        className="absolute inset-0 z-[1]"
        aria-label={video.title}
      />

      {/* Thumbnail Container (16:9) */}
      <div className="relative aspect-video w-full overflow-hidden bg-slate-950">
        <img
          src={video.thumbnail_url || FALLBACK_THUMB}
          alt={video.title}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = FALLBACK_THUMB;
          }}
          className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />

        {/* Subtle Gradient Shadow */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/20 opacity-80 pointer-events-none" />

        {/* Top Badges (Standardized rounded-lg Pills) */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10">
          {video.quality && (
            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold tracking-wider uppercase bg-black/60 text-slate-200 border border-white/20 backdrop-blur-md shadow-sm">
              {video.quality}
            </span>
          )}
          {video.is_featured && (
            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold tracking-wider uppercase bg-rose-600 text-white shadow-sm shadow-rose-600/40 flex items-center gap-0.5">
              <i className="ri-sparkling-fill not-italic text-[10px]"></i> Hot
            </span>
          )}
        </div>

        {/* Top Right: Bookmark Pill */}
        <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onBookmarkToggle(video.id);
            }}
            className={`w-7 h-7 flex items-center justify-center rounded-full backdrop-blur-md transition-all ${
              isBookmarked
                ? 'bg-rose-600 text-white shadow'
                : 'bg-black/50 text-white/80 hover:text-white hover:bg-black/80'
            }`}
            title={isBookmarked ? 'Remove saved' : 'Save stream'}
            aria-label={isBookmarked ? 'Remove saved' : 'Save stream'}
          >
            <i className={`ri-bookmark-${isBookmarked ? 'fill' : 'line'} not-italic text-xs`}></i>
          </button>
        </div>

        {/* Duration Pill (Bottom Right - Plus Jakarta Sans tabular) */}
        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-lg bg-black/80 backdrop-blur-md text-[10px] font-sans font-bold tabular-nums tracking-tight text-white border border-white/10 shadow-sm">
          {formatDuration(video.duration_seconds || video.duration)}
        </div>
      </div>

      {/* Video Info Section */}
      <div className="p-3.5 flex flex-col flex-1 justify-between gap-2.5">
        <div>
          {/* Category Tag */}
          <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-rose-500 dark:text-rose-400 mb-0.5">
            {video.category || 'General'}
          </span>

          {/* Title (Locked to 2 lines so all cards equalize perfectly) */}
          <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-rose-500 dark:group-hover:text-white line-clamp-2 leading-snug transition-colors min-h-[2.5rem]">
            {video.title}
          </h3>
        </div>

        {/* Meta Stats Bar */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/60 dark:border-white/[0.06] mt-auto">
          <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
            <i className="ri-eye-line not-italic text-rose-500/80 dark:text-rose-400/80 text-sm"></i>
            <span>{formatViews(video.views)}</span>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <i className="ri-time-line not-italic text-xs"></i>
            <span>{timeAgo(video.created_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
