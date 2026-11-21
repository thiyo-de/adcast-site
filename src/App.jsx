import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import AgeModal from './components/AgeModal';
import StickyFooter from './components/StickyFooter';
import PopunderTrigger from './components/PopunderTrigger';
import InterstitialTrigger from './components/InterstitialTrigger';
import DesktopGutterAds from './components/DesktopGutterAds';
import BookmarksDrawer from './components/BookmarksDrawer';
import Home from './pages/Home';
import Watch from './pages/Watch';
import Admin from './pages/Admin';
import DMCA from './pages/DMCA';
import Legal from './pages/Legal';
import { store } from './services/store';
import { api } from './services/supabase';
import { AdBlockProvider } from './services/adBlockContext';
import AdBlockNotice from './components/AdBlockNotice';
import { computeCategoryCounts } from './constants/categories';

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

function parseCatalogParams() {
  if (typeof window === 'undefined') return { page: 1, category: 'All', sort: 'newest', search: '' };
  try {
    const params = new URLSearchParams(window.location.search);
    const p = parseInt(params.get('page') || '1', 10);
    return {
      page: Number.isFinite(p) && p >= 1 ? p : 1,
      category: params.get('category') || 'All',
      sort: params.get('sort') || 'newest',
      search: params.get('search') || '',
    };
  } catch {
    return { page: 1, category: 'All', sort: 'newest', search: '' };
  }
}

export default function App() {
  const [routeState, setRouteState] = useState(() => parseRoute());
  const currentView = routeState.view;
  const selectedVideoId = routeState.videoId;

  const [initialCatalog] = useState(() => parseCatalogParams());
  const [searchQuery, setSearchQuery] = useState(initialCatalog.search);
  const [debouncedSearch, setDebouncedSearch] = useState(initialCatalog.search);

  // Debounce search queries by 300ms (instant when empty) to prevent query thrashing
  useEffect(() => {
    if (!searchQuery) {
      setDebouncedSearch('');
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [selectedCategory, setSelectedCategory] = useState(initialCatalog.category);
  const [sortBy, setSortBy] = useState(initialCatalog.sort);
  const [page, setPage] = useState(initialCatalog.page);
  const [videos, setVideos] = useState([]);
  const [pageSize] = useState(20);
  const [totalVideos, setTotalVideos] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [categoryCounts, setCategoryCounts] = useState({});
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
      // Hard navigation boundary to ensure completely clean, isolated JS runtime on Admin (purges 3rd-party ad listeners)
      if (typeof window !== 'undefined' && window.location.pathname !== '/admin') {
        window.location.href = '/admin';
        return;
      }
    } else if (view === 'dmca') {
      path = '/dmca';
    } else if (view === 'terms') {
      path = '/terms';
    } else if (view === 'privacy') {
      path = '/privacy';
    }

    // When leaving Admin to browse public content, perform clean page load to re-initialize ad zones cleanly
    if (currentView === 'admin' && view !== 'admin') {
      if (typeof window !== 'undefined') {
        window.location.href = path;
        return;
      }
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
      const p = parseCatalogParams();
      setPage(p.page);
      setSelectedCategory(p.category);
      setSortBy(p.sort);
      setSearchQuery(p.search);
      setDebouncedSearch(p.search);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Theme State: Default to dark luxury streaming theme
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('adcast_theme');
      if (saved === 'dark' || saved === 'light') return saved;
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

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const fetchVideosPage = async (targetPage = 1, append = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoadingVideos(true);
    }

    try {
      const res = await api.getVideosPage({
        page: targetPage,
        pageSize,
        category: selectedCategory,
        search: debouncedSearch,
        sort: sortBy
      });

      if (append) {
        setVideos((prev) => [...prev, ...(res.items || [])]);
      } else {
        setVideos(res.items || []);
      }
      setTotalVideos(res.total || 0);
      setHasMore(Boolean(res.hasMore));
      setPage(targetPage);
    } catch (err) {
      console.warn('Failed to fetch paginated videos:', err);
    } finally {
      setIsLoadingVideos(false);
      setIsLoadingMore(false);
    }
  };

  const loadCategoryCounts = async () => {
    try {
      const counts = await api.getCategoryCounts();
      setCategoryCounts(counts);
    } catch (err) {
      console.warn('Initial category counts load notice:', err);
    }
  };

  const handlePageChange = (targetPage) => {
    const totalPages = Math.max(1, Math.ceil(totalVideos / pageSize));
    if (targetPage >= 1 && targetPage <= totalPages && targetPage !== page) {
      setPage(targetPage);
      fetchVideosPage(targetPage, false);
      const catalogEl = document.getElementById('catalog-feed');
      if (catalogEl) {
        catalogEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const isInitialFilterMount = useRef(true);
  useEffect(() => {
    if (isInitialFilterMount.current) {
      isInitialFilterMount.current = false;
      fetchVideosPage(page, false);
      return;
    }
    setPage(1);
    fetchVideosPage(1, false);
  }, [debouncedSearch, selectedCategory, sortBy]);

  useEffect(() => {
    if (typeof window === 'undefined' || currentView !== 'home') return;
    const params = new URLSearchParams();
    if (page > 1) params.set('page', page.toString());
    if (selectedCategory && selectedCategory !== 'All') params.set('category', selectedCategory);
    if (sortBy && sortBy !== 'newest') params.set('sort', sortBy);
    if (debouncedSearch) params.set('search', debouncedSearch);

    const queryString = params.toString();
    const targetUrl = queryString ? `/?${queryString}` : '/';
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (currentUrl !== targetUrl) {
      window.history.replaceState({ ...window.history.state, page, selectedCategory, sortBy, searchQuery: debouncedSearch }, '', targetUrl);
    }
  }, [page, selectedCategory, sortBy, debouncedSearch, currentView]);

  useEffect(() => {
    loadCategoryCounts();
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
    <AdBlockProvider currentView={currentView} videoId={selectedVideoId}>
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-obsidian text-slate-900 dark:text-[#F8FAFC] transition-colors duration-300">
        {/* 18+ Age Verification Modal */}
        <AgeModal />

        {/* Ad-Blocker Awareness Notice */}
        <AdBlockNotice />

      {/* Navigation Header with Categories Popover & Theme Toggle */}
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
        selectedCategory={selectedCategory}
        onSelectCategory={(catId) => {
          setSelectedCategory(catId);
          if (currentView !== 'home') navigate('home');
        }}
        categoryCounts={categoryCounts}
        currentView={currentView}
      />

      {/* Main Dynamic View */}
      <main className="flex-1 pb-4 sm:pb-6">
        {currentView === 'home' && (
          <Home
            videos={videos}
            totalVideos={totalVideos}
            page={page}
            pageSize={pageSize}
            isLoadingVideos={isLoadingVideos}
            onPageChange={handlePageChange}
            sortBy={sortBy}
            onSortChange={setSortBy}
            searchQuery={searchQuery}
            onClearSearch={() => setSearchQuery('')}
            onSelectVideo={handleSelectVideo}
            onBookmarkToggle={handleBookmarkToggle}
            isBookmarked={(id) => bookmarks.includes(id)}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
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
            fetchVideosPage(1, false);
            loadCategoryCounts();
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

      {/* Sticky Bottom Mobile Ad Banner, Popunder, and Desktop Interstitial Triggers */}
      {currentView !== 'admin' && (
        <>
          <DesktopGutterAds currentView={currentView} />
          <StickyFooter currentView={currentView} />
          <PopunderTrigger />
          <InterstitialTrigger currentView={currentView} />
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
  </AdBlockProvider>
  );
}
