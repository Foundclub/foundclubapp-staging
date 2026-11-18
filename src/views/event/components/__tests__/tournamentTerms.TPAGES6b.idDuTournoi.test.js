/* eslint-disable max-len -- phrases et doublures recopiées telles quelles */
/**
 * T-PAGES-6b (18/11/2026, chef « nuit du 18/11 », point 3) — LES CONDITIONS SAVENT D'OÙ L'ON VIENT.
 * `openTournamentTerms` prend un identifiant de tournoi FACULTATIF : la page des conditions reçoit
 * `?tournoi=<id>` et « Revenir au tournoi » ramène à la fiche (PublicConditionsTournoiPage). Sans
 * identifiant, l'adresse ne change pas. Branché tel quel sur `onPress`, il reçoit l'événement du
 * toucher : ce n'est pas un identifiant, l'adresse ne change pas non plus.
 * ROUGE avant le lot : l'identifiant était ignoré.
 */
const mockOuvrir = jest.fn();
jest.mock('@/platform/links', () => ({
  __esModule: true,
  default: { openUrl: (/** @type {string} */ adresse) => mockOuvrir(adresse) },
}));

const { openTournamentTerms, TOURNAMENT_TERMS_URL } = require('../tournamentTerms');

beforeEach(() => mockOuvrir.mockClear());

test('🔴 avec l identifiant du tournoi : ?tournoi=<id>', () => {
  openTournamentTerms('evt 3442');
  expect(mockOuvrir).toHaveBeenCalledWith(`${TOURNAMENT_TERMS_URL}?tournoi=evt%203442`);
});

test('caractérisant : sans identifiant, ou avec l événement d un toucher, l adresse est inchangée', () => {
  openTournamentTerms();
  openTournamentTerms(/** @type {any} */ ({ nativeEvent: {}, target: 1 }));
  openTournamentTerms('  ');
  expect(mockOuvrir.mock.calls).toEqual([
    [TOURNAMENT_TERMS_URL], [TOURNAMENT_TERMS_URL], [TOURNAMENT_TERMS_URL],
  ]);
  expect(TOURNAMENT_TERMS_URL).toMatch(/\/conditions-tournoi$/);
});
