import { createClient } from '@supabase/supabase-js';
import { store, isPlaceholderAdCode } from './store';
import { computeCategoryCounts } from '../constants/categories';

const DEFAULT_SUPABASE_URL = 'https://hrvlgnnetoexdbaaebfo.supabase.co';
const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhydmxnbm5ldG9leGRiYWFlYmZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ0NzMyMTMsImV4cCI6MjExMDA0OTIxM30.ZtBow6MB1bE4eusuSAjuHredn3FaL6y4dkoWnkK3zhM';
const STORAGE_KEY_ANON = 'adcast_supabase_anon_key';
const STORAGE_KEY_URL = 'adcast_supabase_url';

export const getSupabaseConfig = () => {
  const url = localStorage.getItem(STORAGE_KEY_URL) || import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const anonKey = localStorage.getItem(STORAGE_KEY_ANON) || import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;
  return { url, anonKey, isConfigured: Boolean(anonKey && anonKey.length > 20) };
};

export const saveSupabaseConfig = (url, anonKey) => {
  localStorage.setItem(STORAGE_KEY_URL, url || DEFAULT_SUPABASE_URL);
  localStorage.setItem(STORAGE_KEY_ANON, anonKey || '');
  clientInstance = null;
};

let clientInstance = null;

export const getSupabaseClient = () => {
  const { url, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return null;
  if (!clientInstance) {
    clientInstance = createClient(url, anonKey);
  }
  return clientInstance;
};

// Supabase Authentication Service (C01)
export const auth = {
  async getSession() {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) return null;
      return data?.session || null;
    } catch {
      return null;
    }
  },

  async getUser() {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) return null;
      return data?.user || null;
    } catch {
      return null;
    }
  },

  async signIn(email, password) {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client is not configured.');
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Supabase sign out error:', err);
      }
    }
    store.adminLogout();
  },

  onAuthStateChange(callback) {
    const supabase = getSupabaseClient();
    if (!supabase) return { unsubscribe: () => {} };
    const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
    return subscription;
  }
};

