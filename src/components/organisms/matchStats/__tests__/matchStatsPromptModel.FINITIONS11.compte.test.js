/* eslint-disable max-len -- les phrases attendues se lisent en entier. */
import { describeResponsesCount } from '../matchStatsPromptModel';

// FINITIONS11-STATS · point 6 — « COMPTE A » (Adel, 03/10 ~11h) : PARTOUT, « N sur M ont
// répondu » compte les CONVOQUÉS, et un joueur ajouté à la main SANS compte n'entre plus dans le
// compte. La fenêtre de rappel de l'entraîneur (« 0 sur 1 joueur a répondu ») comptait toutes les
// lignes de la feuille : elle compte désormais comme la carte « Après le match » et la liste des
// matchs en attente. Un serveur d'avant ne marque rien : toutes les lignes comptent, comme avant.

/**
 * Le repli de t(), interpolé, avec les pluriels de i18next.
 * @param {string} cle - La clé.
 * @param {any} options - Les options.
 * @returns {string} Le texte rendu.
 */
const mockTraduire = (/** @type {string} */ cle, /** @type {any} */ options) => {
  let modele = typeof options === 'string' ? options : cle;
  if (options && typeof options.count === 'number' && options.defaultValue_one) {
    modele = options.count <= 1 ? options.defaultValue_one : options.defaultValue_other;
  }
  return String(modele).replace(/\{\{(\w+)\}\}/g, (tout, nom) => (
    options && nom in options ? String(options[nom]) : tout
  ));
};
jest.mock('i18next', () => ({ __esModule: true, default: { t: (...args) => mockTraduire(...args) } }));

describe('FINITIONS11 · point 6 — la fenêtre de l entraîneur compte les convoqués', () => {
  test('1 · 🔴 convocation publiée : « 1 sur 2 joueurs ont répondu » (ni le non-convoqué, ni le joueur sans compte)', () => {
    expect(describeResponsesCount({
      playerResponses: [
        { convoked: true, status: 'submitted', userDocumentId: 'lea' },
        { convoked: true, status: null, userDocumentId: 'sami' },
        { convoked: false, status: 'submitted', userDocumentId: 'hugo' },
        { convoked: false, status: null, userDocumentId: null },
      ],
    })).toBe('1 sur 2 joueurs ont répondu');
  });

  test('2 · 🔒 serveur d avant (aucune marque) : toutes les lignes comptent, comme avant', () => {
    expect(describeResponsesCount({ playerResponses: [{ status: null }] })).toBe('0 sur 1 joueur a répondu');
  });

  test('3 · 🔒 personne d attendu : la ligne se tait (aucun « 0 sur 0 »)', () => {
    expect(describeResponsesCount({ playerResponses: [{ convoked: false, status: null, userDocumentId: 'hugo' }] })).toBe('');
    expect(describeResponsesCount(null)).toBe('');
  });
});
