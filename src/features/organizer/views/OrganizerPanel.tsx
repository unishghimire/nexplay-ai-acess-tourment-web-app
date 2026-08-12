import React, { useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/context/AuthContext';
import { useNotification } from '../../../shared/context/NotificationContext';
import DashboardLayout from '../../../shared/components/layouts/DashboardLayout';
import TournamentCreateModal from '../../tournaments/components/TournamentCreateModal';
import {
  LayoutDashboard, Trophy, Gamepad2, Radio, Users,
  Wallet, Settings as SettingsIcon, Menu, X,
} from 'lucide-react';
import { useOrgData } from '../hooks/useOrgData';
import { OrgOverlayManager, OverlayType } from '../components/OrgOverlayManager';
import { Seo } from '../../../shared/components/Seo';

// Lazy-load tab components
const OverviewTab = React.lazy(() => import('../components/OverviewTab'));
const TournamentsTab = React.lazy(() => import('../components/TournamentsTab'));
const ScrimsHubTab = React.lazy(() => import('../components/ScrimsHubTab'));
const MatchRoomsTab = React.lazy(() => import('../components/MatchRoomsTab'));
const TeamsRostersTab = React.lazy(() => import('../components/TeamsRostersTab'));
const WalletPayoutsTab = React.lazy(() => import('../components/WalletPayoutsTab'));
const SettingsStreamTab = React.lazy(() => import('../components/SettingsStreamTab'));

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'tournaments', label: 'Tournaments', icon: Trophy },
  { id: 'scrims', label: 'Scrims Hub', icon: Gamepad2 },
  { id: 'rooms', label: 'Match Rooms', icon: Radio },
  { id: 'teams', label: 'Teams & Rosters', icon: Users },
  { id: 'wallet', label: 'Wallet & Payouts', icon: Wallet },
  { id: 'settings', label: 'Settings & Stream', icon: SettingsIcon },
] as const;

type TabId = typeof NAV_ITEMS[number]['id'];

