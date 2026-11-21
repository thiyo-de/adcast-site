export const CORE_CATEGORIES = [
  { id: 'All', label: 'All Streams', icon: 'ri-apps-2-line', color: 'text-rose-500' },
  { id: 'Trending', label: 'Trending', icon: 'ri-fire-fill', color: 'text-rose-500' },
  { id: 'Creator Leaks', label: 'Creator Leaks', icon: 'ri-shield-star-fill', color: 'text-rose-400' },
  { id: 'Amateur', label: 'Amateur', icon: 'ri-camera-lens-fill', color: 'text-rose-400' },
  { id: 'Hardcore', label: 'Hardcore', icon: 'ri-flashlight-fill', color: 'text-rose-400' },
];

export const CATEGORY_TAG_MAP = {
  'Creator Leaks': ['onlyfans', 'fansly', 'leak', 'vip', 'stripper', 'patreon', 'model', 'featured', 'cosplay', 'asian', 'japanese', 'korean', 'chinese', 'oriental'],
  'Amateur': ['amateur', 'homemade', 'couple', 'bedroom', 'ex-girlfriend', 'ex!', 'pov', 'first-person', 'gopro', 'milf', 'mature', 'stepmom', 'mom'],
  'Hardcore': ['threesome', 'creampie', 'bbc', 'bdsm', 'facial', 'asshole', 'cum', 'anal', 'rough', 'action'],
  'Trending': ['viral', 'popular', 'top-rated'],
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
