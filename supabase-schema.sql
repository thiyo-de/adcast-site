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

-- Indexes for fast catalog browsing & health checks
CREATE UNIQUE INDEX IF NOT EXISTS idx_videos_embed_url ON public.videos (embed_url);
CREATE INDEX IF NOT EXISTS idx_videos_category ON public.videos (category);
CREATE INDEX IF NOT EXISTS idx_videos_is_active ON public.videos (is_active);
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
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crawler_sources_is_enabled ON public.crawler_sources (is_enabled);

-- ==============================================================
-- 5. Row Level Security (RLS) Configuration (Hardened for C01)
-- ==============================================================
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.takedown_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crawler_sources ENABLE ROW LEVEL SECURITY;

-- Clean up permissive legacy policies
DROP POLICY IF EXISTS "Allow video mutations" ON public.videos;
DROP POLICY IF EXISTS "Allow ad mutations" ON public.ad_settings;
DROP POLICY IF EXISTS "Allow viewing takedown requests" ON public.takedown_requests;
DROP POLICY IF EXISTS "Public videos can be read by anyone" ON public.videos;
DROP POLICY IF EXISTS "Public ad settings can be read by anyone" ON public.ad_settings;
DROP POLICY IF EXISTS "Anyone can submit a takedown request" ON public.takedown_requests;

-- A. Videos Policies
-- Public can ONLY read active videos
CREATE POLICY "Public videos can be read by anyone" ON public.videos
    FOR SELECT USING (is_active = true OR is_active IS NULL);

-- Only authenticated users (admins) can insert/update/delete videos
CREATE POLICY "Admins can mutate videos" ON public.videos
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- B. Ad Settings Policies
-- Public can read ad configurations
CREATE POLICY "Public ad settings can be read by anyone" ON public.ad_settings
    FOR SELECT USING (true);

-- Only authenticated users (admins) can modify ad settings
CREATE POLICY "Admins can mutate ad settings" ON public.ad_settings
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- C. Takedown Requests Policies
-- Public can SUBMIT takedowns, but CANNOT read existing claimant submissions!
CREATE POLICY "Anyone can submit a takedown request" ON public.takedown_requests
    FOR INSERT WITH CHECK (true);

-- Only authenticated admins can read and update takedowns
CREATE POLICY "Admins can view and manage takedowns" ON public.takedown_requests
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- D. Crawler Sources Policies
-- Public/anon can read active source list
CREATE POLICY "Public can view crawler sources" ON public.crawler_sources
    FOR SELECT USING (true);

-- Only authenticated admins can mutate crawler sources
CREATE POLICY "Admins can mutate crawler sources" ON public.crawler_sources
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==============================================================
-- 6. Seed Verified Live ExoClick Zones (Site ID: 1120332)
-- ==============================================================
INSERT INTO public.ad_settings (slot_id, name, network, dimensions, format, is_active, code, vast_url, frequency_hours)
VALUES
    ('slot_top_banner', 'Top Leaderboard Banner', 'ExoClick / 728x90', '728x90', 'banner', true, '<script async type="application/javascript" src="https://a.magsrv.com/ad-provider.js"></script><ins class="eas6a97888e2" data-zoneid="6093488"></ins><script>(AdProvider = window.AdProvider || []).push({"serve": {}});</script>', NULL, 1),
    ('slot_native_feed', 'Native In-Feed Recommendation Card', 'ExoClick / Native', '1x1 Card', 'native', true, '<script async type="application/javascript" src="https://a.magsrv.com/ad-provider.js"></script><ins class="eas6a97888e20" data-zoneid="6093504"></ins><script>(AdProvider = window.AdProvider || []).push({"serve": {}});</script>', NULL, 1),
    ('slot_sticky_footer', 'Sticky Screen-Bottom Mobile Footer', 'ExoClick Sticky Banner', '300x50 / 728x90', 'sticky', true, '<script async type="application/javascript" src="https://a.magsrv.com/ad-provider.js"></script><ins class="eas6a97888e17" data-zoneid="6093426"></ins><script>(AdProvider = window.AdProvider || []).push({"serve": {}});</script>', NULL, 1),
    ('slot_below_player', 'Below-Video High-CTR Rectangle Banner', 'ExoClick / 300x250', '300x250', 'banner', true, '<script async type="application/javascript" src="https://a.magsrv.com/ad-provider.js"></script><ins class="eas6a97888e2" data-zoneid="6093362"></ins><script>(AdProvider = window.AdProvider || []).push({"serve": {}});</script>', NULL, 1),
    ('slot_video_preroll', 'In-Stream 5-Second Video Pre-Roll Ad', 'ExoClick VAST / In-Stream', 'Video Overlay', 'vast', true, NULL, 'https://s.magsrv.com/v1/vast.php?idz=6093414', 1),
    ('slot_popunder', 'Background Popunder (1h Capped)', 'ExoClick / Popunder', 'Full Tab', 'popunder', true, '<!-- ExoClick Popunder Zone 6093374 -->', NULL, 1),
    ('slot_interstitial', 'Desktop Fullpage Interstitial', 'ExoClick / Interstitial', 'Full Screen', 'interstitial', true, '<script async type="application/javascript" src="https://a.pemsrv.com/ad-provider.js"></script><ins class="eas6a97888e35" data-zoneid="6093518"></ins><script>(AdProvider = window.AdProvider || []).push({"serve": {}});</script>', NULL, 12)
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

-- 7. Seed Initial Crawler Sources
INSERT INTO public.crawler_sources (name, url, category, video_limit, is_enabled)
VALUES
    ('Eporner Trending HD', 'https://www.eporner.com/api/v2/video/search/?query=trending&per_page=15&thumbsize=big&order=top-weekly&format=json', 'Trending', 15, true),
    ('Eporner 4K Ultra HD', 'https://www.eporner.com/api/v2/video/search/?query=4k&per_page=10&thumbsize=big&order=top-monthly&format=json', 'Cinematic', 10, true),
    ('Eporner Featured Action', 'https://www.eporner.com/api/v2/video/search/?query=action&per_page=10&thumbsize=big&order=most-popular&format=json', 'Action', 10, true)
ON CONFLICT DO NOTHING;
