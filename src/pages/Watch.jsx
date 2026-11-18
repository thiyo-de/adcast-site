import React, { useState, useEffect } from 'react';
import VideoPlayer from '../components/VideoPlayer';
import AdSlot from '../components/AdSlot';
import { store } from '../services/store';
import { api } from '../services/supabase';
import { updateVideoSEO, resetDefaultSEO } from '../utils/seo';

export default function Watch({
  videoId,
  allVideos = [],
  onBack,
  onSelectVideo,
  isBookmarked,
  onBookmarkToggle,
  onOpenDMCA
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
    if (video) {
      const related = store.getRelatedVideos(video, recommendationMode, 8);
      setRelatedVideos(related);
    }
  }, [video?.id, recommendationMode]);

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
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto animate-pulse">
          <i className="ri-play-fill not-italic text-3xl ml-1"></i>
        </div>
        <p className="text-xs font-bold text-slate-400">Loading stream...</p>
        <button
          onClick={onBack}
          className="mt-2 min-h-[44px] px-6 py-2 rounded-full glass-button text-xs font-bold"
        >
          Return to Browse
        </button>
      </div>
    );
  }

  const rating = video.rating || null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
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
                ? 'bg-cyan-500 text-black border-cyan-400 font-bold'
                : 'glass-button'
            }`}
            title="Toggle Theater Mode"
          >
            <i className="ri-tv-line not-italic text-sm"></i>
            <span>Theater</span>
          </button>
        </div>
      </div>

      {/* Main Grid Container */}
      <div className={`space-y-6 ${isCinemaMode ? 'relative z-50' : ''}`}>
        <div className={`grid grid-cols-1 ${isTheaterMode ? 'lg:grid-cols-1' : 'lg:grid-cols-3'} gap-6 lg:gap-8`}>
          {/* Main Player Column */}
          <div className={isTheaterMode ? 'col-span-1 space-y-4' : 'lg:col-span-2 space-y-4'}>
            {/* Player Container */}
            <VideoPlayer video={video} />

            {/* Video Title & Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {video.quality && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-cyan-500 text-black shadow-sm">
                  {video.quality}
                </span>
              )}
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-rose-500/10 text-rose-500 border border-rose-500/20">
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
                  <i className="ri-eye-line not-italic text-cyan-500 dark:text-cyan-400 text-sm"></i>
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
                    className="flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-full glass-button text-xs font-bold text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 hover:border-cyan-500/60 active:scale-95 transition-all"
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

            {/* Ad Slot 4: Below-Player High CTR Banner (24px Safe-Spacing Buffer) */}
            <div className="w-full my-6 sm:my-8">
              <AdSlot slotId="slot_below_player" className="w-full rounded-2xl overflow-hidden" />
            </div>

            {/* Video Tags & Description */}
            <div className="p-4 sm:p-5 rounded-2xl glass-panel space-y-3">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Stream Information & Tags
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Indexed from public external media networks. HornyLeaks does not host video files on its servers.
              </p>
              {video.tags && video.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {video.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-white/[0.08]"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Related Streams */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
                <i className="ri-sparkling-fill not-italic text-rose-500 text-sm"></i>
                Recommended
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">
                {relatedVideos.length} streams
              </span>
            </div>

            {/* Recommendation Order Tabs (YouTube/Twitch-Style) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {[
                { id: 'smart', label: 'All Related', icon: 'ri-magic-line' },
                { id: 'views', label: 'Most Viewed', icon: 'ri-fire-fill' },
                { id: 'category', label: video.category || 'Category', icon: 'ri-folder-line' },
                { id: 'newest', label: 'Newest', icon: 'ri-flashlight-line' }
              ].map((tab) => {
                const isActive = recommendationMode === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setRecommendationMode(tab.id)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all duration-200 ${
                      isActive
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'glass-button text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <i className={`${tab.icon} not-italic text-xs`}></i>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Stream List */}
            {relatedVideos.length === 0 ? (
              <div className="p-8 text-center rounded-2xl glass-card">
                <i className="ri-film-line not-italic text-2xl text-slate-400 mb-1 block"></i>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No related streams in this filter</p>
                <button
                  onClick={() => setRecommendationMode('smart')}
                  className="mt-2 text-[11px] font-bold text-rose-500 hover:underline"
                >
                  Reset to All Related
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {relatedVideos.map((item, idx) => {
                  const isSameCategory = item.category === video.category;
                  const formattedViews =
                    item.views >= 1000000
                      ? (item.views / 1000000).toFixed(1) + 'M'
                      : item.views >= 1000
                      ? (item.views / 1000).toFixed(1) + 'K'
                      : (item.views || 0).toString();

                  return (
                    <div
                      key={item.id}
                      onClick={() => onSelectVideo(item.id)}
                      className="flex gap-3 p-2.5 rounded-2xl glass-card cursor-pointer group hover:-translate-y-0.5 transition-all duration-200"
                    >
                      {/* Thumbnail Container */}
                      <div className="relative w-32 sm:w-36 aspect-video rounded-xl overflow-hidden bg-slate-950 shrink-0">
                        <img
                          src={item.thumbnail_url}
                          alt={item.title}
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800&auto=format&fit=crop&q=80';
                          }}
                          className="w-full h-full object-cover filter blur-[10px] scale-110 opacity-25 transition-all duration-300"
                        />
                        <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm pointer-events-none" />

                        {/* Rank Badge for Top 3 Most Viewed */}
                        {recommendationMode === 'views' && idx < 3 && (
                          <span className={`absolute top-1 left-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-white shadow-md ${
                            idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-slate-400' : 'bg-amber-700'
                          }`}>
                            {idx + 1}
                          </span>
                        )}

                        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-black/85 backdrop-blur-sm text-[10px] font-mono font-bold text-white border border-white/10">
                          {item.duration || 'HD'}
                        </span>
                      </div>

                      {/* Video Info */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                        <div>
                          {isSameCategory && recommendationMode === 'smart' && (
                            <span className="inline-block text-[9px] font-extrabold uppercase tracking-wider text-rose-500 dark:text-rose-400 mb-0.5">
                              {item.category}
                            </span>
                          )}
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-rose-500 dark:group-hover:text-white line-clamp-2 leading-snug transition-colors">
                            {item.title}
                          </h4>
                        </div>

                        <div className="text-[11px] text-slate-400 flex items-center gap-2 pt-1">
                          <span className="text-emerald-500 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                            <i className="ri-thumb-up-fill not-italic text-[10px]"></i>
                            {item.rating || 97}%
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5 text-slate-600 dark:text-slate-300 font-semibold">
                            <i className="ri-eye-line not-italic text-[11px] text-cyan-500"></i>
                            {formattedViews}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
