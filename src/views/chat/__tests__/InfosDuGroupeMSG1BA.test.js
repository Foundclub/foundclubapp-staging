import { createElement } from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import InfosDuGroupe from '../InfosDuGroupe';

// MSG1BA — « INFOS DU GROUPE », ce que le serveur MESSAGERIE-1B ajoute (contrat
// admin/docs/CONTRAT_MESSAGERIE_1B.md) : le role de chaque membre (§3.1), la photo, les
// autorisations, les admins multiples (§3.16). Chaque section pose ses temoins ici AVANT
// d'etre ecrite (E6) ; le comportement de 1A reste tenu par `InfosDuGroupe.test.js`.

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      const gabarit = typeof repli === 'string' ? repli : repli?.defaultValue;
      if (typeof gabarit !== 'string') return cle;
      return gabarit.replace(/\{\{(\w+)\}\}/g, (_m, nom) => (repli?.[nom] !== undefined ? String(repli[nom]) : _m));
    },
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  }),
}));
jest.mock('react-native-svg', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    Circle: VueRN,
    default: VueRN,
    Line: VueRN,
    Path: VueRN,
    Polyline: VueRN,
    Rect: VueRN,
    Svg: VueRN,
  };
});
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const Colors = generateColors();
  return { __esModule: true, default: () => ({ Colors }) };
});
jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => () => null);
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => () => null);

const GROUPE = {
  groupName: 'Covoit U15',
  participants: [
    { documentId: 'karim', firstname: 'Karim', lastname: 'Benali' },
    { documentId: 'moi', firstname: 'Adel', lastname: 'F' },
    { documentId: 'lea', firstname: 'Lea', lastname: 'Morel' },
  ],
};

/**
 * Rend la page avec des reglages par defaut (admin), surchargeables.
 * @param {Record<string, any>} [props]
 * @returns {{ arbre: any, appels: Record<string, jest.Mock> }}
 */
const rendre = (props = {}) => {
  const appels = {
    onAjouter: jest.fn(),
    onBasculerAdmin: jest.fn(),
    onClose: jest.fn(),
    onEnvoyerUnMessage: jest.fn(),
    onRenommer: jest.fn(() => Promise.resolve()),
    onRetirer: jest.fn(),
    onSignaler: jest.fn(),
  };
  const reglages = {
    adminIds: ['moi'],
    chat: GROUPE,
    estAdmin: true,
    meId: 'moi',
    visible: true,
    ...appels,
    ...props,
  };
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(InfosDuGroupe, reglages));
  });
  return { appels, arbre };
};

/**
 * Le premier element touchable (ou saisissable) qui porte ce testID.
 * @param {any} arbre
 * @param {string} id
 * @returns {any}
 */
const parId = (arbre, id) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === id
      && (typeof n.props?.onPress === 'function'
        || typeof n.props?.onValueChange === 'function'
        || typeof n.props?.onChangeText === 'function'),
)[0];

/**
 * Tous les textes affiches, a la suite.
 * @param {any} arbre
 * @returns {string}
 */
const textes = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ n) => [n.props.children].flat().join(''))
  .join(' | ');

describe('InfosDuGroupe — §3.1 le role de chaque membre', () => {
  test('IR1 — sous chaque nom, le role lu pour ce membre ; sans role connu, « Membre »', () => {
    const { arbre } = rendre({ roles: { karim: 'Entraîneur', moi: 'Dirigeant' } });
    const vu = textes(arbre);
    expect(vu).toContain('Karim Benali | Entraîneur');
    expect(vu).toContain('Vous | Dirigeant');
    expect(vu).toContain('Lea Morel | Membre');
  });

  test('IR2 — la fiche d un membre dit aussi son role (et « Admin » s il l est)', () => {
    const { arbre } = rendre({
      adminIds: ['moi', 'lea'],
      roles: { karim: 'Entraîneur', lea: 'Joueur' },
    });
    act(() => {
      parId(arbre, 'infos-du-groupe-membre-karim').props.onPress();
    });
    expect(textes(arbre)).toContain('Karim Benali | Entraîneur');
    act(() => {
      parId(arbre, 'infos-du-groupe-fiche-voile').props.onPress();
    });
    act(() => {
      parId(arbre, 'infos-du-groupe-membre-lea').props.onPress();
    });
    expect(textes(arbre)).toContain('Lea Morel | Admin · Joueur');
  });
});
