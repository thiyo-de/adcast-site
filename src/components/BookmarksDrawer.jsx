import React from 'react';
import { store } from '../services/store';

export default function BookmarksDrawer({ isOpen, onClose, onSelectVideo, onRemoveBookmark }) {
  if (!isOpen) return null;

  const bookmarkedIds = store.getBookmarks();
  const allVideos = store.getVideos();
  const bookmarkedVideos = allVideos.filter(v => bookmarkedIds.includes(v.id));

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white/95 dark:bg-obsidian-surface/95 backdrop-blur-2xl border-l border-slate-200 dark:border-white/10 shadow-2xl flex flex-col justify-between">
          {/* Header */}
          <div className="p-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
                <i className="ri-bookmark-fill not-italic text-lg"></i>
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Saved Streams</h3>
                <p className="text-xs text-slate-400">{bookmarkedVideos.length} streams stored locally</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              <i className="ri-close-line not-italic text-lg"></i>
            </button>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {bookmarkedVideos.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <i className="ri-bookmark-line not-italic text-4xl text-slate-300 dark:text-slate-600 mb-2"></i>
                <p className="font-bold text-sm text-slate-700 dark:text-slate-300">No saved videos yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Click the bookmark icon on any stream to save it privately on your device.
                </p>
              </div>
            ) : (
              bookmarkedVideos.map((vid) => (
                <div
                  key={vid.id}
                  onClick={() => {
                    onSelectVideo(vid.id);
                    onClose();
                  }}
                  className="flex items-center gap-3 p-2.5 rounded-2xl glass-card cursor-pointer group"
                >
                  <div className="relative w-24 aspect-video rounded-xl overflow-hidden bg-slate-950 shrink-0">
                    <img src={vid.thumbnail_url} alt={vid.title} className="w-full h-full object-cover filter blur-[10px] scale-110 opacity-25" />
                    <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center">
                      <i className="ri-play-fill not-italic text-white text-lg opacity-0 group-hover:opacity-100 transition-opacity"></i>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white truncate group-hover:text-rose-500 transition-colors">
                      {vid.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {vid.category} • {vid.duration || 'HD'}
                    </p>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveBookmark(vid.id);
                    }}
                    className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                    title="Remove from saved"
                  >
                    <i className="ri-delete-bin-line not-italic text-sm"></i>
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-white/10 text-[11px] text-slate-400 text-center">
            Saved privately on device memory. Zero tracking.
          </div>
        </div>
      </div>
    </div>
  );
}
