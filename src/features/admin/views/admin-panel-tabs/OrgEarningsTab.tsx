import React from 'react';
import {DollarSign} from 'lucide-react';
import { doc, updateDoc, deleteDoc, collection, query, where, getDocs, setDoc, serverTimestamp, increment, getDoc, writeBatch, orderBy, limit, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../../shared/config/firebase';
import {  } from '../../../../shared/utils/utils';
import { } from '../../../../shared/components/ImageUploader';
import {} from '../../../../shared/services/mediaService';

import { AdminPanelTabProps } from './types';

export const OrgEarningsTab: React.FC<AdminPanelTabProps> = (props) => {
    const { formatCurrency, handleReleaseEarnings, tournamentEarnings } = props;
    return (
                <div className="bg-card p-6 rounded-xl border border-gray-800 space-y-6">
                    <div className="flex justify-between items-center border-b border-gray-700 pb-4">
                        <div className="flex items-center gap-4">
                            <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                                <DollarSign className="text-brand-500" /> Org Earnings
                            </h2>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-800 text-gray-400 text-sm uppercase tracking-wider">
                                    <th className="p-4 font-medium">Date</th>
                                    <th className="p-4 font-medium">Tournament</th>
                                    <th className="p-4 font-medium">Organizer</th>
                                    <th className="p-4 font-medium">Total Prize</th>
                                    <th className="p-4 font-medium">Org Share</th>
                                    <th className="p-4 font-medium">Status</th>
                                    <th className="p-4 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/50">
                                {tournamentEarnings.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-gray-500">
                                            No earnings records found.
                                        </td>
                                    </tr>
                                ) : (
                                    tournamentEarnings.map(earning => (
                                        <tr key={earning.id} className="hover:bg-gray-800/20 transition-colors">
                                            <td className="p-4 text-gray-300">
                                                {earning.createdAt?.toDate().toLocaleDateString() || 'N/A'}
                                            </td>
                                            <td className="p-4 text-white font-medium">
                                                {earning.tournamentName}
                                            </td>
                                            <td className="p-4 text-gray-300">
                                                {earning.orgName}
                                            </td>
                                            <td className="p-4 text-gray-300">
                                                {formatCurrency(earning.prizePoolTotal)}
                                            </td>
                                            <td className="p-4 text-brand-400 font-bold">
                                                {formatCurrency(earning.orgShare)}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                                    earning.status === 'released' ? 'bg-green-500/20 text-green-400' :
                                                    'bg-yellow-500/20 text-yellow-400'
                                                }`}>
                                                    {earning.status.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                {earning.status === 'pending' && (
                                                    <button
                                                        onClick={() => handleReleaseEarnings(earning)}
                                                        className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition"
                                                    >
                                                        Release
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
    );
};
