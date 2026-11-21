export const CORE_CATEGORIES = [
  { id: 'All', label: 'All Streams', icon: 'ri-apps-2-line', color: 'text-rose-500' },
  { id: 'Trending', label: 'Trending', icon: 'ri-fire-fill', color: 'text-rose-500' },
  { id: 'Creator Leaks', label: 'Creator Leaks', icon: 'ri-shield-star-fill', color: 'text-rose-400' },
  { id: 'Amateur', label: 'Amateur', icon: 'ri-camera-lens-fill', color: 'text-rose-400' },
  { id: 'POV', label: 'POV', icon: 'ri-eye-2-fill', color: 'text-rose-400' },
  { id: 'MILF', label: 'MILF', icon: 'ri-heart-pulse-fill', color: 'text-rose-400' },
  { id: 'Asian', label: 'Asian', icon: 'ri-sparkling-2-fill', color: 'text-rose-400' },
  { id: 'Hardcore', label: 'Hardcore', icon: 'ri-flashlight-fill', color: 'text-rose-400' },
  { id: '4K Ultra', label: '4K Ultra', icon: 'ri-hd-fill', color: 'text-amber-500' },
];

export const CATEGORY_TAG_MAP = {
  'Creator Leaks': ['onlyfans', 'fansly', 'leak', 'vip', 'stripper', 'patreon', 'model', 'featured'],
  'Amateur': ['amateur', 'homemade', 'couple', 'bedroom', 'ex-girlfriend', 'ex!'],
  'POV': ['pov', 'first-person', 'gopro'],
  'MILF': ['milf', 'mature', 'stepmom', 'mom'],
  'Asian': ['asian', 'japanese', 'korean', 'chinese', 'oriental'],
  'Hardcore': ['threesome', 'creampie', 'bbc', 'bdsm', 'facial', 'asshole', 'cum', 'anal', 'rough', 'action'],
  'Trending': ['viral', 'popular', 'top-rated'],
  '4K Ultra': ['4k', 'ultra', '1080p', '60fps', 'hd'],
};

export function computeCategoryCounts(videos = []) {
  const counts = { All: (videos || []).length };
  CORE_CATEGORIES.forEach((cat) => {
    if (cat.id === 'All') return;
    if (cat.id === 'Trending') {
      counts[cat.id] = videos.filter((v) => (v.views || 0) > 1000 || (v.rating || 0) >= 80).length;
    } else {
      const tagKeywords = CATEGORY_TAG_MAP[cat.id] || [];
      counts[cat.id] = videos.filter((v) => {
        if (v.category === cat.id) return true;
        const videoTags = Array.isArray(v.tags) ? v.tags : [];
        return videoTags.some((t) => tagKeywords.includes((t || '').toLowerCase()));
      }).length;
    }
  });
  return counts;
}
