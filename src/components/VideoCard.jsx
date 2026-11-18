import React from 'react';
import { formatDuration } from '../services/store';

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

  const rating = video.rating || 97;

  return (
    <div
      onClick={() => onSelect(video.id)}
      className="group relative flex flex-col rounded-2xl glass-card overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:hover:shadow-2xl"
    >
      {/* Thumbnail Container (16:9) */}
      <div className="relative aspect-video w-full overflow-hidden bg-slate-950">
        <img
          src={video.thumbnail_url}
          alt={video.title}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800&auto=format&fit=crop&q=80';
          }}
          className="w-full h-full object-cover filter blur-[10px] scale-110 opacity-25 transition-all duration-300"
        />

        {/* 75% Dark Privacy Veil Overlay */}
        <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm pointer-events-none flex items-center justify-center">
          <i className="ri-eye-off-line not-italic text-slate-500/40 text-xl"></i>
        </div>

        {/* Subtle Gradient Shadow */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/20 opacity-80 pointer-events-none" />

        {/* Top Badges (Frosted Glass Pills) */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black tracking-wider uppercase bg-cyan-500 text-black shadow-sm">
            {video.quality || '4K UHD'}
          </span>
          {video.is_featured && (
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-rose-600 text-white shadow-sm flex items-center gap-0.5">
              <i className="ri-sparkling-fill not-italic text-[10px]"></i> Hot
            </span>
          )}
        </div>

        {/* Top Right: Rating & Bookmark Pill */}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-500/90 text-white backdrop-blur-md shadow-sm">
            <i className="ri-thumb-up-fill not-italic text-[10px]"></i>
            {rating}%
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onBookmarkToggle(video.id);
            }}
            className={`p-1 rounded-full backdrop-blur-md transition-all ${
              isBookmarked
                ? 'bg-rose-600 text-white shadow'
                : 'bg-black/50 text-white/80 hover:text-white hover:bg-black/80'
            }`}
            title={isBookmarked ? 'Remove saved' : 'Save stream'}
          >
            <i className={`ri-bookmark-${isBookmarked ? 'fill' : 'line'} not-italic text-xs`}></i>
          </button>
        </div>

        {/* Duration Pill (Bottom Right) */}
        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[10px] font-mono font-bold text-white border border-white/10">
          {formatDuration(video.duration_seconds || video.duration)}
        </div>
      </div>

      {/* Video Info Section */}
      <div className="p-3.5 flex flex-col flex-1 justify-between">
        <div>
          {/* Category Tag */}
          <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-rose-500 dark:text-rose-400 mb-1">
            {video.category || 'General'}
          </span>

          {/* Title */}
          <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-rose-500 dark:group-hover:text-white line-clamp-2 leading-snug mb-2 transition-colors">
            {video.title}
          </h3>
        </div>

        {/* Meta Stats Bar */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/60 dark:border-white/[0.06]">
          <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
            <i className="ri-eye-line not-italic text-cyan-500 dark:text-cyan-400 text-sm"></i>
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
