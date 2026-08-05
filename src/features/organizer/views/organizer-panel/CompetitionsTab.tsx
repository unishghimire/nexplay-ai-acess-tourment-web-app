import React from 'react';
import TournamentManagement from '../../../tournaments/components/TournamentManagement';
import { Tournament } from '../../../../shared/types/types';

interface CompetitionsTabProps {
    hostedTournaments: Tournament[];
    onRefresh: () => void;
    onDelete: (t: Tournament) => void;
}

export const CompetitionsTab: React.FC<CompetitionsTabProps> = ({
    hostedTournaments,
    onRefresh,
    onDelete
}) => {
    return (
        <TournamentManagement 
            hostedTournaments={hostedTournaments}
            onRefresh={onRefresh} 
            onDelete={onDelete} 
            defaultMatchType="tournament"
        />
    );
};

export default CompetitionsTab;
