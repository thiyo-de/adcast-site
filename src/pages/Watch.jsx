import React, { useState, useEffect } from 'react';
import VideoPlayer from '../components/VideoPlayer';
import VideoCard from '../components/VideoCard';
import AdSlot from '../components/AdSlot';
import { showRecommendationAdAfter } from '../services/adRendering';
import { store, FALLBACK_THUMB } from '../services/store';
import { api } from '../services/supabase';
import { updateVideoSEO, resetDefaultSEO, set404SEO } from '../utils/seo';

export default function Watch({
  videoId,
  allVideos = [],
  onBack,
  onSelectVideo,
  isBookmarked,
  onBookmarkToggle,
  onOpenDMCA,
  onTagClick
}) {
  const [video, setVideo] = useState(() => {
    // 1. Instant synchronous resolution from allVideos or local store
    if (videoId) {
      const fromProps = (allVideos || []).find((item) => item.id === videoId);
      if (fromProps) return fromProps;
      const fromStore = store.getVideoById(videoId);
      if (fromStore) return fromStore;
      return null;
    }
    // 2. Fallback to first available video if no ID provided
    const fallbackList = allVideos.length > 0 ? allVideos : store.getVideos();
    return fallbackList[0] || null;
  });

  const [notFound, setNotFound] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [relatedVideos, setRelatedVideos] = useState([]);
  const [recommendationMode, setRecommendationMode] = useState('smart');
  const [isCinemaMode, setIsCinemaMode] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setNotFound(false);

    const resolveVideo = async () => {
      // 1. Check in-memory props
      let found = (allVideos || []).find((item) => item.id === videoId);

      // 2. Check local store
      if (!found && videoId) {
        found = store.getVideoById(videoId);
      }

      // 3. Check Supabase Cloud API
      if (!found && videoId) {
        try {
          found = await api.getVideoById(videoId);
        } catch (err) {}
      }

      // 4. Fallback to first available stream ONLY if no ID was provided
      if (!found && !videoId) {
        const fallbackList = allVideos.length > 0 ? allVideos : store.getVideos();
        found = fallbackList[0] || null;
      }

      if (isMounted) {
        if (found) {
          setVideo(found);
          setLikeCount(found.likes || 0);
          setIsLiked(store.isLiked(found.id));
          store.incrementViews(found.id);
          updateVideoSEO(found);
        } else {
          setVideo(null);
          setNotFound(true);
          set404SEO();
        }
      }
    };

    resolveVideo();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    return () => {
      isMounted = false;
      resetDefaultSEO();
    };
  }, [videoId, allVideos]);

  useEffect(() => {
    let isMounted = true;
    const fetchRelated = async () => {
      if (!video) return;
      try {
        const related = await api.getRelatedVideos(
          recommendationMode === 'category' ? video.category : (recommendationMode === 'smart' ? video.category : 'All'),
          video.id,
          12
        );
        if (isMounted && related && related.length > 0) {
          setRelatedVideos(related);
          return;
        }
      } catch (err) {
        console.warn('On-demand related video fetch fallback:', err);
      }

      // Fallback to local store
      if (isMounted) {
        const pool = allVideos && allVideos.length > 0 ? allVideos : store.getVideos();
        const fallback = store.getRelatedVideos(video, recommendationMode, 12, pool);
        setRelatedVideos(fallback);
      }
    };

    fetchRelated();
    return () => {
      isMounted = false;
    };
  }, [video?.id, video?.category, recommendationMode]);

  const handleLike = () => {
    if (!video) return;
    const res = store.toggleLike(video.id);
    setIsLiked(res.isLiked);
    setLikeCount(res.totalLikes);
  };

  const handleShare = () => {
    try {
      const shareUrl = video?.id ? `${window.location.origin}/watch/${video.id}` : window.location.href;
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      alert('Link copied to clipboard!');
    }
  };

  if (notFound) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
          <i className="ri-error-warning-line not-italic text-3xl"></i>
        </div>
        <h2 className="text-xl font-bold text-slate-100">Stream Unavailable or Removed</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          The requested video stream could not be found or may have been removed following a compliance review.
        </p>
        <button
          onClick={onBack}
          className="mt-4 min-h-[44px] px-6 py-2 rounded-full glass-button text-xs font-bold"
        >
          Return to Browse
        </button>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-6 space-y-6">
        {/* Breadcrumb Skeleton */}
        <div className="flex items-center gap-2 select-none">
          <div className="w-16 h-3.5 rounded-md bg-slate-300/60 dark:bg-slate-800/80 animate-pulse" />
          <span className="text-slate-600">/</span>
          <div className="w-28 h-3.5 rounded-md bg-slate-300/40 dark:bg-slate-800/60 animate-pulse" />
        </div>

        {/* 16:9 Video Player Shimmer Skeleton Frame */}
        <div className="relative aspect-video w-full rounded-2xl md:rounded-3xl overflow-hidden bg-slate-900 border border-slate-200/60 dark:border-white/[0.08] shadow-2xl flex items-center justify-center">
          <div className="shimmer-wave" />
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 shadow-xl shadow-rose-600/10 z-10">
            <i className="ri-play-fill not-italic text-3xl sm:text-4xl ml-1 text-rose-500"></i>
          </div>

          {/* Skeleton Player Control Bar */}
          <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-black/80 to-transparent flex items-center px-4 gap-3 z-10">
            <div className="w-6 h-6 rounded bg-slate-700/60" />
            <div className="w-16 h-3 rounded bg-slate-700/60" />
            <div className="flex-1 h-1.5 rounded-full bg-slate-700/40" />
            <div className="w-6 h-6 rounded bg-slate-700/60" />
          </div>
        </div>

        {/* Video Title & Actions Skeleton Row */}
        <div className="p-4 sm:p-5 rounded-2xl glass-panel space-y-3 border border-slate-200/60 dark:border-white/[0.08]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-2 flex-1">
              <div className="w-3/4 h-5 rounded-md bg-slate-300/70 dark:bg-slate-800/80 animate-pulse" />
              <div className="w-1/2 h-3.5 rounded-md bg-slate-300/50 dark:bg-slate-800/60 animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-slate-300/60 dark:bg-slate-800/70 animate-pulse" />
              <div className="w-10 h-10 rounded-xl bg-slate-300/60 dark:bg-slate-800/70 animate-pulse" />
              <div className="w-10 h-10 rounded-xl bg-slate-300/60 dark:bg-slate-800/70 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Recommended Streams Grid Skeleton */}
        <div className="space-y-4 pt-4 border-t border-slate-200/60 dark:border-white/[0.08]">
          <div className="w-44 h-5 rounded-md bg-slate-300/70 dark:bg-slate-800/80 animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={`watch-rec-skel-${i}`} className="relative flex flex-col rounded-2xl glass-card overflow-hidden border border-slate-200/60 dark:border-white/[0.08]">
                <div className="relative aspect-video w-full bg-slate-200/80 dark:bg-slate-900/80">
                  <div className="shimmer-wave" />
                </div>
                <div className="p-3 space-y-2">
                  <div className="w-16 h-2.5 rounded bg-slate-300/70 dark:bg-slate-800/80" />
                  <div className="w-full h-3 rounded bg-slate-300/80 dark:bg-slate-800/90" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const rating = video.rating || null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-4 space-y-6">
      {/* Cinema Mode Dimmer Overlay */}
      {isCinemaMode && (
        <div
          onClick={() => setIsCinemaMode(false)}
          className="fixed inset-0 z-40 bg-black/95 backdrop-blur-md cursor-pointer flex items-start justify-center pt-6"
        >
          <span className="px-4 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-bold shadow-2xl">
            Click anywhere to turn lights back on
          </span>
        </div>
      )}

      {/* Top Utility Controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-button text-xs font-bold"
        >
          <i className="ri-arrow-left-line not-italic text-sm"></i>
          <span>Back to Browse</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Cinema Lights Toggle */}
          <button
            onClick={() => setIsCinemaMode(!isCinemaMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              isCinemaMode
                ? 'bg-amber-500 text-black border-amber-400 font-bold'
                : 'glass-button'
            }`}
            title="Turn Off Lights"
          >
            <i className={`ri-lightbulb-${isCinemaMode ? 'fill' : 'line'} not-italic text-sm`}></i>
            <span className="hidden sm:inline">Lights</span>
          </button>

          {/* Theater Mode Toggle */}
          <button
            onClick={() => setIsTheaterMode(!isTheaterMode)}
            className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              isTheaterMode
                ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/30 font-bold'
                : 'glass-button'
            }`}
            title="Toggle Theater Mode"
          >
            <i className="ri-tv-line not-italic text-sm"></i>
            <span>Theater</span>
          </button>
        </div>
      </div>

      {/* Main Player & Stream Details Container */}
      <div className={`space-y-6 ${isCinemaMode ? 'relative z-50' : ''}`}>
        {/* Centered / Theater-aware Player Section */}
        <div className={`space-y-4 ${isTheaterMode ? 'w-full' : 'max-w-5xl mx-auto'}`}>
          {/* Player Container */}
          <VideoPlayer key={video.id} video={video} />

          {/* Video Title & Badges */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {video.quality && (
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-black/60 text-slate-200 border border-white/20 backdrop-blur-md shadow-sm">
                {video.quality}
              </span>
            )}
            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-500 border border-rose-500/20">
              {video.category}
            </span>
            <h1 className="text-base sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-snug w-full mt-1">
              {video.title}
            </h1>
          </div>

          {/* Action Bar & Stats */}
          <div className="flex flex-wrap items-center justify-between gap-3 py-3 border-y border-slate-200/80 dark:border-white/[0.08]">
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5 text-slate-800 dark:text-white font-bold">
                <i className="ri-eye-line not-italic text-rose-500/80 dark:text-rose-400/80 text-sm"></i>
                {(video.views || 0).toLocaleString()} views
              </span>
              <span>•</span>
              <span className="text-emerald-500 dark:text-emerald-400 font-extrabold flex items-center gap-1">
                <i className="ri-thumb-up-fill not-italic text-xs"></i>
                {rating}% Rating
              </span>
            </div>

            {/* Action Buttons (Frosted glass pills with 44px+ touch targets) */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleLike}
                className={`flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-full text-xs font-bold active:scale-95 transition-all ${
                  isLiked
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'glass-button'
                }`}
                aria-label="Like video"
              >
                <i className="ri-thumb-up-fill not-italic text-sm"></i>
                <span>{likeCount}</span>
              </button>

              <button
                onClick={() => onBookmarkToggle(video.id)}
                className={`flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-full text-xs font-bold active:scale-95 transition-all ${
                  isBookmarked(video.id)
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'glass-button'
                }`}
                aria-label="Bookmark video"
              >
                <i className={`ri-bookmark-${isBookmarked(video.id) ? 'fill' : 'line'} not-italic text-sm`}></i>
                <span>
                  {isBookmarked(video.id) ? 'Saved' : 'Save'}
                </span>
              </button>

              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-full glass-button text-xs font-bold active:scale-95 transition-all"
                aria-label="Share video link"
              >
                <i className={`${copied ? 'ri-check-line text-emerald-500' : 'ri-share-forward-line'} not-italic text-sm`}></i>
                <span>{copied ? 'Copied!' : 'Share'}</span>
              </button>

              {/* Direct Platform Fallback (Bypasses Safari 3rd-party cookie restrictions) */}
              {video.embed_url && (video.embed_url.includes('youtube.com') || video.embed_url.includes('instagram.com') || video.embed_url.includes('facebook.com')) && (
                <a
                  href={
                    video.embed_url.includes('youtube.com/embed/')
                      ? video.embed_url.replace('/embed/', '/watch?v=').split('?')[0]
                      : video.embed_url.includes('facebook.com')
                      ? decodeURIComponent(video.embed_url.split('href=')[1]?.split('&')[0] || video.embed_url)
                      : video.embed_url.replace('/embed/', '/')
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-full glass-button text-xs font-bold text-rose-400 hover:text-rose-300 border border-rose-500/30 hover:border-rose-500/60 active:scale-95 transition-all"
                  title="Watch original on platform"
                >
                  <i className={
                    video.embed_url.includes('youtube')
                      ? 'ri-youtube-fill text-rose-500 text-sm'
                      : video.embed_url.includes('instagram')
                      ? 'ri-instagram-line text-pink-500 text-sm'
                      : 'ri-facebook-circle-fill text-blue-500 text-sm'
                  }></i>
                  <span className="hidden sm:inline">
                    {video.embed_url.includes('youtube') ? 'YouTube' : video.embed_url.includes('instagram') ? 'Instagram' : 'Facebook'}
                  </span>
                  <i className="ri-external-link-line not-italic text-[10px] text-slate-400"></i>
                </a>
              )}

              <button
                onClick={() => setIsReportModalOpen(true)}
                className="w-11 h-11 flex items-center justify-center rounded-full glass-button text-slate-400 hover:text-rose-500 active:scale-95 transition-all"
                title="Report Issue / Broken Stream"
                aria-label="Report issue"
              >
                <i className="ri-flag-line not-italic text-sm"></i>
              </button>
            </div>
          </div>

          {/* Satisfaction Ratio Bar (Rendered only when real rating exists) */}
          {rating && (
            <div className="w-full bg-slate-200 dark:bg-white/[0.08] h-1.5 rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${rating}%` }}
              />
              <div
                className="bg-rose-500 h-full transition-all duration-500"
                style={{ width: `${100 - rating}%` }}
              />
            </div>
          )}

          {/* Ad Slot 4: Below-Player High CTR Banner (Centered with explicit max-width) */}
          <div className="adcast-inline-placement w-full min-w-0 my-6 sm:my-8 flex justify-center">
            <AdSlot key={video.id} slotId="slot_below_player" className="rounded-2xl" />
          </div>

          {/* Video SEO Synopsis, Tags & Compliance */}
          <div className="p-5 sm:p-6 rounded-2xl glass-panel space-y-4 border border-slate-200/80 dark:border-white/[0.08]">
            {/* Header with Title and Category Pill */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 dark:border-white/[0.06] pb-3">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <i className="ri-information-fill not-italic text-rose-500 text-base"></i>
                About This Stream
              </h3>
              <div className="flex items-center gap-1.5">
                {video.quality && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-500 border border-rose-500/20">
                    {video.quality}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-white/10">
                  {video.category || 'Trending'}
                </span>
              </div>
            </div>

            {/* Dynamic Rich SEO Synopsis */}
            <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
              <p>
                Watch <strong className="text-slate-900 dark:text-white font-semibold">{video.title}</strong> in crisp{' '}
                <span className="text-rose-500 font-semibold">{video.quality || '1080p Full HD'}</span>. Streaming directly from the{' '}
                <span className="font-semibold text-slate-900 dark:text-white">{video.category || 'Exclusive'}</span> collection on HornyLeaks.
                {video.duration ? ` Duration: ${video.duration}.` : ''} High-speed, buffer-free playback optimized for both mobile and desktop screens.
              </p>
              {video.description && video.description.length > 20 && !video.description.includes('Indexed from') && (
                <p className="text-slate-600 dark:text-slate-400 italic">
                  {video.description}
                </p>
              )}
            </div>

            {/* Clickable SEO Keyword Tags */}
            {video.tags && video.tags.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Related Topics & Search Tags
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {video.tags.map((tag) => (
                    <a
                      key={tag}
                      href={`/?search=${encodeURIComponent(tag)}`}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                        e.preventDefault();
                        if (typeof onTagClick === 'function') {
                          onTagClick(tag);
                        } else if (typeof onBack === 'function') {
                          window.location.href = `/?search=${encodeURIComponent(tag)}`;
                        }
                      }}
                      className="px-3 py-1 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-white/[0.05] hover:bg-rose-500/10 hover:border-rose-500/30 text-slate-700 dark:text-slate-300 hover:text-rose-500 dark:hover:text-rose-400 border border-slate-200/80 dark:border-white/[0.08] transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-xs"
                      title={`Explore all streams tagged with #${tag}`}
                    >
                      <span className="text-rose-500 font-bold">#</span>
                      <span>{tag}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Safe Harbor Legal Disclaimer */}
            <div className="pt-2 border-t border-slate-200/60 dark:border-white/[0.06] text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-between gap-2">
              <p>
                Indexed from public external networks. HornyLeaks does not host or store media files on its servers.
              </p>
              <button
                type="button"
                onClick={() => onOpenDMCA && onOpenDMCA(video.id)}
                className="shrink-0 text-slate-400 hover:text-rose-500 underline transition-colors"
              >
                DMCA / Notice
              </button>
            </div>
          </div>
        </div>

        {/* Recommended Streams Grid (Full-Width directly underneath player & details) */}
        <div className="min-w-0 w-full space-y-4 pt-6 border-t border-slate-200/80 dark:border-white/[0.08]">
          <div className="min-w-0 w-full flex flex-col gap-3">
            <div className="min-w-0 flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
                <i className="ri-sparkling-fill not-italic text-rose-500 text-sm"></i>
                Recommended Streams
              </h3>
              <span className="text-[10px] font-sans font-bold tabular-nums text-rose-500 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-full inline-flex items-center">
                {relatedVideos.length} streams
              </span>
            </div>

            {/* Equal-sized controls: two columns on phones, one row on larger screens. */}
            <div role="group" aria-label="Recommendation filters" className="min-w-0 w-full md:max-w-2xl grid grid-cols-2 md:grid-cols-4 auto-rows-fr gap-2 pt-1">
              {(() => {
                const categoryIcon =
                  video.category === 'Movies'
                    ? 'ri-film-fill'
                    : video.category === 'Hardcore'
                    ? 'ri-flashlight-fill'
                    : video.category === 'Indian Leaks'
                    ? 'ri-flag-fill'
                    : video.category === 'Creator Leaks'
                    ? 'ri-shield-star-fill'
                    : video.category === 'Amateur'
                    ? 'ri-camera-lens-fill'
                    : 'ri-fire-fill';

                return [
                  { id: 'smart', label: 'All Related', icon: 'ri-magic-line' },
                  { id: 'views', label: 'Most Viewed', icon: 'ri-fire-fill' },
                  { id: 'category', label: 'Same Category', description: `More in ${video.category || 'this category'}`, icon: categoryIcon },
                  { id: 'newest', label: 'Newest', icon: 'ri-flashlight-line' }
                ];
              })().map((tab) => {
                const isActive = recommendationMode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={isActive}
                    title={tab.description || tab.label}
                    onClick={() => setRecommendationMode(tab.id)}
                    className={`min-w-0 w-full min-h-[44px] h-full flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] sm:text-xs leading-snug font-bold whitespace-normal text-center transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#08090D] ${
                      isActive
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'glass-button text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <i aria-hidden="true" className={`${tab.icon} shrink-0 not-italic text-xs`}></i>
                    <span className="min-w-0 break-words">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stream List Grid */}
          {relatedVideos.length === 0 ? (
            <div className="p-10 text-center rounded-2xl glass-card space-y-2">
              <i className="ri-film-line not-italic text-3xl text-slate-400 mb-1 block"></i>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No related streams in this filter</p>
              <button
                onClick={() => setRecommendationMode('smart')}
                className="mt-2 text-xs font-bold text-rose-500 hover:underline"
              >
                Reset to All Related
              </button>
            </div>
          ) : (
            <div className="relative grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {relatedVideos.map((item, index) => {
                const showNativeAd = showRecommendationAdAfter(index, relatedVideos.length);

                return (
                  <React.Fragment key={item.id}>
                    <VideoCard
                      video={item}
                      onSelect={onSelectVideo}
                      onBookmarkToggle={onBookmarkToggle}
                      isBookmarked={typeof isBookmarked === 'function' ? isBookmarked(item.id) : false}
                    />
                    {showNativeAd && (
                      <AdSlot
                        key={`${video.id}-native-${item.id}`}
                        slotId="slot_native_feed"
                        className="col-span-1"
                        devBadge={false}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Report Broken Stream / Notice Modal (UX15) */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#121526] rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="ri-flag-fill not-italic text-rose-500 text-lg"></i>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Report Video Stream</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsReportModalOpen(false);
                  setReportSubmitted(false);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white"
              >
                <i className="ri-close-line not-italic text-lg"></i>
              </button>
            </div>

            {reportSubmitted ? (
              <div className="text-center py-6 space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto text-2xl">
                  <i className="ri-check-line not-italic"></i>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Report Received</h4>
                <p className="text-xs text-slate-400">
                  Thank you. This stream has been logged for health verification and automated crawler review.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsReportModalOpen(false);
                    setReportSubmitted(false);
                  }}
                  className="mt-4 px-5 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">
                  Select the issue you encountered with <span className="text-slate-900 dark:text-white font-semibold">"{video.title}"</span>:
                </p>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        if (api.quarantineVideo) {
                          await api.quarantineVideo(video.id, 'user_report_broken_playback');
                        }
                      } catch (e) {}
                      setReportSubmitted(true);
                    }}
                    className="w-full p-3 rounded-xl bg-slate-100 dark:bg-white/[0.04] hover:bg-slate-200 dark:hover:bg-white/[0.08] text-left transition-colors flex items-center gap-3 group"
                  >
                    <i className="ri-error-warning-line not-italic text-rose-500 text-lg shrink-0"></i>
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-rose-500">
                        Stream Broken / Not Playing
                      </div>
                      <div className="text-[11px] text-slate-400">Video source returned 404, black screen, or playback error.</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReportSubmitted(true);
                    }}
                    className="w-full p-3 rounded-xl bg-slate-100 dark:bg-white/[0.04] hover:bg-slate-200 dark:hover:bg-white/[0.08] text-left transition-colors flex items-center gap-3 group"
                  >
                    <i className="ri-price-tag-3-line not-italic text-amber-500 text-lg shrink-0"></i>
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-amber-500">
                        Misleading Title or Category
                      </div>
                      <div className="text-[11px] text-slate-400">Content does not match thumbnail, tags, or description.</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsReportModalOpen(false);
                      onOpenDMCA(video.id);
                    }}
                    className="w-full p-3 rounded-xl bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/20 text-left transition-colors flex items-center gap-3 group"
                  >
                    <i className="ri-shield-keyhole-line not-italic text-rose-400 text-lg shrink-0"></i>
                    <div>
                      <div className="text-xs font-bold text-rose-500">
                        Copyright / DMCA Takedown Notice
                      </div>
                      <div className="text-[11px] text-slate-400">Legal intellectual property claim and formal removal notice.</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
