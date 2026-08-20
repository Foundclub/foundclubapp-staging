import renderer, { act } from 'react-test-renderer';

import MyLicense from '../MyLicense';

/**
 * AA07 / K1 — « MA cotisation » quand on en a PLUSIEURS.
 *
 * 🗣️ Adel, recette du 2026-08-20 : « l'accueil dit "Ma cotisation", et si on en
 * a plusieurs on n'en voit qu'une — impossible d'atteindre l'autre. »
 *
 * 🔬 CE QUE LA MESURE A MONTRE AVANT D'ECRIRE CE TEMOIN — `MyLicense.js:109`
 * appelle `useMyLicenses()`, qui rend une LISTE. L'ecran en choisit UNE seule
 * (`fallbackAssignment`, ligne 115) et n'offre aucune porte vers les autres.
 * La plomberie pour en ouvrir une precise existe pourtant deja : la route
 * accepte `assignmentId` (`webRoutes.js:199`) et `useMyLicenseAssignment` sait
 * la charger. ⇒ Il ne manque que le SELECTEUR, pas le rail.
 *
 * 🚪 NATURE : fonctionnalite inatteignable, avec de l'argent derriere. Ce n'est
 * pas de la peinture — la deuxieme cotisation existe, elle est due, et aucun
 * geste de l'app ne permet de l'atteindre.
 *
 * ⛔ CE TEMOIN NE DOIT PAS DEVENIR UN TEST DE PEINTURE : il n'observe pas une
 * couleur ni une marge, il observe qu'un club nomme dans la reponse serveur est
 * ATTEIGNABLE a l'ecran.
 */

/** @type {any} */
let mockMesCotisations;
/** @type {any} */
let mockCotisationCiblee;
/** @type {any[]} */
const mockBoutons = [];
const mockMutationFigee = { isPending: false, mutate: jest.fn(), mutateAsync: jest.fn() };

jest.mock('@/services/license/licenseQueries', () => ({
  createLicenseCheckout: jest.fn(),
  declareExternalLicensePayment: jest.fn(),
  generateLicenseReceipt: jest.fn(),
  submitLicenseDocument: jest.fn(),
  useLicenseMutation: () => mockMutationFigee,
  useMyLicenseAssignment: () => mockCotisationCiblee,
  useMyLicenses: () => mockMesCotisations,
}));

jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
      Colors: couleurs,
      Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
      Images: {},
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

jest.mock('@/components/templates/ScreenContainer', () => function ScreenMock(
  /** @type {any} */ { children },
) {
  return children;
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => function ModalMock(
  /** @type {any} */ { children },
) {
  return children;
});

jest.mock('@/components/atoms/button/Button', () => function ButtonMock(/** @type {any} */ props) {
  mockBoutons.push(props);
  return null;
});

jest.mock('@/platform/links', () => ({ __esModule: true, default: { openUrl: jest.fn() } }));
jest.mock('@/platform/media', () => ({ __esModule: true, default: { pickDocument: jest.fn() } }));
jest.mock('@/platform/share', () => ({ __esModule: true, default: { share: jest.fn() } }));

const cotisation = ({ club, documentId, status }) => ({
  amountDueCents: 18000,
  amountPaidCents: 0,
  amountRemainingCents: 18000,
  campaign: {
    club: { name: club },
    documentId: `camp-${documentId}`,
    name: `Cotisation ${club}`,
    paymentModes: {},
    seasonLabel: '2026-2027',
  },
  club: { name: club },
  currency: 'EUR',
  documentId,
  installments: [],
  payments: [],
  receipts: [],
  status,
});

/** @type {any} */
let arbre = null;

afterEach(() => {
  if (arbre) {
    act(() => arbre.unmount());
    arbre = null;
  }
});

/**
 * Monte l'ecran avec la liste donnee.
 * @param {any[]} liste les cotisations rendues par `/licenses/me`
 * @returns {string} tout le texte rendu, mis a plat
 */
const monter = (liste) => {
  mockBoutons.length = 0;
  mockMesCotisations = { data: liste, isError: false, isLoading: false, refetch: jest.fn() };
  mockCotisationCiblee = { data: null, isError: false, isLoading: false, refetch: jest.fn() };

  act(() => {
    arbre = renderer.create(
      <MyLicense
        navigation={{ navigate: jest.fn(), setOptions: jest.fn() }}
        route={{ params: {} }}
      />,
    );
  });

  return JSON.stringify(arbre.toJSON());
};

const DEUX_COTISATIONS = [
  cotisation({ club: 'FC Nord', documentId: 'assign-nord', status: 'pending' }),
  cotisation({ club: 'AS Sud', documentId: 'assign-sud', status: 'pending' }),
];

describe('AA07 / K1 — plusieurs cotisations', () => {
  it('nomme les DEUX clubs quand deux cotisations sont dues', () => {
    const rendu = monter(DEUX_COTISATIONS);

    expect(rendu).toContain('FC Nord');
    // 🎯 LE CAS D'ADEL : la seconde existe, elle est due, et aujourd hui
    // l'ecran ne la montre nulle part.
    expect(rendu).toContain('AS Sud');
  });

  it('offre un geste pour passer a la seconde cotisation', () => {
    monter(DEUX_COTISATIONS);

    const gestesVersLaSeconde = mockBoutons.filter((bouton) => (
      String(bouton?.title || '').includes('AS Sud')
    ));
    expect(gestesVersLaSeconde.length).toBeGreaterThan(0);
  });

  it('ne cree AUCUN selecteur quand il n y a qu une seule cotisation', () => {
    // 🔒 GARDE-FOU : le cas normal ne doit pas gagner un choix inutile.
    const rendu = monter([DEUX_COTISATIONS[0]]);

    expect(rendu).toContain('FC Nord');
    expect(rendu).not.toContain('AS Sud');
  });
});
