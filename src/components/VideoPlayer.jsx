import React, { useState, useEffect, useRef } from 'react';
import { store, parseToEmbedUrl } from '../services/store';
import { resolveVastAd } from '../utils/vast';

export default function VideoPlayer({ video, onEnded }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPreRoll, setShowPreRoll] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [canSkip, setCanSkip] = useState(false);
  const [adData, setAdData] = useState(null);
  const [isLoadingAd, setIsLoadingAd] = useState(false);
  const videoRef = useRef(null);
  const firedTrackingRef = useRef(new Set());

  const adSettings = store.getAdSettings();
  const preRollSlot = adSettings['slot_video_preroll'];
  const hasPreRoll = preRollSlot && preRollSlot.isActive;

  const rawUrl = video?.embed_url || '';
  const resolvedEmbedUrl = parseToEmbedUrl(rawUrl);

  const isDirectVideo = (url) => {
    if (!url) return false;
    return url.endsWith('.mp4') || url.endsWith('.m3u8') || url.endsWith('.webm') || url.includes('.mp4?');
  };

  const fireTrackingEvents = (eventKey) => {
    if (!adData?.trackingEvents || !adData.trackingEvents[eventKey]) return;
    if (firedTrackingRef.current.has(eventKey)) return;
    firedTrackingRef.current.add(eventKey);

    adData.trackingEvents[eventKey].forEach((url) => {
      try {
        const img = new Image();
        img.src = url;
      } catch {}
    });
  };

  useEffect(() => {
    setIsPlaying(false);
    setShowPreRoll(false);
    setAdData(null);
    setCountdown(5);
    setCanSkip(false);
    setIsLoadingAd(false);
    firedTrackingRef.current.clear();
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

  const handleStartPlay = async () => {
    if (video) {
      store.addToHistory(video);
    }

    if (hasPreRoll && preRollSlot?.vastUrl) {
      setIsLoadingAd(true);
      const vastResult = await resolveVastAd(preRollSlot.vastUrl);
      setIsLoadingAd(false);

      if (vastResult?.mediaUrl) {
        // Fire VAST impression beacons
        if (vastResult.impressionUrls && Array.isArray(vastResult.impressionUrls)) {
          vastResult.impressionUrls.forEach((url) => {
            try {
              const beacon = new Image();
              beacon.src = url;
            } catch {}
          });
        } else if (vastResult.impressionUrl) {
          try {
            const beacon = new Image();
            beacon.src = vastResult.impressionUrl;
          } catch {}
        }

        firedTrackingRef.current.clear();
        setAdData(vastResult);
        setShowPreRoll(true);
        setCountdown(5);
        setCanSkip(false);
        setIsPlaying(true);
        return;
      }
    }

    // If no ad returned (e.g. frequency capped or no-bid), start user video immediately
    setShowPreRoll(false);
    setIsPlaying(true);
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
    if (adData?.clickTrackingUrls && Array.isArray(adData.clickTrackingUrls)) {
      adData.clickTrackingUrls.forEach((url) => {
        try {
          const img = new Image();
          img.src = url;
        } catch {}
      });
    }
    const dest = adData?.clickUrl || preRollSlot?.targetUrl || 'https://s.magsrv.com/v1/vast.php?idz=6091580';
    if (dest) {
      window.open(dest, '_blank', 'noopener,noreferrer');
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

      {/* 2. Loading State while resolving stream/VAST */}
      {isLoadingAd && (
        <div className="absolute inset-0 z-30 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 border-3 border-rose-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-slate-300 tracking-wide">Starting video stream...</span>
        </div>
      )}

      {/* 3. Real In-Stream Video Ad (VAST MP4) */}
      {isPlaying && showPreRoll && adData?.mediaUrl && (
        <div className="absolute inset-0 z-30 bg-black flex items-center justify-center overflow-hidden">
          <video
            src={adData.mediaUrl}
            autoPlay
            playsInline
            onPlay={() => fireTrackingEvents('start')}
            onTimeUpdate={(e) => {
              const el = e.currentTarget;
              if (!el.duration) return;
              const progress = el.currentTime / el.duration;
              if (progress >= 0.25) fireTrackingEvents('firstQuartile');
              if (progress >= 0.50) fireTrackingEvents('midpoint');
              if (progress >= 0.75) fireTrackingEvents('thirdQuartile');
            }}
            onEnded={() => {
              fireTrackingEvents('complete');
              setShowPreRoll(false);
            }}
            className="w-full h-full object-contain cursor-pointer"
            onClick={handleAdClick}
          />

          {/* Top-Left Sponsor Badge */}
          <div className="absolute top-4 left-4 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-xs font-bold text-white shadow-lg pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span>Ad • {countdown > 0 ? `Skip in ${countdown}s` : 'Video Sponsor'}</span>
          </div>

          {/* Bottom-Left Visit Sponsor Link */}
          <div className="absolute bottom-4 left-4 z-40">
            <button
              onClick={handleAdClick}
              className="flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-full bg-black/85 hover:bg-black backdrop-blur-md border border-white/20 text-white text-xs font-bold transition-all shadow-xl active:scale-95 cursor-pointer"
            >
              Visit Sponsor <i className="ri-external-link-line not-italic text-xs"></i>
            </button>
          </div>

          {/* Bottom-Right Skip Button */}
          <div className="absolute bottom-4 right-4 z-40">
            <button
              onClick={handleSkipAd}
              disabled={!canSkip}
              className={`flex items-center gap-1.5 min-h-[44px] px-5 py-2.5 rounded-full text-xs font-bold transition-all active:scale-95 ${
                canSkip
                  ? 'bg-white text-black hover:bg-slate-200 cursor-pointer shadow-xl'
                  : 'bg-black/80 text-white/50 backdrop-blur-md border border-white/10 cursor-not-allowed'
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
