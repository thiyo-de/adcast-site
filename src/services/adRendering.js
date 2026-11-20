// Production-grade ad delivery verification
// Cross-origin iframe contents remain opaque; geometry + non-empty presence is the robust signal.
export function hasRenderedAd(root, loadedFrames = new WeakSet()) {
  if (!root) return false;
  return [...root.querySelectorAll('img, video, iframe, ins')].some((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 15 || rect.height <= 15) return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    if (element.tagName === 'IMG') return element.complete && element.naturalWidth > 10;
    if (element.tagName === 'VIDEO') return element.readyState >= 2 && element.videoWidth > 10;
    if (element.tagName === 'IFRAME') {
      try {
        if (element.contentDocument) return hasRenderedAd(element.contentDocument, loadedFrames);
      } catch {
        // Cross-origin frames cannot be inspected from the host page.
      }
      const src = element.getAttribute('src');
      return loadedFrames.has(element) && Boolean(
        element.getAttribute('srcdoc') || (src && src !== 'about:blank')
      );
    }
    if (element.tagName === 'INS' && element.children.length > 0) {
      return rect.width > 50 && rect.height > 20;
    }
    return false;
  });
}

// Include a placement even for a short recommendation list; never add one to an empty list.
export function showRecommendationAdAfter(index, count) {
  const first = Math.min(2, count) - 1;
  return count > 0 && index >= first && (index - first) % 6 === 0;
}

// Include overflow on either side of a provider wrapper, including positioned children.
export function getAdFrameLayout(availableWidth, containerRect, creativeRects, viewportScale = { x: 1, y: 1 }) {
  // DOMRects include ancestor transforms; clientWidth and CSS transforms use local pixels.
  // Mixing those units can halve the reserved height in a scaled device preview.
  const localRect = rect => ({
    left: (rect.left - containerRect.left) / viewportScale.x,
    right: (rect.right - containerRect.left) / viewportScale.x,
    top: (rect.top - containerRect.top) / viewportScale.y,
    bottom: (rect.bottom - containerRect.top) / viewportScale.y,
    width: rect.width / viewportScale.x,
    height: rect.height / viewportScale.y,
  });
  const localContainer = localRect(containerRect);
  const rects = [containerRect, ...creativeRects].map(localRect).filter(rect => rect.width > 0 && rect.height > 0);
  if (!availableWidth || !rects.length) return null;
  const left = Math.min(...rects.map(rect => rect.left));
  const right = Math.max(...rects.map(rect => rect.right));
  const top = Math.min(...rects.map(rect => rect.top));
  const bottom = Math.max(...rects.map(rect => rect.bottom));
  const scale = Math.min(1, availableWidth / (right - left));
  return {
    scale,
    x: (availableWidth - (right - left) * scale) / 2 + (localContainer.left - left) * scale,
    y: (localContainer.top - top) * scale,
    height: Math.ceil((bottom - top) * scale),
  };
}
