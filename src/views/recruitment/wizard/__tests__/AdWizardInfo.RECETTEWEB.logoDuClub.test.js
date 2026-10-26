import { createElement } from 'react';
import { Image, StyleSheet, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { colors as COULEURS } from '@/theme/colors';

import TeamShield from '@/components/atoms/teamShield/TeamShield';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import EventWizardTeamCard from '@/views/event/wizard/components/EventWizardTeamCard';

import AdWizardInfo from '../AdWizardInfo';

// RECETTEWEB retour 3 (26/10, capture d'Adel, iPhone 2.6.80) — tunnel d'annonce de
// recrutement, « Étape 4/7 · Ciblage sportif », carte « Équipe sélectionnée » : le
// logo du club est un carré plus petit que son rond, pas centré, entouré d'un anneau
// blanc puis du liseré cyan (double contour).
//
// Deux causes, mesurées ici sur les VRAIS ClubLogoMark et ProfileAvatar :
//  1. les pastilles des assistants demandaient 10 % de marge intérieure : le logo
//     ne couvre que 80 % du rond, le fond blanc fait un second anneau ;
//  2. ProfileAvatar donnait au contenu la taille du cadre ENTIER, liseré compris :
//     avec un liseré de 1,5, le contenu (56) déborde de la place intérieure (53) et
//     part de son coin haut-gauche, décalé de 1,5 vers le bas et la droite.
// Attendu : le logo remplit la place intérieure du liseré, pile, donc centré, avec
// un seul liseré.

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

// Le VRAI theme, sans le contexte React qui le porte (jamais un Proxy).
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: { roundAvatar: 'repli-avatar' },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/utils/imageUrl', () => ({
  getImageUrl: (/** @type {string} */ url) => url || undefined,
}));

jest.mock(
  '@/components/molecules/profilePicturePreviewOverlay/ProfilePicturePreviewOverlay',
  () => () => null,
);
jest.mock('@/components/atoms/sponsorLogoTile/SponsorLogoTile', () => () => null);
jest.mock('@/components/atoms/tag/Tag', () => () => null);
jest.mock('@/components/atoms/button/Button', () => () => null);
jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => () => null);
jest.mock(
  '@/components/molecules/wizardStepLayout/WizardStepLayout',
  () => function EtapeMock(/** @type {any} */ props) {
    // eslint-disable-next-line global-require
    const { createElement: creer } = require('react');
    // eslint-disable-next-line global-require
    const { View } = require('react-native');
    return creer(View, null, props.children);
  },
);

jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));

jest.mock('@/services/category/categoryQueries', () => ({
  useGetCategories: () => ({ data: [], error: null, isLoading: false }),
}));
jest.mock('@/services/level/levelQueries', () => ({
  useGetLevels: () => ({ data: [], error: null, isLoading: false }),
}));
jest.mock('@/services/section/sectionQueries', () => ({
  useGetSections: () => ({ data: [], error: null, isLoading: false }),
}));

const LOGO = '/uploads/logo-foundclub.png';

/** @type {any} */
let mockEquipe = null;
jest.mock('../AdWizardContext', () => ({
  useAdWizard: () => ({ dispatch: jest.fn(), state: { team: mockEquipe } }),
}));

/**
 * Une equipe Senior du club FoundClub, avec ou sans logo.
 * @param {string | null} logo URL du logo, ou null.
 * @returns {any} L'equipe.
 */
const equipe = (logo) => ({
  club: { logo: logo ? { url: logo } : null, name: 'FoundClub' },
  documentId: 'equipe-senior',
  name: 'Senior',
});

/** @type {any} */
let arbre = null;

/**
 * Monte un element, logo carre (le FoundClub de la capture fait 512 x 512).
 * @param {any} element L'element a monter.
 * @returns {any} L'arbre de test.
 */
const monter = (element) => {
  jest.spyOn(Image, 'getSize').mockImplementation((_uri, succes) => succes(512, 512));
  act(() => {
    arbre = renderer.create(element);
  });
  return arbre;
};

/**
 * Mesure la pastille du logo : le cadre (avec son liseré), la boite du contenu et l'image.
 * @param {any} racine L'arbre de test.
 * @returns {{
 *   cadre: any, contenu: any, image: any, interieur: { largeur: number, hauteur: number }
 * }}
 *   Les trois styles aplatis, et la place laissee a l'interieur du liseré.
 */
const mesurerPastille = (racine) => {
  const avatar = racine.root.findByType(ProfileAvatar);
  const touche = avatar.findByType(TouchableOpacity);
  const cadre = StyleSheet.flatten(touche.props.style);
  const contenu = StyleSheet.flatten(touche.props.children.props.style);
  const image = StyleSheet.flatten(avatar.findByType(Image).props.style);
  const lisere = cadre.borderWidth || 0;
  return {
    cadre,
    contenu,
    image,
    interieur: { hauteur: cadre.height - (2 * lisere), largeur: cadre.width - (2 * lisere) },
  };
};

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  mockEquipe = null;
  jest.restoreAllMocks();
});

describe.each([
  [
    'étape 4/7 « Ciblage sportif » (AdWizardInfo)',
    56,
    () => createElement(AdWizardInfo, { navigation: { navigate: jest.fn() } }),
  ],
  [
    'étapes Équipe et Récapitulatif (EventWizardTeamCard)',
    60,
    () => createElement(EventWizardTeamCard, { onPress: () => {}, team: mockEquipe }),
  ],
])('RECETTEWEB retour 3 — %s', (_nom, taille, fabrique) => {
  test('un seul liseré cyan, rond, à la taille prévue', () => {
    mockEquipe = equipe(LOGO);
    const { cadre } = mesurerPastille(monter(fabrique()));

    expect(cadre).toMatchObject({
      borderColor: COULEURS.primary500,
      borderRadius: taille / 2,
      borderWidth: 1.5,
      height: taille,
      width: taille,
    });
  });

  test('le logo remplit la place intérieure du liseré : aucun anneau blanc', () => {
    mockEquipe = equipe(LOGO);
    const { image, interieur } = mesurerPastille(monter(fabrique()));

    expect(image.width).toBeCloseTo(interieur.largeur, 5);
    expect(image.height).toBeCloseTo(interieur.hauteur, 5);
  });

  test('le contenu tient pile dans le liseré : centré, sans décalage', () => {
    mockEquipe = equipe(LOGO);
    const { contenu, interieur } = mesurerPastille(monter(fabrique()));

    expect(contenu.width).toBeCloseTo(interieur.largeur, 5);
    expect(contenu.height).toBeCloseTo(interieur.hauteur, 5);
  });

  test('sans logo : l écusson FoundClub aux initiales du club', () => {
    mockEquipe = equipe(null);
    const racine = monter(fabrique());

    expect(racine.root.findAllByType(ProfileAvatar)).toHaveLength(0);
    expect(racine.root.findByType(TeamShield).props.initials).toBeTruthy();
  });
});

describe('RECETTEWEB retour 3 — l annonce publiée (liseré gris de RecruitmentAdCard)', () => {
  test('le logo remplit et reste centré dans son liseré de 1', () => {
    const { contenu, image, interieur } = mesurerPastille(monter(createElement(ClubLogoMark, {
      logoStyle: { borderColor: COULEURS.neutral200, borderRadius: 24, borderWidth: 1 },
      logoUrl: LOGO,
      name: 'FoundClub',
      size: 48,
    })));

    expect(interieur.largeur).toBe(46);
    expect(contenu.width).toBeCloseTo(46, 5);
    expect(image.width).toBeCloseTo(46, 5);
  });
});
