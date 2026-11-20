// A sized <ins> or an empty table is not evidence of a delivered creative.
// Cross-origin iframe contents remain opaque; load + size is only a best-effort signal.
export function hasRenderedAd(root, loadedFrames = new WeakSet()) {
  return [...root.querySelectorAll('img, video, iframe')].some((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 10 || rect.height <= 10) return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (element.tagName === 'IMG') return element.complete && element.naturalWidth > 10;
    if (element.tagName === 'VIDEO') return element.readyState >= 2 && element.videoWidth > 10;
    // Some providers populate an about:blank frame instead of navigating it.
    try {
      if (element.contentDocument) return hasRenderedAd(element.contentDocument, loadedFrames);
    } catch {
      // Cross-origin frames cannot be inspected from the host page.
    }
    const src = element.getAttribute('src');
    return loadedFrames.has(element) && Boolean(
      element.getAttribute('srcdoc') || (src && src !== 'about:blank')
    );
  });
}

// Include a placement even for a short recommendation list; never add one to an empty list.
export function showRecommendationAdAfter(index, count) {
  const first = Math.min(2, count) - 1;
  return count > 0 && index >= first && (index - first) % 6 === 0;
}
