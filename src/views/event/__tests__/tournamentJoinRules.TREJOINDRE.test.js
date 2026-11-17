import {
  canAskToJoinTournamentTeam,
  getTournamentTeamPlayersLine,
  getTournamentTeamsSeekingPlayers,
  getTournamentVisitorTeamsLine,
  TOURNAMENT_VISITOR_TEAMS_THRESHOLD_PERCENT,
} from '../tournamentJoinRules';

// ==========================================================================
// T-REJOINDRE (17/11/2026, décisions de Clément, registre D210) — LES RÈGLES, SEULES.
//   D50 : qui voit « Rejoindre une équipe », et quelles équipes la liste propose ;
//   D49 : ce que le visiteur sans compte lit des équipes, avec le seuil des 30 %.
// ==========================================================================

// La doublure rend le français de l'app (fr.js, sinon le repli, jetons, pluriel).
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

const TOURNOI = {
  date: '2026-12-19T17:15:00.000Z',
  tournamentConfig: {
    entryFeeCents: 2000, maxRosterSize: 5, maxTeams: 24, minAge: 16,
  },
  type: { name: 'Tournoi' },
};

const equipe = (/** @type {any} */ extra = {}) => ({
  captainUser: { documentId: 'u-cap' },
  documentId: 'eq-1',
  isOpenToJoinRequests: true,
  members: [],
  name: 'Les Seuls',
  sourceType: 'custom_team',
  status: 'pending',
  ...extra,
});
const membres = (/** @type {number} */ n) => Array.from({ length: n }, (_v, index) => ({
  documentId: `m-${index}`, responseStatus: 'pending', user: { documentId: `u-${index}` },
}));

describe('T-REJOINDRE — les équipes qui cherchent un joueur (D50)', () => {
  it('garde les équipes ouvertes aux demandes ET pas complètes, écarte les autres', () => {
    const liste = getTournamentTeamsSeekingPlayers([
      equipe({ documentId: 'ouverte-3', members: membres(3) }),
      equipe({ documentId: 'pleine', members: membres(5) }),
      equipe({ documentId: 'fermee', isOpenToJoinRequests: false, members: membres(2) }),
      equipe({ documentId: 'club', members: membres(2), sourceType: 'club_team' }),
      equipe({ documentId: 'refusee', members: membres(2), status: 'declined' }),
    ], TOURNOI.tournamentConfig);

    expect(liste.map(({ team }) => team.documentId)).toEqual(['ouverte-3']);
    expect(getTournamentTeamPlayersLine(liste[0])).toBe('3 joueurs sur 5');
  });

  it('lit le résumé du serveur (T-JOUEURS) quand les membres ne sont pas rendus', () => {
    const [pasPleine] = getTournamentTeamsSeekingPlayers(
      [equipe({ membersSummary: { count: 1 } })],
      TOURNOI.tournamentConfig,
    );
    expect(getTournamentTeamPlayersLine(pasPleine)).toBe('1 joueur sur 5');
    expect(getTournamentTeamsSeekingPlayers(
      [equipe({ membersSummary: { count: 5 } })],
      TOURNOI.tournamentConfig,
    )).toEqual([]);
  });

  it("n'écrit pas « 0 joueur » quand le nombre n'est pas connu : l'équipe reste proposée, sans nombre", () => {
    const [inconnue] = getTournamentTeamsSeekingPlayers([equipe()], TOURNOI.tournamentConfig);
    expect(inconnue.playerCount).toBeNull();
    expect(getTournamentTeamPlayersLine(inconnue)).toBeNull();
  });

  it('sans effectif maximum : « 3 joueurs », et aucune équipe écartée pour sa taille', () => {
    const [libre] = getTournamentTeamsSeekingPlayers([equipe({ members: membres(3) })], {});
    expect(getTournamentTeamPlayersLine(libre)).toBe('3 joueurs');
  });
});

