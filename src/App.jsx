import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import AgeModal from './components/AgeModal';
import StickyFooter from './components/StickyFooter';
import BookmarksDrawer from './components/BookmarksDrawer';
import Home from './pages/Home';
import Watch from './pages/Watch';
import Admin from './pages/Admin';
import DMCA from './pages/DMCA';
import Legal from './pages/Legal';
import { store } from './services/store';
import { api } from './services/supabase';

export default function App() {
  const [currentView, setCurrentView] = useState('home');
  const [selectedVideoId, setSelectedVideoId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [videos, setVideos] = useState([]);
  const [bookmarks, setBookmarks] = useState(store.getBookmarks());
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [isDevMode, setIsDevMode] = useState(store.isDevMode());

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
  }, []);

  const loadVideos = async () => {
    const list = await api.getVideos();
    setVideos(list);
  };

  const handleSelectVideo = (id) => {
    setSelectedVideoId(id);
    setCurrentView('watch');
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
        onSearchChange={setSearchQuery}
        onOpenBookmarks={() => setIsBookmarksOpen(true)}
        bookmarkCount={bookmarks.length}
        onNavigateHome={() => {
          setSelectedVideoId(null);
          setCurrentView('home');
        }}
        onNavigateAdmin={() => setCurrentView('admin')}
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
            onSelectVideo={handleSelectVideo}
            onBookmarkToggle={handleBookmarkToggle}
            isBookmarked={(id) => bookmarks.includes(id)}
          />
        )}

        {currentView === 'watch' && (
          <Watch
            videoId={selectedVideoId}
            allVideos={videos}
            onBack={() => setCurrentView('home')}
            onSelectVideo={handleSelectVideo}
            isBookmarked={(id) => bookmarks.includes(id)}
            onBookmarkToggle={handleBookmarkToggle}
            onOpenDMCA={(vidId) => {
              setSelectedVideoId(vidId);
              setCurrentView('dmca');
            }}
          />
        )}

        {currentView === 'admin' && (
          <Admin onBack={() => {
            loadVideos();
            setCurrentView('home');
          }} />
        )}

        {currentView === 'dmca' && (
          <DMCA initialVideoId={selectedVideoId} onBack={() => setCurrentView('home')} />
        )}

        {currentView === 'terms' && (
          <Legal defaultTab="terms" onBack={() => setCurrentView('home')} />
        )}

        {currentView === 'privacy' && (
          <Legal defaultTab="privacy" onBack={() => setCurrentView('home')} />
        )}
      </main>

      {/* Sticky Bottom Mobile Ad Banner (Slot 3: ExoClick) */}
      <StickyFooter />

      {/* Saved Bookmarks Drawer */}
      <BookmarksDrawer
        isOpen={isBookmarksOpen}
        onClose={() => setIsBookmarksOpen(false)}
        onSelectVideo={handleSelectVideo}
        onRemoveBookmark={handleBookmarkToggle}
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
              onClick={() => setCurrentView('dmca')}
              className="hover:text-rose-500 transition-colors flex items-center gap-1"
            >
              <i className="ri-shield-check-fill not-italic text-rose-500 text-sm"></i>
              DMCA Removal
            </button>
            <span>•</span>
            <button
              onClick={() => setCurrentView('terms')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Terms of Service
            </button>
            <span>•</span>
            <button
              onClick={() => setCurrentView('privacy')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Privacy Policy
            </button>
            <span>•</span>
            <button
              onClick={() => setCurrentView('admin')}
              className="text-amber-500 hover:text-amber-400 transition-colors flex items-center gap-1"
            >
              <i className="ri-lock-line not-italic text-sm"></i> Admin
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
