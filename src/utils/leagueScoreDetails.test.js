import { buildPadelScorePayload } from './leagueScoreDetails';

// I18N-3 : les messages passent par i18next.t, qui rend undefined sans initialisation.
// Le double lit le vrai fr.js, puis le repli, et remplit les {{jetons}} : le temoin
// affirme toujours le texte francais affiche.
jest.mock('i18next', () => {
  const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    __esModule: true,
    default: {
      language: 'fr',
      t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
        const valeur = String(cle).split('.').reduce(
          (/** @type {any} */ noeud, segment) => (noeud == null ? undefined : noeud[segment]),
          catalogue,
        );
        const gabarit = typeof valeur === 'string' ? valeur : String(repli);
        return gabarit.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String((options || {})[nom] ?? ''));
      },
    },
  };
});

describe('leagueScoreDetails', () => {
  it('derives a padel match score from two won sets', () => {
    const result = buildPadelScorePayload([
      { a: '6', b: '4' },
      { a: '7', b: '6' },
    ]);

    expect(result.error).toBeUndefined();
    expect(result.scoreA).toBe(2);
    expect(result.scoreB).toBe(0);
    expect(result.scoreDetails.scoreLabel).toBe('6-4 7-6');
  });

  it('rejects padel scores without a 2-set winner', () => {
    const result = buildPadelScorePayload([
      { a: '6', b: '4' },
      { a: '4', b: '6' },
    ]);

    expect(result.error).toBe('Le vainqueur doit gagner 2 sets.');
  });
});
