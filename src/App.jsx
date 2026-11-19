import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import AgeModal from './components/AgeModal';
import StickyFooter from './components/StickyFooter';
import PopunderTrigger from './components/PopunderTrigger';
import BookmarksDrawer from './components/BookmarksDrawer';
import Home from './pages/Home';
import Watch from './pages/Watch';
import Admin from './pages/Admin';
import DMCA from './pages/DMCA';
import Legal from './pages/Legal';
import { store } from './services/store';
import { api } from './services/supabase';

function parseRoute(pathname = window.location.pathname) {
  if (pathname.startsWith('/watch/')) {
    const id = pathname.replace('/watch/', '').split('/')[0].trim();
    return { view: 'watch', videoId: id || null };
  }
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return { view: 'admin', videoId: null };
  }
  if (pathname === '/dmca' || pathname.startsWith('/dmca/')) {
    return { view: 'dmca', videoId: null };
  }
  if (pathname === '/terms' || pathname.startsWith('/terms/')) {
    return { view: 'terms', videoId: null };
  }
  if (pathname === '/privacy' || pathname.startsWith('/privacy/')) {
    return { view: 'privacy', videoId: null };
  }
  return { view: 'home', videoId: null };
}

export default function App() {
  const [routeState, setRouteState] = useState(() => parseRoute());
  const currentView = routeState.view;
  const selectedVideoId = routeState.videoId;

  const [searchQuery, setSearchQuery] = useState('');
  const [videos, setVideos] = useState([]);
  const [bookmarks, setBookmarks] = useState(store.getBookmarks());
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [isDevMode, setIsDevMode] = useState(store.isDevMode());
  const lastHomeScrollY = useRef(0);

  const navigate = (view, videoId = null, replace = false) => {
    // Preserve scroll offset when leaving home (UX07)
    if (currentView === 'home' && view !== 'home') {
      lastHomeScrollY.current = window.scrollY;
    }

    let path = '/';
    if (view === 'watch' && videoId) {
      path = `/watch/${encodeURIComponent(videoId)}`;
    } else if (view === 'admin') {
      path = '/admin';
    } else if (view === 'dmca') {
      path = '/dmca';
    } else if (view === 'terms') {
      path = '/terms';
    } else if (view === 'privacy') {
      path = '/privacy';
    }

    if (window.location.pathname !== path) {
      if (replace) {
        window.history.replaceState({ view, videoId }, '', path);
      } else {
        window.history.pushState({ view, videoId }, '', path);
      }
    }

    setRouteState({ view, videoId });

    // Restore previous scroll position on returning to browse
    if (view === 'home' && lastHomeScrollY.current > 0) {
      setTimeout(() => {
        window.scrollTo({ top: lastHomeScrollY.current, behavior: 'instant' });
      }, 10);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSearchChange = (query) => {
    setSearchQuery(query);
    if (currentView !== 'home') {
      navigate('home');
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      setRouteState(parseRoute());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Dual Theme State (Dark / Light with System Preference Detection)
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('adcast_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      // Fallback to user's OS preference
      if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
      }
      return 'dark';
    } catch (e) {
      return 'dark';
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('adcast_theme', theme);
    } catch (e) {}
  }, [theme]);

  // Optional: Listen to system changes if user hasn't manually overridden yet
  useEffect(() => {
    try {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e) => {
        const manual = localStorage.getItem('adcast_theme');
        if (!manual) {
          setTheme(e.matches ? 'dark' : 'light');
        }
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } catch (e) {}
  }, []);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    loadVideos();
    loadAdSettings();
    const unsubscribeAds = api.subscribeToAdSettings((cloudAds) => {
      if (cloudAds) {
        store.saveAdSettings(cloudAds);
      }
    });
    return () => {
      if (typeof unsubscribeAds === 'function') unsubscribeAds();
    };
  }, []);

  const loadVideos = async () => {
    const list = await api.getVideos();
    setVideos(list);
  };

  const loadAdSettings = async () => {
    try {
      const cloudAds = await api.getAdSettings();
      if (cloudAds) {
        store.saveAdSettings(cloudAds);
      }
    } catch (err) {
      console.warn('Initial cloud ad load notice:', err);
    }
  };

  const handleSelectVideo = (id) => {
    navigate('watch', id);
  };

  const handleBookmarkToggle = (id) => {
    const updated = store.toggleBookmark(id);
    setBookmarks(updated);
  };

  const handleToggleDevMode = () => {
    const nextVal = !isDevMode;
    store.setDevMode(nextVal);
    setIsDevMode(nextVal);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-obsidian text-slate-900 dark:text-[#F8FAFC] transition-colors duration-300">
      {/* 18+ Age Verification Modal */}
      <AgeModal />

      {/* Navigation Header with Theme Toggle */}
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onOpenBookmarks={() => setIsBookmarksOpen(true)}
        bookmarkCount={bookmarks.length}
        onNavigateHome={() => navigate('home')}
        isDevMode={isDevMode}
        onToggleDevMode={handleToggleDevMode}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Dynamic View with Safe-Area Clearance for Sticky Footer */}
      <main
        className="flex-1 pb-28 sm:pb-24"
        style={{ paddingBottom: 'calc(6.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {currentView === 'home' && (
          <Home
            videos={videos}
            searchQuery={searchQuery}
            onClearSearch={() => setSearchQuery('')}
            onSelectVideo={handleSelectVideo}
            onBookmarkToggle={handleBookmarkToggle}
            isBookmarked={(id) => bookmarks.includes(id)}
          />
        )}

        {currentView === 'watch' && (
          <Watch
            videoId={selectedVideoId}
            allVideos={videos}
            onBack={() => navigate('home')}
            onSelectVideo={handleSelectVideo}
            isBookmarked={(id) => bookmarks.includes(id)}
            onBookmarkToggle={handleBookmarkToggle}
            onOpenDMCA={(vidId) => navigate('dmca', vidId)}
          />
        )}

        {currentView === 'admin' && (
          <Admin onBack={() => {
            loadVideos();
            navigate('home');
          }} />
        )}

        {currentView === 'dmca' && (
          <DMCA initialVideoId={selectedVideoId} onBack={() => navigate('home')} />
        )}

        {currentView === 'terms' && (
          <Legal defaultTab="terms" onBack={() => navigate('home')} />
        )}

        {currentView === 'privacy' && (
          <Legal defaultTab="privacy" onBack={() => navigate('home')} />
        )}
      </main>

      {/* Sticky Bottom Mobile Ad Banner and Popunder Trigger (Disabled on Admin to prevent ad overlap) */}
      {currentView !== 'admin' && (
        <>
          <StickyFooter />
          <PopunderTrigger />
        </>
      )}

      {/* Saved Bookmarks Drawer */}
      <BookmarksDrawer
        isOpen={isBookmarksOpen}
        onClose={() => setIsBookmarksOpen(false)}
        onSelectVideo={handleSelectVideo}
        onRemoveBookmark={handleBookmarkToggle}
        onClearAllBookmarks={() => setBookmarks([])}
      />

      {/* Global Footer (Glassmorphic) with clearance for sticky ad */}
      <footer
        className="w-full glass-panel border-t pt-8 pb-28 sm:pb-20 text-xs text-slate-500 dark:text-slate-400"
        style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
              Horny<span className="text-rose-500">Leaks</span>
            </span>
            <p className="text-[11px] text-slate-400 mt-1">
              Curated public video media index. No files hosted on local servers.
            </p>
          </div>

          {/* Legal Links */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
            <button
              onClick={() => navigate('dmca')}
              className="hover:text-rose-500 transition-colors flex items-center gap-1"
            >
              <i className="ri-shield-check-fill not-italic text-rose-500 text-sm"></i>
              DMCA Removal
            </button>
            <span>•</span>
            <button
              onClick={() => navigate('terms')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Terms of Service
            </button>
            <span>•</span>
            <button
              onClick={() => navigate('privacy')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Privacy Policy
            </button>
          </div>

          <div className="text-[11px] text-slate-400">
            © 2026 HornyLeaks Media. 18+ Strictly Enforced.
          </div>
        </div>
      </footer>
    </div>
  );
}
