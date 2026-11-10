/* eslint-disable max-len -- intitulés de témoins et données d'exemple, lus en entier. */
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FriendlyMatchFiltersSheet from '../FriendlyMatchFiltersSheet';

// AMICAUX-FORMAT (10/11/2026, maquette validée par Adel, écran 5) — le filtre
// « Format » ne mélange plus les sports : on choisit le sport, puis ses formats.

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: {},
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));
jest.mock('@/services/category/categoryQueries', () => ({ useGetCategories: () => ({ data: [] }) }));
jest.mock('@/services/level/levelQueries', () => ({ useGetLevels: () => ({ data: [] }) }));
jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => ({ SvgIcon: () => null }));
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

/**
 * Les libellés des pastilles, espaces insécables ramenés à des espaces.
 * @param {any} arbre
 * @returns {string[]}
 */
const pastilles = (arbre) => arbre.root.findAllByType(TouchableOpacity)
  .flatMap((pastille) => pastille.findAllByType(Text))
  .map((noeud) => noeud.props.children)
  .filter((valeur) => typeof valeur === 'string')
  .map((texte) => texte.replace(/[\u00a0\u202f]/g, ' '));

/**
 * Touche la pastille qui porte ce libellé.
 * @param {any} arbre
 * @param {string} libelle
 */
const toucher = (arbre, libelle) => {
  const cible = arbre.root.findAllByType(TouchableOpacity).find((pastille) => pastille
    .findAllByType(Text)
    .some((noeud) => String(noeud.props.children).replace(/[\u00a0\u202f]/g, ' ') === libelle));
  act(() => { cible.props.onPress(); });
};

const monter = (/** @type {any} */ props = {}) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <FriendlyMatchFiltersSheet
        filters={undefined}
        onApply={props.onApply || jest.fn()}
        onClose={jest.fn()}
        sportNames={props.sportNames}
        visible
      />,
    );
  });
  return arbre;
};

describe('AMICAUX-FORMAT — le filtre par sport puis par format', () => {
  it('la ligne « Sport » propose les sports des équipes du lecteur ; pas de format avant le sport', () => {
    const textes = pastilles(monter({ sportNames: ['Football', 'Futsal'] }));
    expect(textes).toEqual(expect.arrayContaining(['Tous les sports', 'Football', 'Futsal']));
    expect(textes).not.toContain('11 contre 11');
    expect(textes).not.toContain('double');
  });

  it('choisir le basket montre SES formats, plus « Autres formats », et l’application les transmet', () => {
    const onApply = jest.fn();
    const arbre = monter({ onApply, sportNames: ['Basketball'] });
    toucher(arbre, 'Basketball');
    const textes = pastilles(arbre);
    expect(textes).toEqual(expect.arrayContaining(['Tous', '5 contre 5', '3x3', 'Autres formats']));
    expect(textes).not.toContain('11 contre 11');
    toucher(arbre, '3x3');
    toucher(arbre, 'Appliquer');
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ format: '3x3', sport: 'Basketball' }));
  });

  it('sans équipe : les sports collectifs les plus courants', () => {
    expect(pastilles(monter())).toEqual(expect.arrayContaining(['Football', 'Handball', 'Rugby']));
  });
});
