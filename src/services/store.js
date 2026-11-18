// Central Data & Ad Settings Store

/**
 * Universal Embed URL Parser
 * Automatically converts raw links from YouTube, Instagram, Facebook, Vimeo into embeddable iframe URLs.
 */
export function parseToEmbedUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();

  // 1. YouTube (watch, shorts, embed, youtu.be)
  const ytMatch = trimmed.match(/(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch && ytMatch[1]) {
    return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0`;
  }

  // 2. Instagram (reels, posts, tv)
  const igMatch = trimmed.match(/instagram\.com\/(?:reel|p|tv)\/([a-zA-Z0-9_-]+)/);
  if (igMatch && igMatch[1]) {
    return `https://www.instagram.com/reel/${igMatch[1]}/embed/`;
  }

  // 3. Facebook (watch, video, reels)
  if (trimmed.includes('facebook.com/') || trimmed.includes('fb.watch/')) {
    if (trimmed.includes('plugins/video.php')) {
      return trimmed;
    }
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(trimmed)}&show_text=0&autoplay=1`;
  }

  // 4. Vimeo
  const vimeoMatch = trimmed.match(/vimeo\.com\/([0-9]+)/);
  if (vimeoMatch && vimeoMatch[1]) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
  }

  return trimmed;
}

/**
 * Universal Thumbnail Resolver
 * Automatically resolves high-res thumbnails for YouTube videos if not explicitly provided.
 */
export function getThumbnailForUrl(url, fallbackThumbnail = '') {
  if (!url || typeof url !== 'string') return fallbackThumbnail;
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch && ytMatch[1]) {
    return `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`;
  }
  return fallbackThumbnail;
}

const STORAGE_KEYS = {
  VIDEOS: 'adcast_videos_v4',
  AD_SETTINGS: 'adcast_ad_settings_v1',
  BOOKMARKS: 'adcast_bookmarks_v1',
  LIKES: 'adcast_likes_v1',
  HISTORY: 'adcast_history_v1',
  DMCA: 'adcast_dmca_v1',
  DEV_MODE: 'adcast_dev_mode',
  ADMIN_AUTH: 'adcast_admin_session'
};

// High-Quality Seed Videos with Tube-specific metadata (Direct MP4, YouTube, Instagram Reels, Facebook Watch)
const SEED_VIDEOS = [
  // --- MULTI-PLATFORM EMBEDS (TESTING SUITE) ---
  {
    id: 'vid-yt-01',
    title: 'Cyberpunk Metropolis 2077: Rain & Neon Alley Tour (YouTube 4K)',
    embed_url: 'https://www.youtube.com/embed/aqz-KE-bpKQ?autoplay=1&rel=0',
    thumbnail_url: 'https://img.youtube.com/vi/aqz-KE-bpKQ/maxresdefault.jpg',
    duration: '10:34',
    durationMinutes: 10,
    category: 'Cinematic',
    quality: '4K UHD',
    rating: 99,
    tags: ['youtube', 'cyberpunk', '4k', 'cinematic', 'neon'],
    views: 1892000,
    likes: 42100,
    is_featured: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'vid-yt-02',
    title: 'Sintel Open Movie: High Fantasy Dragon Quest (YouTube 4K)',
    embed_url: 'https://www.youtube.com/embed/eRsGyueVLvQ?autoplay=1&rel=0',
    thumbnail_url: 'https://img.youtube.com/vi/eRsGyueVLvQ/maxresdefault.jpg',
    duration: '14:48',
    durationMinutes: 14,
    category: 'Trending',
    quality: '4K UHD',
    rating: 98,
    tags: ['youtube', 'fantasy', 'animation', 'action', 'trending'],
    views: 2450000,
    likes: 58000,
    is_featured: true,
    created_at: new Date(Date.now() - 3600000 * 5).toISOString()
  },
  {
    id: 'vid-ig-01',
    title: 'High-Altitude Mountain Ridge FPV Drone Dive (Instagram Reel)',
    embed_url: 'https://www.instagram.com/reel/C8P4fC0u7V-/embed/',
    thumbnail_url: 'https://images.unsplash.com/photo-1527977966376-1c8408f9f108?w=800&auto=format&fit=crop&q=80',
    duration: '00:45',
    durationMinutes: 1,
    category: 'Action',
    quality: '1080p 60FPS',
    rating: 97,
    tags: ['instagram', 'reels', 'fpv', 'action', 'drone'],
    views: 630400,
    likes: 21900,
    is_featured: true,
    created_at: new Date(Date.now() - 3600000 * 12).toISOString()
  },
  {
    id: 'vid-fb-01',
    title: 'Red Bull Extreme Downhill Mountain Bike Run (Facebook Watch)',
    embed_url: 'https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2FRedBull%2Fvideos%2F10156828591825152%2F&show_text=0&autoplay=1',
    thumbnail_url: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&auto=format&fit=crop&q=80',
    duration: '04:12',
    durationMinutes: 4,
    category: 'Action',
    quality: '1080p',
    rating: 95,
    tags: ['facebook', 'sports', 'mtb', 'downhill', 'redbull'],
    views: 489000,
    likes: 14300,
    is_featured: false,
    created_at: new Date(Date.now() - 86400000).toISOString()
  },

  // --- CINEMATIC ---
  {
    id: 'vid-101',
    title: 'Cyberpunk Odyssey: Neon Metropolis Night Drive (4K)',
    embed_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnail_url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&auto=format&fit=crop&q=80',
    duration: '09:56',
    durationMinutes: 9,
    category: 'Cinematic',
    quality: '4K UHD',
    rating: 98,
    tags: ['cyberpunk', 'neon', '4k', 'cinematic', 'futuristic', 'night'],
    views: 1482100,
    likes: 31200,
    is_featured: true,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 'vid-102',
    title: 'Cosmic Horizons: Deep Space Nebula Flythrough (8K HDR)',
    embed_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4',
    thumbnail_url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80',
    duration: '25:18',
    durationMinutes: 25,
    category: 'Cinematic',
    quality: '8K HDR',
    rating: 99,
    tags: ['space', 'galaxy', 'universe', '8k', 'cinematic', 'cosmic'],
    views: 2673000,
    likes: 49200,
    is_featured: true,
    created_at: new Date(Date.now() - 86400000 * 3).toISOString()
  },
  {
    id: 'vid-103',
    title: 'The Last Ronin: Feudal Japan Moonlight Duel',
    embed_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    thumbnail_url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80',
    duration: '14:50',
    durationMinutes: 14,
    category: 'Cinematic',
    quality: '4K UHD',
    rating: 97,
    tags: ['cinematic', 'samurai', 'action', 'japan', 'martialarts', 'sword'],
    views: 842000,
    likes: 19800,
    is_featured: false,
    created_at: new Date(Date.now() - 86400000 * 4).toISOString()
  },

  // --- TRENDING ---
  {
    id: 'vid-104',
    title: 'High Velocity: Supercar Night Racing in Tokyo Wangan',
    embed_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    thumbnail_url: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=800&auto=format&fit=crop&q=80',
    duration: '14:22',
    durationMinutes: 14,
    category: 'Trending',
    quality: '1080p 60FPS',
    rating: 96,
    tags: ['racing', 'tokyo', 'cars', 'action', 'supercar', 'drift'],
    views: 2894500,
    likes: 64100,
    is_featured: true,
    created_at: new Date(Date.now() - 86400000 * 5).toISOString()
  },
  {
    id: 'vid-105',
    title: 'Tokyo Midnight Walk: Cyberpunk Streets & Hidden Izakayas',
    embed_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
    thumbnail_url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&auto=format&fit=crop&q=80',
    duration: '32:00',
    durationMinutes: 32,
    category: 'Trending',
    quality: '4K UHD',
    rating: 95,
    tags: ['tokyo', 'streetview', 'nightlife', 'japan', 'travel', 'rain'],
    views: 1942000,
    likes: 51200,
    is_featured: false,
    created_at: new Date(Date.now() - 86400000 * 6).toISOString()
  },
  {
    id: 'vid-106',
    title: 'Hypercar Dyno Run: 1500HP Twin Turbo Beast on the Limit',
    embed_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    thumbnail_url: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=800&auto=format&fit=crop&q=80',
    duration: '11:15',
    durationMinutes: 11,
    category: 'Trending',
    quality: '4K UHD',
    rating: 97,
    tags: ['hypercar', 'tuning', 'horsepower', 'dyno', 'racing', 'cars'],
    views: 2954000,
    likes: 71000,
    is_featured: false,
    created_at: new Date(Date.now() - 86400000 * 7).toISOString()
  },
  {
    id: 'vid-107',
    title: 'Underground Car Meet: Custom JDM & Euro Stance Showcase',
    embed_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackSeeTheWorld.mp4',
    thumbnail_url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&auto=format&fit=crop&q=80',
    duration: '18:10',
    durationMinutes: 18,
    category: 'Trending',
    quality: '1080p 60FPS',
    rating: 94,
    tags: ['jdm', 'tuning', 'cars', 'stance', 'drift', 'underground'],
    views: 1320000,
    likes: 28400,
    is_featured: false,
    created_at: new Date(Date.now() - 86400000 * 8).toISOString()
  },

  // --- MUSIC ---
  {
    id: 'vid-108',
    title: 'Deep House Sunset Session: Ibiza Beach Club Live Set',
    embed_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnail_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80',
    duration: '45:10',
    durationMinutes: 45,
    category: 'Music',
    quality: '4K UHD',
    rating: 99,
    tags: ['deephouse', 'ibiza', 'club', 'sunset', 'music', 'relax'],
    views: 4240000,
    likes: 98000,
    is_featured: true,
    created_at: new Date(Date.now() - 86400000 * 9).toISOString()
  },
  {
    id: 'vid-109',
    title: 'Techno Underground: Berlin Bunker Rave Highlights',
    embed_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    thumbnail_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
    duration: '18:45',
    durationMinutes: 18,
    category: 'Music',
    quality: '1080p',
    rating: 92,
    tags: ['techno', 'berlin', 'rave', 'electronic', 'club', 'underground'],
    views: 1631000,
    likes: 42000,
    is_featured: false,
    created_at: new Date(Date.now() - 86400000 * 10).toISOString()
  },
  {
    id: 'vid-110',
    title: 'Neon Synthwave Live Lounge: Lo-Fi Chill Beats to Relax',
    embed_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    thumbnail_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
    duration: '50:00',
    durationMinutes: 50,
    category: 'Music',
    quality: '1080p',
    rating: 99,
    tags: ['synthwave', 'lofi', 'chill', 'relax', 'beats', 'night'],
    views: 3102000,
    likes: 87400,
    is_featured: false,
    created_at: new Date(Date.now() - 86400000 * 11).toISOString()
  },
  {
    id: 'vid-111',
    title: 'Midnight Anime Lo-Fi Cafe Beats & Soft Rain (10 Hours)',
    embed_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnail_url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80',
    duration: '60:00',
    durationMinutes: 60,
    category: 'Music',
    quality: '4K UHD',
    rating: 98,
    tags: ['chill', 'lofi', 'anime', 'rain', 'study', 'beats', 'relax'],
    views: 4120000,
    likes: 92000,
    is_featured: false,
    created_at: new Date(Date.now() - 86400000 * 12).toISOString()
  },

  // --- ACTION ---
  {
    id: 'vid-112',
    title: 'Extreme Downhill Freeride: Alps Mountain Descent (GoPro)',
    embed_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnail_url: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=800&auto=format&fit=crop&q=80',
    duration: '08:14',
    durationMinutes: 8,
    category: 'Action',
    quality: '1080p 60FPS',
    rating: 94,
    tags: ['extreme', 'downhill', 'mountain', 'freeride', 'sports', 'action'],
    views: 912000,
    likes: 18900,
    is_featured: false,
    created_at: new Date(Date.now() - 86400000 * 13).toISOString()
  },
  {
    id: 'vid-113',
    title: 'Drone FPV Racing: Abandoned Industrial Complex Freestyle',
    embed_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackSeeTheWorld.mp4',
    thumbnail_url: 'https://images.unsplash.com/photo-1527977966376-1c8408f9f108?w=800&auto=format&fit=crop&q=80',
    duration: '06:40',
    durationMinutes: 6,
    category: 'Action',
    quality: '1080p 60FPS',
    rating: 98,
    tags: ['fpv', 'drone', 'freestyle', 'acrobatics', 'action', 'urban'],
    views: 1118000,
    likes: 29500,
    is_featured: false,
    created_at: new Date(Date.now() - 86400000 * 14).toISOString()
  },
  {
    id: 'vid-114',
    title: 'Urban Free Solo: Rooftops & Cranes of Dubai Skyline',
    embed_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    thumbnail_url: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&auto=format&fit=crop&q=80',
    duration: '13:40',
    durationMinutes: 13,
    category: 'Action',
    quality: '4K UHD',
    rating: 95,
    tags: ['action', 'extreme', 'dubai', 'rooftop', 'climbing', 'stunts'],
    views: 1820000,
    likes: 41200,
    is_featured: false,
    created_at: new Date(Date.now() - 86400000 * 15).toISOString()
  },
  {
    id: 'vid-115',
    title: 'Wingsuit Proximity Flying: Norway Fjords High Speed Pass',
    embed_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    thumbnail_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80',
    duration: '07:22',
    durationMinutes: 7,
    category: 'Action',
    quality: '4K UHD',
    rating: 98,
    tags: ['wingsuit', 'extreme', 'basejump', 'norway', 'action', 'flight'],
    views: 2240000,
    likes: 54000,
    is_featured: false,
    created_at: new Date(Date.now() - 86400000 * 16).toISOString()
  },

  // --- TUTORIALS ---
  {
    id: 'vid-116',
    title: 'Mastering Cinematic Lighting & VFX in Unreal Engine 5.4',
    embed_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    thumbnail_url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80',
    duration: '22:30',
    durationMinutes: 22,
    category: 'Tutorials',
    quality: '4K UHD',
    rating: 97,
    tags: ['unrealengine', 'vfx', '3d', 'cgi', 'tutorials', 'creative'],
    views: 785000,
    likes: 14200,
    is_featured: false,
    created_at: new Date(Date.now() - 86400000 * 17).toISOString()
  },
  {
    id: 'vid-117',
    title: 'Color Grading Masterclass: Moody Dark Cinematic Looks',
    embed_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    thumbnail_url: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&auto=format&fit=crop&q=80',
    duration: '19:15',
    durationMinutes: 19,
    category: 'Tutorials',
    quality: '4K UHD',
    rating: 96,
    tags: ['tutorials', 'colorgrading', 'cinematic', 'editing', 'video'],
    views: 654000,
    likes: 12900,
    is_featured: false,
    created_at: new Date(Date.now() - 86400000 * 18).toISOString()
  },
  {
    id: 'vid-118',
    title: 'Sound Design Secrets: Creating Heavy Cyberpunk Basslines',
    embed_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnail_url: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&auto=format&fit=crop&q=80',
    duration: '26:40',
    durationMinutes: 26,
    category: 'Tutorials',
    quality: '1080p',
    rating: 98,
    tags: ['tutorials', 'sounddesign', 'music', 'synth', 'production', 'cyberpunk'],
    views: 520000,
    likes: 11400,
    is_featured: false,
    created_at: new Date(Date.now() - 86400000 * 19).toISOString()
  },

  // --- FEATURED ---
  {
    id: 'vid-119',
    title: 'Superyacht Life: Mediterranean Summer Cruise & Lifestyle Tour',
    embed_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    thumbnail_url: 'https://images.unsplash.com/photo-1569263979104-865ab7cd8d17?w=800&auto=format&fit=crop&q=80',
    duration: '16:05',
    durationMinutes: 16,
    category: 'Featured',
    quality: '4K UHD',
    rating: 96,
    tags: ['luxury', 'yacht', 'monaco', 'cruise', 'featured', 'lifestyle'],
    views: 1521000,
    likes: 38900,
    is_featured: true,
    created_at: new Date(Date.now() - 86400000 * 20).toISOString()
  },
  {
    id: 'vid-120',
    title: 'Billionaire Penthouse Tour: Manhattan 360 Skyline View',
    embed_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnail_url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=80',
    duration: '21:30',
    durationMinutes: 21,
    category: 'Featured',
    quality: '4K UHD',
    rating: 99,
    tags: ['luxury', 'architecture', 'featured', 'lifestyle', 'penthouse', 'nyc'],
    views: 3450000,
    likes: 81200,
    is_featured: true,
    created_at: new Date(Date.now() - 86400000 * 21).toISOString()
  }
];

// 6 Core Ad Slots Setup (100% ExoClick Dedicated)
const DEFAULT_AD_SETTINGS = {
  slot_top_banner: {
    id: 'slot_top_banner',
    name: 'Top Leaderboard Banner (728x90)',
    network: 'ExoClick / 728x90',
    dimensions: '728x90',
    isActive: true,
    code: '<script async type="application/javascript" src="https://a.magsrv.com/ad-provider.js"></script><ins class="eas6a9788e2" data-zoneid="6093488"></ins><script>(AdProvider = window.AdProvider || []).push({"serve": {}});</script>'
  },
  slot_native_feed: {
    id: 'slot_native_feed',
    name: 'Native In-Feed Recommendation Card',
    network: 'ExoClick / Native',
    dimensions: 'Card size',
    isActive: true,
    code: '<script async type="application/javascript" src="https://a.magsrv.com/ad-provider.js"></script><ins class="eas6a97888e20" data-zoneid="6093504"></ins><script>(AdProvider = window.AdProvider || []).push({"serve": {}});</script>'
  },
  slot_sticky_footer: {
    id: 'slot_sticky_footer',
    name: 'Sticky Screen-Bottom Mobile Footer',
    network: 'ExoClick Sticky Banner',
    dimensions: '300x50 / 728x90',
    isActive: true,
    code: '<script async type="application/javascript" src="https://a.magsrv.com/ad-provider.js"></script><ins class="eas6a97888e17" data-zoneid="6093426"></ins><script>(AdProvider = window.AdProvider || []).push({"serve": {}});</script>'
  },
  slot_below_player: {
    id: 'slot_below_player',
    name: 'Below-Video High-CTR Rectangle Banner',
    network: 'ExoClick / 300x250',
    dimensions: '300x250',
    isActive: true,
    code: '<script async type="application/javascript" src="https://a.magsrv.com/ad-provider.js"></script><ins class="eas6a97888e2" data-zoneid="6093362"></ins><script>(AdProvider = window.AdProvider || []).push({"serve": {}});</script>'
  },
  slot_video_preroll: {
    id: 'slot_video_preroll',
    name: 'In-Stream 5-Second Video Pre-Roll Ad',
    network: 'ExoClick VAST / In-Stream',
    dimensions: 'Video Overlay',
    isActive: true,
    durationSeconds: 5,
    adTitle: 'Featured Sponsor — High Speed Premium Streaming',
    adDescription: 'Instant HD access worldwide. Video starts in 5s.',
    targetUrl: 'https://s.magsrv.com/v1/vast.php?idz=6093414',
    vastUrl: 'https://s.magsrv.com/v1/vast.php?idz=6093414'
  },
  slot_popunder: {
    id: 'slot_popunder',
    name: 'Background Popunder (1h Capped)',
    network: 'ExoClick / Popunder',
    dimensions: 'Full Tab',
    isActive: true,
    code: '<!-- EXOCLICK TABUNDER (Zone 6093374 - 1h Capped) -->',
    frequencyHours: 1
  },
  affiliate_fallbacks: {
    isEnabled: true,
    vpn: {
      id: 'vpn',
      title: 'Shield Your Browsing — 70% Off CyberShield VPN',
      description: 'Stream in 4K with military-grade encryption, zero ISP throttling, and 100% no-logs policy.',
      cta: 'Claim 70% Discount',
      badge: 'VERIFIED SPONSOR',
      url: 'https://nordvpn.com',
      image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80',
      network: 'CyberShield Privacy'
    },
    dating: {
      id: 'dating',
      title: 'Private Live HD Video Chat & Streams',
      description: 'Connect with verified real-time video streamers worldwide with 100% discretion.',
      cta: 'Join Free Today',
      badge: '18+ EXCLUSIVE',
      url: 'https://example.com/dating',
      image: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=800&auto=format&fit=crop&q=80',
      network: 'LiveStream Hub'
    },
    gaming: {
      id: 'gaming',
      title: 'Play Next-Gen Cyber RPG — Free Instant Play',
      description: 'Immerse in photorealistic 4K open-world combat directly in your mobile browser.',
      cta: 'Play Now Free',
      badge: 'HOT GAME',
      url: 'https://example.com/gaming',
      image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80',
      network: 'Nexus Gaming'
    }
  }
};

// Store Operations
export const store = {
  // Videos
  getVideos() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.VIDEOS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error('Error loading videos:', e);
    }
    this.saveVideos(SEED_VIDEOS);
    return SEED_VIDEOS;
  },

  getVideoById(id) {
    const list = this.getVideos();
    return list.find(v => v.id === id) || null;
  },

  getRelatedVideos(currentVideo, mode = 'smart', limit = 10) {
    if (!currentVideo) return [];
    const all = this.getVideos().filter(v => v.id !== currentVideo.id);

    // 1. Same Category Tab (strictly filtered to category, sorted by popularity)
    if (mode === 'category') {
      return all
        .filter(v => v.category && v.category === currentVideo.category)
        .sort((a, b) => (b.views || 0) - (a.views || 0))
        .slice(0, limit);
    }

    // 2. Most Viewed Tab (strictly sorted by total views)
    if (mode === 'views') {
      return [...all]
        .sort((a, b) => (b.views || 0) - (a.views || 0))
        .slice(0, limit);
    }

    // 3. Newest Tab (sorted by creation timestamp)
    if (mode === 'newest') {
      return [...all]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, limit);
    }

    // 4. 'smart' composite score (Relevance + Category + Tag Affinity + Popularity)
    const currentTags = (currentVideo.tags || []).map(t => t.toLowerCase());
    const maxViews = Math.max(...all.map(v => v.views || 1), 1);

    const scored = all.map(video => {
      let score = 0;

      // Category match weight: 40 pts
      if (video.category && currentVideo.category && video.category === currentVideo.category) {
        score += 40;
      }

      // Shared tags weight: 20 pts per matching tag
      const videoTags = (video.tags || []).map(t => t.toLowerCase());
      const sharedTagsCount = videoTags.filter(t => currentTags.includes(t)).length;
      score += sharedTagsCount * 20;

      // View count normalized weight: up to 25 pts
      const viewRatio = Math.min(1, (video.views || 0) / maxViews);
      score += viewRatio * 25;

      // Rating quality weight: up to 15 pts
      const ratingRatio = (video.rating || 90) / 100;
      score += ratingRatio * 15;

      return { video, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(item => item.video);
  },

  saveVideos(videos) {
    try {
      localStorage.setItem(STORAGE_KEYS.VIDEOS, JSON.stringify(videos));
    } catch (e) {
      console.error('Error saving videos:', e);
    }
  },

  addVideo(videoData) {
    const list = this.getVideos();
    const parsedEmbedUrl = parseToEmbedUrl(videoData.embed_url);
    const resolvedThumb = videoData.thumbnail_url || getThumbnailForUrl(videoData.embed_url, 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800&auto=format&fit=crop&q=80');

    const newVideo = {
      id: 'vid-' + Date.now(),
      views: 0,
      likes: 0,
      rating: 100,
      quality: '1080p',
      is_featured: false,
      created_at: new Date().toISOString(),
      ...videoData,
      embed_url: parsedEmbedUrl,
      thumbnail_url: resolvedThumb
    };
    list.unshift(newVideo);
    this.saveVideos(list);
    return newVideo;
  },

  updateVideo(id, updatedFields) {
    const list = this.getVideos().map(v => (v.id === id ? { ...v, ...updatedFields } : v));
    this.saveVideos(list);
    return list.find(v => v.id === id);
  },

  deleteVideo(id) {
    const list = this.getVideos().filter(v => v.id !== id);
    this.saveVideos(list);
    return list;
  },

  incrementViews(id) {
    const list = this.getVideos().map(v => {
      if (v.id === id) {
        return { ...v, views: (v.views || 0) + 1 };
      }
      return v;
    });
    this.saveVideos(list);
  },

  // Ad Settings
  getAdSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.AD_SETTINGS);
      if (data) {
        const parsed = JSON.parse(data);
        if (!parsed.slot_top_banner?.code || !parsed.slot_top_banner.code.includes('6093488')) {
          parsed.slot_top_banner = DEFAULT_AD_SETTINGS.slot_top_banner;
        }
        if (!parsed.slot_native_feed?.code || !parsed.slot_native_feed.code.includes('6093504')) {
          parsed.slot_native_feed = DEFAULT_AD_SETTINGS.slot_native_feed;
        }
        if (!parsed.slot_sticky_footer?.code || !parsed.slot_sticky_footer.code.includes('6093426')) {
          parsed.slot_sticky_footer = DEFAULT_AD_SETTINGS.slot_sticky_footer;
        }
        if (!parsed.slot_video_preroll?.vastUrl || !parsed.slot_video_preroll.vastUrl.includes('6093414')) {
          parsed.slot_video_preroll = {
            ...DEFAULT_AD_SETTINGS.slot_video_preroll,
            ...(parsed.slot_video_preroll || {}),
            vastUrl: DEFAULT_AD_SETTINGS.slot_video_preroll.vastUrl,
            targetUrl: DEFAULT_AD_SETTINGS.slot_video_preroll.targetUrl
          };
        }
        if (!parsed.slot_below_player?.code || !parsed.slot_below_player.code.includes('6093362')) {
          parsed.slot_below_player = DEFAULT_AD_SETTINGS.slot_below_player;
        }
        if (!parsed.slot_popunder?.code || parsed.slot_popunder?.code?.includes('benchform.org') || parsed.slot_popunder?.code?.includes('Adsterra')) {
          parsed.slot_popunder = DEFAULT_AD_SETTINGS.slot_popunder;
        }
        return {
          ...DEFAULT_AD_SETTINGS,
          ...parsed,
          affiliate_fallbacks: {
            ...DEFAULT_AD_SETTINGS.affiliate_fallbacks,
            ...(parsed.affiliate_fallbacks || {})
          }
        };
      }
    } catch (e) {
      console.error('Error loading ad settings:', e);
    }
    this.saveAdSettings(DEFAULT_AD_SETTINGS);
    return DEFAULT_AD_SETTINGS;
  },

  saveAdSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEYS.AD_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving ad settings:', e);
    }
  },

  updateAdSlot(slotId, fields) {
    const current = this.getAdSettings();
    current[slotId] = { ...current[slotId], ...fields };
    this.saveAdSettings(current);
    return current;
  },

  // Popunder 24h Check
  shouldTriggerPopunder() {
    try {
      const lastPop = localStorage.getItem('adcast_last_popunder');
      if (!lastPop) return true;
      const hoursPassed = (Date.now() - parseInt(lastPop, 10)) / (1000 * 60 * 60);
      return hoursPassed >= 24;
    } catch (e) {
      return true;
    }
  },

  getPopunderCooldownRemainingHours() {
    try {
      const lastPop = localStorage.getItem('adcast_last_popunder');
      if (!lastPop) return 0;
      const hoursPassed = (Date.now() - parseInt(lastPop, 10)) / (1000 * 60 * 60);
      return Math.max(0, Math.round((24 - hoursPassed) * 10) / 10);
    } catch (e) {
      return 0;
    }
  },

  markPopunderTriggered() {
    try {
      localStorage.setItem('adcast_last_popunder', Date.now().toString());
    } catch (e) {}
  },

  // Bookmarks (Client-side, no user login required)
  getBookmarks() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BOOKMARKS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  toggleBookmark(videoId) {
    const current = this.getBookmarks();
    const index = current.indexOf(videoId);
    let updated;
    if (index > -1) {
      updated = current.filter(id => id !== videoId);
    } else {
      updated = [...current, videoId];
    }
    localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(updated));
    return updated;
  },

  isBookmarked(videoId) {
    return this.getBookmarks().includes(videoId);
  },

  // Likes
  toggleLike(videoId) {
    try {
      const likes = JSON.parse(localStorage.getItem(STORAGE_KEYS.LIKES) || '[]');
      const index = likes.indexOf(videoId);
      let updated;
      let diff = 0;
      if (index > -1) {
        updated = likes.filter(id => id !== videoId);
        diff = -1;
      } else {
        updated = [...likes, videoId];
        diff = 1;
      }
      localStorage.setItem(STORAGE_KEYS.LIKES, JSON.stringify(updated));

      const list = this.getVideos().map(v => {
        if (v.id === videoId) {
          return { ...v, likes: Math.max(0, (v.likes || 0) + diff) };
        }
        return v;
      });
      this.saveVideos(list);
      return { isLiked: diff === 1, totalLikes: list.find(v => v.id === videoId)?.likes || 0 };
    } catch (e) {
      return { isLiked: false, totalLikes: 0 };
    }
  },

  isLiked(videoId) {
    try {
      const likes = JSON.parse(localStorage.getItem(STORAGE_KEYS.LIKES) || '[]');
      return likes.includes(videoId);
    } catch (e) {
      return false;
    }
  },

  // Watch History (Retention Engine)
  getHistory() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  addToHistory(video, progressPercent = 25) {
    if (!video || !video.id) return [];
    try {
      const current = this.getHistory();
      const filtered = current.filter(item => item.id !== video.id);
      const historyItem = {
        id: video.id,
        title: video.title,
        thumbnail_url: video.thumbnail_url,
        category: video.category,
        duration: video.duration,
        quality: video.quality,
        progressPercent: progressPercent,
        watched_at: new Date().toISOString()
      };
      const updated = [historyItem, ...filtered].slice(0, 8);
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
      return updated;
    } catch (e) {
      return [];
    }
  },

  clearHistory() {
    try {
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
    } catch (e) {}
    return [];
  },

  // DMCA Requests
  getDMCARequests() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.DMCA) || '[]');
    } catch (e) {
      return [];
    }
  },

  submitDMCARequest(req) {
    const list = this.getDMCARequests();
    const item = {
      id: 'dmca-' + Date.now(),
      status: 'pending',
      created_at: new Date().toISOString(),
      ...req
    };
    list.unshift(item);
    localStorage.setItem(STORAGE_KEYS.DMCA, JSON.stringify(list));
    return item;
  },

  resolveDMCARequest(id) {
    const list = this.getDMCARequests().map(r => (r.id === id ? { ...r, status: 'resolved' } : r));
    localStorage.setItem(STORAGE_KEYS.DMCA, JSON.stringify(list));
    return list;
  },

  // Dev Mode (Toggle Ad Outlines)
  isDevMode() {
    return localStorage.getItem(STORAGE_KEYS.DEV_MODE) === 'true';
  },

  setDevMode(val) {
    localStorage.setItem(STORAGE_KEYS.DEV_MODE, val ? 'true' : 'false');
  },

  // Admin Auth (Default master pin: "admin123")
  isAdminLoggedIn() {
    return sessionStorage.getItem(STORAGE_KEYS.ADMIN_AUTH) === 'true';
  },

  adminLogin(password) {
    if (password === 'admin123' || password === 'admin@123') {
      sessionStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, 'true');
      return true;
    }
    return false;
  },

  adminLogout() {
    sessionStorage.removeItem(STORAGE_KEYS.ADMIN_AUTH);
  }
};
