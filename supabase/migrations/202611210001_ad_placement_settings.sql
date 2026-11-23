ALTER TABLE public.ad_settings ADD COLUMN IF NOT EXISTS frequency_minutes INTEGER CHECK (frequency_minutes >= 0);

INSERT INTO public.ad_settings (slot_id, name, network, dimensions, format, is_active, code, vast_url, frequency_hours)
VALUES
    ('slot_mobile_interstitial', 'Mobile Fullpage Interstitial', 'ExoClick / Mobile Interstitial', 'Mobile Fullscreen', 'interstitial_mobile', true, '<script async type="application/javascript" src="https://a.pemsrv.com/ad-provider.js"></script><ins class="eas6a97888e33" data-zoneid="6100242"></ins><script>(AdProvider = window.AdProvider || []).push({"serve": {}});</script>', NULL, 1),
    ('slot_desktop_skyscraper_left', 'Desktop Skyscraper (Left 160x600)', 'ExoClick / 160x600', '160x600', 'skyscraper_left', true, '<script async type="application/javascript" src="https://a.magsrv.com/ad-provider.js"></script><ins class="eas6a97888e2" data-zoneid="6100280"></ins><script>(AdProvider = window.AdProvider || []).push({"serve": {}});</script>', NULL, 1),
    ('slot_desktop_skyscraper_right', 'Desktop Skyscraper (Right 160x600)', 'ExoClick / 160x600', '160x600', 'skyscraper_right', true, '<script async type="application/javascript" src="https://a.magsrv.com/ad-provider.js"></script><ins class="eas6a97888e2" data-zoneid="6100290"></ins><script>(AdProvider = window.AdProvider || []).push({"serve": {}});</script>', NULL, 1)
ON CONFLICT (slot_id) DO NOTHING;

UPDATE public.ad_settings SET frequency_minutes = 5 WHERE slot_id = 'slot_video_preroll' AND frequency_minutes IS NULL;
NOTIFY pgrst, 'reload schema';