// Unified Data Access API
export const api = {
  async getVideos() {
    const supabase = getSupabaseClient();
    if (!supabase) return store.getVideos();

    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .or('is_active.eq.true,is_active.is.null')
        .or('publication_state.eq.published,publication_state.is.null')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Supabase fetch failed, falling back to local cache:', error);
        return store.getVideos();
      }
      // Cloud database is authoritative: empty table returns [] without reviving SEED_VIDEOS
      return data || [];
    } catch (err) {
      console.warn('Supabase fetch failed, using local store:', err);
      return store.getVideos();
    }
  },

  async getVideosPage({ page = 1, pageSize = 24, category = 'All', search = '', sort = 'newest' } = {}) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return this.getLocalVideosPage({ page, pageSize, category, search, sort });
    }

    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('videos')
        .select('*', { count: 'exact' })
        .or('is_active.eq.true,is_active.is.null')
        .or('publication_state.eq.published,publication_state.is.null')
        .range(from, to);

      if (category && category !== 'All') {
        query = query.eq('category', category);
      }

      const q = (search || '').trim();
      if (q) {
        query = query.or(`title.ilike.%${q}%,category.ilike.%${q}%`);
      }

      switch (sort) {
        case 'views':
        case 'trending':
          query = query.order('views', { ascending: false });
          break;
        case 'top_rated':
          query = query.order('rating', { ascending: false });
          break;
        case 'newest':
        default:
          query = query.order('created_at', { ascending: false });
          break;
      }

      const { data, count, error } = await query;
      if (error) {
        console.warn('Supabase getVideosPage failed, falling back to local store:', error);
        return this.getLocalVideosPage({ page, pageSize, category, search, sort });
      }

      const total = typeof count === 'number' ? count : (data ? data.length : 0);
      return {
        items: data || [],
        total,
        page,
        pageSize,
        hasMore: total > to + 1
      };
    } catch (err) {
      console.warn('Supabase getVideosPage error, falling back to local store:', err);
      return this.getLocalVideosPage({ page, pageSize, category, search, sort });
    }
  },

  getLocalVideosPage({ page = 1, pageSize = 24, category = 'All', search = '', sort = 'newest' } = {}) {
    let pool = store.getVideos() || [];
    if (category && category !== 'All') {
      pool = pool.filter((v) => v.category === category);
    }
    const q = (search || '').trim().toLowerCase();
    if (q) {
      pool = pool.filter(
        (v) =>
          (v.title && v.title.toLowerCase().includes(q)) ||
          (v.category && v.category.toLowerCase().includes(q))
      );
    }
    switch (sort) {
      case 'views':
      case 'trending':
        pool.sort((a, b) => (b.views || 0) - (a.views || 0));
        break;
      case 'top_rated':
        pool.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'newest':
      default:
        pool.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        break;
    }
    const total = pool.length;
    const from = (page - 1) * pageSize;
    const items = pool.slice(from, from + pageSize);
    return {
      items,
      total,
      page,
      pageSize,
      hasMore: total > from + pageSize
    };
  },

  async getRelatedVideos(category, excludeId = null, limit = 12) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      const pool = store.getVideos() || [];
      return pool
        .filter((v) => (!excludeId || v.id !== excludeId) && (!category || category === 'All' || v.category === category))
        .slice(0, limit);
    }
    try {
      let query = supabase
        .from('videos')
        .select('*')
        .or('is_active.eq.true,is_active.is.null')
        .or('publication_state.eq.published,publication_state.is.null')
        .limit(limit);

      if (category && category !== 'All') {
        query = query.eq('category', category);
      }
      if (excludeId) {
        query = query.neq('id', excludeId);
      }
      query = query.order('views', { ascending: false });

      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        const pool = store.getVideos() || [];
        return pool.filter((v) => !excludeId || v.id !== excludeId).slice(0, limit);
      }
      return data;
    } catch {
      const pool = store.getVideos() || [];
      return pool.filter((v) => !excludeId || v.id !== excludeId).slice(0, limit);
    }
  },

  async getCategoryCounts() {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return computeCategoryCounts(store.getVideos());
    }
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('category')
        .or('is_active.eq.true,is_active.is.null')
        .or('publication_state.eq.published,publication_state.is.null');

      if (error || !data) {
        return computeCategoryCounts(store.getVideos());
      }
      return computeCategoryCounts(data);
    } catch {
      return computeCategoryCounts(store.getVideos());
    }
  },

  async getVideoById(id) {
    const supabase = getSupabaseClient();
    if (!supabase) return store.getVideoById(id);

    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) return store.getVideoById(id);
      return data;
    } catch (err) {
      return store.getVideoById(id);
    }
  },

  async addVideo(videoData) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('videos').insert([videoData]).select();
      if (error) {
        console.error('Supabase video insert error:', error);
        throw error;
      }
      if (data && data[0]) {
        store.addVideo(data[0]);
        return data[0];
      }
    }
    return store.addVideo(videoData);
  },

  async updateVideo(id, fields) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('videos').update(fields).eq('id', id).select();
      if (error) {
        console.error('Supabase video update error:', error);
        throw error;
      }
      if (data && data[0]) {
        store.updateVideo(id, fields);
        return data[0];
      }
    }
    return store.updateVideo(id, fields);
  },

  async deleteVideo(id) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { error } = await supabase.rpc('hard_delete_and_suppress_video', {
        p_video_id: id,
        p_reason: 'admin_deleted'
      });
      if (error) {
        console.error('Supabase video delete error:', error);
        throw error;
      }
    }
    return store.deleteVideo(id);
  },

  async getDeadVideos() {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .in('health_state', ['dead', 'quarantined'])
        .neq('publication_state', 'rejected')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error fetching dead videos:', error);
        return [];
      }
      return data || [];
    } catch (err) {
      console.error('Exception fetching dead videos:', err);
      return [];
    }
  },

  async quarantineVideo(id, reason = 'user_reported_broken') {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase
          .from('videos')
          .update({ is_active: false, health_state: 'quarantined', dead_reason: reason })
          .eq('id', id);
      } catch (err) {
        console.error('Error quarantining video:', err);
      }
    }
  },

  async restoreVideo(id) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase
          .from('videos')
          .update({ is_active: true, health_state: 'healthy', dead_reason: null })
          .eq('id', id);
      } catch (err) {
        console.error('Error restoring video:', err);
      }
    }
  },

  async getPendingVideos() {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('publication_state', 'pending')
        .order('created_at', { ascending: false });
      return data || [];
    } catch (err) {
      console.error('Error fetching pending videos:', err);
      return [];
    }
  },

  async approveVideo(id) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.rpc('approve_video', { p_video_id: id });
      } catch (rpcErr) {
        await supabase.from('videos').update({ publication_state: 'published' }).eq('id', id);
      }
    }
  },

  async rejectVideo(id) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.rpc('reject_video', { p_video_id: id });
      } catch (rpcErr) {
        await supabase.from('videos').update({ publication_state: 'rejected', is_active: false }).eq('id', id);
      }
    }
  },

  async hardDeleteAllDeadVideos() {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.rpc('hard_delete_and_suppress_dead_videos', {
        p_reason: 'bulk_purged_quarantine'
      });
      if (error) {
        console.error('Error purging dead videos:', error);
        throw error;
      }
      return data;
    }
  },

  async getAdSettings() {
    const supabase = getSupabaseClient();
    if (!supabase) return store.getAdSettings();

    try {
      const { data, error } = await supabase.from('ad_settings').select('*');
      if (error || !data || data.length === 0) return store.getAdSettings();

      const mapped = { ...store.getAdSettings() };
      data.forEach(item => {
        if (item.slot_id === 'affiliate_fallbacks') {
          try {
            const parsed = typeof item.code === 'string' ? JSON.parse(item.code) : item.code;
            mapped.affiliate_fallbacks = {
              ...mapped.affiliate_fallbacks,
              ...parsed
            };
          } catch (e) {}
          return;
        }

        let code = item.code;
        // Targeted migration: Repair historical typo in top banner class if present in DB
        if (item.slot_id === 'slot_top_banner' && code && code.includes('class="eas6a9788e2"')) {
          code = code.replace('class="eas6a9788e2"', 'class="eas6a97888e2"');
        }

        // Targeted migration: Upgrade legacy adConfig popunder to verified ad_idzone tag
        if (item.slot_id === 'slot_popunder' && code && (code.includes('adConfig') || code.includes('1440'))) {
          code = existing.code;
        }

        const existing = mapped[item.slot_id] || {};
        // Inoculate against placeholder poisoning: If remote code is a placeholder, retain existing working code
        if (isPlaceholderAdCode(code) && existing.code && !isPlaceholderAdCode(existing.code)) {
          code = existing.code;
        }

        mapped[item.slot_id] = {
          ...existing,
          id: item.slot_id,
          name: item.name || existing.name,
          network: item.network || existing.network,
          dimensions: item.dimensions || existing.dimensions,
          code: code,
          format: item.format || existing.format,
          targetUrl: item.target_url || existing.targetUrl,
          vastUrl: item.vast_url || existing.vastUrl,
          frequencyHours: item.frequency_hours !== undefined ? item.frequency_hours : existing.frequencyHours,
          isActive: item.is_active !== false
        };
      });
      return mapped;
    } catch (err) {
      console.warn('Failed to fetch cloud ad settings, falling back to local store:', err);
      return store.getAdSettings();
    }
  },

  async updateAdSlot(slotId, fields) {
    const updated = store.updateAdSlot(slotId, fields);
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const payload = {
          slot_id: slotId,
          name: fields.name || slotId,
          network: fields.network || 'Custom',
          dimensions: fields.dimensions || 'Custom',
          code: fields.code !== undefined ? fields.code : null,
          format: fields.format || 'banner',
          target_url: fields.targetUrl || null,
          vast_url: fields.vastUrl || null,
          frequency_hours: fields.frequencyHours !== undefined ? fields.frequencyHours : 1,
          is_active: fields.isActive !== false,
          updated_at: new Date().toISOString()
        };

        const { error } = await supabase.from('ad_settings').upsert(payload);
        if (error) {
          console.error('Supabase updateAdSlot error:', error.message);
          throw error;
        }
      } catch (err) {
        console.error('Error updating cloud ad slot:', err);
        throw err;
      }
    }
    return updated;
  },

  async updateAffiliateFallbacks(fields) {
    const current = store.getAdSettings();
    const updated = {
      ...current,
      affiliate_fallbacks: {
        ...current.affiliate_fallbacks,
        ...fields
      }
    };
    store.saveAdSettings(updated);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('ad_settings').upsert({
          slot_id: 'affiliate_fallbacks',
          name: 'Affiliate Fallback Campaigns',
          network: 'Direct / Internal',
          dimensions: 'Flexible',
          format: 'affiliate',
          code: JSON.stringify(updated.affiliate_fallbacks),
          is_active: updated.affiliate_fallbacks.isEnabled !== false,
          updated_at: new Date().toISOString()
        });
      } catch (err) {
        console.error('Failed to sync affiliate fallbacks to Supabase:', err);
        throw err;
      }
    }
    return updated;
  },

  subscribeToAdSettings(callback) {
    const supabase = getSupabaseClient();
    if (!supabase) return () => {};

    try {
      const channel = supabase
        .channel('public:ad_settings')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ad_settings' },
          async () => {
            const latest = await api.getAdSettings();
            if (typeof callback === 'function') {
              callback(latest);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (err) {
      console.warn('Realtime ad settings subscription error:', err);
      return () => {};
    }
  },

  async submitTakedown(req) {
    const local = store.submitDMCARequest(req);
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('takedown_requests').insert([req]);
      } catch (err) {
        console.error('Supabase submit takedown error:', err);
      }
    }
    return local;
  },

  async getDMCARequests() {
    const supabase = getSupabaseClient();
    if (!supabase) return store.getDMCARequests();
    try {
      const { data, error } = await supabase
        .from('takedown_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error || !data) return store.getDMCARequests();
      return data;
    } catch (err) {
      console.warn('Failed to fetch cloud takedowns, using local store:', err);
      return store.getDMCARequests();
    }
  },

  async resolveDMCARequest(id, action = 'takedown_and_suppress') {
    store.resolveDMCARequest(id);
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: req } = await supabase
          .from('takedown_requests')
          .select('*')
          .eq('id', id)
          .single();

        if (req && req.video_url && action === 'takedown_and_suppress') {
          const rawUrl = req.video_url.trim();

          let videoToTakedown = null;
          const { data: exactMatch } = await supabase
            .from('videos')
            .select('id, embed_url')
            .eq('embed_url', rawUrl)
            .maybeSingle();

          if (exactMatch) {
            videoToTakedown = exactMatch;
          } else {
            const uuidMatch = rawUrl.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
            if (uuidMatch) {
              const { data: idMatch } = await supabase
                .from('videos')
                .select('id, embed_url')
                .eq('id', uuidMatch[0])
                .maybeSingle();
              if (idMatch) videoToTakedown = idMatch;
            }
          }

          if (videoToTakedown) {
            await supabase
              .from('videos')
              .update({ publication_state: 'rejected', is_active: false })
              .eq('id', videoToTakedown.id);

            await supabase
              .from('suppressed_videos')
              .upsert({
                embed_url: videoToTakedown.embed_url,
                reason: 'dmca_takedown',
                suppressed_by: 'admin_dmca_resolution'
              }, { onConflict: 'embed_url' });
          } else if (rawUrl.startsWith('http')) {
            await supabase
              .from('suppressed_videos')
              .upsert({
                embed_url: rawUrl,
                reason: 'dmca_takedown',
                suppressed_by: 'admin_dmca_resolution'
              }, { onConflict: 'embed_url' });
          }
        }

        const { error } = await supabase
          .from('takedown_requests')
          .update({ status: 'resolved' })
          .eq('id', id);

        if (error) throw error;
      } catch (err) {
        console.error('Error resolving DMCA request:', err);
        throw err;
      }
    }
  },

  // Crawler Sources Management
  async getCrawlerSources() {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('crawler_sources')
        .select('*')
        .order('created_at', { ascending: true });
      return data || [];
    } catch (err) {
      console.warn('Failed to fetch crawler sources:', err);
      return [];
    }
  },

  async addCrawlerSource(sourceData) {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    try {
      const typeVal = sourceData.type || sourceData.source_type || 'json_api';
      const { data, error } = await supabase
        .from('crawler_sources')
        .insert([{
          name: sourceData.name,
          url: sourceData.url,
          type: typeVal,
          category: sourceData.category || 'Trending',
          video_limit: parseInt(sourceData.video_limit, 10) || 15,
          is_enabled: sourceData.is_enabled !== false,
          auto_approve: sourceData.auto_approve !== false
        }])
        .select();
      if (error) {
        console.error('Failed to add crawler source:', error);
        throw error;
      }
      const created = data ? data[0] : null;
      if (created && created.id) {
        try {
          await supabase
            .from('source_schedules')
            .upsert({
              source_id: created.id,
              timezone: 'Asia/Calcutta',
              cron_expression: '0 */4 * * *',
              is_active: true
            }, { onConflict: 'source_id' });
        } catch (schedErr) {
          console.warn('Initial schedule setup notice:', schedErr);
        }
      }
      return created;
    } catch (err) {
      console.error('Failed to add crawler source:', err);
      throw err;
    }
  },

  async updateCrawlerSource(id, fields) {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    try {
      const updateData = { ...fields };
      if (updateData.source_type && !updateData.type) {
        updateData.type = updateData.source_type;
        delete updateData.source_type;
      }
      const { data, error } = await supabase
        .from('crawler_sources')
        .update(updateData)
        .eq('id', id)
        .select();
      if (error) {
        console.error('Failed to update crawler source:', error);
        throw error;
      }
      return data ? data[0] : null;
    } catch (err) {
      console.error('Failed to update crawler source:', err);
      throw err;
    }
  },

  async deleteCrawlerSource(id) {
    const supabase = getSupabaseClient();
    if (!supabase) return false;
    try {
      const { error } = await supabase.from('crawler_sources').delete().eq('id', id);
      if (error) {
        console.error('Failed to delete crawler source:', error);
        throw error;
      }
      return true;
    } catch (err) {
      console.error('Failed to delete crawler source:', err);
      throw err;
    }
  },

  async triggerSync(source = null) {
    const session = await auth.getSession();
    const token = session?.access_token;
    const webhookUrl = import.meta.env.VITE_SYNC_WEBHOOK_URL || '/.netlify/functions/trigger-sync';

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          source_id: source?.id || null,
          source_name: source?.name || null,
          source_url: source?.url || null
        })
      });

      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          status: 'unauthorized',
          message: 'Admin authorization required. Please sign in with an authorized administrator account.'
        };
      }

      if (response.status === 404 || response.status === 501) {
        return {
          ok: false,
          status: 'unconfigured',
          message: 'Serverless crawler webhook trigger is unconfigured on this host.'
        };
      }

      const result = await response.json().catch(() => ({}));
      if (response.ok && result.ok) {
        return {
          ok: true,
          status: 'dispatched',
          jobId: result.jobId || result.run_id || null,
          message: result.message || 'Crawler sync job successfully dispatched.'
        };
      }

      return {
        ok: false,
        status: result.status || 'error',
        message: result.message || `Server responded with HTTP ${response.status}`
      };
    } catch (err) {
      return {
        ok: false,
        status: 'unconfigured',
        message: 'No active serverless trigger endpoint detected.'
      };
    }
  },

  async discoverSource(targetUrl) {
    const session = await auth.getSession();
    const token = session?.access_token;
    const discoverUrl = '/.netlify/functions/discover-source';

    try {
      const response = await fetch(discoverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ targetUrl })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { ok: false, message: err.message || `Probing failed with status ${response.status}` };
      }

      return await response.json();
    } catch (err) {
      return {
        ok: false,
        message: 'Could not contact discovery service. Check serverless functions or specify type manually.'
      };
    }
  }
};
