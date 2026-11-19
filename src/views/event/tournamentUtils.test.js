import {
  formatTournamentScore,
  getTournamentClosure,
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

// I18N-2 : ces libellés passent par i18next.t — la doublure rend le français de l app
// (fr.js, sinon le repli), sans initialiser i18next.
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

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

  // T-SUITES-TOURNOI (18/11, chef « 2- A ») : une équipe archivée (`archivedAt`, même
  // restée « pending ») ne compte plus dans « en attente » : même règle que
  // getTournamentRegisteredTeamsCount.
  test('🔴 T-SUITES : une équipe archivée (archivedAt) n est plus « en attente »', () => {
    const teams = [
      { members: [], status: 'accepted' },
      { members: [], status: 'pending' },
      { archivedAt: '2026-11-10T10:00:00.000Z', members: [], status: 'pending' },
      { archivedAt: '2026-11-10T10:00:00.000Z', members: [], status: 'accepted' },
      { members: [], status: 'declined' },
    ];
    expect(getTournamentStatusCounters(teams, {})).toEqual(expect.objectContaining({
      accepted: 1, archived: 2, declined: 1, pending: 1,
    }));
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
    expect(getTournamentCompetitionStateLabel('draft')).toBe('Compétition en brouillon');
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

  // T-LIGUE-2 (15/11) : publiee au tirage, la ligue doit encore pouvoir avoir sa phase finale.
  test('publiee sans tableau final : le bouton de la phase finale reste, une seule fois', () => {
    const publiee = (bracket) => getTournamentCompetitionActions({
      bracket,
      config: { competitionState: 'published', formatMode: 'groups_to_knockout' },
      overview: { groups: 1, totalMatches: 40 },
    });
    expect(publiee([]).canGenerateKnockout).toBe(true);
    expect(publiee([]).canDrawGroups).toBe(false);
    expect(publiee([]).canGenerateMatches).toBe(false);
    expect(publiee([]).canPublish).toBe(false);
    expect(publiee([{ matches: [] }]).canGenerateKnockout).toBe(false);
    expect(getTournamentCompetitionActions({
      bracket: [],
      config: { competitionState: 'published', formatMode: 'knockout_only' },
    }).canGenerateKnockout).toBe(false);
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
      label: 'Validé',
      tone: '#0f0',
    });
  });
});

// REPRISE-EVENEMENTS 131 — la règle de clôture lue par le pilotage et les deux fiches.
describe('getTournamentClosure', () => {
  test('clôturé : la date est celle de l’archivage le plus récent', () => {
    expect(getTournamentClosure({
      sessionStatus: 'closed',
      tournamentTeams: [
        { archivedAt: '2026-10-30T10:00:00.000Z', status: 'archived' },
        { archivedAt: '2026-10-31T10:00:00.000Z', status: 'archived' },
      ],
    })).toEqual({ closedAt: Date.parse('2026-10-31T10:00:00.000Z'), isClosed: true });
  });

  test('🐞 FIN-EVENEMENTS : un tournoi « Privé » neuf n’est pas clôturé', () => {
    expect(getTournamentClosure({ sessionStatus: 'closed', tournamentTeams: [] }))
      .toEqual({ closedAt: undefined, isClosed: false });
    expect(getTournamentClosure({
      sessionStatus: 'closed',
      tournamentTeams: [{ archivedAt: null, status: 'accepted' }],
    })).toEqual({ closedAt: undefined, isClosed: false });
  });

  test('ouvert, ou sans équipe archivée : ni clôture ni date', () => {
    expect(getTournamentClosure({ sessionStatus: 'open', tournamentTeams: [] }))
      .toEqual({ closedAt: undefined, isClosed: false });
    expect(getTournamentClosure(null)).toEqual({ closedAt: undefined, isClosed: false });
  });
});

// DEUX-EQUIPES (19/11/2026, recette 49, M1362 / M1363) — la règle partagée des équipes du lecteur.
describe('getViewerTournamentTeams (DEUX-EQUIPES)', () => {
  const { getViewerTournamentTeams } = jest.requireActual('./tournamentUtils');
  const REFUSEE = {
    captainUser: { documentId: 'u-979' }, documentId: 'eq-33', members: [], status: 'declined',
  };
  const OU_IL_JOUE = {
    documentId: 'eq-32', members: [], status: 'accepted', viewerMembership: { responseStatus: 'pending' },
  };
  const INVITE = {
    documentId: 'eq-32', members: [], status: 'accepted', viewerMembership: { responseStatus: 'invited' },
  };
  const ids = (/** @type {any} */ r) => ({
    declined: r.declinedTeam?.documentId || null,
    managed: r.managedTeam?.documentId || null,
    member: r.memberTeam?.documentId || null,
    pending: r.pendingTeam?.documentId || null,
  });

  test('refusée (capitaine) + active (joueur) : l active est son équipe, la refusée est signalée', () => {
    expect(ids(getViewerTournamentTeams([REFUSEE, OU_IL_JOUE], 'u-979'))).toEqual({
      declined: 'eq-33', managed: null, member: 'eq-32', pending: null,
    });
  });

  test('refusée (capitaine) + invitation : l invitation n est pas masquée', () => {
    expect(ids(getViewerTournamentTeams([REFUSEE, INVITE], 'u-979'))).toEqual({
      declined: 'eq-33', managed: null, member: null, pending: 'eq-32',
    });
  });

  test('refusée dont la liste des membres est rendue (capitaine membre actif) + active : même choix', () => {
    const refuseeAvecMembres = { ...REFUSEE, members: [{ responseStatus: 'pending', user: { documentId: 'u-979' } }] };
    expect(ids(getViewerTournamentTeams([refuseeAvecMembres, OU_IL_JOUE], 'u-979'))).toEqual({
      declined: 'eq-33', managed: null, member: 'eq-32', pending: null,
    });
  });

  test('seule la refusée : elle reste son équipe (comportement d avant), et signalée', () => {
    expect(ids(getViewerTournamentTeams([REFUSEE], 'u-979'))).toEqual({
      declined: 'eq-33', managed: 'eq-33', member: null, pending: null,
    });
  });

  test('archivée (capitaine) + active : l active passe, l archivée n est pas « refusée »', () => {
    const archivee = { ...REFUSEE, archivedAt: '2026-11-19T10:00:00.000Z', status: 'pending' };
    expect(ids(getViewerTournamentTeams([archivee, OU_IL_JOUE], 'u-979'))).toEqual({
      declined: null, managed: null, member: 'eq-32', pending: null,
    });
  });

  test('capitaine d une équipe active : inchangé ; tournoi clos : plus d équipe gérée ; sans compte : rien', () => {
    const active = { ...REFUSEE, status: 'pending' };
    expect(ids(getViewerTournamentTeams([active], 'u-979')).managed).toBe('eq-33');
    expect(ids(getViewerTournamentTeams([active], 'u-979', { managementClosed: true })).managed).toBeNull();
    expect(ids(getViewerTournamentTeams([active], ''))).toEqual({
      declined: null, managed: null, member: null, pending: null,
    });
  });
});
