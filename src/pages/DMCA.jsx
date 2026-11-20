import React, { useState } from 'react';
import { api } from '../services/supabase';
import { store } from '../services/store';

export default function DMCA({ initialVideoId, onBack }) {
  const reportedVideo = initialVideoId ? store.getVideoById(initialVideoId) : null;
  const [videoUrl, setVideoUrl] = useState(
    initialVideoId ? `${window.location.origin}/watch/${initialVideoId}` : ''
  );
  const [claimantName, setClaimantName] = useState('');
  const [claimantEmail, setClaimantEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await api.submitTakedown({
        video_url: videoUrl,
        claimant_name: claimantName,
        claimant_email: claimantEmail,
        notes: notes
      });
      setIsSubmitted(true);
    } catch (err) {
      setSubmitError(err?.message || 'Failed to submit takedown request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-32 sm:pb-36 space-y-6 sm:space-y-8">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-full glass-button text-xs font-bold active:scale-95 transition-all"
      >
        <i className="ri-arrow-left-line not-italic text-sm"></i>
        <span>Back to Browse</span>
      </button>

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-500 mb-1 shadow-inner">
          <i className="ri-shield-check-fill not-italic text-3xl"></i>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          DMCA & Content Removal Policy
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
          HornyLeaks respects intellectual property rights. We index and embed media hosted by public third parties and do not host video files on our infrastructure.
        </p>
      </div>

      {/* Policy Notice Box */}
      <div className="p-6 rounded-2xl glass-card space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed border border-slate-200/80 dark:border-white/10">
        <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
          <i className="ri-alert-line not-italic text-amber-500 text-lg"></i>
          Third-Party Media Embed Disclaimer
        </h3>
        <p>
          HornyLeaks functions solely as a media search engine and curation index. None of the video streams displayed on this site are hosted, stored, or uploaded onto our servers. All embeds originate from public external video platforms.
        </p>
        <p>
          If you are the legal copyright owner of a video indexed here and wish for the embed link to be removed, please complete the form below. Valid takedown notices are reviewed and removed within <strong className="text-slate-900 dark:text-white">24 to 48 hours</strong>.
        </p>
      </div>

      {/* Submission Form */}
      <div className="p-6 sm:p-8 rounded-3xl glass-panel shadow-2xl border border-slate-200/80 dark:border-white/10">
        {isSubmitted ? (
          <div className="py-12 text-center space-y-3">
            <i className="ri-checkbox-circle-fill not-italic text-5xl text-emerald-500 mx-auto block animate-bounce"></i>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Notice Submitted Successfully</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              Your takedown request has been recorded. Our compliance administrator will verify the claim and remove the embed reference within 24–48 hours.
            </p>
            <button
              onClick={onBack}
              className="mt-4 min-h-[44px] px-6 py-2.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md active:scale-95 transition-all cursor-pointer"
            >
              Return to Platform
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              Submit Takedown Request
            </h3>

            {/* Reported Video Context Card (If navigated from watch page) */}
            {reportedVideo && (
              <div className="p-3.5 rounded-2xl glass-card flex items-center gap-3 border border-rose-500/30 bg-rose-500/[0.03]">
                <div className="relative w-20 aspect-video rounded-xl overflow-hidden bg-black shrink-0">
                  <img src={reportedVideo.thumbnail_url} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-extrabold text-rose-500 uppercase tracking-wider block">
                    Reported Stream Reference
                  </span>
                  <h4 className="text-xs font-bold truncate text-slate-900 dark:text-white">
                    {reportedVideo.title}
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    ID: {reportedVideo.id} • {reportedVideo.category}
                  </span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Video URL on HornyLeaks *
              </label>
              <input
                type="text"
                required
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="e.g. https://adcast.com/watch/vid-101"
                className="w-full min-h-[44px] px-4 py-2.5 bg-slate-100/80 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Copyright Owner / Agent Name *
                </label>
                <input
                  type="text"
                  required
                  value={claimantName}
                  onChange={(e) => setClaimantName(e.target.value)}
                  placeholder="Full legal name"
                  className="w-full min-h-[44px] px-4 py-2.5 bg-slate-100/80 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Official Contact Email *
                </label>
                <input
                  type="email"
                  required
                  value={claimantEmail}
                  onChange={(e) => setClaimantEmail(e.target.value)}
                  placeholder="email@company.com"
                  className="w-full min-h-[44px] px-4 py-2.5 bg-slate-100/80 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Proof of Ownership & Details
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Please describe your copyright ownership or provide original work links..."
                className="w-full p-3.5 bg-slate-100/80 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>

            {submitError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold flex items-center gap-2">
                <i className="ri-error-warning-line not-italic text-sm"></i>
                <span>{submitError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 min-h-[44px] px-8 py-3 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <i className="ri-send-plane-fill not-italic text-sm"></i>
              <span>{isSubmitting ? 'Submitting Notice...' : 'Submit Notice for Review'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
