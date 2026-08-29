import { query, withTransaction } from '../index.js';

export interface DbRound {
  id: string;
  tournament_id: string;
  round_number: number;
  stage_name: string;
  qualification_rule: number;
  teams_per_group: number;
  matches_per_group: number;
  status: string;
  created_at: Date;
}

export interface DbGroup {
  id: string;
  tournament_id: string;
  round_id: string;
  round_number: number;
  name: string;
  team_limit: number;
  status: string;
  created_at: Date;
}

export interface DbGroupMember {
  id: string;
  group_id: string;
  team_id: string;
  team_name: string;
  logo_url?: string | null;
  created_at: Date;
}

export interface DbMatch {
  id: string;
  tournament_id: string;
  group_id?: string | null;
  round_number: number;
  match_number: number;
  map?: string | null;
  status: 'scheduled' | 'live' | 'completed';
  team1_id?: string | null;
  team2_id?: string | null;
  score1: number;
  score2: number;
  results: any[];
  created_at: Date;
}

export const GroupRepository = {
  /**
   * Dynamically generate groups with strict <= 12 teams per group limit.
   */
  async generateRoundGroups(
    tournamentId: string,
    roundNumber: number,
    stageName: string,
    teams: Array<{ teamId: string; teamName: string; logoUrl?: string }>,
    teamsPerGroupLimit = 12,
    qualificationRule = 2
  ): Promise<{ round: DbRound; groups: Array<DbGroup & { members: DbGroupMember[] }> }> {
    if (teams.length === 0) {
      throw new Error('Cannot generate groups for zero teams');
    }

    const maxCap = Math.min(Math.max(teamsPerGroupLimit, 2), 12);
    const numGroups = Math.max(1, Math.ceil(teams.length / maxCap));

    return withTransaction(async (client) => {
      // 1. Create or retrieve round
      const roundId = `round_${tournamentId}_r${roundNumber}`;
      const roundRes = await client.query<DbRound>(
        `INSERT INTO rounds (id, tournament_id, round_number, stage_name, qualification_rule, teams_per_group, matches_per_group, status)
         VALUES ($1, $2, $3, $4, $5, $6, 3, 'active')
         ON CONFLICT (tournament_id, round_number) DO UPDATE SET
           stage_name = EXCLUDED.stage_name,
           status = 'active'
         RETURNING *;`,
        [roundId, tournamentId, roundNumber, stageName, qualificationRule, maxCap]
      );
      const round = roundRes.rows[0];

      // 2. Distribute teams evenly (Fisher-Yates shuffle)
      const shuffled = [...teams];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const groupBuckets: Array<Array<{ teamId: string; teamName: string; logoUrl?: string }>> = Array.from(
        { length: numGroups },
        () => []
      );
      shuffled.forEach((team, idx) => {
        groupBuckets[idx % numGroups].push(team);
      });

      // 3. Insert groups and members
      const createdGroups: Array<DbGroup & { members: DbGroupMember[] }> = [];

      for (let gIdx = 0; gIdx < numGroups; gIdx++) {
        const groupLetter = String.fromCharCode(65 + gIdx);
        const groupName = `Group ${groupLetter}`;
        const groupId = `grp_${tournamentId}_r${roundNumber}_${groupLetter}`;

        const groupRes = await client.query<DbGroup>(
          `INSERT INTO groups (id, tournament_id, round_id, round_number, name, team_limit, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'upcoming')
           RETURNING *;`,
          [groupId, tournamentId, round.id, roundNumber, groupName, maxCap]
        );
        const group = groupRes.rows[0];

        const members: DbGroupMember[] = [];
        for (const member of groupBuckets[gIdx]) {
          const memberId = `gm_${groupId}_${member.teamId}`;
          const memberRes = await client.query<DbGroupMember>(
            `INSERT INTO group_members (id, group_id, team_id, team_name, logo_url)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (group_id, team_id) DO UPDATE SET team_name = EXCLUDED.team_name
             RETURNING *;`,
            [memberId, group.id, member.teamId, member.teamName, member.logoUrl || null]
          );
          members.push(memberRes.rows[0]);
        }

        createdGroups.push({ ...group, members });
      }

      return { round, groups: createdGroups };
    });
  },

  /**
   * Record Battle Royale results with backend placement and kill point calculation.
   */
  async recordBattleRoyaleMatchResult(
    matchId: string,
    results: Array<{
      teamId: string;
      teamName: string;
      placement: number;
      kills: number;
      placementPoints: number;
      killPoints: number;
    }>
  ): Promise<DbMatch> {
    // Validate results array
    const validated = results.map((r) => {
      const p = Math.max(1, Number(r.placement || 1));
      const k = Math.max(0, Number(r.kills || 0));
      const pp = Number(r.placementPoints ?? (p === 1 ? 15 : p === 2 ? 12 : p === 3 ? 10 : p <= 5 ? 6 : p <= 10 ? 2 : 0));
      const kp = Number(r.killPoints ?? k);
      return {
        teamId: r.teamId,
        teamName: r.teamName,
        placement: p,
        kills: k,
        placementPoints: pp,
        killPoints: kp,
        totalPoints: pp + kp,
      };
    });

    // Sort by total points DESC, tie-broken by placement points DESC
    validated.sort((a, b) => b.totalPoints - a.totalPoints || b.placementPoints - a.placementPoints);

    const res = await query<DbMatch>(
      `UPDATE matches SET
        results = $1::jsonb,
        status = 'completed'
       WHERE id = $2
       RETURNING *;`,
      [JSON.stringify(validated), matchId]
    );

    if (res.rows.length === 0) throw new Error('Match not found');
    return res.rows[0];
  },

  /**
   * Finalize Round and Advance Top Teams across Groups into Next Round.
   */
  async advanceStage(
    tournamentId: string,
    currentRoundNumber: number,
    nextStageName: string,
    qualificationPerGroup = 2
  ): Promise<{ nextRound: DbRound; qualifiedCount: number }> {
    return withTransaction(async (client) => {
      // 1. Fetch current round groups
      const groupsRes = await client.query<DbGroup>(
        'SELECT * FROM groups WHERE tournament_id = $1 AND round_number = $2 ORDER BY name ASC',
        [tournamentId, currentRoundNumber]
      );
      if (groupsRes.rows.length === 0) throw new Error('No groups found for current round');

      // 2. Fetch matches and aggregate standings for each group
      const qualifiedTeams: Array<{ teamId: string; teamName: string; logoUrl?: string }> = [];

      for (const grp of groupsRes.rows) {
        const matchesRes = await client.query<DbMatch>(
          'SELECT * FROM matches WHERE group_id = $1 AND status = \'completed\'',
          [grp.id]
        );

        // Aggregate points per team
        const standingsMap = new Map<string, { teamId: string; teamName: string; totalPoints: number; placementPoints: number }>();

        for (const match of matchesRes.rows) {
          const matchResults = Array.isArray(match.results) ? match.results : [];
          for (const item of matchResults) {
            const cur = standingsMap.get(item.teamId) || {
              teamId: item.teamId,
              teamName: item.teamName,
              totalPoints: 0,
              placementPoints: 0,
            };
            cur.totalPoints += Number(item.totalPoints || 0);
            cur.placementPoints += Number(item.placementPoints || 0);
            standingsMap.set(item.teamId, cur);
          }
        }

        const sortedStandings = Array.from(standingsMap.values()).sort(
          (a, b) => b.totalPoints - a.totalPoints || b.placementPoints - a.placementPoints
        );

        // Extract top N teams from this group
        const topTeams = sortedStandings.slice(0, qualificationPerGroup);
        topTeams.forEach((t) => qualifiedTeams.push({ teamId: t.teamId, teamName: t.teamName }));
      }

      if (qualifiedTeams.length === 0) {
        throw new Error('No qualified teams could be determined from completed matches');
      }

      // 3. Generate Next Round
      const nextRoundNumber = currentRoundNumber + 1;
      const { round: nextRound } = await GroupRepository.generateRoundGroups(
        tournamentId,
        nextRoundNumber,
        nextStageName,
        qualifiedTeams,
        12,
        qualificationPerGroup
      );

      // 4. Update tournament current_round & stage
      await client.query(
        `UPDATE tournaments SET
          current_round = $1,
          stage = 'knockout',
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [nextRoundNumber, tournamentId]
      );

      return { nextRound, qualifiedCount: qualifiedTeams.length };
    });
  },
};
