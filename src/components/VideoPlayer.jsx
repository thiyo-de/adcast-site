import React, { useState, useEffect, useRef } from 'react';
import { store, parseToEmbedUrl } from '../services/store';

export default function VideoPlayer({ video, onEnded }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPreRoll, setShowPreRoll] = useState(true);
  const [countdown, setCountdown] = useState(5);
  const [canSkip, setCanSkip] = useState(false);
  const videoRef = useRef(null);

  const adSettings = store.getAdSettings();
  const preRollSlot = adSettings['slot_video_preroll'];
  const hasPreRoll = preRollSlot && preRollSlot.isActive;

  const rawUrl = video?.embed_url || '';
  const resolvedEmbedUrl = parseToEmbedUrl(rawUrl);

  const isDirectVideo = (url) => {
    if (!url) return false;
    return url.endsWith('.mp4') || url.endsWith('.m3u8') || url.endsWith('.webm') || url.includes('.mp4?');
  };

  useEffect(() => {
    setIsPlaying(false);
    setShowPreRoll(hasPreRoll);
    setCountdown(preRollSlot?.durationSeconds || 5);
    setCanSkip(false);
  }, [video?.id]);

  useEffect(() => {
    let timer;
    if (isPlaying && showPreRoll && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setCanSkip(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, showPreRoll, countdown]);

  const handleStartPlay = () => {
    setIsPlaying(true);
    if (!hasPreRoll) {
      setShowPreRoll(false);
    }
    if (video) {
      store.addToHistory(video);
    }
  };

  // Desktop Power Controls (Keyboard Shortcuts)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        return;
      }

      // Space or K: Toggle Play/Pause
      if (e.code === 'Space' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        if (!isPlaying) {
          handleStartPlay();
        } else if (videoRef.current) {
          if (videoRef.current.paused) {
            videoRef.current.play();
          } else {
            videoRef.current.pause();
          }
        }
      }

      // F: Toggle Fullscreen
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        const playerContainer = videoRef.current?.parentElement || document.querySelector('.aspect-video');
        if (playerContainer) {
          if (!document.fullscreenElement) {
            playerContainer.requestFullscreen?.().catch(() => {});
          } else {
            document.exitFullscreen?.().catch(() => {});
          }
        }
      }

      // M: Toggle Mute
      if (e.key === 'm' || e.key === 'M') {
        if (videoRef.current) {
          videoRef.current.muted = !videoRef.current.muted;
        }
      }

      // Left Arrow: Seek back 10s
      if (e.code === 'ArrowLeft') {
        if (videoRef.current) {
          e.preventDefault();
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
        }
      }

      // Right Arrow: Seek forward 10s
      if (e.code === 'ArrowRight') {
        if (videoRef.current) {
          e.preventDefault();
          videoRef.current.currentTime = Math.min(videoRef.current.duration || 9999, videoRef.current.currentTime + 10);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, video?.id]);

  const handleSkipAd = () => {
    setShowPreRoll(false);
  };

  const handleAdClick = () => {
    if (preRollSlot?.targetUrl) {
      window.open(preRollSlot.targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (!video) return null;

  return (
    <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-slate-200/80 dark:border-white/10 shadow-2xl group select-none">
      {/* 1. Initial Poster State (Cinematic 16:9) */}
      {!isPlaying && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-cover bg-center cursor-pointer group"
          style={{ backgroundImage: `url(${video.thumbnail_url})` }}
          onClick={handleStartPlay}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] transition-all duration-300 group-hover:bg-black/40" />

          {/* Centered Play Button (44px+ touch-safe) */}
          <button
            className="relative z-10 flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-xl shadow-rose-600/30 transform transition-all duration-300 group-hover:scale-110 active:scale-95 cursor-pointer"
            aria-label="Play video"
          >
            <i className="ri-play-fill not-italic text-3xl sm:text-4xl ml-1"></i>
          </button>

          {/* Top-Left Quality Badge */}
          <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5">
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-500 text-black shadow-md">
              {video.quality || '4K UHD'}
            </span>
          </div>

          {/* Bottom Badges */}
          <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/80 backdrop-blur-md border border-white/10 text-xs font-bold text-white shadow-md">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>{video.category || 'Stream'}</span>
          </div>

          <div className="absolute bottom-4 right-4 z-10 px-2.5 py-1 rounded-lg bg-black/85 backdrop-blur-md border border-white/10 text-xs font-mono font-bold text-white shadow-md">
            {video.duration || 'HD'}
          </div>
        </div>
      )}

      {/* 2. Pre-Roll Video Ad Overlay (ExoClick VAST) */}
      {isPlaying && showPreRoll && (
        <div className="absolute inset-0 z-30 flex flex-col justify-between p-4 sm:p-6 bg-gradient-to-t from-black via-slate-950 to-black/90">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/80 border border-rose-500/30 text-rose-400 text-xs font-bold tracking-wider uppercase">
              <i className="ri-shield-star-line not-italic text-sm"></i>
              Sponsor Message
            </div>

            <div className="text-xs text-slate-400 font-mono">
              Video starts in: <span className="text-white font-bold text-sm">{countdown}s</span>
            </div>
          </div>

          <div className="my-auto text-center max-w-md mx-auto cursor-pointer" onClick={handleAdClick}>
            <div className="inline-flex items-center gap-1 px-3 py-1 mb-3 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
              <i className="ri-sparkling-fill not-italic text-xs"></i> Featured Sponsor
            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-white mb-2 leading-snug">
              {preRollSlot?.adTitle || 'Ultra-Fast High Definition Streaming'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 mb-4 line-clamp-2">
              {preRollSlot?.adDescription || 'Unlimited access to thousands of daily curated streams worldwide.'}
            </p>
            <button className="inline-flex items-center gap-1.5 min-h-[44px] px-6 py-2.5 rounded-full bg-gradient-to-r from-rose-600 to-rose-500 text-white text-xs font-bold shadow-lg hover:scale-105 active:scale-95 transition-all">
              Visit Sponsor <i className="ri-external-link-line not-italic text-xs"></i>
            </button>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-white/10">
            <div className="text-[11px] text-slate-400 font-medium">
              ✦ SPONSORED • Powered by <strong className="text-slate-200">ExoClick VAST</strong>
            </div>

            {/* 44px Skip Ad Button */}
            <button
              onClick={handleSkipAd}
              disabled={!canSkip}
              className={`flex items-center gap-1.5 min-h-[44px] px-5 py-2.5 rounded-full text-xs font-bold transition-all active:scale-95 ${
                canSkip
                  ? 'bg-white text-black hover:bg-slate-200 cursor-pointer shadow-xl'
                  : 'bg-white/10 text-white/50 backdrop-blur-md border border-white/10 cursor-not-allowed'
              }`}
              aria-label={canSkip ? 'Skip ad now' : `Skip ad in ${countdown} seconds`}
            >
              <i className="ri-skip-forward-fill not-italic text-sm"></i>
              <span>{canSkip ? 'Skip Ad' : `Skip in ${countdown}s`}</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Actual Video Playback (Optimized for Mobile) */}
      {isPlaying && !showPreRoll && (
        <>
          {isDirectVideo(resolvedEmbedUrl) ? (
            <video
              ref={videoRef}
              src={resolvedEmbedUrl}
              controls
              autoPlay
              playsInline
              webkit-playsinline="true"
              preload="metadata"
              onEnded={onEnded}
              className="w-full h-full object-contain bg-black"
            />
          ) : (
            <iframe
              src={resolvedEmbedUrl}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full border-0 bg-black"
              sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-popups"
            />
          )}
        </>
      )}
    </div>
  );
}
