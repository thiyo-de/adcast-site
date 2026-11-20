-- ==============================================================
-- AdCast / HornyLeaks Supabase Database Schema & Seed Script
-- Project: https://hrvlgnnetoexdbaaebfo.supabase.co
-- Production Domain: https://hornyleaks.site
-- ==============================================================

-- 1. Create Videos Table (with full schema compatibility)
CREATE TABLE IF NOT EXISTS public.videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    embed_url TEXT NOT NULL,
    thumbnail_url TEXT NOT NULL,
    duration TEXT DEFAULT '10:00',
    duration_seconds INTEGER DEFAULT 600,
    category TEXT DEFAULT 'Trending',
    tags TEXT[] DEFAULT ARRAY['trending']::TEXT[],
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    quality TEXT DEFAULT '1080p',
    rating INTEGER DEFAULT 95,
    is_featured BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    dead_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Non-destructive column migrations for existing databases
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 600;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS quality TEXT DEFAULT '1080p';
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT 95;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS dead_reason TEXT;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS health_state TEXT DEFAULT 'healthy';
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS first_failed_at TIMESTAMPTZ;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS last_health_check_at TIMESTAMPTZ;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS publication_state TEXT DEFAULT 'published';

-- Indexes for fast catalog browsing & health checks
CREATE UNIQUE INDEX IF NOT EXISTS idx_videos_embed_url ON public.videos (embed_url);
CREATE INDEX IF NOT EXISTS idx_videos_category ON public.videos (category);
CREATE INDEX IF NOT EXISTS idx_videos_is_active ON public.videos (is_active);
CREATE INDEX IF NOT EXISTS idx_videos_health_state ON public.videos (health_state);
CREATE INDEX IF NOT EXISTS idx_videos_publication_state ON public.videos (publication_state);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON public.videos (created_at DESC);

-- 2. Create Ad Settings Table
CREATE TABLE IF NOT EXISTS public.ad_settings (
    slot_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    network TEXT NOT NULL,
    dimensions TEXT DEFAULT '728x90',
    code TEXT,
    format TEXT DEFAULT 'banner',
    target_url TEXT,
    vast_url TEXT,
    frequency_hours INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Non-destructive column migrations for ad_settings
ALTER TABLE public.ad_settings ADD COLUMN IF NOT EXISTS format TEXT DEFAULT 'banner';
ALTER TABLE public.ad_settings ADD COLUMN IF NOT EXISTS target_url TEXT;
ALTER TABLE public.ad_settings ADD COLUMN IF NOT EXISTS vast_url TEXT;
ALTER TABLE public.ad_settings ADD COLUMN IF NOT EXISTS frequency_hours INTEGER DEFAULT 1;

-- 3. Create DMCA Takedown Requests Table
CREATE TABLE IF NOT EXISTS public.takedown_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_url TEXT NOT NULL,
    claimant_name TEXT NOT NULL,
    claimant_email TEXT NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create Crawler Sources Table (Engine & Admin Sync)
CREATE TABLE IF NOT EXISTS public.crawler_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    category TEXT DEFAULT 'Trending',
    video_limit INTEGER DEFAULT 15,
    is_enabled BOOLEAN DEFAULT true,
    mapping JSONB DEFAULT '{}'::jsonb,
    source_type TEXT DEFAULT 'json_api',
    access_state TEXT DEFAULT 'ok',
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crawler_sources_is_enabled ON public.crawler_sources (is_enabled);
ALTER TABLE public.crawler_sources ADD COLUMN IF NOT EXISTS mapping JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.crawler_sources ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'json_api';
ALTER TABLE public.crawler_sources ADD COLUMN IF NOT EXISTS access_state TEXT DEFAULT 'ok';
ALTER TABLE public.crawler_sources ADD COLUMN IF NOT EXISTS auto_approve BOOLEAN DEFAULT true;
ALTER TABLE public.crawler_sources ADD COLUMN IF NOT EXISTS selectors JSONB DEFAULT '{}'::jsonb;

-- Health State Constraint for videos (healthy, suspect, quarantined, unknown)
ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS videos_health_state_check;
ALTER TABLE public.videos ADD CONSTRAINT videos_health_state_check 
    CHECK (health_state IN ('healthy', 'suspect', 'quarantined', 'unknown'));

-- 5. Create Suppressed Videos (Tombstones for deleted / DMCA / dead videos)
CREATE TABLE IF NOT EXISTS public.suppressed_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    embed_url TEXT NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    suppressed_at TIMESTAMPTZ DEFAULT now(),
    suppressed_by TEXT DEFAULT 'system'
);
CREATE INDEX IF NOT EXISTS idx_suppressed_videos_embed_url ON public.suppressed_videos (embed_url);

