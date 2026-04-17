import {
  formatTournamentScore,
  getTournamentCompetitionActions,
  getTournamentCompetitionStateLabel,
  getTournamentFormatLabel,
  getTournamentMatchStatusMeta,
  getTournamentMemberBuckets,
  getTournamentPendingMembershipForUser,
  getTournamentRosterSummary,
  getTournamentStatusCounters,
  isTournamentTeamNonCompliant,
} from './tournamentUtils';

describe('tournamentUtils', () => {
  const tournamentConfig = {
    maxRosterSize: 5,
    minRosterSize: 3,
  };

  const baseTeam = {
    members: [
      { documentId: 'm-1', responseStatus: 'present', user: { documentId: 'u-1' } },
      { documentId: 'm-2', responseStatus: 'pending', user: { documentId: 'u-2' } },
      { documentId: 'm-3', responseStatus: 'invited', user: { documentId: 'u-3' } },
      { documentId: 'm-4', responseStatus: 'requested', user: { documentId: 'u-4' } },
      { documentId: 'm-5', responseStatus: 'declined', user: { documentId: 'u-5' } },
    ],
    status: 'accepted',
  };

  test('separates roster actif, invitations and join requests', () => {
    const buckets = getTournamentMemberBuckets(baseTeam.members);

    expect(buckets.activeMembers.map((member) => member.documentId)).toEqual(['m-1', 'm-2']);
    expect(buckets.invitedMembers.map((member) => member.documentId)).toEqual(['m-3']);
    expect(buckets.requestedMembers.map((member) => member.documentId)).toEqual(['m-4']);
    expect(buckets.declinedMembers.map((member) => member.documentId)).toEqual(['m-5']);
  });

  test('builds roster summary from active members only', () => {
    const summary = getTournamentRosterSummary(baseTeam, tournamentConfig);

    expect(summary.totalCount).toBe(2);
    expect(summary.presentCount).toBe(1);
    expect(summary.pendingCount).toBe(1);
    expect(summary.invitedCount).toBe(1);
    expect(summary.requestedCount).toBe(1);
    expect(summary.meetsMinRoster).toBe(false);
    expect(summary.hasWarning).toBe(true);
  });

  test('ignores minimum roster constraint for permanent club teams', () => {
    const summary = getTournamentRosterSummary(
      { ...baseTeam, sourceType: 'club_team' },
      tournamentConfig,
    );

    expect(summary.totalCount).toBe(2);
    expect(summary.meetsMinRoster).toBe(true);
    expect(summary.hasWarning).toBe(false);
    expect(isTournamentTeamNonCompliant({ ...baseTeam, sourceType: 'club_team' }, tournamentConfig)).toBe(false);
  });

  test('flags only non-compliant teams in counters', () => {
    const teams = [
      baseTeam,
      {
        members: [
          { responseStatus: 'present', user: { documentId: 'u-10' } },
          { responseStatus: 'present', user: { documentId: 'u-11' } },
          { responseStatus: 'present', user: { documentId: 'u-12' } },
        ],
        status: 'pending',
      },
    ];

    expect(isTournamentTeamNonCompliant(baseTeam, tournamentConfig)).toBe(true);
    expect(getTournamentStatusCounters(teams, tournamentConfig)).toEqual({
      accepted: 1,
      archived: 0,
      declined: 0,
      pending: 1,
      warning: 1,
    });
  });

  test('finds the pending tournament membership for a user', () => {
    const teams = [
      {
        documentId: 'team-1',
        members: [{ responseStatus: 'requested', user: { documentId: 'u-4' } }],
      },
      {
        documentId: 'team-2',
        members: [{ responseStatus: 'present', user: { documentId: 'u-4' } }],
      },
    ];

    expect(getTournamentPendingMembershipForUser(teams, 'u-4')?.documentId).toBe('team-1');
    expect(getTournamentPendingMembershipForUser(teams, 'u-99')).toBeNull();
  });

  test('derives competition summary labels and actions', () => {
    const dashboard = {
      bracket: [],
      config: {
        competitionState: 'draft',
        formatMode: 'groups_to_knockout',
      },
      overview: {
        groups: 2,
        totalMatches: 6,
      },
    };

    expect(getTournamentFormatLabel('groups_to_knockout')).toBe('Poules + finale');
    expect(getTournamentCompetitionStateLabel('draft')).toBe('Competition en brouillon');
    expect(getTournamentCompetitionActions(dashboard)).toEqual({
      canDrawGroups: true,
      canGenerateKnockout: true,
      canGenerateMatches: true,
      canPublish: true,
      hasBracket: false,
      usesGroups: true,
      usesKnockout: true,
    });
  });

  test('formats match score and exposes status meta', () => {
    const colors = {
      error500: '#f44',
      neutral300: '#999',
      primary500: '#0af',
      success500: '#0f0',
      warning500: '#fa0',
    };

    expect(formatTournamentScore({ scoreA: 3, scoreB: 1 })).toBe('3 - 1');
    expect(formatTournamentScore({ scoreA: null, scoreB: 1 })).toBe('--');
    expect(getTournamentMatchStatusMeta('validated', colors)).toEqual({
      label: 'Valide',
      tone: '#0f0',
    });
  });
});
