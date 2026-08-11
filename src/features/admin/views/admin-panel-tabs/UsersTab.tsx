import React, { useState } from 'react';
import {Users, Search, Trash, Edit, CheckCircle} from 'lucide-react';

import { AdminPanelTabProps } from './types';

export const UsersTab: React.FC<AdminPanelTabProps> = (props) => {
    const { formatCurrency, handleSuspendOrg, handleUpdateUserRole, searchQuery, setSearchQuery, users, setSelectedUser } = props;
    const [processingId, setProcessingId] = useState<string | null>(null);
    return (
                <div className="bg-card p-6 rounded-xl border border-gray-800 space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-700 pb-4">
                        <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                            <Users className="text-brand-500" /> Manage Users
                        </h2>
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                            <input 
                                type="text"
                                placeholder="Search users..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-dark border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:border-brand-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                        <table className="w-full text-left border-collapse min-w-[600px] sm:min-w-0">
                            <thead>
                                <tr className="text-[10px] text-gray-500 uppercase font-black tracking-widest border-b border-gray-800">
                                    <th className="px-4 py-4">User</th>
                                    <th className="px-4 py-4">Role</th>
                                    <th className="px-4 py-4">Balance</th>
                                    <th className="px-4 py-4">Status</th>
                                    <th className="px-4 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/50">
                                {users
                                    .filter(u => 
                                        u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                        u.email.toLowerCase().includes(searchQuery.toLowerCase())
                                    )
                                    .map(u => (
                                    <tr key={u.uid} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-brand-600/20 rounded-lg flex items-center justify-center border border-brand-500/30">
                                                    <Users className="text-brand-500 w-4 h-4" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-white">{u.username}</div>
                                                    <div className="text-[10px] text-gray-500">{u.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <select 
                                                value={u.role}
                                                onChange={(e) => handleUpdateUserRole(u.uid, e.target.value as any)}
                                                className="bg-dark border border-gray-700 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-brand-500"
                                            >
                                                <option value="player">Player</option>
                                                <option value="organizer">Organizer</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="text-sm font-mono font-bold text-white">{formatCurrency(u.balance)}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${u.isBanned ? 'bg-red-600/20 text-red-400' : 'bg-green-600/20 text-green-400'}`}>
                                                {u.isBanned ? 'Banned' : 'Active'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    onClick={() => setSelectedUser(u)}
                                                    className="p-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600 hover:text-white rounded-lg transition-all"
                                                    title="Manage Balance & Role"
                                                >
                                                    <Edit className="w-3.5 h-3.5" />
                                                </button>
                                                <button 
                                                    onClick={() => handleSuspendOrg(u.uid, !u.isBanned)}
                                                    className={`p-1.5 rounded-lg border transition-all ${
                                                        u.isBanned 
                                                            ? 'bg-green-600/20 text-green-400 border-green-500/30 hover:bg-green-600 hover:text-white' 
                                                            : 'bg-red-600/20 text-red-400 border-red-500/30 hover:bg-red-600 hover:text-white'
                                                    }`}
                                                >
                                                    {u.isBanned ? <CheckCircle className="w-3.5 h-3.5" /> : <Trash className="w-3.5 h-3.5" />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
    );
};
