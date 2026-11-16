import React, { useState } from 'react';

export default function Legal({ onBack, defaultTab = 'terms' }) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#12141F] hover:bg-[#1A1D2D] border border-[#222638] text-xs font-bold text-slate-300 hover:text-white transition-colors"
      >
        <i className="ri-arrow-left-line not-italic text-sm"></i> Back
      </button>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#222638] pb-3">
        <button
          onClick={() => setActiveTab('terms')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'terms'
              ? 'bg-rose-600 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <i className="ri-file-text-line not-italic text-sm"></i>
          Terms of Service
        </button>

        <button
          onClick={() => setActiveTab('privacy')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'privacy'
              ? 'bg-rose-600 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <i className="ri-lock-line not-italic text-sm"></i>
          Privacy Policy
        </button>
      </div>

      {/* Content */}
      <div className="p-6 sm:p-8 rounded-2xl bg-[#12141F] border border-[#222638] space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
        {activeTab === 'terms' ? (
          <>
            <h1 className="text-xl font-extrabold text-white">Terms of Service</h1>
            <p>Last updated: November 2026</p>
            <h3 className="text-sm font-bold text-white pt-2">1. Acceptance of Terms</h3>
            <p>
              By accessing and using HornyLeaks, you agree to comply with and be bound by these Terms of Service. If you do not agree, please discontinue using the service immediately.
            </p>
            <h3 className="text-sm font-bold text-white pt-2">2. Nature of Service</h3>
            <p>
              HornyLeaks is an automated web index that displays third-party video embeds. We do not host, store, convert, or distribute copyrighted video files on our own servers. All content shown is publicly available on external networks.
            </p>
            <h3 className="text-sm font-bold text-white pt-2">3. User Age Eligibility</h3>
            <p>
              You must be at least 18 years of age (or the legal age of majority in your jurisdiction) to access this platform. By continuing to use the site, you verify that you fulfill this age requirement.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-extrabold text-white">Privacy Policy</h1>
            <p>Last updated: November 2026</p>
            <h3 className="text-sm font-bold text-white pt-2">1. Information We Do Not Collect</h3>
            <p>
              HornyLeaks does not require public user registrations, passwords, or personal identity profiles. General browsing is completely anonymous.
            </p>
            <h3 className="text-sm font-bold text-white pt-2">2. Local Browser Storage</h3>
            <p>
              We utilize your browser’s localStorage solely to remember your 18+ age verification choice and locally saved bookmarks. This data remains on your physical device.
            </p>
            <h3 className="text-sm font-bold text-white pt-2">3. Third-Party Advertisers</h3>
            <p>
              Third-party advertising partners (such as ExoClick, JuicyAds, TrafficFactory, and Adsterra) may use cookies or scripts to serve relevant advertisements. These partners adhere to their respective privacy guidelines.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
