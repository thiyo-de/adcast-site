import { createClient } from '@supabase/supabase-js';
import { store } from './store';

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

  async signUp(email, password) {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client is not configured.');
    const { data, error } = await supabase.auth.signUp({
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
      const { error } = await supabase.from('videos').delete().eq('id', id);
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
        .eq('is_active', false)
        .order('created_at', { ascending: false });
      return data || [];
    } catch (err) {
      return [];
    }
  },

  async restoreVideo(id) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase
          .from('videos')
          .update({ is_active: true, dead_reason: null })
          .eq('id', id);
      } catch (err) {
        console.error('Error restoring video:', err);
      }
    }
  },

  async hardDeleteAllDeadVideos() {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('videos').delete().eq('is_active', false);
      } catch (err) {
        console.error('Error purging dead videos:', err);
      }
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
        mapped[item.slot_id] = {
          ...mapped[item.slot_id],
          id: item.slot_id,
          name: item.name,
          network: item.network,
          code: item.code,
          isActive: item.is_active
        };
      });
      return mapped;
    } catch (err) {
      return store.getAdSettings();
    }
  },

  async updateAdSlot(slotId, fields) {
    const updated = store.updateAdSlot(slotId, fields);
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('ad_settings').upsert({
          slot_id: slotId,
          name: fields.name || slotId,
          network: fields.network || 'Custom',
          code: fields.code,
          is_active: fields.isActive !== false,
          updated_at: new Date().toISOString()
        });
      } catch (err) {}
    }
    return updated;
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

  async resolveDMCARequest(id) {
    store.resolveDMCARequest(id);
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase
          .from('takedown_requests')
          .update({ status: 'resolved' })
          .eq('id', id);
      } catch (err) {
        console.error('Error resolving DMCA request:', err);
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
      const { data, error } = await supabase
        .from('crawler_sources')
        .insert([{
          name: sourceData.name,
          url: sourceData.url,
          type: sourceData.type || 'hornyleak',
          category: sourceData.category || 'Trending',
          video_limit: parseInt(sourceData.video_limit, 10) || 15,
          is_enabled: sourceData.is_enabled !== false
        }])
        .select();
      return data ? data[0] : null;
    } catch (err) {
      console.error('Failed to add crawler source:', err);
      return null;
    }
  },

  async updateCrawlerSource(id, fields) {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('crawler_sources')
        .update(fields)
        .eq('id', id)
        .select();
      return data ? data[0] : null;
    } catch (err) {
      console.error('Failed to update crawler source:', err);
      return null;
    }
  },

  async deleteCrawlerSource(id) {
    const supabase = getSupabaseClient();
    if (!supabase) return false;
    try {
      await supabase.from('crawler_sources').delete().eq('id', id);
      return true;
    } catch (err) {
      console.error('Failed to delete crawler source:', err);
      return false;
    }
  }
};