-- 6. Create Source Schedules (Asia/Calcutta Autonomous Engine Schedules)
CREATE TABLE IF NOT EXISTS public.source_schedules (
    source_id UUID PRIMARY KEY REFERENCES public.crawler_sources(id) ON DELETE CASCADE,
    cron_expression TEXT DEFAULT '0 */6 * * *',
    timezone TEXT DEFAULT 'Asia/Calcutta',
    interval_minutes INTEGER DEFAULT 360,
    next_run_at TIMESTAMPTZ,
    last_run_at TIMESTAMPTZ,
    run_state TEXT DEFAULT 'idle',
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Create Source Checkpoints (Incremental Pagination State)
CREATE TABLE IF NOT EXISTS public.source_checkpoints (
    source_id UUID PRIMARY KEY REFERENCES public.crawler_sources(id) ON DELETE CASCADE,
    last_page INTEGER DEFAULT 1,
    cursor_value TEXT,
    last_video_external_id TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================
-- 8. Admin Security Helper Function
-- ==============================================================
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean AS $$
BEGIN
  IF auth.jwt() IS NULL THEN
    RETURN false;
  END IF;
  RETURN COALESCE(
    (auth.jwt() ->> 'email' = 'admin@hornyleaks.site') OR 
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'),
    false
  );
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================
-- 9. Row Level Security (RLS) Configuration (Strict Admin Lock)
-- ==============================================================
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.takedown_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crawler_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppressed_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_checkpoints ENABLE ROW LEVEL SECURITY;

-- Clean up permissive legacy policies
DROP POLICY IF EXISTS "Allow video mutations" ON public.videos;
DROP POLICY IF EXISTS "Allow ad mutations" ON public.ad_settings;
DROP POLICY IF EXISTS "Allow viewing takedown requests" ON public.takedown_requests;
DROP POLICY IF EXISTS "Public videos can be read by anyone" ON public.videos;
DROP POLICY IF EXISTS "Public ad settings can be read by anyone" ON public.ad_settings;
DROP POLICY IF EXISTS "Anyone can submit a takedown request" ON public.takedown_requests;
DROP POLICY IF EXISTS "Public can view crawler sources" ON public.crawler_sources;
DROP POLICY IF EXISTS "Admins can view crawler sources" ON public.crawler_sources;

-- A. Videos Policies
CREATE POLICY "Public videos can be read by anyone" ON public.videos
    FOR SELECT USING ((is_active = true OR is_active IS NULL) AND (publication_state = 'published' OR publication_state IS NULL));

CREATE POLICY "Admins can mutate videos" ON public.videos
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- B. Ad Settings Policies
CREATE POLICY "Public ad settings can be read by anyone" ON public.ad_settings
    FOR SELECT USING (true);

CREATE POLICY "Admins can mutate ad settings" ON public.ad_settings
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- C. Takedown Requests Policies
CREATE POLICY "Anyone can submit a takedown request" ON public.takedown_requests
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view and manage takedowns" ON public.takedown_requests
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- D. Crawler Sources Policies (Internal: Admins Only)
CREATE POLICY "Admins can view crawler sources" ON public.crawler_sources
    FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can mutate crawler sources" ON public.crawler_sources
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- E. Engine Support Policies (Suppressed Videos, Schedules, Checkpoints)
CREATE POLICY "Admins can manage suppressed_videos" ON public.suppressed_videos
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can manage source_schedules" ON public.source_schedules
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can manage source_checkpoints" ON public.source_checkpoints
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ==============================================================
-- 10. Atomic Hard-Deletion & Suppression RPCs (Hardened Authorization)
-- ==============================================================
CREATE OR REPLACE FUNCTION public.hard_delete_and_suppress_video(p_video_id uuid, p_reason text DEFAULT 'admin_deleted')
RETURNS boolean AS $$
DECLARE v_embed_url text;
BEGIN
  IF public.is_admin() IS NOT TRUE THEN 
    RAISE EXCEPTION 'Unauthorized: Administrator access required'; 
  END IF;
  SELECT embed_url INTO v_embed_url FROM public.videos WHERE id = p_video_id;
  IF v_embed_url IS NULL THEN RETURN false; END IF;
  INSERT INTO public.suppressed_videos (embed_url, reason, suppressed_at, suppressed_by)
  VALUES (TRIM(v_embed_url), p_reason, now(), auth.jwt() ->> 'email')
  ON CONFLICT (embed_url) DO UPDATE SET reason = EXCLUDED.reason, suppressed_at = now();
  DELETE FROM public.videos WHERE id = p_video_id;
  RETURN true;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.hard_delete_and_suppress_dead_videos(p_reason text DEFAULT 'bulk_purged_quarantine')
RETURNS integer AS $$
DECLARE v_count integer;
BEGIN
  IF public.is_admin() IS NOT TRUE THEN 
    RAISE EXCEPTION 'Unauthorized: Administrator access required'; 
  END IF;
  INSERT INTO public.suppressed_videos (embed_url, reason, suppressed_at, suppressed_by)
  SELECT TRIM(embed_url), p_reason, now(), auth.jwt() ->> 'email'
  FROM public.videos 
  WHERE is_active = false 
    AND (publication_state IS NULL OR publication_state != 'rejected')
    AND (health_state = 'dead' OR health_state = 'quarantined')
  ON CONFLICT (embed_url) DO UPDATE SET reason = EXCLUDED.reason, suppressed_at = now();

  WITH deleted AS (
    DELETE FROM public.videos 
    WHERE is_active = false 
      AND (publication_state IS NULL OR publication_state != 'rejected')
      AND (health_state = 'dead' OR health_state = 'quarantined')
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM deleted;
  RETURN v_count;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.approve_video(p_video_id uuid)
RETURNS boolean AS $$
BEGIN
  IF public.is_admin() IS NOT TRUE THEN 
    RAISE EXCEPTION 'Unauthorized: Administrator access required'; 
  END IF;
  UPDATE public.videos SET publication_state = 'published' WHERE id = p_video_id;
  RETURN true;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.reject_video(p_video_id uuid)
RETURNS boolean AS $$
BEGIN
  IF public.is_admin() IS NOT TRUE THEN 
    RAISE EXCEPTION 'Unauthorized: Administrator access required'; 
  END IF;
  UPDATE public.videos SET publication_state = 'rejected', is_active = false WHERE id = p_video_id;
  RETURN true;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Explicitly Revoke Function Permissions from Public / Anon
REVOKE EXECUTE ON FUNCTION public.hard_delete_and_suppress_video(uuid, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.hard_delete_and_suppress_dead_videos(text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.approve_video(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.reject_video(uuid) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.hard_delete_and_suppress_video(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.hard_delete_and_suppress_dead_videos(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_video(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_video(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon, service_role;

-- ==============================================================
-- 11. Seed Verified Live ExoClick Zones (Site ID: 1120332)
-- ==============================================================
INSERT INTO public.ad_settings (slot_id, name, network, dimensions, format, is_active, code, vast_url, frequency_hours)
VALUES
    ('slot_top_banner', 'Top Banner (Desktop 728x90 / Mobile 6096160)', 'ExoClick / Adaptive Banner', '728x90 / 300x250', 'banner', true, '<script async type="application/javascript" src="https://a.magsrv.com/ad-provider.js"></script><ins class="eas6a97888e2" data-zoneid="6093488"></ins><script>(AdProvider = window.AdProvider || []).push({"serve": {}});</script>', NULL, 1),
    ('slot_native_feed', 'Native In-Feed Recommendation Card', 'ExoClick / Native', '1x1 Card', 'native', true, '<script async type="application/javascript" src="https://a.magsrv.com/ad-provider.js"></script><ins class="eas6a97888e20" data-zoneid="6093504"></ins><script>(AdProvider = window.AdProvider || []).push({"serve": {}});</script>', NULL, 1),
    ('slot_sticky_footer', 'Mobile Sticky Bottom', 'ExoClick Sticky Banner', '300x50 / 300x250', 'sticky', true, '<script async type="application/javascript" src="https://a.magsrv.com/ad-provider.js"></script><ins class="eas6a97888e17" data-zoneid="6096158"></ins><script>(AdProvider = window.AdProvider || []).push({"serve": {}});</script>', NULL, 1),
    ('slot_below_player', 'Below-Video High-CTR Rectangle Banner', 'ExoClick / 300x250', '300x250', 'banner', true, '<script async type="application/javascript" src="https://a.magsrv.com/ad-provider.js"></script><ins class="eas6a97888e2" data-zoneid="6093362"></ins><script>(AdProvider = window.AdProvider || []).push({"serve": {}});</script>', NULL, 1),
    ('slot_video_preroll', 'In-Stream 5-Second Video Pre-Roll Ad', 'ExoClick VAST / In-Stream', 'Video Overlay', 'vast', true, NULL, 'https://s.magsrv.com/v1/vast.php?idz=6093414', 1),
    ('slot_popunder', 'Background Popunder (1h Capped)', 'ExoClick / Popunder', 'Full Tab', 'popunder', true, '<script type="application/javascript">var ad_idzone = "6093374", ad_popup_fallback = false, ad_popup_force = false, ad_chrome_enabled = true, ad_new_tab = true, ad_frequency_period = 60, ad_frequency_count = 1, ad_trigger_method = 1, ad_tcf_enabled = true;</script><script async type="application/javascript" id="popmagicldr" data-ad_idzone="6093374" data-ad_frequency_period="60" data-ad_frequency_count="1" data-ad_trigger_method="1" data-ad_tcf_enabled="true" src="https://a.pemsrv.com/popunder1000.js"></script>', NULL, 1),
    ('slot_interstitial', 'Desktop Fullpage Interstitial', 'ExoClick / Interstitial', 'Full Screen', 'interstitial', true, '<script async type="application/javascript" src="https://a.pemsrv.com/ad-provider.js"></script><ins class="eas6a97888e35" data-zoneid="6093518"></ins><script>(AdProvider = window.AdProvider || []).push({"serve": {}});</script>', NULL, 1)
ON CONFLICT (slot_id) DO UPDATE SET
    name = EXCLUDED.name,
    network = EXCLUDED.network,
    dimensions = EXCLUDED.dimensions,
    format = EXCLUDED.format,
    is_active = EXCLUDED.is_active,
    code = EXCLUDED.code,
    vast_url = EXCLUDED.vast_url,
    frequency_hours = EXCLUDED.frequency_hours,
    updated_at = now();

-- 12. Seed Initial Crawler Sources
INSERT INTO public.crawler_sources (name, url, category, video_limit, is_enabled)
VALUES
    ('Eporner Trending HD', 'https://www.eporner.com/api/v2/video/search/?query=trending&per_page=15&thumbsize=big&order=top-weekly&format=json', 'Trending', 15, true),
    ('Eporner 4K Ultra HD', 'https://www.eporner.com/api/v2/video/search/?query=4k&per_page=10&thumbsize=big&order=top-monthly&format=json', 'Cinematic', 10, true),
    ('Eporner Featured Action', 'https://www.eporner.com/api/v2/video/search/?query=action&per_page=10&thumbsize=big&order=most-popular&format=json', 'Action', 10, true)
ON CONFLICT DO NOTHING;
