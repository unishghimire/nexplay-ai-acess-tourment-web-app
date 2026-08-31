import React from 'react';
import {Users, Settings, Megaphone, AlertTriangle} from 'lucide-react';

import { AdminPanelTabProps } from './types';

export const SettingsTab: React.FC<AdminPanelTabProps> = (props) => {
    const { handleSaveSettings, isNoticeActive, maintenanceMode, minWithdrawal, notice, orgFormDescription, setIsNoticeActive, setMaintenanceMode, setMinWithdrawal, setNotice, setOrgFormDescription, setSupportEmail, setSupportPhone, siteSettings, supportEmail, supportPhone, toggleOrgForm } = props;
    return (
                <div className="bg-card p-6 rounded-xl border border-gray-800 space-y-8">
                    <div className="border-b border-gray-700 pb-4">
                        <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                            <Settings className="text-brand-500" /> Site Configuration
                        </h2>
                        <p className="text-xs text-gray-500 mt-1 uppercase font-bold">Manage global application settings and support info.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <h3 className="text-sm font-bold text-brand-400 uppercase tracking-widest border-l-2 border-brand-500 pl-3">Financial Settings</h3>
                            <div>
                                <label htmlFor="min-withdrawal" className="text-xs text-gray-500 uppercase font-bold mb-1 block">Minimum Withdrawal Amount</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">Rs.</span>
                                    <input 
                                        type="number" 
                                        value={minWithdrawal}
                                        onChange={e => setMinWithdrawal(e.target.value)}
                                        className="w-full bg-dark border border-gray-700 rounded-lg p-3 pl-10 text-white focus:border-brand-500 focus-visible:outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h3 className="text-sm font-bold text-brand-400 uppercase tracking-widest border-l-2 border-brand-500 pl-3">Support Info</h3>
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label htmlFor="support-email" className="text-xs text-gray-500 uppercase font-bold mb-1 block">Support Email</label>
                                    <input 
                                        type="email" 
                                        value={supportEmail}
                                        onChange={e => setSupportEmail(e.target.value)}
                                        className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="support-phone" className="text-xs text-gray-500 uppercase font-bold mb-1 block">Support Phone / WhatsApp</label>
                                    <input 
                                        type="text" 
                                        value={supportPhone}
                                        onChange={e => setSupportPhone(e.target.value)}
                                        className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="col-span-full space-y-6">
                            <h3 className="text-sm font-bold text-brand-400 uppercase tracking-widest border-l-2 border-brand-500 pl-3">Maintenance</h3>
                            <div className="bg-dark p-4 rounded-xl border border-gray-800 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="text-red-500 w-5 h-5" />
                                        <span className="text-sm text-white font-bold uppercase">Maintenance Mode</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={maintenanceMode} onChange={e => setMaintenanceMode(e.target.checked)} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-surface peer-focus:focus-visible:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-colors peer-checked:bg-red-600"></div>
                                    </label>
                                </div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase">When enabled, the entire website will be disabled for normal users. Only Admins can access the site.</p>
                            </div>

                            <h3 className="text-sm font-bold text-brand-400 uppercase tracking-widest border-l-2 border-brand-500 pl-3">System Notice</h3>
                            <div className="bg-dark p-4 rounded-xl border border-gray-800 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Megaphone className="text-brand-500 w-5 h-5" />
                                        <span className="text-sm text-white font-bold uppercase">Display Site-wide Notice</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={isNoticeActive} onChange={e => setIsNoticeActive(e.target.checked)} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-surface peer-focus:focus-visible:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-colors peer-checked:bg-brand-600"></div>
                                    </label>
                                </div>
                                <textarea 
                                    value={notice}
                                    onChange={e => setNotice(e.target.value)}
                                    className="w-full bg-surface border border-gray-700 rounded-lg p-4 text-white focus:border-brand-500 focus-visible:outline-none h-32"
                                    placeholder="Enter notice message here... (e.g. Scheduled maintenance at 10 PM)"
                                />
                            </div>

                            <h3 className="text-sm font-bold text-brand-400 uppercase tracking-widest border-l-2 border-brand-500 pl-3 pt-4">Organizer Settings</h3>
                            <div className="bg-dark p-4 rounded-xl border border-gray-800 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Users className="text-brand-500 w-5 h-5" />
                                        <span className="text-sm text-white font-bold uppercase">Open Organizer Applications</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={siteSettings?.isOrgFormOpen ?? true} onChange={toggleOrgForm} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-surface peer-focus:focus-visible:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-colors peer-checked:bg-brand-600"></div>
                                    </label>
                                </div>
                                <p className="text-[10px] text-gray-500 uppercase font-bold">Toggle whether users can apply to become an organization from the contact page.</p>
                                
                                <div className="pt-4 border-t border-gray-800">
                                    <label htmlFor="organizer-form-desc" className="text-[10px] text-gray-500 uppercase font-black mb-2 block tracking-widest">Organizer Form Description</label>
                                    <textarea 
                                        value={orgFormDescription}
                                        onChange={e => setOrgFormDescription(e.target.value)}
                                        className="w-full bg-surface border border-gray-700 rounded-lg p-4 text-white focus:border-brand-500 focus-visible:outline-none h-32 text-sm"
                                        placeholder="Explain the requirements for becoming an organizer..."
                                    />
                                </div>
                            </div>

                            {/* Main Discord Server Integration */}
                            <h3 className="text-sm font-bold text-[#5865F2] uppercase tracking-widest border-l-2 border-[#5865F2] pl-3 pt-4 flex items-center gap-2">
                                Main Discord Server Integration
                            </h3>
                            <div className="bg-dark p-6 rounded-xl border border-gray-800 space-y-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm text-white font-bold uppercase tracking-wide">Automatic Tournament Announcements</div>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Automatically broadcast tournament updates (Publish, Live, Group Draws, Match Starts, Results) to the main Discord server.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                                        <input 
                                            type="checkbox" 
                                            checked={props.autoDiscordTournamentAnnouncements ?? true} 
                                            onChange={e => props.setAutoDiscordTournamentAnnouncements?.(e.target.checked)} 
                                            className="sr-only peer" 
                                        />
                                        <div className="w-11 h-6 bg-surface peer-focus:focus-visible:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-colors peer-checked:bg-[#5865F2]"></div>
                                    </label>
                                </div>

                                <div>
                                    <label htmlFor="discord-webhook-url" className="text-xs text-gray-400 uppercase font-bold mb-1.5 flex items-center justify-between">
                                        <span>Main Discord Webhook URL (#tournaments)</span>
                                        {props.discordWebhookTournaments?.trim() ? (
                                            <span className="text-[10px] text-green-400 font-bold bg-green-950/60 border border-green-500/30 px-2 py-0.5 rounded">CONFIGURED</span>
                                        ) : (
                                            <span className="text-[10px] text-yellow-400 font-bold bg-yellow-950/60 border border-yellow-500/30 px-2 py-0.5 rounded">NOT SET</span>
                                        )}
                                    </label>
                                    <div className="flex gap-2">
                                        <input 
                                            id="discord-webhook-url"
                                            type="url" 
                                            value={props.discordWebhookTournaments || ''}
                                            onChange={e => props.setDiscordWebhookTournaments?.(e.target.value)}
                                            placeholder="https://discord.com/api/webhooks/..."
                                            className="w-full bg-surface border border-gray-700 rounded-lg p-3 text-white font-mono text-xs focus:border-[#5865F2] focus-visible:outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                if (!props.discordWebhookTournaments?.trim()) {
                                                    props.showToast?.('Please enter a Discord Webhook URL first', 'warning');
                                                    return;
                                                }
                                                const { testDiscordWebhook } = await import('../../../../shared/services/DiscordService');
                                                props.showToast?.('Sending test announcement to Discord...', 'info');
                                                const res = await testDiscordWebhook(props.discordWebhookTournaments.trim());
                                                props.showToast?.(res.message, res.success ? 'success' : 'error');
                                            }}
                                            className="px-4 py-3 bg-[#5865F2] hover:bg-[#4752c4] text-white text-xs font-bold uppercase tracking-wider rounded-lg transition shrink-0 shadow-md shadow-[#5865F2]/20"
                                        >
                                            Test Ping
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-gray-500 font-bold mt-1.5">
                                        Paste the Discord channel webhook URL. Once saved, all tournament lifecycle events will be automatically announced to your main Discord community.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-gray-800 flex justify-end">
                        <button type="button" 
                            onClick={handleSaveSettings}
                            className="bg-brand-600 hover:bg-brand-500 text-white px-10 py-3 rounded-xl font-bold transition shadow-lg shadow-brand-600/20 uppercase tracking-widest"
                        >
                            Save All Settings
                        </button>
                    </div>
                </div>
    );
};
