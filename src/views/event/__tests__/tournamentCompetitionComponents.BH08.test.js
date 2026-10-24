import renderer, { act } from 'react-test-renderer';

import { TournamentBracketBoard } from '../tournamentCompetitionComponents';

// ==========================================================================
// BUGHUNT BH08 (24/10) — P8-02 : `name || source ? … : …` se lisait
// `(name || source) ? « Qualifié A » : …` ; le nom de l équipe ne sortait jamais.
// ==========================================================================

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (typeof repli === 'string' ? repli : cle),
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

jest.mock('@/components/atoms/button/Button', () => () => null);
jest.mock('@/components/atoms/tag/Tag', () => () => null);

const textes = (/** @type {any} */ noeud) => {
  if (noeud == null) return '';
  if (typeof noeud === 'string') return noeud;
  if (Array.isArray(noeud)) return noeud.map(textes).join(' ');
  return textes(noeud.children);
};

describe('BH08 · P8-02 — le tableau à élimination directe', () => {
  test('affiche le nom des équipes connues, et « Qualifié » seulement en attente', () => {
    /** @type {any} */
    let arbre = null;
    act(() => {
      arbre = renderer.create(
        <TournamentBracketBoard
          bracket={[{
            label: 'Finale',
            matches: [
              { documentId: 'm-1', teamA: { name: 'Lyon' }, teamB: { name: 'Nice' } },
              { documentId: 'm-2', sourceMatchA: { documentId: 'm-1' }, teamA: null, teamB: null },
            ],
          }]}
        />,
      );
    });
    const texte = textes(arbre.toJSON());
    arbre.unmount();

    expect(texte).toContain('Lyon');
    expect(texte).toContain('Nice');
    expect(texte).toContain('Qualifié A');
    expect(texte).toContain('À définir');
  });
});
