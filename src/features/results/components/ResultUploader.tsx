import React, { useState } from 'react';
import { Tournament, TournamentGroup, Match, TeamMatchResult } from '../../../shared/types/types';
import { CheckCircle2, Camera, Shield } from 'lucide-react';
import Modal from '../../../shared/components/Modal';
import { useNotification } from '../../../shared/context/NotificationContext';
import { doc, updateDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db, auth } from '../../../shared/config/firebase';

interface ResultUploaderProps {
    isOpen: boolean;
    onClose: () => void;
    tournament: Tournament;
    group: TournamentGroup;
    match: Match;
    onSuccess: () => void;
}

const ResultUploader: React.FC<ResultUploaderProps> = ({ isOpen, onClose, tournament, group, match, onSuccess }) => {
    const { showToast } = useNotification();
    const [loading, setLoading] = useState(false);
    const [screenshot, setScreenshot] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [results, setResults] = useState<TeamMatchResult[]>(
        group.teams.map(t => ({
            teamId: t.id,
            teamName: t.name,
            kills: 0,
            placement: 1,
            totalPoints: 0
        }))
    );

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setScreenshot(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleUpdateResult = (teamId: string, field: 'kills' | 'placement', value: number) => {
        setResults(prev => prev.map(r => {
            if (r.teamId === teamId) {
                const updated = { ...r, [field]: value };
                // Calculate points if point system exists
                if (tournament.pointSystem) {
                    const killPoints = updated.kills * tournament.pointSystem.pointsPerKill;
                    const placementPoints = tournament.pointSystem.placementPoints?.find(p => p.rank === updated.placement)?.points || 0;
                    updated.totalPoints = killPoints + placementPoints;
                }
                return updated;
            }
            return r;
        }));
    };

    const handleSubmit = async () => {
        if (!screenshot && !window.confirm("Continue without screenshot proof?")) {
            return;
        }

        setLoading(true);
        try {
            // Upload screenshot proof file via api/process-image (which uses ImgBB)
            let screenshotUrl = '';
            if (screenshot) {
                try {
                    const base64Data = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.readAsDataURL(screenshot);
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = error => reject(error);
                    });
                    
                    const currentUser = auth.currentUser;
                    if (!currentUser) {
                        console.error('No authenticated user for screenshot upload');
                        return;
                    }
                    const token = await currentUser.getIdToken();
                    const response = await fetch('/api/process-image', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            base64: base64Data,
                            folder: `matches/${match.id}`
                        })
                    });
                    
                    if (response.ok) {
                        const json = await response.json();
                        screenshotUrl = json.url;
                    } else {
                        console.error("Failed to upload screenshot to server API");
                    }
                } catch (err) {
                    console.error("Error processing screenshot file upload:", err);
                }
            }

            // 2. Submit the result directly to Firestore
            const tournamentRef = doc(db, 'tournaments', tournament.id);
            
            // Check if we are updating a group in the main tournament doc or a subcollection
            // Based on TournamentAdminPanel, it's currently in the main doc's 'groups' array.
            const updatedGroups = tournament.groups?.map(g => {
                if (g.id === group.id) {
                    return {
                        ...g,
                        matches: g.matches.map(m => {
                            if (m.id === match.id) {
                                return {
                                    ...m,
                                    status: 'completed' as const,
                                    results: results,
                                    screenshotUrl
                                };
                            }
                            return m;
                        })
                    };
                }
                return g;
            }) || [];

            await updateDoc(tournamentRef, {
                groups: updatedGroups
            });

            // 3. Update participant totals/stats if needed
            const batch = writeBatch(db);
            for (const res of results) {
                // Find participant doc
                const q = query(collection(db, 'participants'), 
                    where('tournamentId', '==', tournament.id),
                    where('userId', '==', res.teamId) // Assuming teamId is userId for solo or primary lead
                );
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const pDoc = snap.docs[0];
                    const pData = pDoc.data();
                    batch.update(pDoc.ref, {
                        totalKills: (pData.totalKills || 0) + res.kills,
                        totalPoints: (pData.totalPoints || 0) + res.totalPoints,
                        matchesPlayed: (pData.matchesPlayed || 0) + 1
                    });
                }
            }
            await batch.commit();

            showToast("Match results uploaded and points calculated!", "success");
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error(error);
            showToast(error.message || "Failed to upload results", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Upload Match Result - ${group.name}`}>
            <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1 custom-scrollbar">
                {/* Screenshot Upload */}
                <div className="space-y-4">
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">Match Screenshot (Proof)</label>
                    <div 
                        onClick={() => document.getElementById('result-screenshot')?.click()}
                        className="relative h-48 rounded-3xl border-2 border-dashed border-gray-800 hover:border-brand-500 transition-all cursor-pointer overflow-hidden flex flex-col items-center justify-center bg-dark group"
                    >
                        {previewUrl ? (
                            <>
                                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                                    <Camera className="w-8 h-8 text-white" />
                                </div>
                            </>
                        ) : (
                            <>
                                <Camera className="w-10 h-10 text-gray-700 mb-2 group-hover:text-brand-500 transition-colors" />
                                <p className="text-gray-500 text-xs font-bold">CLICK TO UPLOAD PROOF</p>
                            </>
                        )}
                        <input id="result-screenshot" type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                    </div>
                </div>

                {/* Team Results Table */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest tracking-widest">Team Performance</label>
                        <div className="flex items-center gap-2 text-[10px] text-brand-400 font-bold">
                            <Shield className="w-3 h-3" /> Auto-Calculation Active
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        {results.map((res) => (
                            <div key={res.teamId} className="bg-dark p-4 rounded-2xl border border-gray-800 flex items-center gap-4">
                                <div className="flex-1">
                                    <p className="text-sm font-black text-white truncate">{res.teamName}</p>
                                    <p className="text-[10px] text-gray-500 font-bold">Total Points: <span className="text-brand-500">{res.totalPoints}</span></p>
                                </div>
                                <div className="flex gap-3">
                                    <div className="w-20">
                                        <label className="block text-[8px] font-black text-gray-600 uppercase mb-1">Kills</label>
                                        <input 
                                            type="number" 
                                            value={res.kills}
                                            onChange={(e) => handleUpdateResult(res.teamId, 'kills', parseInt(e.target.value) || 0)}
                                            className="w-full bg-surface border border-gray-800 text-white rounded-lg p-2 text-sm font-bold focus:border-brand-500 outline-none"
                                        />
                                    </div>
                                    <div className="w-20">
                                        <label className="block text-[8px] font-black text-gray-600 uppercase mb-1">Rank</label>
                                        <input 
                                            type="number" 
                                            value={res.placement}
                                            min="1"
                                            onChange={(e) => handleUpdateResult(res.teamId, 'placement', parseInt(e.target.value) || 1)}
                                            className="w-full bg-surface border border-gray-800 text-white rounded-lg p-2 text-sm font-bold focus:border-brand-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="pt-4 sticky bottom-0 bg-surface">
                    <button 
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-brand-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <CheckCircle2 className="w-5 h-5" />
                        )}
                        Submit Result
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ResultUploader;
