import React, { useState, useEffect } from 'react';
import { Settings, Radio, UserCog, Save, Link2, Youtube } from 'lucide-react';

export interface SettingsStreamTabProps {
  profile: any;
  isDemoMode: boolean;
  onSaveSettings: (settings: {
    orgName?: string;
    bio?: string;
    whatsapp?: string;
    contactInfo?: string;
    discord?: string;
  }) => void;
}

export const SettingsStreamTab: React.FC<SettingsStreamTabProps> = ({
  profile,
  isDemoMode,
  onSaveSettings,
}) => {
  // Section A State: Organization Profile
  const [orgName, setOrgName] = useState<string>(
    profile?.orgName || profile?.name || profile?.displayName || ''
  );
  const [bio, setBio] = useState<string>(profile?.bio || '');
  const [whatsapp, setWhatsapp] = useState<string>(
    profile?.whatsapp || profile?.phone || ''
  );
  const [contactInfo, setContactInfo] = useState<string>(
    profile?.contactInfo || profile?.contactEmail || profile?.email || ''
  );
  const [discord, setDiscord] = useState<string>(
    profile?.discord || profile?.discordWebhook || ''
  );

  // Section B State: Stream & Staff
  const [youtubeUrl, setYoutubeUrl] = useState<string>(
    profile?.youtubeUrl || profile?.youtube || ''
  );
  const [twitchUrl, setTwitchUrl] = useState<string>(
    profile?.twitchUrl || profile?.twitch || ''
  );

  const [refereeName, setRefereeName] = useState<string>(
    profile?.refereeName || profile?.staff?.referee?.name || ''
  );
  const [refereeEnabled, setRefereeEnabled] = useState<boolean>(
    profile?.refereeEnabled ?? profile?.staff?.referee?.enabled ?? true
  );

  const [casterName, setCasterName] = useState<string>(
    profile?.casterName || profile?.staff?.caster?.name || ''
  );
  const [casterEnabled, setCasterEnabled] = useState<boolean>(
    profile?.casterEnabled ?? profile?.staff?.caster?.enabled ?? true
  );

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Sync state if profile prop updates
  useEffect(() => {
    if (profile) {
      setOrgName(profile.orgName || profile.name || profile.displayName || '');
      setBio(profile.bio || '');
      setWhatsapp(profile.whatsapp || profile.phone || '');
      setContactInfo(profile.contactInfo || profile.contactEmail || profile.email || '');
      setDiscord(profile.discord || profile.discordWebhook || '');
      if (profile.youtubeUrl || profile.youtube) {
        setYoutubeUrl(profile.youtubeUrl || profile.youtube);
      }
      if (profile.twitchUrl || profile.twitch) {
        setTwitchUrl(profile.twitchUrl || profile.twitch);
      }
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await onSaveSettings({
        orgName,
        bio,
        whatsapp,
        contactInfo,
        discord,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to get embeddable YouTube URL
  const getEmbedYoutubeUrl = (url: string) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  };

  const embedUrl = getEmbedYoutubeUrl(youtubeUrl);

  return (
    <div className="space-y-6 text-gray-100">
      {/* 1. Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-800">
        <div>
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-brand-500" />
            <h2 className="text-2xl font-bold text-white tracking-tight">Settings &amp; Stream</h2>
            {isDemoMode && (
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Demo Mode
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Organization branding, stream configuration, and staff permissions
          </p>
        </div>
      </div>

      {/* 2. Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section A: Organization Profile Card */}
        <div className="bg-gray-950/50 border border-gray-800 rounded-lg p-5 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800/80">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-brand-500" /> Organization Profile
            </h3>
            {saveSuccess && (
              <span className="text-xs font-medium text-emerald-400 animate-pulse">
                Settings saved!
              </span>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            {/* Org Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Org Name
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Free Fire Champions Esports"
                className="w-full bg-black border border-gray-800 rounded-lg p-3 text-sm text-white placeholder-gray-600 outline-none focus:border-brand-500 transition-colors"
                required
              />
            </div>

            {/* Bio (textarea 3 rows) */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Bio
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Brief summary of your esports organization, motto, or tournament rules..."
                className="w-full bg-black border border-gray-800 rounded-lg p-3 text-sm text-white placeholder-gray-600 outline-none focus:border-brand-500 transition-colors resize-none"
              />
            </div>

            {/* WhatsApp Number */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                WhatsApp Number
              </label>
              <input
                type="text"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="e.g. +977 9800000000 or https://chat.whatsapp.com/..."
                className="w-full bg-black border border-gray-800 rounded-lg p-3 text-sm text-white placeholder-gray-600 outline-none focus:border-brand-500 transition-colors"
              />
            </div>

            {/* Contact Email */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Contact Email
              </label>
              <input
                type="email"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder="e.g. contact@esportsorg.com"
                className="w-full bg-black border border-gray-800 rounded-lg p-3 text-sm text-white placeholder-gray-600 outline-none focus:border-brand-500 transition-colors"
              />
            </div>

            {/* Discord Webhook URL */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-indigo-400" /> Discord Webhook URL
              </label>
              <input
                type="url"
                value={discord}
                onChange={(e) => setDiscord(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="w-full bg-black border border-gray-800 rounded-lg p-3 text-sm font-mono text-white placeholder-gray-600 outline-none focus:border-brand-500 transition-colors"
              />
            </div>

            {/* Save Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full bg-brand-500 text-white rounded-lg py-3 px-4 font-semibold text-sm hover:bg-brand-400 transition-colors flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer min-h-[44px]"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving Settings...' : 'Save Profile Settings'}
              </button>
            </div>
          </form>
        </div>

        {/* Section B: Stream & Staff Card */}
        <div className="bg-gray-950/50 border border-gray-800 rounded-lg p-5 space-y-6">
          {/* Stream Configuration Header */}
          <div className="pb-3 border-b border-gray-800/80">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-brand-500" /> Stream &amp; Staff Configuration
            </h3>
          </div>

          {/* Stream Inputs */}
          <div className="space-y-4">
            {/* YouTube Live URL */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Youtube className="w-4 h-4 text-red-500" /> YouTube Live URL
              </label>
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full bg-black border border-gray-800 rounded-lg p-3 text-sm text-white placeholder-gray-600 outline-none focus:border-brand-500 transition-colors"
              />
            </div>

            {/* Twitch URL (Using Radio icon as requested) */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-purple-400" /> Twitch Broadcast URL
              </label>
              <input
                type="url"
                value={twitchUrl}
                onChange={(e) => setTwitchUrl(e.target.value)}
                placeholder="https://twitch.tv/..."
                className="w-full bg-black border border-gray-800 rounded-lg p-3 text-sm text-white placeholder-gray-600 outline-none focus:border-brand-500 transition-colors"
              />
            </div>

            {/* Stream Preview Area */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Stream Preview
              </label>
              <div className="aspect-video bg-gray-900 rounded-lg border border-gray-800 relative overflow-hidden flex flex-col items-center justify-center group">
                {embedUrl ? (
                  <iframe
                    src={embedUrl}
                    title="Stream preview"
                    className="w-full h-full rounded-lg"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-center p-4">
                    <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 group-hover:scale-105 transition-transform">
                      <Radio className="w-6 h-6 text-brand-500 animate-pulse" />
                    </div>
                    <span className="text-sm font-semibold text-gray-300">Stream preview</span>
                    <span className="text-xs text-gray-500 max-w-xs">
                      Enter a valid YouTube or Twitch live URL above to test live player stream feed.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Staff Permissions Section */}
          <div className="pt-4 border-t border-gray-800/80 space-y-4">
            <div className="flex items-center gap-2">
              <UserCog className="w-4 h-4 text-brand-500" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                Staff Permissions &amp; Roles
              </h4>
            </div>

            {/* Referee Name Input + Toggle */}
            <div className="bg-black/40 border border-gray-800 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1">
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Referee Name / Handle
                </label>
                <input
                  type="text"
                  value={refereeName}
                  onChange={(e) => setRefereeName(e.target.value)}
                  placeholder="e.g. Ref_Alex or FreeFire_Admin"
                  className="w-full bg-black border border-gray-800 rounded p-2 text-xs text-white placeholder-gray-600 outline-none focus:border-brand-500"
                />
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-0 border-t sm:border-t-0 border-gray-800">
                <span className="text-xs text-gray-400 font-medium">Referee Access</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={refereeEnabled}
                  onClick={() => setRefereeEnabled(!refereeEnabled)}
                  className={`relative inline-flex h-6 w-11 min-h-[44px] min-w-[44px] items-center justify-start flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    refereeEnabled ? 'bg-brand-500' : 'bg-gray-800'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      refereeEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Caster Name Input + Toggle */}
            <div className="bg-black/40 border border-gray-800 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1">
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Caster Name / Handle
                </label>
                <input
                  type="text"
                  value={casterName}
                  onChange={(e) => setCasterName(e.target.value)}
                  placeholder="e.g. Caster_Sam or FF_Shoutcaster"
                  className="w-full bg-black border border-gray-800 rounded p-2 text-xs text-white placeholder-gray-600 outline-none focus:border-brand-500"
                />
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-0 border-t sm:border-t-0 border-gray-800">
                <span className="text-xs text-gray-400 font-medium">Caster Access</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={casterEnabled}
                  onClick={() => setCasterEnabled(!casterEnabled)}
                  className={`relative inline-flex h-6 w-11 min-h-[44px] min-w-[44px] items-center justify-start flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    casterEnabled ? 'bg-brand-500' : 'bg-gray-800'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      casterEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Note text about staff permissions */}
            <p className="text-xs text-gray-500">
              Note: Staff permissions grant assigned handles access to referee room management, match score validation, live stream overlays, and spectator access.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsStreamTab;