const OrganizerPanel: React.FC = () => {
  const { profile } = useAuth();
  const { showToast } = useNotification();
  const location = useLocation();
  const navigate = useNavigate();

  const org = useOrgData();
  const activeTab = (new URLSearchParams(location.search).get('tab') || 'overview') as TabId;

  // Mobile sidebar drawer
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Overlay state
  const [activeOverlay, setActiveOverlay] = useState<OverlayType>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [warningTeam, setWarningTeam] = useState<string | null>(null);
  const [warningReason, setWarningReason] = useState('');
  const [roomDispatchTarget, setRoomDispatchTarget] = useState<any>(null);
  const [scrimSlotTarget, setScrimSlotTarget] = useState<any>(null);
  const [disputeTarget, setDisputeTarget] = useState<string | null>(null);

  // Room dispatch form state
  const [roomId, setRoomId] = useState('');
  const [roomPass, setRoomPass] = useState('');
  const [streamUrl, setStreamUrl] = useState('');

  // Tournament create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTournament, setEditTournament] = useState<any>(null);

  // --- Handlers ---

  const handleTabChange = (tabId: TabId) => {
    navigate(`?tab=${tabId}`);
    setMobileNavOpen(false);
  };

  const handleDelete = useCallback((id: string, title: string) => {
    setDeleteTarget({ id, title });
    setActiveOverlay('DELETE_CONFIRM');
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await org.deleteTournament(deleteTarget.id);
      showToast('Tournament deleted', 'success');
    } catch {
      showToast('Failed to delete tournament', 'error');
    } finally {
      setActiveOverlay(null);
      setDeleteTarget(null);
    }
  }, [deleteTarget, org, showToast]);

  const handleUpdateStatus = useCallback(async (id: string, status: string) => {
    try {
      await org.updateTournamentStatus(id, status as any);
      showToast(`Tournament status: ${status.toUpperCase()}`, 'success');
    } catch {
      showToast('Failed to update status', 'error');
    }
  }, [org, showToast]);

  const handleCreateTournament = useCallback(() => {
    setShowCreateModal(true);
  }, []);

  const handleManageTournament = useCallback((id: string) => {
    navigate(`/tournament-admin/${id}`);
  }, [navigate]);

  const handleEditTournament = useCallback((tournament: any) => {
    setEditTournament(tournament);
    setShowCreateModal(true);
  }, []);

  const handleViewScrimDetails = useCallback((scrimId: string) => {
    navigate(`/organizer/scrim/${scrimId}`);
  }, [navigate]);

  const handleOpenRoomDispatch = useCallback((target: any) => {
    setRoomDispatchTarget(target);
    setRoomId(target?.roomId || '');
    setRoomPass(target?.roomPass || '');
    setStreamUrl(target?.ytLink || target?.streamUrl || '');
    setActiveOverlay('ROOM_DISPATCH');
  }, []);

  const handleBroadcastRoom = useCallback(async () => {
    if (!roomDispatchTarget) return;
    try {
      await org.broadcastLobby(roomDispatchTarget.id || roomDispatchTarget.tournamentId, roomId, roomPass, streamUrl);
      showToast('Room credentials broadcasted to all players', 'success');
    } catch {
      showToast('Failed to broadcast room details', 'error');
    } finally {
      setActiveOverlay(null);
      setRoomDispatchTarget(null);
    }
  }, [roomDispatchTarget, roomId, roomPass, streamUrl, org, showToast]);

  const handleOpenSlotGrid = useCallback((scrim: any) => {
    setScrimSlotTarget(scrim);
    setActiveOverlay('SCRIM_SLOTS');
  }, []);

  const handleToggleSlot = useCallback((slotNumber: number) => {
    showToast(`Slot ${slotNumber} toggled`, 'info');
  }, [showToast]);

  const handleToggleRosterLock = useCallback((teamId: string) => {
    showToast(`Roster lock toggled for ${teamId}`, 'success');
  }, [showToast]);

  const handleIssueWarning = useCallback((teamName: string) => {
    setWarningTeam(teamName);
    setActiveOverlay('TEAM_WARNING');
  }, []);

  const confirmWarning = useCallback(() => {
    showToast(`Warning issued to ${warningTeam}`, 'success');
    setActiveOverlay(null);
    setWarningTeam(null);
    setWarningReason('');
  }, [warningTeam, showToast]);

  const handleBanTeam = useCallback((teamId: string, teamName: string) => {
    showToast(`${teamName} ban toggled`, 'success');
  }, [showToast]);

  const handleResolveDispute = useCallback((action: 'warn' | 'ban' | 'dismiss') => {
    showToast(`Dispute ${action === 'dismiss' ? 'dismissed' : `resolved — ${action} issued`}`, 'success');
    setActiveOverlay(null);
    setDisputeTarget(null);
  }, [showToast]);

  const handleRequestWithdraw = useCallback(async (amount: number, method: string, details: string) => {
    try {
      await org.requestWithdrawal(amount, method, details);
      showToast('Withdrawal request submitted', 'success');
    } catch {
      showToast('Failed to process withdrawal', 'error');
    }
  }, [org, showToast]);

  const handleSaveSettings = useCallback(async (settings: any) => {
    try {
      await org.saveOrgSettings(settings);
      showToast('Organization settings saved', 'success');
    } catch {
      showToast('Failed to save settings', 'error');
    }
  }, [org, showToast]);

  // Tab content renderer
  const renderTab = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab
          kpis={org.kpis}
          activityFeed={[]}
          hostedTournaments={org.hostedTournaments}
        />;
      case 'tournaments':
        return <TournamentsTab
          hostedTournaments={org.hostedTournaments}
          onDelete={handleDelete}
          onUpdateStatus={handleUpdateStatus}
          onCreateTournament={handleCreateTournament}
          onOpenRoomDispatch={handleOpenRoomDispatch}
          onManageTournament={handleManageTournament}
          onEditTournament={handleEditTournament}
        />;
      case 'scrims':
        return <ScrimsHubTab
          scrims={[]}
          onOpenSlotGrid={handleOpenSlotGrid}
          onToggleSlot={handleToggleSlot}
          onViewDetails={handleViewScrimDetails}
        />;
      case 'rooms':
        return <MatchRoomsTab
          matchRooms={[]}
          disputes={[]}
          onOpenRoomDispatch={handleOpenRoomDispatch}
          onResolveDispute={handleResolveDispute}
        />;
      case 'teams':
        return <TeamsRostersTab
          teams={[]}
          onToggleRosterLock={handleToggleRosterLock}
          onIssueWarning={handleIssueWarning}
          onBanTeam={handleBanTeam}
        />;
      case 'wallet':
        return <WalletPayoutsTab
          kpis={org.kpis}
          transactions={org.transactions}
          onRequestWithdraw={handleRequestWithdraw}
        />;
      case 'settings':
        return <SettingsStreamTab
          profile={profile}
          onSaveSettings={handleSaveSettings}
        />;
      default:
        return null;
    }
  };

  if (org.loading) {
    return (
      <DashboardLayout title="Loading...">
        <div className="flex flex-col items-center justify-center min-h-[40vh]">
          <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-xs text-gray-500 font-medium uppercase tracking-widest">Loading Organizer Panel...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Organizer Panel">
            <Seo title="Organizer Panel | NexPlay" description="Tournament organizer dashboard" noindex />
      {/* Mobile nav toggle */}
      <button
        onClick={() => setMobileNavOpen(!mobileNavOpen)}
        className="lg:hidden flex items-center justify-between bg-card p-4 rounded-2xl border border-gray-800 w-full mb-4"
      >
        <span className="font-bold text-white text-sm uppercase tracking-widest">Organizer Menu</span>
        {mobileNavOpen ? <X className="w-5 h-5 text-gray-400" /> : <Menu className="w-5 h-5 text-gray-400" />}
      </button>

      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
        {/* Sidebar Navigation */}
        <aside className={`w-full lg:w-60 flex-shrink-0 ${mobileNavOpen ? 'block' : 'hidden lg:block'}`}>
          <nav className="space-y-2 bg-card p-4 rounded-2xl border border-gray-800 h-fit lg:sticky lg:top-24">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-full text-xs font-black uppercase tracking-widest transition-all shrink-0 min-h-[44px] ${
                  activeTab === item.id
                    ? 'bg-brand-500 text-white shadow-xl shadow-brand-500/20'
                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                }`}
              >
                <item.icon className={`w-4 h-4 flex-shrink-0 ${activeTab === item.id ? 'text-white' : 'text-gray-500'}`} />
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 overflow-x-hidden">
          <React.Suspense
            fallback={<div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>}
          >
            {renderTab()}
          </React.Suspense>
        </main>
      </div>

      {/* Unified Overlay Manager */}
      <OrgOverlayManager
        activeOverlay={activeOverlay}
        onClose={() => { setActiveOverlay(null); setDeleteTarget(null); setWarningTeam(null); setRoomDispatchTarget(null); setScrimSlotTarget(null); setDisputeTarget(null); }}
        deleteTarget={deleteTarget?.title}
        onConfirmDelete={confirmDelete}
        teamName={warningTeam}
        warningReason={warningReason}
        setWarningReason={setWarningReason}
        onIssueWarning={confirmWarning}
        roomId={roomId}
        setRoomId={setRoomId}
        roomPass={roomPass}
        setRoomPass={setRoomPass}
        streamUrl={streamUrl}
        setStreamUrl={setStreamUrl}
        onBroadcastRoom={handleBroadcastRoom}
        disputeId={disputeTarget ?? undefined}
        onResolveDispute={handleResolveDispute}
        scrimTitle={scrimSlotTarget?.title}
        slotGrid={scrimSlotTarget?.slots}
        onToggleSlot={handleToggleSlot}
      />

      {/* Tournament Create Modal (reused from existing) */}
      {showCreateModal && (
        <TournamentCreateModal
          isOpen={showCreateModal}
          onClose={() => { setShowCreateModal(false); setEditTournament(null); }}
          onSuccess={() => { setShowCreateModal(false); setEditTournament(null); org.fetchHostedTournaments(); }}
          editTournament={editTournament}
        />
      )}
    </DashboardLayout>
  );
};

export default OrganizerPanel;
