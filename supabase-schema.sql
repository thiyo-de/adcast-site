-- ==============================================================
-- AdCast Supabase Database Schema & Seed Script
-- Project: https://hrvlgnnetoexdbaaebfo.supabase.co
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/hrvlgnnetoexdbaaebfo/sql
-- ==============================================================

-- 1. Create Videos Table
CREATE TABLE IF NOT EXISTS public.videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    embed_url TEXT NOT NULL,
    thumbnail_url TEXT NOT NULL,
    duration TEXT DEFAULT '10:00',
    category TEXT DEFAULT 'Trending',
    tags TEXT[] DEFAULT ARRAY['trending']::TEXT[],
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Ad Settings Table
CREATE TABLE IF NOT EXISTS public.ad_settings (
    slot_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    network TEXT NOT NULL,
    dimensions TEXT DEFAULT '728x90',
    code TEXT,
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT now()
);

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

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.takedown_requests ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies: Public Read Access
CREATE POLICY "Public videos can be read by anyone" ON public.videos
    FOR SELECT USING (true);

CREATE POLICY "Public ad settings can be read by anyone" ON public.ad_settings
    FOR SELECT USING (true);

CREATE POLICY "Anyone can submit a takedown request" ON public.takedown_requests
    FOR INSERT WITH CHECK (true);

-- 6. RLS Policies: Allow mutations via Anon key (controlled by frontend Admin PIN)
CREATE POLICY "Allow video mutations" ON public.videos
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow ad mutations" ON public.ad_settings
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow viewing takedown requests" ON public.takedown_requests
    FOR ALL USING (true) WITH CHECK (true);

-- 7. Seed Initial Ad Slots
INSERT INTO public.ad_settings (slot_id, name, network, dimensions, is_active, code)
VALUES
    ('slot_top_banner', 'Top Leaderboard Banner', 'TrafficFactory', '728x90', true, '<div style="background: linear-gradient(90deg, #1A1D2D, #222638); border: 1px dashed #E11D48; color: #F8FAFC; text-align: center; padding: 22px 10px; font-weight: 700; font-size: 14px; border-radius: 8px;">⚡ TRAFFICFACTORY / TOP BANNER AD (728x90)</div>'),
    ('slot_native_feed', 'Native In-Feed Recommendation Card', 'JuicyAds Native', 'Card size', true, '<div style="background: #1A1D2D; border: 1px solid #E11D48; border-radius: 12px; padding: 16px; height: 100%; display: flex; flex-direction: column; justify-content: space-between;"><div style="color: #E11D48; font-size: 11px; font-weight: 800; text-transform: uppercase;">✦ SPONSORED</div><div style="font-weight: 700; color: #FFF; font-size: 15px; margin: 12px 0;">Exclusive Premium Offers Available Now</div><div style="color: #94A3B8; font-size: 12px;">JuicyAds Native Card Slot</div><button style="background: #E11D48; color: #FFF; border: none; padding: 8px 14px; border-radius: 9999px; font-weight: 700; font-size: 12px; margin-top: 12px; cursor: pointer;">Learn More</button></div>'),
    ('slot_sticky_footer', 'Sticky Screen-Bottom Mobile Footer', 'ExoClick Sticky', '300x50', true, '<div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-weight: 700; font-size: 13px; color: #06B6D4;">★ EXOCLICK STICKY BOTTOM BANNER (300x50)</div>'),
    ('slot_below_player', 'Below-Video Rectangle Banner', 'JuicyAds 300x250', '300x250', true, '<div style="background: #12141F; border: 1px dashed #06B6D4; color: #FFF; text-align: center; padding: 30px 15px; border-radius: 8px; font-weight: 700; font-size: 14px;">🎯 JUICYADS BELOW-PLAYER BANNER (300x250 / 728x90)</div>'),
    ('slot_video_preroll', 'In-Stream 5-Second Video Pre-Roll Ad', 'ExoClick VAST', 'Video Overlay', true, 'https://example.com/vast-tag'),
    ('slot_popunder', 'Background Popunder (24h Capped)', 'Adsterra Popunder', 'Full Tab', true, '<!-- Adsterra Popunder Script Placeholder -->')
ON CONFLICT (slot_id) DO NOTHING;

-- 8. Seed Sample Videos
INSERT INTO public.videos (title, embed_url, thumbnail_url, duration, category, tags, views, likes, is_featured)
VALUES
    ('Cyberpunk Odyssey: Neon Metropolis Night Drive (4K)', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&auto=format&fit=crop&q=80', '09:56', 'Cinematic', ARRAY['cyberpunk', '4k', 'neon', 'futuristic'], 48210, 3120, true),
    ('High Velocity: Supercar Night Racing in Tokyo', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=800&auto=format&fit=crop&q=80', '14:22', 'Trending', ARRAY['racing', 'tokyo', 'cars', 'action'], 89450, 6410, true),
    ('Deep House Sunset Session: Ibiza Beach Club Mix', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80', '45:10', 'Music', ARRAY['deephouse', 'ibiza', 'club', 'sunset'], 124000, 9800, true),
    ('Extreme Downhill Freeride: Alps Mountain Descent', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=800&auto=format&fit=crop&q=80', '08:14', 'Action', ARRAY['extreme', 'downhill', 'mountain'], 31200, 1890, false),
    ('Mastering Cinematic Lighting & VFX in Unreal Engine 5', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80', '22:30', 'Tutorials', ARRAY['unrealengine', 'vfx', '3d'], 18500, 1420, false),
    ('Midnight Tokyo Walk: Cyberpunk Streets & Hidden Izakayas', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4', 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&auto=format&fit=crop&q=80', '32:00', 'Trending', ARRAY['tokyo', 'streetview', 'japan'], 74200, 5120, false)
ON CONFLICT DO NOTHING;
