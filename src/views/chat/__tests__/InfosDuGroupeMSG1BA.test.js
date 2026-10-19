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
    expect(vu).toContain('Karim Benali | Coach / Prof');
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
    expect(textes(arbre)).toContain('Karim Benali | Coach / Prof');
    act(() => {
      parId(arbre, 'infos-du-groupe-fiche-voile').props.onPress();
    });
    act(() => {
      parId(arbre, 'infos-du-groupe-membre-lea').props.onPress();
    });
    expect(textes(arbre)).toContain('Lea Morel | Admin · Pratiquant / Joueur');
  });
});

const OUVERTES = {
  membersCanAddMembers: false,
  membersCanEditName: false,
  membersCanEditPhoto: false,
  membersCanSendMessages: true,
};

describe('InfosDuGroupe — §3.16 photo, autorisations, admins', () => {
  test('IA1 — admin : la ligne « Autorisations du groupe » et son resume ; la page s ouvre', () => {
    const onChangerAutorisation = jest.fn();
    const { arbre } = rendre({ autorisations: OUVERTES, onChangerAutorisation });
    expect(textes(arbre)).toContain('Autorisations du groupe | Les membres peuvent écrire');
    act(() => {
      parId(arbre, 'infos-du-groupe-autorisations').props.onPress();
    });
    act(() => {
      parId(arbre, 'autorisation-membersCanEditName').props.onValueChange(true);
    });
    expect(onChangerAutorisation).toHaveBeenCalledWith('membersCanEditName', true);
  });

  test('IA2 — simple membre : pas de ligne « Autorisations » ; ce qui est ouvert, permis', () => {
    const { arbre } = rendre({
      adminIds: ['karim'],
      autorisations: { ...OUVERTES, membersCanAddMembers: true, membersCanEditName: true },
      estAdmin: false,
    });
    expect(parId(arbre, 'infos-du-groupe-autorisations')).toBeUndefined();
    expect(parId(arbre, 'infos-du-groupe-nom').props.disabled).toBe(false);
    expect(parId(arbre, 'infos-du-groupe-ajouter')).toBeDefined();
    // La photo reste fermee pour lui : pas de pastille appareil photo.
    expect(parId(arbre, 'infos-du-groupe-photo')).toBeUndefined();
  });

  test('IA3 — la photo : feuille, « Choisir dans la galerie », « Supprimer » s il y en a', () => {
    const onChoisirPhoto = jest.fn();
    const onSupprimerPhoto = jest.fn();
    const { arbre } = rendre({
      autorisations: OUVERTES,
      chat: { ...GROUPE, groupPhoto: { url: '/uploads/g.jpg' } },
      onChoisirPhoto,
      onSupprimerPhoto,
    });
    act(() => {
      parId(arbre, 'infos-du-groupe-photo').props.onPress();
    });
    act(() => {
      parId(arbre, 'photo-du-groupe-galerie').props.onPress();
    });
    expect(onChoisirPhoto).toHaveBeenCalledWith('galerie');
    act(() => {
      parId(arbre, 'infos-du-groupe-photo').props.onPress();
    });
    act(() => {
      parId(arbre, 'photo-du-groupe-supprimer').props.onPress();
    });
    expect(onSupprimerPhoto).toHaveBeenCalled();
  });

  test('IA4 — serveur d avant 1B : ni photo, ni autorisations, comme avant', () => {
    const { arbre } = rendre({ autorisations: null });
    expect(parId(arbre, 'infos-du-groupe-photo')).toBeUndefined();
    expect(parId(arbre, 'infos-du-groupe-autorisations')).toBeUndefined();
    expect(parId(arbre, 'infos-du-groupe-nom').props.disabled).toBe(false);
    expect(parId(arbre, 'infos-du-groupe-ajouter')).toBeDefined();
  });

  test('IA5 — « Modifier les admins » : on coche Lea, « Valider » rend la liste complete', () => {
    const onValiderAdmins = jest.fn();
    const { arbre } = rendre({ autorisations: OUVERTES, onValiderAdmins });
    act(() => {
      parId(arbre, 'infos-du-groupe-autorisations').props.onPress();
    });
    expect(textes(arbre)).toContain('Admins · 1');
    act(() => {
      parId(arbre, 'autorisations-modifier-les-admins').props.onPress();
    });
    act(() => {
      parId(arbre, 'admins-du-groupe-lea').props.onPress();
    });
    act(() => {
      parId(arbre, 'admins-du-groupe-valider').props.onPress();
    });
    expect(onValiderAdmins).toHaveBeenCalledWith(['moi', 'lea']);
  });
});
