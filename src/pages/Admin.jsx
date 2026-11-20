import React, { useState, useEffect } from 'react';
import { store, parseToEmbedUrl, getThumbnailForUrl, parseDurationToSeconds, formatDuration } from '../services/store';
import { api, auth, getSupabaseConfig, saveSupabaseConfig, getSupabaseClient } from '../services/supabase';

export default function Admin({ onBack }) {
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authErrorMsg, setAuthErrorMsg] = useState(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState(null);
  const [activeTab, setActiveTab] = useState('videos');

  // Video Management State
  const [videos, setVideos] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState(null);
  const [videoForm, setVideoForm] = useState({
    title: '',
    embed_url: '',
    thumbnail_url: '',
    duration: '10:00',
    category: 'Trending',
    quality: '1080p',
    rating: 98,
    tags: 'trending, viral',
    is_featured: false
  });

  // Ad Settings State
  const [adSettings, setAdSettings] = useState(store.getAdSettings());
  const [savedSlotId, setSavedSlotId] = useState(null);

  // Supabase Sync State
  const [supabaseConfig, setSupabaseConfigState] = useState(getSupabaseConfig());
  const [supabaseAnonKeyInput, setSupabaseAnonKeyInput] = useState(supabaseConfig.anonKey || '');
  const [supabaseStatus, setSupabaseStatus] = useState(null);

  // DMCA State
  const [dmcaList, setDmcaList] = useState([]);

  // Dead Streams (Quarantine) State
  const [deadVideos, setDeadVideos] = useState([]);
  const [isPurging, setIsPurging] = useState(false);
  const [isPurgePreviewOpen, setIsPurgePreviewOpen] = useState(false);

  // Review Queue (Moderation) State
  const [pendingVideos, setPendingVideos] = useState([]);

  // Crawler & Engine State
  const [crawlerSources, setCrawlerSources] = useState([]);
  const [sourceForm, setSourceForm] = useState({
    name: '',
    url: '',
    category: 'Trending',
    video_limit: 15,
    type: 'json_api',
    auto_approve: true
  });
  const [editingSourceId, setEditingSourceId] = useState(null);
  const [isSyncingEngine, setIsSyncingEngine] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState(null);

  useEffect(() => {
    let mounted = true;

    // Purge any lingering third-party ad elements or floating badges from DOM when in Admin
    try {
      const adElements = document.querySelectorAll(
        '[data-adcast-popunder], [class*="eas-"], [id*="eas-"], ins.eas6, div[class*="slot_sticky_footer"]'
      );
      adElements.forEach((el) => el.remove());

      const bodyChildren = Array.from(document.body.children);
      bodyChildren.forEach((child) => {
        if (child.id !== 'root' && !child.hasAttribute('data-react-modal')) {
          const style = window.getComputedStyle(child);
          if (style.position === 'fixed' || child.tagName === 'IFRAME' || child.tagName === 'INS') {
            child.remove();
          }
        }
      });
    } catch (e) {
      console.warn('Ad cleanup notice:', e);
    }

    // Check active Supabase Auth session on mount
    auth.getSession().then((session) => {
      if (!mounted) return;
      if (session?.user && (session.user.email === 'admin@hornyleaks.site' || session.user.app_metadata?.role === 'admin')) {
        setUser(session.user);
        store.setAdminLoggedIn(true);
        setIsLoggedIn(true);
      } else {
        setUser(null);
        store.setAdminLoggedIn(false);
        setIsLoggedIn(false);
      }
    });

    const subscription = auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user && (session.user.email === 'admin@hornyleaks.site' || session.user.app_metadata?.role === 'admin')) {
        setUser(session.user);
        store.setAdminLoggedIn(true);
        setIsLoggedIn(true);
      } else {
        setUser(null);
        store.setAdminLoggedIn(false);
        setIsLoggedIn(false);
      }
    });

    return () => {
      mounted = false;
      if (subscription?.unsubscribe) subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      loadData();
    }
  }, [isLoggedIn]);

  const loadData = async () => {
    const vList = await api.getVideos();
    setVideos(vList);
    const deadList = await api.getDeadVideos();
    setDeadVideos(deadList);
    const pendingList = await api.getPendingVideos();
    setPendingVideos(pendingList);
    const ads = await api.getAdSettings();
    setAdSettings(ads);
    const dmcas = await api.getDMCARequests();
    setDmcaList(dmcas);
    const sources = await api.getCrawlerSources();
    setCrawlerSources(sources);
  };

  const handleApproveVideo = async (id) => {
    await api.approveVideo(id);
    loadData();
  };

  const handleRejectVideo = async (id) => {
    await api.rejectVideo(id);
    loadData();
  };

  const handleBatchApproveAll = async () => {
    if (window.confirm(`Approve all ${pendingVideos.length} pending video(s) for public publication?`)) {
      for (const v of pendingVideos) {
        await api.approveVideo(v.id);
      }
      loadData();
    }
  };

  const handleDiscoverUrl = async () => {
    if (!sourceForm.url || !sourceForm.url.trim()) return;
    setIsDiscovering(true);
    setDiscoveryResult(null);
    try {
      const res = await api.discoverSource(sourceForm.url);
      setDiscoveryResult(res);
      if (res.ok) {
        let detectedName = sourceForm.name;
        if (!detectedName || detectedName.trim() === '') {
          try {
            detectedName = new URL(res.recommendedUrl || sourceForm.url).hostname.replace('www.', '');
            detectedName = detectedName.charAt(0).toUpperCase() + detectedName.slice(1);
          } catch (e) {}
        }
        setSourceForm((prev) => ({
          ...prev,
          name: detectedName,
          url: res.recommendedUrl || prev.url,
          type: res.detectedType || prev.type || 'json_api'
        }));
      }
    } catch (err) {
      setDiscoveryResult({ ok: false, message: err.message });
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthErrorMsg(null);
    setAuthSuccessMsg(null);
    setAuthLoading(true);

    try {
      if (!passwordInput || !passwordInput.trim()) {
        throw new Error('Please enter the administrator password.');
      }

      // Supabase Cloud Authentication is the strict, blocking gate
      const supaRes = await auth.signIn('admin@hornyleaks.site', passwordInput.trim());
      if (!supaRes?.user) {
        throw new Error('Authentication failed: Cloud session could not be established.');
      }

      setUser(supaRes.user);
      store.setAdminLoggedIn(true);
      setIsLoggedIn(true);
      setAuthSuccessMsg('Authenticated as verified administrator.');
    } catch (err) {
      store.setAdminLoggedIn(false);
      setIsLoggedIn(false);
      setUser(null);
      setAuthErrorMsg(err.message || 'Authentication failed. Please verify your administrator password.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (e) {}
    store.setAdminLoggedIn(false);
    setUser(null);
    setIsLoggedIn(false);
  };

  // Video Actions
  const handleSaveVideo = async (e) => {
    e.preventDefault();
    const tagArray = videoForm.tags.split(',').map((t) => t.trim()).filter(Boolean);
    const durSec = parseDurationToSeconds(videoForm.duration);
    const formattedDur = formatDuration(durSec);
    const payload = {
      title: videoForm.title,
      embed_url: videoForm.embed_url,
      thumbnail_url: videoForm.thumbnail_url,
      duration: formattedDur,
      duration_seconds: durSec,
      category: videoForm.category,
      quality: videoForm.quality || '4K UHD',
      rating: parseInt(videoForm.rating, 10) || 98,
      tags: tagArray,
      is_featured: videoForm.is_featured
    };

    try {
      if (editingVideo) {
        await api.updateVideo(editingVideo.id, payload);
      } else {
        await api.addVideo(payload);
      }

      setIsAddModalOpen(false);
      setEditingVideo(null);
      setVideoForm({
        title: '',
        embed_url: '',
        thumbnail_url: '',
        duration: '10:00',
        category: 'Trending',
        quality: '4K UHD',
        rating: 98,
        tags: 'trending, viral',
        is_featured: false
      });
      await loadData();
    } catch (err) {
      alert(`Failed to save video: ${err.message || 'Database mutation rejected.'}`);
    }
  };

  const handleDeleteVideo = async (id) => {
    if (window.confirm('Are you sure you want to delete this video?')) {
      try {
        await api.deleteVideo(id);
        await loadData();
      } catch (err) {
        alert(`Failed to delete video: ${err.message || 'Database mutation rejected.'}`);
      }
    }
  };

  const handleRestoreVideo = async (id) => {
    await api.restoreVideo(id);
    loadData();
  };

  const handleHardDeleteVideo = async (id) => {
    if (window.confirm('Permanently delete this dead stream from the database? This cannot be undone.')) {
      await api.deleteVideo(id);
      loadData();
    }
  };

  const handlePurgeAllDeadVideos = async () => {
    try {
      setIsPurging(true);
      const purgedCount = await api.hardDeleteAllDeadVideos();
      setIsPurgePreviewOpen(false);
      await loadData();
      alert(`Successfully purged and suppressed ${purgedCount ?? deadVideos.length} dead stream(s).`);
    } catch (err) {
      alert(`Failed to purge dead streams: ${err.message || 'Database mutation rejected.'}`);
    } finally {
      setIsPurging(false);
    }
  };

  // Crawler Sources Handlers
  const handleSaveSource = async (e) => {
    e.preventDefault();
    if (!sourceForm.name || !sourceForm.url) return;

    try {
      if (editingSourceId) {
        await api.updateCrawlerSource(editingSourceId, {
          name: sourceForm.name,
          url: sourceForm.url,
          category: sourceForm.category,
          video_limit: parseInt(sourceForm.video_limit, 10) || 15,
          type: sourceForm.type || 'json_api',
          auto_approve: sourceForm.auto_approve !== false
        });
        setEditingSourceId(null);
      } else {
        await api.addCrawlerSource({
          name: sourceForm.name,
          url: sourceForm.url,
          category: sourceForm.category,
          video_limit: parseInt(sourceForm.video_limit, 10) || 15,
          type: sourceForm.type || 'json_api',
          auto_approve: sourceForm.auto_approve !== false,
          is_enabled: true
        });
      }

      setSourceForm({ name: '', url: '', category: 'Trending', video_limit: 15, type: 'json_api', auto_approve: true });
      setDiscoveryResult(null);
      loadData();
    } catch (err) {
      alert(`Failed to save crawler source: ${err.message || 'Database mutation rejected.'}`);
    }
  };

  const handleEditSource = (s) => {
    setEditingSourceId(s.id);
    setSourceForm({
      name: s.name,
      url: s.url,
      category: s.category || 'Trending',
      video_limit: s.video_limit || 15,
      type: s.type || s.source_type || 'json_api',
      auto_approve: s.auto_approve !== false
    });
  };

  const handleToggleSource = async (source) => {
    try {
      await api.updateCrawlerSource(source.id, { is_enabled: !source.is_enabled });
      loadData();
    } catch (err) {
      alert(`Failed to update crawler source: ${err.message || 'Database mutation rejected.'}`);
    }
  };

  const handleDeleteSource = async (id) => {
    if (window.confirm('Remove this video target source?')) {
      try {
        await api.deleteCrawlerSource(id);
        loadData();
      } catch (err) {
        alert(`Failed to delete crawler source: ${err.message || 'Database mutation rejected.'}`);
      }
    }
  };

  const handleTriggerSync = async (source = null) => {
    setIsSyncingEngine(true);
    setSyncStatus({
      type: 'loading',
      message: source ? `Contacting sync trigger service for "${source.name}"...` : 'Contacting sync trigger service for all active sources...'
    });

    try {
      const res = await api.triggerSync(source);
      setIsSyncingEngine(false);

      if (res.ok) {
        setSyncStatus({
          type: 'success',
          jobId: res.jobId,
          message: res.message || 'Workflow dispatched to GitHub Actions runner queue.'
        });
        loadData();
      } else if (res.status === 'unconfigured') {
        setSyncStatus({
          type: 'unconfigured',
          message: res.message || 'Serverless trigger endpoint is unconfigured on this host.'
        });
      } else if (res.status === 'unauthorized') {
        setSyncStatus({
          type: 'unauthorized',
          message: res.message || 'Administrator session required to dispatch crawler jobs.'
        });
      } else {
        setSyncStatus({
          type: 'error',
          message: res.message || 'Failed to dispatch crawler sync job.'
        });
      }
    } catch (err) {
      setIsSyncingEngine(false);
      setSyncStatus({
        type: 'error',
        message: err.message || 'Unexpected network error dispatching sync.'
      });
    }
  };

  const handleEditClick = (v) => {
    setEditingVideo(v);
    setVideoForm({
      title: v.title,
      embed_url: v.embed_url,
      thumbnail_url: v.thumbnail_url,
      duration: v.duration || '10:00',
      category: v.category || 'Trending',
      quality: v.quality || '4K UHD',
      rating: v.rating || 98,
      tags: Array.isArray(v.tags) ? v.tags.join(', ') : '',
      is_featured: v.is_featured || false
    });
    setIsAddModalOpen(true);
  };

  // Ad Slot Updates (C06: Shared, Persistent, Reactive)
  const handleAdSlotUpdate = async (slotId, fields) => {
    try {
      const updated = await api.updateAdSlot(slotId, fields);
      setAdSettings(updated);
      setSavedSlotId(slotId);
      setTimeout(() => setSavedSlotId(null), 2500);
    } catch (err) {
      alert(`Failed to update ad slot "${slotId}" in cloud database: ${err.message}`);
    }
  };

  const handleAffiliateUpdate = async (fields) => {
    try {
      const updated = await api.updateAffiliateFallbacks(fields);
      setAdSettings(updated);
      setSavedSlotId('affiliate_fallbacks');
      setTimeout(() => setSavedSlotId(null), 2500);
    } catch (err) {
      alert(`Failed to save affiliate fallbacks to cloud database: ${err.message}`);
    }
  };

  // Supabase Test Connection
  const handleSaveSupabaseKey = async () => {
    saveSupabaseConfig(supabaseConfig.url, supabaseAnonKeyInput);
    setSupabaseConfigState(getSupabaseConfig());

    const client = getSupabaseClient();
    if (!client) {
      setSupabaseStatus('error');
      return;
    }

    try {
      const { data, error } = await client.from('videos').select('count', { count: 'exact' });
      if (error) {
        setSupabaseStatus('error: ' + error.message);
      } else {
        setSupabaseStatus('connected');
        loadData();
      }
    } catch (e) {
      setSupabaseStatus('error: ' + e.message);
    }
  };

  const handleResolveDMCA = async (id) => {
    if (window.confirm('Resolve this DMCA notice and permanently suppress the target stream against future ingestion?')) {
      try {
        await api.resolveDMCARequest(id);
        const updated = await api.getDMCARequests();
        setDmcaList(updated);
        await loadData();
        alert('DMCA notice resolved and target stream suppressed.');
      } catch (err) {
        alert(`Failed to resolve DMCA notice: ${err.message || 'Database mutation rejected.'}`);
      }
    }
  };

  // 1. Master Login Gate
  if (!isLoggedIn) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md p-8 rounded-3xl glass-panel shadow-2xl">
          <div className="text-center mb-6">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
              <i className="ri-shield-keyhole-fill not-italic text-3xl"></i>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">HornyLeaks Admin</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Private Dashboard & Database Management
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Master Password
              </label>
              <input
                type="password"
                required
                autoFocus
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter admin master password"
                className="w-full px-4 py-3 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-2xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            {authErrorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs text-rose-500 flex items-start gap-2">
                <i className="ri-error-warning-fill not-italic text-sm mt-0.5 shrink-0"></i>
                <span>{authErrorMsg}</span>
              </div>
            )}

            {authSuccessMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-emerald-500 flex items-start gap-2">
                <i className="ri-checkbox-circle-fill not-italic text-sm mt-0.5 shrink-0"></i>
                <span>{authSuccessMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 rounded-full bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {authLoading && <i className="ri-loader-4-line not-italic animate-spin"></i>}
              {authLoading ? 'Authenticating...' : 'Sign In to Dashboard'}
            </button>

            <button
              type="button"
              onClick={onBack}
              className="w-full text-center text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 pt-2"
            >
              ← Return to public site
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. Main Admin Dashboard
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Admin Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl glass-panel">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-600 to-rose-500 flex items-center justify-center text-white shadow-md shadow-rose-600/20">
            <i className="ri-shield-keyhole-fill not-italic text-xl"></i>
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              HornyLeaks Administration
              {user ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                  AUTH: {user.email}
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-mono">
                  LOCAL OFFLINE
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage video catalog, configure ad slots, and control database syncing.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-full glass-button text-xs font-semibold"
          >
            View Public Site
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-rose-500/10 text-rose-500 hover:bg-rose-600 hover:text-white text-xs font-semibold border border-rose-500/20 transition-all cursor-pointer"
          >
            <i className="ri-logout-box-r-line not-italic text-sm"></i> Logout
          </button>
        </div>
      </div>

      {/* Local Mode Notice Banner */}
      {!user && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-600 dark:text-amber-400">
          <div className="flex items-center gap-2">
            <i className="ri-shield-alert-line text-lg shrink-0"></i>
            <span>
              <strong>Local Mode Notice:</strong> You are signed in with local storage credentials. Supabase Cloud RLS requires authentication with your Supabase email & password for cloud writes.
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-600 dark:text-amber-300 font-bold text-xs transition-all cursor-pointer"
          >
            Switch to Supabase Login
          </button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-1 border-b border-slate-200/80 dark:border-white/[0.08]">
        <button
          onClick={() => setActiveTab('videos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'videos'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'glass-button'
          }`}
        >
          <i className="ri-movie-2-line not-italic text-sm"></i>
          Videos ({videos.length})
        </button>

        <button
          onClick={() => setActiveTab('review')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'review'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'glass-button'
          }`}
        >
          <i className="ri-checkbox-multiple-line not-italic text-sm"></i>
          Review Queue ({pendingVideos.length})
        </button>

        <button
          onClick={() => setActiveTab('crawler')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'crawler'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'glass-button'
          }`}
        >
          <i className="ri-radar-line not-italic text-sm"></i>
          Crawler & Sources ({crawlerSources.length})
        </button>

        <button
          onClick={() => setActiveTab('ads')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'ads'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'glass-button'
          }`}
        >
          <i className="ri-megaphone-line not-italic text-sm"></i>
          Ad Network Manager (6 Slots)
        </button>

        <button
          onClick={() => setActiveTab('supabase')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'supabase'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'glass-button'
          }`}
        >
          <i className="ri-database-2-line not-italic text-sm"></i>
          Supabase Cloud Sync
        </button>

        <button
          onClick={() => setActiveTab('dmca')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'dmca'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'glass-button'
          }`}
        >
          <i className="ri-shield-check-line not-italic text-sm"></i>
          DMCA Requests ({dmcaList.filter((d) => d.status === 'pending').length})
        </button>

        <button
          onClick={() => setActiveTab('quarantine')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'quarantine'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'glass-button'
          }`}
        >
          <i className="ri-error-warning-line not-italic text-sm"></i>
          Dead Streams ({deadVideos.length})
        </button>
      </div>

      {/* TAB 1: VIDEOS MANAGEMENT */}
      {activeTab === 'videos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Video Catalog</h2>
            <button
              onClick={() => {
                setEditingVideo(null);
                setVideoForm({
                  title: '',
                  embed_url: '',
                  thumbnail_url: '',
                  duration: '10:00',
                  category: 'Trending',
                  quality: '4K UHD',
                  rating: 98,
                  tags: 'trending, viral',
                  is_featured: false
                });
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all cursor-pointer"
            >
              <i className="ri-add-line not-italic text-sm"></i> Add Video Embed
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl glass-panel">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 dark:bg-white/[0.04] text-slate-500 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-white/10">
                <tr>
                  <th className="p-3.5">Thumbnail</th>
                  <th className="p-3.5">Title & Embed URL</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Rating</th>
                  <th className="p-3.5">Views</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.06]">
                {videos.map((vid) => (
                  <tr key={vid.id} className="hover:bg-slate-100/50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="p-3.5 w-24">
                      <div className="relative w-20 aspect-video rounded-xl overflow-hidden bg-slate-950">
                        <img src={vid.thumbnail_url} alt="" className="w-full h-full object-cover filter blur-[10px] scale-110 opacity-25" />
                        <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm pointer-events-none" />
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 dark:text-white line-clamp-1">{vid.title}</div>
                      <div className="text-[11px] text-slate-400 font-mono truncate max-w-md">
                        {vid.embed_url}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                        {vid.category}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="font-bold text-emerald-500 dark:text-emerald-400">{vid.rating || 98}%</span>
                    </td>
                    <td className="p-3.5 font-mono text-slate-600 dark:text-slate-300">
                      {(vid.views || 0).toLocaleString()}
                    </td>
                    <td className="p-3.5 text-right space-x-1">
                      <button
                        onClick={() => handleEditClick(vid)}
                        className="p-2 rounded-xl glass-button"
                        title="Edit video"
                      >
                        <i className="ri-edit-line not-italic text-sm"></i>
                      </button>
                      <button
                        onClick={() => handleDeleteVideo(vid.id)}
                        className="p-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all"
                        title="Delete video"
                      >
                        <i className="ri-delete-bin-line not-italic text-sm"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: REVIEW QUEUE (CONTENT MODERATION UX13) */}
      {activeTab === 'review' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <i className="ri-checkbox-multiple-line not-italic text-rose-500"></i>
                Staging & Review Queue
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Videos from sources configured for review before being visible to public visitors.
              </p>
            </div>
            {pendingVideos.length > 0 && (
              <button
                onClick={handleBatchApproveAll}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
              >
                <i className="ri-check-double-line not-italic text-sm"></i>
                Approve All ({pendingVideos.length})
              </button>
            )}
          </div>

          {pendingVideos.length === 0 ? (
            <div className="p-8 text-center rounded-2xl glass-panel">
              <i className="ri-checkbox-circle-line not-italic text-3xl text-emerald-500 mb-2 block"></i>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Review Queue is Clear</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                All imported streams are approved and active in the public catalog.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl glass-panel overflow-hidden border border-slate-200/80 dark:border-white/10">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-100/70 dark:bg-white/[0.03] text-slate-800 dark:text-slate-200 uppercase font-mono text-[10px] tracking-wider border-b border-slate-200/80 dark:border-white/10">
                  <tr>
                    <th className="p-3.5">Preview</th>
                    <th className="p-3.5">Title & Source</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Duration</th>
                    <th className="p-3.5 text-right">Moderation Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.05]">
                  {pendingVideos.map((vid) => (
                    <tr key={vid.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                      <td className="p-3.5 w-24">
                        <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-950">
                          <img
                            src={vid.thumbnail_url || '/icon.png'}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.src = '/icon.png'; }}
                          />
                        </div>
                      </td>
                      <td className="p-3.5 max-w-xs sm:max-w-md">
                        <div className="font-bold text-slate-900 dark:text-white truncate">{vid.title}</div>
                        <div className="text-[11px] text-slate-400 font-mono truncate">{vid.embed_url}</div>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                          {vid.category}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-600 dark:text-slate-300">
                        {vid.duration || '10:00'}
                      </td>
                      <td className="p-3.5 text-right space-x-2">
                        <button
                          onClick={() => handleApproveVideo(vid.id)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600/10 hover:bg-emerald-600 text-emerald-600 hover:text-white font-bold text-xs transition-all cursor-pointer"
                          title="Publish video to public catalog"
                        >
                          <i className="ri-check-line not-italic text-sm mr-1"></i> Approve
                        </button>
                        <button
                          onClick={() => handleRejectVideo(vid.id)}
                          className="px-3 py-1.5 rounded-xl bg-rose-600/10 hover:bg-rose-600 text-rose-600 hover:text-white font-bold text-xs transition-all cursor-pointer"
                          title="Reject and exclude from catalog"
                        >
                          <i className="ri-close-line not-italic text-sm mr-1"></i> Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: CRAWLER & TARGET ENGINE */}
      {activeTab === 'crawler' && (
        <div className="space-y-6">
          {/* Top Engine Control Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl glass-panel">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <i className="ri-radar-line not-italic text-rose-500 text-xl"></i>
                Video Crawler & Auto-Sync Engine
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Configure external target websites, set custom video limiters per source, and trigger real-time background syncs.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleTriggerSync(null)}
                disabled={isSyncingEngine}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/20 active:scale-95 disabled:opacity-50"
              >
                <i className={`${isSyncingEngine ? 'ri-loader-4-line animate-spin' : 'ri-flashlight-fill'} not-italic text-sm`}></i>
                {isSyncingEngine ? 'Syncing...' : 'Sync All Active Sources'}
              </button>

              <button
                onClick={() => {
                  setActiveTab('quarantine');
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl glass-button text-xs font-bold"
              >
                <i className="ri-shield-check-line not-italic text-emerald-500 text-sm"></i>
                Stream Health Status
              </button>
            </div>
          </div>

          {/* Honest Sync Status Banner & Unconfigured Action Center */}
          {syncStatus && (
            <div className={`p-4 rounded-2xl border text-xs font-semibold animate-fade-in ${
              syncStatus.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : syncStatus.type === 'loading'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                : syncStatus.type === 'unconfigured'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-500'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <i className={`${
                    syncStatus.type === 'success'
                      ? 'ri-checkbox-circle-fill text-emerald-500 text-lg'
                      : syncStatus.type === 'loading'
                      ? 'ri-loader-4-line animate-spin text-rose-500 text-lg'
                      : syncStatus.type === 'unconfigured'
                      ? 'ri-information-fill text-amber-500 text-lg'
                      : 'ri-error-warning-fill text-rose-500 text-lg'
                  } not-italic shrink-0 mt-0.5`}></i>
                  <div>
                    <div className="font-bold text-sm">
                      {syncStatus.type === 'success' && 'Crawler Sync Dispatched'}
                      {syncStatus.type === 'loading' && 'Dispatching Crawler Sync...'}
                      {syncStatus.type === 'unconfigured' && 'Direct Serverless Dispatch Unconfigured'}
                      {(syncStatus.type === 'error' || syncStatus.type === 'unauthorized') && 'Sync Dispatch Failed'}
                    </div>
                    <div className="mt-1 text-slate-600 dark:text-slate-300 font-normal">
                      {syncStatus.message}
                    </div>
                    {syncStatus.jobId && (
                      <div className="mt-1.5 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                        Job Run ID: <span className="font-bold">{syncStatus.jobId}</span>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSyncStatus(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  title="Dismiss"
                >
                  <i className="ri-close-line not-italic text-base"></i>
                </button>
              </div>

              {/* Helpful options when unconfigured or instructions are needed */}
              {syncStatus.type === 'unconfigured' && (
                <div className="mt-3 pt-3 border-t border-amber-500/20 grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-700 dark:text-slate-300 font-normal">
                  <div className="p-3 rounded-xl bg-black/10 dark:bg-black/20 space-y-1.5">
                    <div className="font-bold text-xs flex items-center gap-1.5 text-slate-900 dark:text-white">
                      <i className="ri-github-fill not-italic text-sm"></i>
                      Option 1: 1-Click Trigger on GitHub
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Dispatches the live crawler runner instantly via GitHub Actions.
                    </p>
                    <a
                      href="https://github.com/thiyo-de/adcast-site/actions/workflows/auto-sync.yml"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold transition-all shadow-sm"
                    >
                      <span>Open GitHub Actions</span>
                      <i className="ri-external-link-line not-italic text-xs"></i>
                    </a>
                  </div>

                  <div className="p-3 rounded-xl bg-black/10 dark:bg-black/20 space-y-1.5">
                    <div className="font-bold text-xs flex items-center gap-1.5 text-slate-900 dark:text-white">
                      <i className="ri-terminal-box-line not-italic text-sm"></i>
                      Option 2: Run Locally via Terminal
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Run the sync engine directly on your development machine:
                    </p>
                    <code className="block p-1.5 rounded bg-black/30 text-[11px] font-mono text-amber-500 dark:text-amber-300 select-all">
                      npm --prefix adcast-sync-engine run sync
                    </code>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Form: Add / Edit Target Video Source */}
          <div className="p-5 sm:p-6 rounded-2xl glass-panel space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/10 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <i className="ri-add-circle-line not-italic text-rose-500"></i>
                {editingSourceId ? 'Edit Target Source' : 'Add New Target Video Source'}
              </h3>
              {editingSourceId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingSourceId(null);
                    setSourceForm({ name: '', url: '', category: 'Trending', video_limit: 15 });
                  }}
                  className="text-xs text-slate-400 hover:text-rose-500 font-semibold"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <form onSubmit={handleSaveSource} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Source Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={sourceForm.name}
                    onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })}
                    placeholder="e.g. HornyLeak (Latest Leaks)"
                    className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target Website Catalog URL *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      required
                      value={sourceForm.url}
                      onChange={(e) => setSourceForm({ ...sourceForm, url: e.target.value })}
                      placeholder="https://www.eporner.com or https://site.com/feed"
                      className="flex-1 px-3.5 py-2.5 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-rose-500"
                    />
                    <button
                      type="button"
                      onClick={handleDiscoverUrl}
                      disabled={isDiscovering || !sourceForm.url}
                      className="px-3.5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50 shrink-0 cursor-pointer"
                      title="Auto-detect source type and discover video streams"
                    >
                      {isDiscovering ? <i className="ri-loader-4-line not-italic animate-spin text-sm"></i> : <i className="ri-magic-line not-italic text-sm"></i>}
                      {isDiscovering ? 'Probing...' : 'Auto-Discover'}
                    </button>
                  </div>
                  {discoveryResult && (
                    <div className={`mt-2 p-2.5 rounded-xl text-xs border ${
                      discoveryResult.ok
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                    }`}>
                      <div className="font-bold flex items-center gap-1">
                        <i className={`${discoveryResult.ok ? 'ri-checkbox-circle-fill' : 'ri-alert-fill'} not-italic text-sm`}></i>
                        {discoveryResult.ok ? `Discovered: ${discoveryResult.detectedType}` : 'Discovery Notice'}
                      </div>
                      <div className="text-[11px] opacity-90">{discoveryResult.details?.message || discoveryResult.message}</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Adapter Type
                  </label>
                  <select
                    value={sourceForm.type || 'json_api'}
                    onChange={(e) => setSourceForm({ ...sourceForm, type: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white dark:[color-scheme:dark]"
                  >
                    <option value="json_api" className="bg-white dark:bg-[#0F111A]">JSON API (Fastest)</option>
                    <option value="mrss_feed" className="bg-white dark:bg-[#0F111A]">MRSS / RSS Feed (Standard)</option>
                    <option value="hornyleak" className="bg-white dark:bg-[#0F111A]">HornyLeak Platform</option>
                    <option value="html_scrape" className="bg-white dark:bg-[#0F111A]">HTML Web Crawler</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Default Category
                  </label>
                  <select
                    value={sourceForm.category}
                    onChange={(e) => setSourceForm({ ...sourceForm, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white dark:[color-scheme:dark]"
                  >
                    <option value="Trending" className="bg-white dark:bg-[#0F111A]">Trending</option>
                    <option value="Creator Leaks" className="bg-white dark:bg-[#0F111A]">Creator Leaks</option>
                    <option value="Amateur" className="bg-white dark:bg-[#0F111A]">Amateur</option>
                    <option value="Hardcore" className="bg-white dark:bg-[#0F111A]">Hardcore</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Video Limiter (per run)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      required
                      value={sourceForm.video_limit}
                      onChange={(e) => setSourceForm({ ...sourceForm, video_limit: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Publication / Moderation Setting */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60 dark:border-white/5">
                <input
                  type="checkbox"
                  id="auto_approve_toggle"
                  checked={sourceForm.auto_approve !== false}
                  onChange={(e) => setSourceForm({ ...sourceForm, auto_approve: e.target.checked })}
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <label htmlFor="auto_approve_toggle" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  <strong>Auto-publish imported videos immediately</strong> (uncheck to route imported streams to the Review Queue first)
                </label>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <i className="ri-save-line not-italic text-sm"></i>
                  {editingSourceId ? 'Update Target Source' : 'Save & Register Source'}
                </button>
              </div>
            </form>
          </div>

          {/* List: Configured Target Sources */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <i className="ri-list-check-2 not-italic text-cyan-500"></i>
                Configured Video Sources ({crawlerSources.length})
              </h3>
              <span className="text-xs text-slate-400">
                {crawlerSources.filter((s) => s.is_enabled).length} active, {crawlerSources.filter((s) => !s.is_enabled).length} paused
              </span>
            </div>

            {crawlerSources.length === 0 ? (
              <div className="p-8 text-center rounded-2xl glass-panel">
                <i className="ri-radar-line not-italic text-3xl text-slate-400 mb-2 block"></i>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">No sources registered yet</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Add your first target website above to begin syncing videos automatically.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {crawlerSources.map((source) => (
                  <div
                    key={source.id}
                    className={`p-4 rounded-2xl glass-card flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all border ${
                      source.is_enabled
                        ? 'border-slate-200/80 dark:border-white/10'
                        : 'border-slate-300/40 dark:border-white/5 opacity-60'
                    }`}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {source.name}
                        </h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                          {source.category}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                          {source.source_type || 'json_api'}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20">
                          Limit: {source.video_limit || 15}
                        </span>
                        {source.auto_approve === false && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            Queue Review
                          </span>
                        )}
                        {source.access_state === 'blocked_challenge' ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center gap-1">
                            <i className="ri-shield-alert-fill"></i> Challenge Blocked
                          </span>
                        ) : (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                              source.is_enabled
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : 'bg-slate-500/10 text-slate-400'
                            }`}
                          >
                            {source.is_enabled ? 'Active' : 'Paused'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono truncate">
                        <i className="ri-link text-xs"></i>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-rose-500 truncate"
                        >
                          {source.url}
                        </a>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleTriggerSync(source)}
                        disabled={isSyncingEngine || !source.is_enabled}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-600/10 hover:bg-rose-600 text-rose-500 hover:text-white text-xs font-bold transition-all disabled:opacity-40"
                        title="Fetch videos from this source right now"
                      >
                        <i className="ri-flashlight-line not-italic text-xs"></i>
                        Fetch Now
                      </button>

                      <button
                        onClick={() => handleToggleSource(source)}
                        className={`p-2 rounded-xl text-xs font-bold transition-all ${
                          source.is_enabled
                            ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                            : 'bg-slate-500/10 text-slate-400 hover:bg-slate-500/20'
                        }`}
                        title={source.is_enabled ? 'Pause this source' : 'Activate this source'}
                      >
                        <i className={`${source.is_enabled ? 'ri-toggle-fill' : 'ri-toggle-line'} not-italic text-base`}></i>
                      </button>

                      <button
                        onClick={() => handleEditSource(source)}
                        className="p-2 rounded-xl glass-button text-slate-400 hover:text-slate-800 dark:hover:text-white"
                        title="Edit source settings"
                      >
                        <i className="ri-edit-line not-italic text-sm"></i>
                      </button>

                      <button
                        onClick={() => handleDeleteSource(source.id)}
                        className="p-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-600 hover:text-white transition-all"
                        title="Remove source"
                      >
                        <i className="ri-delete-bin-line not-italic text-sm"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: AD NETWORK MANAGER */}
      {activeTab === 'ads' && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-600 dark:text-cyan-300 flex items-center justify-between">
            <span>
              💡 <strong>Ad Placement:</strong> Paste your real ad tags from <strong>ExoClick, JuicyAds, TrafficFactory, or Adsterra</strong> below.
            </span>
            <span className="font-bold uppercase text-[10px] tracking-wider px-2.5 py-0.5 rounded-full bg-cyan-500/20">
              Live Synced
            </span>
          </div>

          {/* Anti-AdBlock & Self-Hosted Affiliate Fallbacks Control Panel */}
          <div className="p-6 rounded-3xl glass-panel border border-cyan-500/30 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <i className="ri-shield-flash-line not-italic text-xl"></i>
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    Anti-AdBlock & Affiliate Fallback Engine
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      Revenue Defense
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Automatically recovers 35%–45% of traffic using Brave or ad-blockers with high-converting native offers.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {adSettings.affiliate_fallbacks?.isEnabled ? 'Enabled' : 'Disabled'}
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adSettings.affiliate_fallbacks?.isEnabled ?? true}
                    onChange={(e) =>
                      handleAffiliateUpdate({ isEnabled: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                  🛡️ VPN & Privacy Offer URL
                </label>
                <input
                  type="text"
                  value={adSettings.affiliate_fallbacks?.vpn?.url || ''}
                  onChange={(e) =>
                    setAdSettings((prev) => ({
                      ...prev,
                      affiliate_fallbacks: {
                        ...prev.affiliate_fallbacks,
                        vpn: { ...prev.affiliate_fallbacks?.vpn, url: e.target.value }
                      }
                    }))
                  }
                  placeholder="https://nordvpn.com?aff=yourId"
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white"
                />
                <span className="text-[10px] text-slate-400">Used in Top Leaderboard & Sticky Footer</span>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                  💬 18+ Live Stream / Dating URL
                </label>
                <input
                  type="text"
                  value={adSettings.affiliate_fallbacks?.dating?.url || ''}
                  onChange={(e) =>
                    setAdSettings((prev) => ({
                      ...prev,
                      affiliate_fallbacks: {
                        ...prev.affiliate_fallbacks,
                        dating: { ...prev.affiliate_fallbacks?.dating, url: e.target.value }
                      }
                    }))
                  }
                  placeholder="https://example.com/dating?aff=yourId"
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white"
                />
                <span className="text-[10px] text-slate-400">Used in Native In-Feed Recommendation Cards</span>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                  🎮 Cyber Gaming Offer URL
                </label>
                <input
                  type="text"
                  value={adSettings.affiliate_fallbacks?.gaming?.url || ''}
                  onChange={(e) =>
                    setAdSettings((prev) => ({
                      ...prev,
                      affiliate_fallbacks: {
                        ...prev.affiliate_fallbacks,
                        gaming: { ...prev.affiliate_fallbacks?.gaming, url: e.target.value }
                      }
                    }))
                  }
                  placeholder="https://example.com/gaming?aff=yourId"
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white"
                />
                <span className="text-[10px] text-slate-400">Used in Below-Player High-CTR Banner</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => handleAffiliateUpdate(adSettings.affiliate_fallbacks)}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                {savedSlotId === 'affiliate_fallbacks' ? (
                  <span className="text-white flex items-center gap-1">
                    <i className="ri-check-line not-italic text-sm"></i> Fallback URLs Saved!
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <i className="ri-save-line not-italic text-sm"></i> Save Affiliate Fallback URLs
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.keys(adSettings)
              .filter((slotKey) => slotKey.startsWith('slot_'))
              .map((slotKey) => {
              const slot = adSettings[slotKey];
              const isSaved = savedSlotId === slotKey;

              return (
                <div
                  key={slotKey}
                  className="p-5 rounded-2xl glass-panel space-y-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-500">
                          {slot.network}
                        </span>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">{slot.name}</h3>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={slot.isActive}
                          onChange={(e) =>
                            handleAdSlotUpdate(slotKey, { isActive: e.target.checked })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                      </label>
                    </div>

                    {slotKey === 'slot_video_preroll' ? (
                      <div className="space-y-3 pt-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                            ExoClick VAST Tag URL or Target Sponsor Link
                          </label>
                          <input
                            type="text"
                            value={slot.targetUrl || ''}
                            onChange={(e) =>
                              setAdSettings({
                                ...adSettings,
                                [slotKey]: { ...slot, targetUrl: e.target.value }
                              })
                            }
                            placeholder="https://example.com/sponsor"
                            className="w-full px-3 py-2 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                            Sponsor Title Overlay
                          </label>
                          <input
                            type="text"
                            value={slot.adTitle || ''}
                            onChange={(e) =>
                              setAdSettings({
                                ...adSettings,
                                [slotKey]: { ...slot, adTitle: e.target.value }
                              })
                            }
                            placeholder="Featured Sponsor..."
                            className="w-full px-3 py-2 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          Ad Code (Raw HTML / JavaScript script tag / iframe)
                        </label>
                        <textarea
                          rows={4}
                          value={slot.code || ''}
                          onChange={(e) =>
                            setAdSettings({
                              ...adSettings,
                              [slotKey]: { ...slot, code: e.target.value }
                            })
                          }
                          placeholder="Paste ad script from network here..."
                          className="w-full px-3 py-2 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl font-mono text-[11px] text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
                        />
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleAdSlotUpdate(slotKey, adSettings[slotKey])}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl glass-button text-xs font-bold"
                  >
                    {isSaved ? (
                      <span className="text-emerald-500 dark:text-emerald-400 flex items-center gap-1">
                        <i className="ri-check-line not-italic text-sm"></i> Saved!
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <i className="ri-save-line not-italic text-cyan-500 text-sm"></i> Save Ad Code
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: SUPABASE CLOUD SYNC */}
      {activeTab === 'supabase' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="p-6 rounded-3xl glass-panel space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <i className="ri-database-2-fill not-italic text-emerald-500 text-lg"></i>
                Connected Supabase Project
              </h3>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Project Ref: hrvlgnnetoexdbaaebfo
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Project URL
              </label>
              <input
                type="text"
                readOnly
                value={supabaseConfig.url}
                className="w-full px-4 py-2.5 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Supabase Anon (Public) Key
              </label>
              <input
                type="password"
                value={supabaseAnonKeyInput}
                onChange={(e) => setSupabaseAnonKeyInput(e.target.value)}
                placeholder="Paste your anon public key from Supabase Dashboard"
                className="w-full px-4 py-2.5 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSaveSupabaseKey}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all"
              >
                <i className="ri-save-line not-italic text-sm"></i> Save & Test Cloud Sync
              </button>

              <a
                href="https://supabase.com/dashboard/project/hrvlgnnetoexdbaaebfo/sql"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-full glass-button text-xs font-semibold"
              >
                Open SQL Editor <i className="ri-external-link-line not-italic text-xs"></i>
              </a>
            </div>

            {supabaseStatus && (
              <div
                className={`p-3 rounded-2xl text-xs font-semibold mt-3 ${
                  supabaseStatus === 'connected'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                }`}
              >
                {supabaseStatus === 'connected'
                  ? '✅ Connected to Supabase Cloud! Real-time syncing active.'
                  : `⚠️ ${supabaseStatus}`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: DMCA */}
      {activeTab === 'dmca' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">DMCA Notices & Takedowns</h2>
          {dmcaList.length === 0 ? (
            <div className="p-8 text-center rounded-2xl glass-card text-slate-400 text-xs">
              No takedown requests recorded. All clear!
            </div>
          ) : (
            <div className="space-y-3">
              {dmcaList.map((req) => (
                <div
                  key={req.id}
                  className="p-4 rounded-2xl glass-card flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white text-xs">{req.claimant_name}</span>
                      <span className="text-slate-400 text-xs">({req.claimant_email})</span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          req.status === 'resolved'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-amber-500/10 text-amber-500'
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>
                    <p className="text-xs text-rose-500 font-mono mt-1">{req.video_url}</p>
                    {req.notes && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{req.notes}</p>}
                  </div>

                  {req.status === 'pending' && (
                    <button
                      onClick={() => handleResolveDMCA(req.id)}
                      className="px-4 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-bold"
                    >
                      Mark Resolved
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: DEAD STREAMS (QUARANTINE) */}
      {activeTab === 'quarantine' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl glass-panel">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <i className="ri-error-warning-line not-italic text-rose-500"></i>
                Quarantined Dead Streams ({deadVideos.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                These streams were automatically soft-deleted by the health checker (source removed, 404). They are hidden from your public website. You can review and hard-delete them here.
              </p>
            </div>

            {deadVideos.length > 0 && (
              <button
                onClick={() => setIsPurgePreviewOpen(true)}
                disabled={isPurging}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-sm shadow-rose-600/30"
              >
                <i className="ri-delete-bin-2-line not-italic text-sm"></i>
                Review & Purge All ({deadVideos.length})
              </button>
            )}
          </div>

          {deadVideos.length === 0 ? (
            <div className="p-12 text-center rounded-2xl glass-panel">
              <i className="ri-checkbox-circle-line not-italic text-4xl text-emerald-500 mb-2 block"></i>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">All Streams Are Healthy!</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Zero dead streams found. The health checker will automatically move any broken streams here if a source site removes them.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {deadVideos.map((v) => (
                <div key={v.id} className="p-4 rounded-2xl glass-card flex flex-col justify-between gap-3 border border-rose-500/20">
                  <div className="flex gap-3">
                    <img
                      src={v.thumbnail_url}
                      alt={v.title}
                      className="w-24 h-16 object-cover rounded-xl bg-slate-800 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
                        {v.title}
                      </h4>
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-rose-500 font-mono">
                        <i className="ri-error-warning-line not-italic"></i>
                        {v.dead_reason || 'Source video deleted (404)'}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Duration: {v.duration} • Category: {v.category}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 dark:border-white/[0.06]">
                    <button
                      onClick={() => handleRestoreVideo(v.id)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-emerald-500 hover:text-emerald-400"
                      title="Restore back to active public site"
                    >
                      <i className="ri-refresh-line not-italic"></i>
                      Restore to Active
                    </button>

                    <button
                      onClick={() => handleHardDeleteVideo(v.id)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-rose-500 hover:text-rose-400"
                      title="Permanently remove from database"
                    >
                      <i className="ri-delete-bin-line not-italic"></i>
                      Hard Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Video Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg p-6 sm:p-7 rounded-3xl glass-panel shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              {editingVideo ? 'Edit Video Embed' : 'Add New Video Embed'}
            </h3>

            <form onSubmit={handleSaveVideo} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={videoForm.title}
                  onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })}
                  placeholder="Video title"
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Video URL (YouTube, Instagram Reel, Facebook Video, or .mp4/.m3u8) *
                </label>
                <input
                  type="text"
                  required
                  value={videoForm.embed_url}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const parsed = parseToEmbedUrl(raw);
                    const suggestedThumb = getThumbnailForUrl(raw, '');
                    setVideoForm(prev => ({
                      ...prev,
                      embed_url: parsed,
                      thumbnail_url: prev.thumbnail_url || suggestedThumb
                    }));
                  }}
                  placeholder="Paste YouTube, Instagram, Facebook, or direct video URL"
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Thumbnail Image URL *
                </label>
                <input
                  type="text"
                  required
                  value={videoForm.thumbnail_url}
                  onChange={(e) => setVideoForm({ ...videoForm, thumbnail_url: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                  <select
                    value={videoForm.category}
                    onChange={(e) => setVideoForm({ ...videoForm, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white dark:[color-scheme:dark]"
                  >
                    <option value="Trending" className="bg-white dark:bg-[#0F111A] text-slate-900 dark:text-white">Trending</option>
                    <option value="Cinematic" className="bg-white dark:bg-[#0F111A] text-slate-900 dark:text-white">Cinematic</option>
                    <option value="Music" className="bg-white dark:bg-[#0F111A] text-slate-900 dark:text-white">Music</option>
                    <option value="Action" className="bg-white dark:bg-[#0F111A] text-slate-900 dark:text-white">Action</option>
                    <option value="Tutorials" className="bg-white dark:bg-[#0F111A] text-slate-900 dark:text-white">Tutorials</option>
                    <option value="Featured" className="bg-white dark:bg-[#0F111A] text-slate-900 dark:text-white">Featured</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Quality</label>
                  <select
                    value={videoForm.quality}
                    onChange={(e) => setVideoForm({ ...videoForm, quality: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white dark:[color-scheme:dark]"
                  >
                    <option value="4K UHD" className="bg-white dark:bg-[#0F111A] text-slate-900 dark:text-white">4K UHD</option>
                    <option value="1080p 60FPS" className="bg-white dark:bg-[#0F111A] text-slate-900 dark:text-white">1080p 60FPS</option>
                    <option value="1080p" className="bg-white dark:bg-[#0F111A] text-slate-900 dark:text-white">1080p</option>
                    <option value="720p HD" className="bg-white dark:bg-[#0F111A] text-slate-900 dark:text-white">720p HD</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Duration</label>
                  <input
                    type="text"
                    value={videoForm.duration}
                    onChange={(e) => setVideoForm({ ...videoForm, duration: e.target.value })}
                    placeholder="12:45"
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={videoForm.tags}
                  onChange={(e) => setVideoForm({ ...videoForm, tags: e.target.value })}
                  placeholder="racing, tokyo, 4k"
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="feat"
                  checked={videoForm.is_featured}
                  onChange={(e) => setVideoForm({ ...videoForm, is_featured: e.target.checked })}
                  className="rounded bg-slate-100 dark:bg-white/[0.05] border-slate-300 dark:border-white/10 text-rose-600 focus:ring-0"
                />
                <label htmlFor="feat" className="text-xs text-slate-600 dark:text-slate-300">
                  Feature this video on homepage badge
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-full glass-button text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md"
                >
                  Save Video
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Purge All Dead Videos Preview Modal */}
      {isPurgePreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-xl max-h-[85vh] flex flex-col p-6 rounded-3xl glass-panel shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <i className="ri-error-warning-fill text-rose-500 not-italic"></i>
                Confirm Permanent Purge ({deadVideos.length} Streams)
              </h3>
              <button
                type="button"
                onClick={() => !isPurging && setIsPurgePreviewOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <i className="ri-close-line text-lg not-italic"></i>
              </button>
            </div>

            <div className="py-3 text-xs text-slate-600 dark:text-slate-300">
              <p>
                The following streams have been confirmed dead or quarantined. Purging will <strong>permanently delete</strong> their records and insert their embed URLs into <code className="text-rose-400">suppressed_videos</code> so automated scrapers will never re-import them.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 my-2 max-h-60 border border-slate-200 dark:border-white/[0.08] rounded-xl p-2 bg-slate-50 dark:bg-black/20">
              {deadVideos.map((v) => (
                <div key={v.id} className="flex items-center gap-3 p-2 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200/50 dark:border-white/[0.04]">
                  <img
                    src={v.thumbnail_url}
                    alt=""
                    className="w-12 h-8 object-cover rounded bg-slate-800 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {v.title}
                    </div>
                    <div className="text-[10px] text-rose-400 truncate">
                      Reason: {v.dead_reason || 'Source 404 / broken'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-white/10">
              <button
                type="button"
                disabled={isPurging}
                onClick={() => setIsPurgePreviewOpen(false)}
                className="px-4 py-2 rounded-full glass-button text-xs font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPurging}
                onClick={handlePurgeAllDeadVideos}
                className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/30 disabled:opacity-50"
              >
                <i className="ri-delete-bin-2-fill not-italic"></i>
                {isPurging ? 'Purging & Suppressing...' : `Permanently Purge All (${deadVideos.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
