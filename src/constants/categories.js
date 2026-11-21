export const CORE_CATEGORIES = [
  { id: 'All', label: 'All Streams', icon: 'ri-apps-2-line', color: 'text-rose-500' },
  { id: 'Trending', label: 'Trending', icon: 'ri-fire-fill', color: 'text-rose-500' },
  { id: 'Indian Leaks', label: 'Indian Leaks', icon: 'ri-flag-fill', color: 'text-amber-400' },
  { id: 'Creator Leaks', label: 'Creator Leaks', icon: 'ri-shield-star-fill', color: 'text-rose-400' },
  { id: 'Amateur', label: 'Amateur', icon: 'ri-camera-lens-fill', color: 'text-rose-400' },
  { id: 'Hardcore', label: 'Hardcore', icon: 'ri-flashlight-fill', color: 'text-rose-400' },
];

export const CATEGORY_TAG_MAP = {
  'Indian Leaks': ['desi', 'indian', 'mms', 'bhabhi', 'pakistani', 'mallu', 'tamil', 'hindi', 'bengali', 'punjabi'],
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

  // Dynamically count any newly added categories present in videos
  (videos || []).forEach((v) => {
    const cat = v.category;
    if (cat && cat !== 'All' && !Object.prototype.hasOwnProperty.call(counts, cat)) {
      counts[cat] = videos.filter((item) => item.category === cat).length;
    }
  });

  return counts;
}

export function getAvailableCategories(categoryCounts = {}) {
  const list = [...CORE_CATEGORIES];
  const existingIds = new Set(CORE_CATEGORIES.map((c) => c.id));

  Object.keys(categoryCounts || {}).forEach((catId) => {
    if (!existingIds.has(catId) && catId !== 'All' && (categoryCounts[catId] || 0) > 0) {
      list.push({
        id: catId,
        label: catId,
        icon: 'ri-folder-video-line',
        color: 'text-rose-400'
      });
    }
  });

  return list;
}
