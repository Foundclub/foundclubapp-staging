/**
 * T-PAGES-6 (17/11/2026), question 5 de T-REJOINDRE tranchée « C » par le chef : l'organisateur de
 * CE tournoi ne voit pas « Rejoindre une équipe ». Règle partagée (T-PAGES-3 et 4 l'appellent) :
 * isTournamentOrganizer, lue par canAskToJoinTournamentTeam.
 */
import { canAskToJoinTournamentTeam, isTournamentOrganizer } from '../tournamentJoinRules';

const TOURNOI = {
  date: '2026-12-19T18:00:00.000Z',
  organizer: { documentId: 'u-orga' },
  tournamentConfig: { minAge: 16 },
  type: { name: 'Tournoi' },
};
const compte = (/** @type {string} */ documentId) => ({ birthdate: '1990-01-01', documentId });

test('🔴 l organisateur de ce tournoi ne voit pas « Rejoindre une équipe »', () => {
  expect(isTournamentOrganizer(TOURNOI, compte('u-orga'))).toBe(true);
  expect(canAskToJoinTournamentTeam({
    accountRoleKey: 'coach', event: TOURNOI, teams: [], user: compte('u-orga'),
  })).toBe(false);
});

test('caractérisant : un autre compte le voit ; sans organisateur connu, rien ne change', () => {
  expect(isTournamentOrganizer(TOURNOI, compte('u-joueur'))).toBe(false);
  expect(canAskToJoinTournamentTeam({
    accountRoleKey: 'coach', event: TOURNOI, teams: [], user: compte('u-joueur'),
  })).toBe(true);
  expect(isTournamentOrganizer({ ...TOURNOI, organizer: null }, compte('u-orga'))).toBe(false);
  expect(isTournamentOrganizer(TOURNOI, null)).toBe(false);
});