describe('T-REJOINDRE — qui voit « Rejoindre une équipe » (D50)', () => {
  const adulte = { birthdate: '2000-01-01', documentId: 'u-seul' };
  const voit = (/** @type {any} */ params = {}) => canAskToJoinTournamentTeam({
    accountRoleKey: 'player', event: TOURNOI, teams: [equipe()], user: adulte, ...params,
  });

  it('un compte connecté, sans équipe dans ce tournoi, le voit', () => {
    expect(voit()).toBe(true);
  });

  it('pas le visiteur sans compte, ni un compte Parent', () => {
    expect(voit({ user: null })).toBe(false);
    expect(voit({ accountRoleKey: 'parent' })).toBe(false);
  });

  it("pas le joueur plus jeune que l'âge minimum (15 ans le jour du tournoi) ; 16 ans le voit", () => {
    expect(voit({ user: { birthdate: '2011-06-01', documentId: 'u-15' } })).toBe(false);
    expect(voit({ user: { birthdate: '2010-06-01', documentId: 'u-16' } })).toBe(true);
  });

  it('pas celui qui a déjà une équipe, une invitation ou une demande dans ce tournoi', () => {
    const avec = (/** @type {string} */ responseStatus) => [equipe({
      members: [{ documentId: 'm-1', responseStatus, user: { documentId: 'u-seul' } }],
    })];
    expect(voit({ teams: avec('pending') })).toBe(false);
    expect(voit({ teams: avec('invited') })).toBe(false);
    expect(voit({ teams: avec('requested') })).toBe(false);
    expect(voit({ teams: [equipe({ captainUser: { documentId: 'u-seul' } })] })).toBe(false);
    expect(voit({ teams: avec('declined') })).toBe(true);
  });

  it('membres non rendus par le serveur : la marque `viewerMembership` (T-PARCOURS-2) suffit à le reconnaître', () => {
    const marque = (/** @type {string} */ responseStatus) => [equipe({ viewerMembership: { responseStatus } })];
    expect(voit({ teams: marque('pending') })).toBe(false);
    expect(voit({ teams: marque('requested') })).toBe(false);
    expect(voit({ teams: marque('invited') })).toBe(false);
    expect(voit({ teams: marque('declined') })).toBe(true);
  });

  it("pas sur un tournoi clôturé, ni sur un événement qui n'est pas un tournoi", () => {
    expect(voit({
      event: { ...TOURNOI, tournamentConfig: { ...TOURNOI.tournamentConfig, closedAt: '2026-12-20T00:00:00.000Z' } },
    })).toBe(false);
    expect(voit({ event: { ...TOURNOI, type: { name: 'Match' } } })).toBe(false);
  });
});

describe('T-REJOINDRE — le visiteur sans compte et le seuil des 30 % (D49)', () => {
  const fiche = (/** @type {any} */ tournamentTeamsSummary, /** @type {any} */ config = {}) => ({
    tournamentConfig: config, tournamentTeamsSummary,
  });

  it('le seuil est une constante nommée : 30 %', () => {
    expect(TOURNAMENT_VISITOR_TEAMS_THRESHOLD_PERCENT).toBe(30);
  });

  it('24 attendues : sous 8 inscrites, seulement « 24 équipes attendues »', () => {
    expect(getTournamentVisitorTeamsLine(fiche({ expectedCount: 24, registeredCount: 5 })))
      .toBe('24 équipes attendues');
    expect(getTournamentVisitorTeamsLine(fiche({ expectedCount: 24, registeredCount: 7 })))
      .toBe('24 équipes attendues');
    expect(getTournamentVisitorTeamsLine(fiche({ expectedCount: 24, registeredCount: 0 })))
      .toBe('24 équipes attendues');
  });

  it('24 attendues : à partir de 8 inscrites, « N équipes inscrites sur 24 »', () => {
    expect(getTournamentVisitorTeamsLine(fiche({ expectedCount: 24, registeredCount: 8 })))
      .toBe('8 équipes inscrites sur 24');
    expect(getTournamentVisitorTeamsLine(fiche({ expectedCount: 24, registeredCount: 24 })))
      .toBe('24 équipes inscrites sur 24');
  });

  it('10 attendues : le seuil est 3, pas 4 (30 % de 10 calculé en entiers)', () => {
    expect(getTournamentVisitorTeamsLine(fiche({ expectedCount: 10, registeredCount: 3 })))
      .toBe('3 équipes inscrites sur 10');
    expect(getTournamentVisitorTeamsLine(fiche({ expectedCount: 10, registeredCount: 2 })))
      .toBe('10 équipes attendues');
  });

  it('sans capacité : rien, jamais « 0 équipe »', () => {
    expect(getTournamentVisitorTeamsLine(fiche({ expectedCount: null, registeredCount: 5 }))).toBeNull();
    expect(getTournamentVisitorTeamsLine(fiche(undefined))).toBeNull();
    expect(getTournamentVisitorTeamsLine(null)).toBeNull();
  });

  it('serveur ancien (pas de résumé) mais capacité publique connue : « 24 équipes attendues »', () => {
    expect(getTournamentVisitorTeamsLine(fiche(undefined, { maxTeams: 24 })))
      .toBe('24 équipes attendues');
  });

  it('le singulier : « 1 équipe inscrite sur 2 »', () => {
    expect(getTournamentVisitorTeamsLine(fiche({ expectedCount: 2, registeredCount: 1 })))
      .toBe('1 équipe inscrite sur 2');
  });
});
