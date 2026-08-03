import renderer, { act } from 'react-test-renderer';

import ClubEdit from '../ClubEdit';

// L15 (E6) : ClubEdit.js n'avait AUCUN test. Ces tests caracterisent d'abord le
// comportement livre — un cadre d'apercu CARRE FIXE de 110x110 — avant de le
// corriger. C'est ce cadre carre, combine a resizeMode="contain", qui laisse
// voir le fond blanc de SelectAvatar sous forme de bandes des que le logo n'est
// pas exactement carre.
// Mesure du 2026-08-02 sur l'API de production (GET /api/clubs?populate=logo) :
// les ecussons servis portent bien width/height, et ils valent 84x100, 81x100,
// 100x100 — donc des bandes de ~16 a 19 % sur les cotes.

/** @type {any[]} */
const mockSelectAvatarProps = [];
const mockRefetch = jest.fn();
const mockMutate = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: mockMutate }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {any} */ fallback) => (
      typeof fallback === 'string' ? fallback : key
    ),
  }),
}));

// Le vrai Joi, sans le bootstrap i18next que '@/theme/strings' declenche a
// l'import (il chargerait fr.js, tenu par un autre lot).
jest.mock('@/theme/strings', () => ({ Joi: jest.requireActual('joi') }));

jest.mock('@/theme/colors', () => ({
  withAlpha: () => 'couleur-transparente',
}));

jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      ApplicationStyle: new Proxy({}, { get: () => styleLeaf }),
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

const mockGetClub = jest.fn();
jest.mock('@/services/club/clubQueries', () => ({
  useGetClub: (/** @type {any} */ ...args) => mockGetClub(...args),
}));

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: [] }),
}));

jest.mock('@/services/club/clubService', () => ({
  updateClubInfo: jest.fn(),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) {
    return children;
  },
);

jest.mock('@/components/atoms/button/Button', () => function ButtonMock() {
  return null;
});

jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() {
  return null;
});

// React 19 passe `ref` comme une prop ordinaire : pas besoin de forwardRef ici.
jest.mock('@/components/molecules/input/Input', () => function InputMock() {
  return null;
});

jest.mock(
  '@/components/molecules/autocompleteSelect/AutocompleteSelect',
  () => function AutocompleteSelectMock() {
    return null;
  },
);

jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function SubscriptionPaywallSheetMock() {
    return null;
  },
);

// Le point d'observation du lot : on releve exactement ce que ClubEdit demande
// a SelectAvatar de peindre.
jest.mock(
  '@/components/molecules/selectAvatar/SelectAvatar',
  () => function SelectAvatarMock(props) {
    mockSelectAvatarProps.push(props);
    return null;
  },
);

const navigation = { goBack: jest.fn(), navigate: jest.fn() };

/**
 * Construit une reponse de useGetClub avec le logo donne.
 * @param {any} logo
 * @returns {any}
 */
const clubWithLogo = (logo) => ({
  data: {
    activites: [],
    clubMembersPublicVisibility: true,
    documentId: 'club-1',
    logo,
    name: 'AS Test',
  },
  error: null,
  isLoading: false,
  refetch: mockRefetch,
});

/**
 * Monte l'ecran et rend les dernieres props recues par SelectAvatar.
 * @param {any} queryResult
 * @returns {Promise<{ props: any, tree: any }>}
 */
const renderScreen = async (queryResult) => {
  mockGetClub.mockReturnValue(queryResult);
  /** @type {any} */
  let tree;
  await act(async () => {
    tree = renderer.create(
      <ClubEdit
        navigation={/** @type {any} */ (navigation)}
        route={/** @type {any} */ ({ params: { clubId: 'club-1' } })}
      />,
    );
  });
  return { props: mockSelectAvatarProps[mockSelectAvatarProps.length - 1], tree };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSelectAvatarProps.length = 0;
});

// Bornes attendues, recopiees ici volontairement : si quelqu'un les elargit
// dans l'ecran sans le vouloir, ce test le dit.
const HAUTEUR = 110;
const RATIO_MIN = 0.5;
const RATIO_MAX = 2.5;

