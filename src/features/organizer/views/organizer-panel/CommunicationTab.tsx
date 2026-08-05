import React from 'react';
import { Send, Link2 } from 'lucide-react';
import { Tournament } from '../../../../shared/types/types';

interface CommunicationTabProps {
    commSelectedTourId: string;
    setCommSelectedTourId: (val: string) => void;
    hostedTournaments: Tournament[];
    announcementText: string;
    setAnnouncementText: (val: string) => void;
    onBroadcastAnnouncement: (e: React.FormEvent) => void;
    discordWebhook: string;
    setDiscordWebhook: (val: string) => void;
    savingWebhook: boolean;
    onSaveWebhook: () => void;
    profile: any;
}

export const CommunicationTab: React.FC<CommunicationTabProps> = ({
    commSelectedTourId,
    setCommSelectedTourId,
    hostedTournaments,
    announcementText,
    setAnnouncementText,
    onBroadcastAnnouncement,
    discordWebhook,
    setDiscordWebhook,
    savingWebhook,
    onSaveWebhook,
    profile
}) => {
    return (
        <div className="space-y-8">
            <div className="border-b border-gray-800 pb-6">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Announcements & Webhooks</h2>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Broadcast real-time messages directly to participant in-boxes</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Announcement compose box */}
                <div className="space-y-6">
                    <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                        <Send className="w-5 h-5 text-brand-500" /> Write Live Broadcast
                    </h3>
                    <form onSubmit={onBroadcastAnnouncement} className="bg-black/20 p-8 rounded-3xl border border-gray-800 space-y-4">
                        <div>
                            <label className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Select Target Competition</label>
                            <select 
                                value={commSelectedTourId}
                                onChange={(e) => setCommSelectedTourId(e.target.value)}
                                required
                                className="w-full bg-black border border-gray-800 rounded-full p-4 text-xs font-black text-white outline-none focus:border-brand-500 uppercase tracking-widest"
                            >
                                <option value="">-- Choose Competition --</option>
                                {hostedTournaments.map(t => (
                                    <option key={t.id} value={t.id}>{t.title}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Broadcast Message Context</label>
                            <textarea 
                                value={announcementText}
                                onChange={(e) => setAnnouncementText(e.target.value)}
                                required
                                rows={5}
                                placeholder="Type official details, postponement schedules, map downloads, or schedule changes. This broadcasts instantly to all dashboard indicators..."
                                className="w-full bg-black border border-gray-800 rounded-3xl p-4 text-xs font-bold text-white outline-none focus:border-brand-500"
                            />
                        </div>
                        <button 
                            type="submit"
                            className="w-full bg-brand-500 hover:bg-brand-400 text-white py-4 rounded-full font-black text-xs uppercase tracking-widest transition-all shadow-lg"
                        >
                            BroadCast Announcement
                        </button>
                    </form>
                </div>

                {/* Webhook Settings configurations */}
                <div className="space-y-6">
                    <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                        <Link2 className="w-5 h-5 text-purple-500" /> Automated Discord Webhooks
                    </h3>
                    
                    <div className="bg-black/20 p-8 rounded-3xl border border-gray-800 space-y-4">
                        <p className="text-xs text-gray-400 font-bold tracking-wide">
                            Route instant results, schedules updates, and custom credentials directly to your discord servers for tournament automatic postings.
                        </p>
                        <div>
                            <label className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Discord Server Webhook Link</label>
                            <input 
                                type="url"
                                value={discordWebhook}
                                onChange={(e) => setDiscordWebhook(e.target.value)}
                                placeholder="https://discord.com/api/webhooks/..."
                                className="w-full bg-black border border-gray-800 rounded-full p-4 text-xs font-mono text-white outline-none focus:border-brand-500"
                            />
                        </div>
                        <button 
                            onClick={onSaveWebhook}
                            disabled={savingWebhook}
                            className="w-full bg-purple-600 hover:bg-purple-500 text-white py-4 rounded-full font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-purple-600/10"
                        >
                            {savingWebhook ? "Integrating Webhook..." : "Save Webhook Settings"}
                        </button>

                        <div className="border-t border-gray-800 pt-6 mt-6">
                            <h4 className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-3">Integrations Status</h4>
                            <div className="flex gap-4">
                                <div className="flex-1 bg-black p-4 rounded-2xl border border-gray-900 flex items-center gap-3 text-xs">
                                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-gray-400 font-bold">Discord webhook: {profile?.discord ? 'Active' : 'Offline'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommunicationTab;
