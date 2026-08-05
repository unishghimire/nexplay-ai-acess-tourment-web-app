import React from 'react';

interface SettingsTabProps {
    handleSaveOrgSettings: (e: React.FormEvent) => void;
    settingsOrgName: string;
    setSettingsOrgName: (v: string) => void;
    settingsWhatsapp: string;
    setSettingsWhatsapp: (v: string) => void;
    settingsContact: string;
    setSettingsContact: (v: string) => void;
    settingsBio: string;
    setSettingsBio: (v: string) => void;
    savingSettings: boolean;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
    handleSaveOrgSettings, settingsOrgName, setSettingsOrgName, settingsWhatsapp, setSettingsWhatsapp,
    settingsContact, setSettingsContact, settingsBio, setSettingsBio, savingSettings
}) => {
    return (
        <form onSubmit={handleSaveOrgSettings} className="space-y-6">
            <div className="border-b border-gray-800 pb-6">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Organization Profile Settings</h2>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Synchronize public branding, mottos, logos, and support details</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Organization Display Name</label>
                    <input type="text" value={settingsOrgName} onChange={(e) => setSettingsOrgName(e.target.value)} required placeholder="e.g. NexPlay Esports Association" className="w-full bg-black border border-gray-800 rounded-full p-4 text-xs font-bold text-white outline-none focus:border-brand-500" />
                </div>
                <div>
                    <label className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">WhatsApp Contact / Support channel Link</label>
                    <input type="url" value={settingsWhatsapp} onChange={(e) => setSettingsWhatsapp(e.target.value)} placeholder="https://chat.whatsapp.com/..." className="w-full bg-black border border-gray-800 rounded-full p-4 text-xs font-bold text-white outline-none focus:border-brand-500" />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Support Contact Info / E-mail</label>
                    <input type="text" value={settingsContact} onChange={(e) => setSettingsContact(e.target.value)} placeholder="e.g. support@yourdomain.net" className="w-full bg-black border border-gray-800 rounded-full p-4 text-xs font-bold text-white outline-none focus:border-brand-500" />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Short Bio / Rules Terms Template</label>
                    <textarea value={settingsBio} onChange={(e) => setSettingsBio(e.target.value)} rows={6} placeholder="Tell potential registrants who you are and state default regulations, match cancellation schedules, and payment/refunding guidelines..." className="w-full bg-black border border-gray-800 rounded-3xl p-4 text-xs font-bold text-white outline-none focus:border-brand-500" />
                </div>
            </div>

            <button type="submit" disabled={savingSettings} className="w-full bg-brand-500 hover:bg-brand-400 text-white py-4 rounded-full font-black text-xs uppercase tracking-widest transition-all shadow-lg">
                {savingSettings ? "Synchronizing settings..." : "Sync Preferences"}
            </button>
        </form>
    );
};

export default SettingsTab;
