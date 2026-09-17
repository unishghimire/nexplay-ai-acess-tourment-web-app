import React from 'react';
import { X, Share, PlusSquare, Smartphone } from 'lucide-react';
import { usePwaInstall } from '../../hooks/usePwaInstall';

export const InstallAppPrompt: React.FC = () => {
    const {
        isIOS,
        showIOSModal,
        closeIOSModal
    } = usePwaInstall();

    return (
        <>
            {/* iOS / Browser "Add to Home Screen" Instructional Modal */}
            {showIOSModal && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="install-modal-title"
                    className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
                >
                    <div className="bg-[#0f172a] border border-purple-500/30 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 animate-slide-up relative">
                        <button
                            type="button"
                            onClick={closeIOSModal}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
                            aria-label="Close installation dialog"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-purple-950/80 border border-purple-500/40 p-1.5 flex items-center justify-center shadow-[0_0_16px_rgba(139,92,246,0.4)] shrink-0">
                                <img src="/logo.png" alt="NexPlay Logo" className="w-full h-full object-contain" />
                            </div>
                            <div>
                                <h3 id="install-modal-title" className="text-base sm:text-lg font-black text-white uppercase tracking-tight">
                                    Install NexPlay App
                                </h3>
                                <p className="text-xs text-slate-400">
                                    {isIOS ? 'Install on iOS Safari' : 'Install on Mobile Browser'}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2.5 pt-1 text-xs text-slate-200">
                            {isIOS ? (
                                <>
                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#141d33] border border-white/5">
                                        <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                                            <Share className="w-4 h-4" />
                                        </div>
                                        <p>
                                            1. Tap the <span className="text-white font-bold">Share</span> icon in Safari toolbar.
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#141d33] border border-white/5">
                                        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                            <PlusSquare className="w-4 h-4" />
                                        </div>
                                        <p>
                                            2. Scroll down and tap <span className="text-white font-bold">Add to Home Screen</span>.
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#141d33] border border-white/5">
                                        <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                                            <Smartphone className="w-4 h-4" />
                                        </div>
                                        <p>
                                            3. Tap <span className="text-white font-bold">Add</span> to complete installation!
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#141d33] border border-white/5">
                                        <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                                            <Share className="w-4 h-4" />
                                        </div>
                                        <p>
                                            1. Tap the <span className="text-white font-bold">Menu (⋮)</span> in your browser.
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#141d33] border border-white/5">
                                        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                            <PlusSquare className="w-4 h-4" />
                                        </div>
                                        <p>
                                            2. Select <span className="text-white font-bold">Install app</span> or <span className="text-white font-bold">Add to Home screen</span>.
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#141d33] border border-white/5">
                                        <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                                            <Smartphone className="w-4 h-4" />
                                        </div>
                                        <p>
                                            3. Confirm to launch the native fullscreen experience!
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={closeIOSModal}
                            className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-purple-900/40 transition active:scale-95"
                        >
                            Got It
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default InstallAppPrompt;
