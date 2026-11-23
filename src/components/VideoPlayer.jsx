import React, { useState, useEffect, useRef } from 'react';
import { store, useAdSettings, parseToEmbedUrl } from '../services/store';
import { useAdBlock } from '../services/adBlockContext';
import { resolveVastAd, vastSkipSeconds } from '../utils/vast';

export default function VideoPlayer({ video, onEnded }) {
  const { verifyBeforePlayback, recheck } = useAdBlock();
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPreRoll, setShowPreRoll] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const canSkip = countdown === 0;
  const [adData, setAdData] = useState(null);
  const [isAdMuted, setIsAdMuted] = useState(false);
  const [isAdAutoplayRefused, setIsAdAutoplayRefused] = useState(false);
  const [isLoadingAd, setIsLoadingAd] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const videoRef = useRef(null);
  const adVideoRef = useRef(null);
  const prefetchedAdRef = useRef(null);
  const prerollCooldownRecordedRef = useRef(false);
  const firedTrackingRef = useRef(new Set());
  const firedImpressionRef = useRef(false);

  const adSettings = useAdSettings();
  const preRollSlot = adSettings['slot_video_preroll'];
  const hasPreRoll = preRollSlot && preRollSlot.isActive;

  const [directStreamUrl, setDirectStreamUrl] = useState('');
  const [isResolvingStream, setIsResolvingStream] = useState(false);

  const rawUrl = video?.stream_url || video?.embed_url || '';
  const resolvedEmbedUrl = parseToEmbedUrl(rawUrl);

  // Dynamically resolve MyDesi and HornyLeaks into direct streams / clean embed players
  useEffect(() => {
    let isMounted = true;
    if (
      rawUrl &&
      (rawUrl.includes('mydesi.fun') ||
        rawUrl.includes('hornyleak.tv/embed/'))
    ) {
      setIsResolvingStream(true);
      const endpoint =
        typeof window !== 'undefined' && window.location.hostname !== 'localhost'
          ? `/.netlify/functions/resolve-stream?url=${encodeURIComponent(rawUrl)}`
          : `/api/resolve-stream?url=${encodeURIComponent(rawUrl)}`;
      fetch(endpoint)
        .then((res) => res.json())
        .then((data) => {
          if (isMounted && data?.ok) {
            if (data.streamUrl) {
              setDirectStreamUrl(data.streamUrl);
            } else if (data.embedUrl) {
              setDirectStreamUrl(data.embedUrl);
            }
          }
        })
        .catch((err) => console.warn('Stream resolution fallback:', err))
        .finally(() => {
          if (isMounted) setIsResolvingStream(false);
        });
    } else {
      setDirectStreamUrl('');
      setIsResolvingStream(false);
    }
    return () => {
      isMounted = false;
    };
  }, [rawUrl]);

  const activeMediaUrl = directStreamUrl || resolvedEmbedUrl;

  const recordAdDiagnostic = (code, message) => {
    if (typeof window !== 'undefined') {
      window.__adDiagnostics = {
        lastEvent: code,
        message,
        timestamp: new Date().toISOString()
      };
    }
  };

  const isDirectVideo = (url) => {
    if (!url) return false;
    return (
      url.endsWith('.mp4') ||
      url.endsWith('.m3u8') ||
      url.endsWith('.webm') ||
      url.includes('.mp4?') ||
      url.includes('stream=1') ||
      url.includes('fastbytes.xyz') ||
      url.includes('vidserv.cc')
    );
  };

  const fireImpressionBeacons = () => {
    if (firedImpressionRef.current || !adData) return;
    firedImpressionRef.current = true;

    if (adData.impressionUrls && Array.isArray(adData.impressionUrls)) {
      adData.impressionUrls.forEach((url) => {
        try {
          const beacon = new Image();
          beacon.src = url;
        } catch {}
      });
    } else if (adData.impressionUrl) {
      try {
        const beacon = new Image();
        beacon.src = adData.impressionUrl;
      } catch {}
    }
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
    setIsAdMuted(false);
    setIsAdAutoplayRefused(false);
    setCountdown(null);
    setIsLoadingAd(false);
    setPlaybackError(false);
    prerollCooldownRecordedRef.current = false;
    firedTrackingRef.current.clear();
    firedImpressionRef.current = false;
  }, [video?.id]);

  // Pre-fetch VAST ad on mount/video change if 5-minute cooldown has passed
  useEffect(() => {
    const lastPreRoll = parseInt(localStorage.getItem('adcast_last_preroll') || '0', 10);
    const cooldownMinutes = typeof preRollSlot?.frequencyMinutes === 'number' ? preRollSlot.frequencyMinutes : 0;
    const cooldownMs = cooldownMinutes * 60 * 1000;
    const isCooldownActive = cooldownMs > 0 && (Date.now() - lastPreRoll < cooldownMs);

    if (hasPreRoll && preRollSlot?.vastUrl && !isCooldownActive) {
      prefetchedAdRef.current = resolveVastAd(preRollSlot.vastUrl);
    }

    return () => {
      prefetchedAdRef.current = null;
    };
  }, [video?.id, hasPreRoll, preRollSlot?.vastUrl, preRollSlot?.frequencyMinutes]);

  // Mobile WebKit Autoplay Policy Recovery: if unmuted autoplay is rejected, fall back to muted autoplay, then prompt manual play
  useEffect(() => {
    if (showPreRoll && adVideoRef.current) {
      const playPromise = adVideoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Unmuted ad autoplay blocked by mobile policy, switching to muted autoplay:', err);
          setIsAdMuted(true);
          if (adVideoRef.current) {
            adVideoRef.current.muted = true;
            adVideoRef.current.play().catch((finalErr) => {
              console.warn('Muted ad playback failed, prompting manual play overlay:', finalErr);
              setIsAdAutoplayRefused(true);
            });
          }
        });
      }
    }
  }, [showPreRoll]);

  const handleStartPlay = async () => {
    if (video) {
      store.addToHistory(video);
    }

    // Pre-playback verification: confirm AdBlock hasn't been re-enabled before starting
    if (typeof verifyBeforePlayback === 'function') {
      const isAllowed = await verifyBeforePlayback();
      if (!isAllowed) {
        return;
      }
    }

    // Run pre-roll with configurable frequency cooldown (0 = every video)
    const now = Date.now();
    const lastPreRoll = parseInt(localStorage.getItem('adcast_last_preroll') || '0', 10);
    const cooldownMinutes = typeof preRollSlot?.frequencyMinutes === 'number' ? preRollSlot.frequencyMinutes : 0;
    const cooldownMs = cooldownMinutes * 60 * 1000;
    const isCooldownActive = cooldownMs > 0 && (now - lastPreRoll < cooldownMs);

    if (hasPreRoll && preRollSlot?.vastUrl && !isCooldownActive) {
      setIsLoadingAd(true);
      prefetchedAdRef.current ??= resolveVastAd(preRollSlot.vastUrl);
      const vastResult = await prefetchedAdRef.current;
      setIsLoadingAd(false);

      if (vastResult?.mediaUrl) {
        prefetchedAdRef.current = null;
        prerollCooldownRecordedRef.current = false;
        firedTrackingRef.current.clear();
        firedImpressionRef.current = false;
        setAdData(vastResult);
        setShowPreRoll(true);
        setCountdown(null);
        setIsPlaying(true);
        return;
      } else {
        recordAdDiagnostic(
          vastResult?.errorCode || 'NO_FILL',
          vastResult?.errorMessage || 'No video creative available from ad provider'
        );
        // If VAST failed due to network error while online, re-verify ad blocker status
        if (vastResult?.errorCode === 'NETWORK_ERROR' && typeof recheck === 'function' && navigator.onLine) {
          recheck();
        }
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
    if (!canSkip) return;
    fireTrackingEvents('skip');
    adVideoRef.current?.pause();
    setShowPreRoll(false);
  };

  function updateSkipTime(media) {
    const offsets = adData?.skipOffsets || [];
    const seconds = offsets.map(offset => vastSkipSeconds(offset, media.duration));
    const available = seconds.length > 0 && seconds.every(value => value !== null);
    setCountdown(available ? Math.max(0, Math.ceil(Math.max(...seconds) - media.currentTime)) : null);
  }

  const handleAdClick = () => {
    const dest = adData?.clickUrl;
    if (!/^https?:\/\//i.test(dest || '')) return;
    if (adData?.clickTrackingUrls && Array.isArray(adData.clickTrackingUrls)) {
      adData.clickTrackingUrls.forEach((url) => {
        try {
          const img = new Image();
          img.src = url;
        } catch {}
      });
    }
    window.open(dest, '_blank', 'noopener,noreferrer');
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

          {/* Top-Left Quality Badge (Render only when factual quality data exists - UX01) */}
          {video.quality && (
            <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5">
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-500 text-black shadow-md">
                {video.quality}
              </span>
            </div>
          )}

          {/* Bottom Badges */}
          <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/80 backdrop-blur-md border border-white/10 text-xs font-bold text-white shadow-md">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>{video.category || 'Stream'}</span>
          </div>

          <div className="absolute bottom-4 right-4 z-10 px-2.5 py-1 rounded-lg bg-black/85 backdrop-blur-md border border-white/10 text-xs font-sans font-bold tabular-nums tracking-tight text-white shadow-md">
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
            ref={adVideoRef}
            src={adData.mediaUrl}
            autoPlay
            playsInline
            webkit-playsinline="true"
            muted={isAdMuted}
            onLoadedMetadata={e => updateSkipTime(e.currentTarget)}
            onPlaying={() => {
              fireImpressionBeacons();
              fireTrackingEvents('start');
              setIsAdAutoplayRefused(false);

              // Confirmed playback: record cooldown only once per ad session (buffering does not duplicate)
              if (!prerollCooldownRecordedRef.current) {
                prerollCooldownRecordedRef.current = true;
                try {
                  localStorage.setItem('adcast_last_preroll', Date.now().toString());
                } catch (e) {
                  console.warn('Pre-roll cooldown write error:', e);
                }
              }
            }}
            onTimeUpdate={(e) => {
              const el = e.currentTarget;
              updateSkipTime(el);
              if (!el.duration) return;
              const progress = el.currentTime / el.duration;
              if (progress >= 0.25) fireTrackingEvents('firstQuartile');
              if (progress >= 0.50) fireTrackingEvents('midpoint');
              if (progress >= 0.75) fireTrackingEvents('thirdQuartile');
            }}
            onError={() => {
              console.warn('Preroll ad media playback failed, falling back to main video');
              recordAdDiagnostic('MEDIA_DECODE_ERROR', 'Preroll ad media failed to decode/play');
              setShowPreRoll(false);
            }}
            onEnded={() => {
              fireTrackingEvents('complete');
              setShowPreRoll(false);
            }}
            className="w-full h-full object-contain cursor-pointer"
            onClick={handleAdClick}
          />

          {/* Manual Play Overlay if mobile browser completely refused autoplay */}
          {isAdAutoplayRefused && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm p-4 text-center">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAdAutoplayRefused(false);
                  if (adVideoRef.current) {
                    adVideoRef.current.play().catch(() => {
                      recordAdDiagnostic('MEDIA_DECODE_ERROR', 'Manual ad playback failed on mobile device');
                      setShowPreRoll(false);
                    });
                  }
                }}
                className="flex items-center gap-2 px-6 py-3.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-2xl active:scale-95 cursor-pointer"
                aria-label="Play video ad"
              >
                <i className="ri-play-fill not-italic text-2xl ml-0.5"></i>
                <span>Tap to Play Ad</span>
              </button>
            </div>
          )}

          {/* Top-Left Sponsor Badge */}
          <div className="absolute top-4 left-4 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-xs font-bold text-white shadow-lg pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span>Ad • {countdown > 0 ? `Skip in ${countdown}s` : 'Video Sponsor'}</span>
          </div>

          {/* Top-Right Mute / Unmute Button (Mobile WebKit Autoplay Compliance) */}
          <div className="absolute top-4 right-4 z-40">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (adVideoRef.current) {
                  const nextMuted = !isAdMuted;
                  adVideoRef.current.muted = nextMuted;
                  setIsAdMuted(nextMuted);
                }
              }}
              className="flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 rounded-full bg-black/80 hover:bg-black backdrop-blur-md border border-white/20 text-white text-xs font-bold transition-all shadow-xl active:scale-95 cursor-pointer"
              aria-label={isAdMuted ? 'Unmute ad audio' : 'Mute ad audio'}
            >
              <i className={`${isAdMuted ? 'ri-volume-mute-fill text-rose-400' : 'ri-volume-up-fill text-emerald-400'} not-italic text-sm`}></i>
              <span>{isAdMuted ? 'Tap to Unmute' : 'Mute'}</span>
            </button>
          </div>

          {/* Bottom-Left Visit Sponsor Link */}
          {adData.clickUrl && <div className="absolute bottom-4 left-4 z-40">
            <button
              onClick={handleAdClick}
              className="flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-full bg-black/85 hover:bg-black backdrop-blur-md border border-white/20 text-white text-xs font-bold transition-all shadow-xl active:scale-95 cursor-pointer"
            >
              Visit Sponsor <i className="ri-external-link-line not-italic text-xs"></i>
            </button>
          </div>}

          {/* Bottom-Right Skip Button */}
          {countdown !== null && <div className="absolute bottom-4 right-4 z-40">
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
          </div>}
        </div>
      )}

      {/* 3. Actual Video Playback (Optimized for Mobile) */}
      {isPlaying && !showPreRoll && (
        <>
          {playbackError ? (
            <div className="absolute inset-0 z-30 bg-black/95 flex flex-col items-center justify-center p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center text-2xl">
                <i className="ri-error-warning-line not-italic"></i>
              </div>
              <h4 className="text-sm font-bold text-white">Stream Source Unavailable</h4>
              <p className="text-xs text-slate-400 max-w-sm">
                This media source could not be played or returned an error. The stream may be offline.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => {
                    setPlaybackError(false);
                    setDirectStreamUrl('');
                    setIsPlaying(true);
                  }}
                  className="px-4 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow active:scale-95 cursor-pointer"
                >
                  <i className="ri-refresh-line not-italic mr-1"></i> Retry
                </button>
              </div>
            </div>
          ) : isDirectVideo(activeMediaUrl) ? (
            <video
              ref={videoRef}
              src={activeMediaUrl}
              controls
              autoPlay
              playsInline
              webkit-playsinline="true"
              preload="metadata"
              referrerPolicy="no-referrer"
              onEnded={onEnded}
              onError={() => {
                // If direct stream fails (especially on mobile devices due to carrier/session restrictions),
                // automatically and silently switch to the clean iframe player instead of showing an error
                if (resolvedEmbedUrl && resolvedEmbedUrl !== activeMediaUrl) {
                  console.warn('Direct stream playback error, falling back to embed player:', resolvedEmbedUrl);
                  setDirectStreamUrl('');
                  setPlaybackError(false);
                } else {
                  setPlaybackError(true);
                }
              }}
              className="w-full h-full object-contain bg-black"
            />
          ) : (
            <iframe
              src={activeMediaUrl}
              title={video.title}
              scrolling="no"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full border-0 bg-black block overflow-hidden"
              style={{ overflow: 'hidden', border: 'none', display: 'block', width: '100%', height: '100%' }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-popups allow-popups-to-escape-sandbox"
            />
          )}
        </>
      )}
    </div>
  );
}