describe('ClubEdit — le cadre de l apercu epouse le format du logo', () => {
  it('logo 200x100 : le cadre prend le ratio 2, la hauteur ne bouge pas', async () => {
    const { props } = await renderScreen(clubWithLogo({
      height: 100,
      url: '/uploads/ecusson-large.png',
      width: 200,
    }));

    expect(props.containerStyle.aspectRatio).toBeCloseTo(2, 5);
    expect(props.containerStyle.height).toBe(HAUTEUR);
    // La largeur est calculee a partir du MEME ratio : le cadre carre impose
    // par SelectAvatar (width: size) ne peut pas repasser devant.
    expect(props.containerStyle.width).toBeCloseTo(HAUTEUR * 2, 5);
    // contain + cadre au bon format = plus aucune bande a voir.
    expect(props.imageResizeMode).toBe('contain');
    expect(props.imageStyle).toEqual({ height: '100%', width: '100%' });
  });

  it('logo 100x200 : le cadre se couche sur la borne basse 0.5', async () => {
    const { props } = await renderScreen(clubWithLogo({
      height: 200,
      url: '/uploads/fanion.png',
      width: 100,
    }));

    expect(props.containerStyle.aspectRatio).toBeCloseTo(RATIO_MIN, 5);
    expect(props.containerStyle.height).toBe(HAUTEUR);
    expect(props.containerStyle.width).toBeCloseTo(HAUTEUR * RATIO_MIN, 5);
  });

  it('logo 84x100 (ecusson reel mesure en production) : ratio 0.84 respecte', async () => {
    const { props } = await renderScreen(clubWithLogo({
      height: 100,
      url: '/uploads/fff-581420.jpg',
      width: 84,
    }));

    expect(props.containerStyle.aspectRatio).toBeCloseTo(0.84, 5);
  });

  it('dimensions folles (1000x100) : le cadre s arrete a la borne haute 2.5', async () => {
    const { props } = await renderScreen(clubWithLogo({
      height: 100,
      url: '/uploads/banderole.png',
      width: 1000,
    }));

    expect(props.containerStyle.aspectRatio).toBeCloseTo(RATIO_MAX, 5);
    // Sans borne le cadre ferait 1100 de large : une lamelle hors de l ecran.
    expect(props.containerStyle.width).toBeCloseTo(HAUTEUR * RATIO_MAX, 5);
  });
});

describe('ClubEdit — repli quand les dimensions du logo sont inconnues', () => {
  /**
   * Verifie qu un cadre reste dans des bornes tenables : ni ecrase, ni geant.
   * @param {any} containerStyle
   */
  const attendreUnCadreTenable = (containerStyle) => {
    expect(containerStyle.aspectRatio).toBeGreaterThanOrEqual(RATIO_MIN);
    expect(containerStyle.aspectRatio).toBeLessThanOrEqual(RATIO_MAX);
    expect(containerStyle.height).toBe(HAUTEUR);
    expect(containerStyle.width).toBeGreaterThanOrEqual(HAUTEUR * RATIO_MIN);
    expect(containerStyle.width).toBeLessThanOrEqual(HAUTEUR * RATIO_MAX);
  };

  it('logo venant du serveur sans width/height : cadre carre d origine, 110x110', async () => {
    const { props } = await renderScreen(clubWithLogo({ url: '/uploads/sans-dimensions.png' }));

    attendreUnCadreTenable(props.containerStyle);
    expect(props.containerStyle.aspectRatio).toBe(1);
    expect(props.containerStyle.width).toBe(HAUTEUR);
  });

  it('image choisie par le selecteur de fichier web (sans dimensions) : meme repli', async () => {
    const { props } = await renderScreen(clubWithLogo({
      height: 100,
      url: '/uploads/ecusson-large.png',
      width: 200,
    }));

    // Ce que SelectAvatar envoie reellement sur le chemin web
    // (handleBrowserFileSelection met width et height a undefined).
    await act(async () => {
      props.onAvatarSelected({
        height: undefined,
        path: 'blob:http://localhost/abc',
        url: '',
        width: undefined,
      });
    });

    const apres = mockSelectAvatarProps[mockSelectAvatarProps.length - 1];
    attendreUnCadreTenable(apres.containerStyle);
    expect(apres.containerStyle.aspectRatio).toBe(1);
  });

  it('dimensions a zero : le cadre ne se replie pas sur une division par zero', async () => {
    const { props } = await renderScreen(clubWithLogo({
      height: 0,
      url: '/uploads/corrompu.png',
      width: 0,
    }));

    attendreUnCadreTenable(props.containerStyle);
    expect(props.containerStyle.aspectRatio).toBe(1);
  });

  it('aucun logo : le cadre vide reste le carre de 110 d origine', async () => {
    const { props } = await renderScreen(clubWithLogo(null));

    attendreUnCadreTenable(props.containerStyle);
    expect(props.containerStyle.aspectRatio).toBe(1);
    expect(props.size).toBe(HAUTEUR);
  });
});
