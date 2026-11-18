/* eslint-disable max-len -- phrases et adresses recopiées telles quelles */
/**
 * T-PAGES-6b (18/11/2026, point 4 du chef) — LA CASE « DATE » DU BLOC « LE TOURNOI » (page d'équipe et
 * fiche) lit l'heure SAISIE. Cas réel de la recette 45 (TEST 3442) : `date` à minuit UTC, `startTime`
 * 19:00:00. La brique le faisait déjà ; le « 01:00 » venait du serveur, dont la vue d'équipe ne portait
 * pas `startTime` (admin tests/authz/T-PAGES-6b-heure-page-equipe.test.js, rouge puis vert).
 * Caractérisant : il garde la règle, et montre ce que l'écran affiche quand le serveur l'oublie.
 */
jest.mock('i18next', () => ({ language: 'fr', t: (/** @type {string} */ cle) => cle }));

const { getTournamentEssentials } = require('../TournamentEssentials');

const caseDate = (/** @type {any} */ event) => getTournamentEssentials(event)
  .find((item) => item.key === 'date');

test('caractérisant : minuit UTC + startTime 19:00:00 ⇒ « 19:00 – 23:00 »', () => {
  expect(caseDate({
    date: '2026-12-05T00:00:00.000Z', endTime: '23:00:00', startTime: '19:00:00',
  })?.note).toBe('19:00 – 23:00');
  expect(caseDate({ date: '2026-12-05T00:00:00.000Z', startTime: '19:00:00' })?.note).toBe('19:00');
});

test('caractérisant : sans startTime (vue d équipe d avant), la date seule se lit 01:00 à Paris', () => {
  expect(caseDate({ date: '2026-12-05T00:00:00.000Z' })?.note).toBe('01:00');
});
