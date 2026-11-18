/* eslint-disable max-len -- les témoins se lisent en entier. */
import { getTournamentEssentials } from '../components/TournamentEssentials';
import { lireReglesPayantes } from '../components/TournamentPaidRulesFields';
import { getTournamentTeamProgress } from '../components/TournamentTeamProgress';
import { getTournamentTeamPlayersLine, getTournamentTeamsSeekingPlayers } from '../tournamentJoinRules';
import { getTournamentRosterSummary } from '../tournamentUtils';

// ==========================================================================
// T-SANS-PLAFOND (18/11/2026, décision d'Adel D239) — UNE ÉQUIPE DE TOURNOI N'A PLUS DE NOMBRE MAXIMUM.
// « Dans une équipe, il ne doit pas y avoir une limite de joueurs. Tant qu'ils paient, on s'en fout. »
// Le tournoi garde `maxRosterSize: 5` (ou 8) en base : les écrans n'en tirent plus rien. Le seuil de
// validation reste 5 payés ; au-delà, des remplaçants. ROUGE avant le lot, vert après.
// ==========================================================================

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));
jest.mock('@/theme/strings/localeDesFormats', () => ({ __esModule: true, default: () => 'fr-FR' }));

const CONFIG = { entryFeeCents: 2000, maxRosterSize: 5 };
const actifs = (/** @type {number} */ n) => Array.from({ length: n }, (_v, i) => ({
  documentId: `m-${i + 1}`, responseStatus: i === 0 ? 'present' : 'pending', role: i === 0 ? 'captain' : 'member', user: { documentId: `u-${i + 1}` },
}));
const equipe = (/** @type {number} */ n) => ({
  documentId: `equipe-${n}`, isOpenToJoinRequests: true, members: actifs(n), name: `Équipe de ${n}`, sourceType: 'custom_team', status: 'accepted',
});

test('🔴 « Rejoindre une équipe » garde une équipe ouverte à 5 et à 7 joueurs (plafond 5 en base), sans « sur 5 »', () => {
  const liste = getTournamentTeamsSeekingPlayers([equipe(4), equipe(5), equipe(7)], CONFIG);
  expect(liste.map((entry) => entry.team.documentId)).toEqual(['equipe-4', 'equipe-5', 'equipe-7']);
  expect(liste.map(getTournamentTeamPlayersLine)).toEqual(['4 joueurs', '5 joueurs', '7 joueurs']);
});

test('🔴 7 actifs sur un plafond 5 : aucun avertissement d effectif (le minimum, lui, avertit encore)', () => {
  expect(getTournamentRosterSummary(equipe(7), CONFIG).hasWarning).toBe(false);
  expect(getTournamentRosterSummary(equipe(3), { ...CONFIG, minRosterSize: 5 }).hasWarning).toBe(true);
});

test('🔴 progression : validée à 7 payés → « 5 sur 5 », + 2 remplaçants ; le seuil reste 5', () => {
  const valide = getTournamentTeamProgress({
    members: actifs(7), payment: { paidCount: 7, paidMembersToValidate: 5 }, teamStatus: 'accepted', tournamentConfig: CONFIG,
  });
  expect([valide.done, valide.needed, valide.substitutes, valide.ratio]).toEqual([5, 5, 2, 1]);

  const enCours = getTournamentTeamProgress({
    members: actifs(6), payment: { paidCount: 4, paidMembersToValidate: 5 }, teamStatus: 'pending', tournamentConfig: CONFIG,
  });
  expect([enCours.done, enCours.needed, enCours.substitutes, enCours.isValidated]).toEqual([4, 5, 1, false]);
});

test('🔴 la ligne « joueurs à inviter » ne dit plus « sur {max} » : elle vise le minimum', () => {
  const progress = getTournamentTeamProgress({
    members: actifs(2), payment: { paidCount: 0, paidMembersToValidate: 5 }, teamStatus: 'pending', tournamentConfig: { ...CONFIG, maxRosterSize: 8, minRosterSize: 5 },
  });
  expect(progress.todo.find((item) => item.kind === 'players')).toMatchObject({ count: 2, max: 5, missing: 3 });
});

test('🔴 case « Format » : « 5 joueurs par équipe » (le minimum), plus de « 5 à 8 »', () => {
  const [format] = getTournamentEssentials({ tournamentConfig: { maxRosterSize: 8, minRosterSize: 5 } });
  expect(format.value).toBe('5 joueurs par équipe');
});

test('🔴 réglages payants : un seuil de 9 payés n est plus refusé à cause d un effectif max 8', () => {
  const lecture = lireReglesPayantes({ feeText: '20', maxRosterSize: 8, paidText: '9' });
  expect(lecture.hasError).toBe(false);
  expect(lecture.config.paidMembersToValidate).toBe(9);
});
