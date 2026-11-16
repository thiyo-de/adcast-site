import React, { useState, useEffect } from 'react';
import { store, parseToEmbedUrl, getThumbnailForUrl } from '../services/store';
import { api, getSupabaseConfig, saveSupabaseConfig, getSupabaseClient } from '../services/supabase';

export default function Admin({ onBack }) {
  const [isLoggedIn, setIsLoggedIn] = useState(store.isAdminLoggedIn());
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState(false);
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
    quality: '4K UHD',
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
    const ads = await api.getAdSettings();
    setAdSettings(ads);
    setDmcaList(store.getDMCARequests());
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (store.adminLogin(passwordInput)) {
      setIsLoggedIn(true);
      setAuthError(false);
    } else {
      setAuthError(true);
    }
  };

  const handleLogout = () => {
    store.adminLogout();
    setIsLoggedIn(false);
  };

  // Video Actions
  const handleSaveVideo = async (e) => {
    e.preventDefault();
    const tagArray = videoForm.tags.split(',').map((t) => t.trim()).filter(Boolean);
    const payload = {
      title: videoForm.title,
      embed_url: videoForm.embed_url,
      thumbnail_url: videoForm.thumbnail_url,
      duration: videoForm.duration,
      category: videoForm.category,
      quality: videoForm.quality || '4K UHD',
      rating: parseInt(videoForm.rating, 10) || 98,
      tags: tagArray,
      is_featured: videoForm.is_featured
    };

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
    loadData();
  };

  const handleDeleteVideo = async (id) => {
    if (window.confirm('Are you sure you want to delete this video?')) {
      await api.deleteVideo(id);
      loadData();
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
    if (window.confirm(`Are you sure you want to PERMANENTLY delete all ${deadVideos.length} dead streams?`)) {
      setIsPurging(true);
      await api.hardDeleteAllDeadVideos();
      setIsPurging(false);
      loadData();
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

  // Ad Slot Updates
  const handleAdSlotUpdate = async (slotId, fields) => {
    const updated = await api.updateAdSlot(slotId, fields);
    setAdSettings(updated);
    setSavedSlotId(slotId);
    setTimeout(() => setSavedSlotId(null), 2500);
  };

  const handleAffiliateUpdate = (fields) => {
    const current = store.getAdSettings();
    const updated = {
      ...current,
      affiliate_fallbacks: {
        ...current.affiliate_fallbacks,
        ...fields
      }
    };
    store.saveAdSettings(updated);
    setAdSettings(updated);
    setSavedSlotId('affiliate_fallbacks');
    setTimeout(() => setSavedSlotId(null), 2500);
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

  const handleResolveDMCA = (id) => {
    store.resolveDMCARequest(id);
    setDmcaList(store.getDMCARequests());
  };

  // 1. Master Login Gate
  if (!isLoggedIn) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md p-8 rounded-3xl glass-panel shadow-2xl">
          <div className="text-center mb-6">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
              <i className="ri-lock-2-fill not-italic text-3xl"></i>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">HornyLeaks Admin</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Private Dashboard & Ad Network Engine
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Master Security Password
              </label>
              <input
                type="password"
                required
                autoFocus
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter admin password (default: admin123)"
                className="w-full px-4 py-3 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-2xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
              />
              {authError && (
                <p className="text-xs text-rose-500 mt-1.5 font-semibold flex items-center gap-1">
                  <i className="ri-error-warning-fill not-italic text-sm"></i> Incorrect password. Try: admin123
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition-all cursor-pointer"
            >
              Sign In to Dashboard
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
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                LIVE
              </span>
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
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-rose-500/10 text-rose-500 hover:bg-rose-600 hover:text-white text-xs font-semibold border border-rose-500/20 transition-all"
          >
            <i className="ri-logout-box-r-line not-italic text-sm"></i> Logout
          </button>
        </div>
      </div>

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
                onClick={handlePurgeAllDeadVideos}
                disabled={isPurging}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-sm shadow-rose-600/30"
              >
                <i className="ri-delete-bin-2-line not-italic text-sm"></i>
                {isPurging ? 'Purging...' : 'Hard Delete All Dead Streams'}
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
    </div>
  );
}
