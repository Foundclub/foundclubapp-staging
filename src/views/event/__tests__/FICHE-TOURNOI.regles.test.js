/* eslint-disable max-len -- titres de témoins en phrases */
import {
  getTournamentNameAndShortDate,
  isTournamentRegistrationOpen,
} from '../tournamentJoinRules';
import { getTournamentTeamsTabLine } from '../tournamentTeamsCount';

// FICHE-TOURNOI (19/11/2026, liste de travail d'Adel, pages 6 et 8) — les règles partagées par la
// carte des listes, la fiche du téléphone, le site et l'aperçu d'une équipe.

jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

const TOURNOI = (/** @type {any} */ autres = {}) => ({
  date: '2099-12-19T18:00:00.000Z',
  name: 'FoundClub x AR Soccer',
  tournamentConfig: { competitionState: 'draft', maxTeams: 24 },
  type: { name: 'Tournoi' },
  ...autres,
});

describe('FICHE-TOURNOI · 6a — « Inscriptions ouvertes »', () => {
  test('🔴 ouvertes : ni fermées, ni clôturé, ni publié', () => {
    expect(isTournamentRegistrationOpen(TOURNOI())).toBe(true);
    expect(isTournamentRegistrationOpen(TOURNOI({ tournamentConfig: { registrationsClosed: true } }))).toBe(false);
    expect(isTournamentRegistrationOpen(TOURNOI({ tournamentConfig: { competitionState: 'published' } }))).toBe(false);
    expect(isTournamentRegistrationOpen(TOURNOI({ tournamentConfig: { closedAt: '2099-12-20T10:00:00.000Z' } }))).toBe(false);
    expect(isTournamentRegistrationOpen(null)).toBe(false);
  });
});

describe('FICHE-TOURNOI · 8b — la tête de l onglet Équipes', () => {
  test('🔴 au seuil des 30 % : « 9 équipes inscrites · 15 places libres »', () => {
    expect(getTournamentTeamsTabLine(TOURNOI({ tournamentTeamsSummary: { expectedCount: 24, registeredCount: 9 } })))
      .toBe('9 équipes inscrites · 15 places libres');
  });

  test('🔴 singulier et complet : « 1 place libre », « 0 place libre »', () => {
    expect(getTournamentTeamsTabLine(TOURNOI({ tournamentTeamsSummary: { expectedCount: 24, registeredCount: 23 } })))
      .toBe('23 équipes inscrites · 1 place libre');
    expect(getTournamentTeamsTabLine(TOURNOI({ tournamentTeamsSummary: { expectedCount: 24, registeredCount: 24 } })))
      .toBe('24 équipes inscrites · 0 place libre');
  });

  test('sous le seuil (« 4- A ») ou sans capacité : rien, la ligne d avant reste', () => {
    expect(getTournamentTeamsTabLine(TOURNOI({ tournamentTeamsSummary: { expectedCount: 24, registeredCount: 7 } }))).toBeNull();
    expect(getTournamentTeamsTabLine(TOURNOI({ tournamentConfig: {}, tournamentTeams: [{ status: 'accepted' }] }))).toBeNull();
  });

  test('sans résumé (connecté), le même compte que le serveur : en attente + validées', () => {
    const equipes = Array.from({ length: 8 }, (_, i) => ({ status: i % 2 ? 'pending' : 'accepted' }))
      .concat([{ status: 'declined' }, { archivedAt: '2099-01-01', status: 'accepted' }]);
    expect(getTournamentTeamsTabLine(TOURNOI({ tournamentTeams: equipes }))).toBe('8 équipes inscrites · 16 places libres');
  });
});

describe('FICHE-TOURNOI · 8e — « nom du tournoi · date courte » (règle d Adel D276)', () => {
  test('🔴 « FoundClub x AR Soccer · sam. 19 déc. »', () => {
    expect(getTournamentNameAndShortDate(TOURNOI())).toBe('FoundClub x AR Soccer · sam. 19 déc.');
  });

  test('sans date lisible : le nom seul ; sans rien : vide', () => {
    expect(getTournamentNameAndShortDate(TOURNOI({ date: 'pas une date' }))).toBe('FoundClub x AR Soccer');
    expect(getTournamentNameAndShortDate(null)).toBe('');
  });
});
