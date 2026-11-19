/* eslint-disable max-len -- les témoins se lisent en entier. */
import {
  canAskToJoinTournamentTeam,
  hasTournamentTeamForUser,
} from '../tournamentJoinRules';
import { blocksAnotherTournamentTeam } from '../tournamentUtils';

// ==========================================================================
// DEUX-EQUIPES-2 (19/11/2026, décision du chef d'orchestre sur le bloc ⚖️ de DEUX-EQUIPES) — LE
// CAPITAINE D'UNE ÉQUIPE REFUSÉE (ou archivée) voit de nouveau « Rejoindre une équipe » et « Créer une
// équipe », comme le serveur le permet (`assertUserIsNotActiveInAnotherTournamentTeam` ne compte ni
// les équipes refusées ni les archivées). Avant : `hasTournamentTeamForUser` comptait toute équipe
// dont il était capitaine, admin ou membre actif, quel que soit son statut.
// ==========================================================================

jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

const TOURNOI = {
  date: '2026-12-19T17:15:00.000Z',
  tournamentConfig: { entryFeeCents: 2000, maxTeams: 24, minAge: 16 },
  type: { name: 'Tournoi' },
};
const MOI = 'u-002';
const equipe = (/** @type {any} */ extra = {}) => ({
  adminUsers: [{ documentId: MOI }],
  captainUser: { documentId: MOI },
  documentId: 'eq-33',
  members: [{ documentId: 'm-cap', responseStatus: 'present', user: { documentId: MOI } }],
  name: 'EMU Test 002',
  status: 'pending',
  ...extra,
});
const ouverte = { captainUser: { documentId: 'u-autre' }, documentId: 'eq-32', isOpenToJoinRequests: true, members: [], name: 'Recette Site 333', sourceType: 'custom_team', status: 'accepted' };
const peutRejoindre = (/** @type {any[]} */ teams) => canAskToJoinTournamentTeam({
  accountRoleKey: 'player', event: TOURNOI, teams, user: { birthdate: '1990-01-01', documentId: MOI },
});

describe('DEUX-EQUIPES-2 — capitaine d’une équipe refusée ou archivée', () => {
  test.each([
    ['refusée', { status: 'declined' }],
    ['archivée', { archivedAt: '2026-11-19T10:00:00.000Z', status: 'archived' }],
  ])('🔴 équipe %s : il n’a plus d’équipe qui bloque, il voit « Rejoindre une équipe »', (_label, statut) => {
    const teams = [equipe(statut), ouverte];
    expect(hasTournamentTeamForUser(teams, MOI)).toBe(false);
    expect(peutRejoindre(teams)).toBe(true);
  });

  test('🔴 la marque du serveur (`viewerMembership`) sur une équipe refusée ne bloque pas non plus', () => {
    const teams = [{ ...ouverte, documentId: 'eq-33', status: 'declined', viewerMembership: { responseStatus: 'present' } }, ouverte];
    expect(hasTournamentTeamForUser(teams, MOI)).toBe(false);
  });

  test('équipe en attente ou validée : il a toujours son équipe, pas de bouton (comme avant)', () => {
    expect(hasTournamentTeamForUser([equipe(), ouverte], MOI)).toBe(true);
    expect(hasTournamentTeamForUser([equipe({ status: 'accepted' }), ouverte], MOI)).toBe(true);
    expect(peutRejoindre([equipe(), ouverte])).toBe(false);
  });

  test('une invitation en attente garde le bouton caché, même si son autre équipe est refusée (comme avant)', () => {
    const invitante = { ...ouverte, members: [{ documentId: 'm-inv', responseStatus: 'invited', user: { documentId: MOI } }] };
    expect(hasTournamentTeamForUser([equipe({ status: 'declined' }), invitante], MOI)).toBe(true);
  });

  test('🔴 « Créer une équipe » : une équipe refusée ou archivée ne bloque pas, une équipe en attente ou validée bloque', () => {
    expect(blocksAnotherTournamentTeam(equipe({ status: 'declined' }))).toBe(false);
    expect(blocksAnotherTournamentTeam(equipe({ archivedAt: '2026-11-19T10:00:00.000Z', status: 'archived' }))).toBe(false);
    expect(blocksAnotherTournamentTeam(equipe())).toBe(true);
    expect(blocksAnotherTournamentTeam(equipe({ status: 'accepted' }))).toBe(true);
    expect(blocksAnotherTournamentTeam(null)).toBe(false);
  });
});
