/* eslint-disable max-len -- les témoins se lisent en entier. */
import '@/theme/strings';

import renderer, { act } from 'react-test-renderer';

import { buildWebPath } from '@/navigation/webRoutes';

import client from '@/services/client';
import { getChildrenCurrentLicenses } from '@/services/license/licenseService';

import MyLicenses from '../MyLicenses';

// FIN-PARENT (02/11, Adel « 3d enfants ») — dans « Mes cotisations », le parent voit les cotisations
// de SES enfants, en lecture. Mesuré sur la recette 19 : /licenses/me est refusé au Parent, mais
// /licenses/users/:id/current lui rend la cotisation d'un enfant mineur relié à son compte (règle
// serveur : PARENT-LIEN-2-garde-fous) et 403 pour tout autre. La liste des enfants vient du serveur
// (/parent-links/as-parent), jamais de l'écran. Une fiche sans compte ne peut pas avoir de cotisation
// (license-assignment.user : un compte).

/** @type {any} */
let mockAuth = {};
/** @type {any} */
let mockLiens = {};
/** @type {any} */
let mockFiches = {};
/** @type {any} */
let mockLicences = {};
const mockMesCotisations = jest.fn();
const mockCotisationsDesEnfants = jest.fn();

jest.mock('@/domains/auth/useAuth', () => ({ __esModule: true, default: () => mockAuth }));
jest.mock('@/services/client', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('@/services/license/licenseQueries', () => ({
  useChildrenLicenses: (/** @type {any} */ ids) => mockCotisationsDesEnfants(ids),
  useMyLicenses: () => mockMesCotisations(),
}));
jest.mock('@/services/parentLink/parentLinkQueries', () => ({ useParentLinksAsParent: () => mockLiens }));
jest.mock('@/services/declaredChild/declaredChildQueries', () => ({ useGetMyDeclaredChildren: () => mockFiches }));
jest.mock('@react-navigation/native', () => ({
  createNavigationContainerRef: () => ({ current: null, isReady: () => false }),
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
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
jest.mock('@/components/templates/ScreenContainer', () => function ScreenMock(/** @type {any} */ { children }) {
  return children;
});
jest.mock('@/components/atoms/skeletonLoader/SkeletonLoader', () => function SkeletonLoaderMock() { return null; });

const cotisationDeHugo = {
  amountRemainingCents: 18000,
  campaign: {
    club: { name: 'AS Montrivage' }, documentId: 'camp-1', name: 'Saison 2026-2027', paymentModes: {}, seasonLabel: '2026-2027', status: 'active',
  },
  club: { documentId: 'club-1', name: 'AS Montrivage' },
  currency: 'EUR',
  documentId: 'cot-hugo',
  installments: [],
  payments: [],
  receipts: [],
  status: 'pending',
};
const HUGO = {
  age: 14, documentId: 'u-hugo', firstname: 'Hugo', lastname: 'Lemaire',
};
const LINA = {
  account: null, age: 10, documentId: 'fiche-lina', firstname: 'Lina', lastname: 'Recette',
};
const FICHE_DE_HUGO = {
  account: { documentId: 'u-hugo' }, age: 14, documentId: 'fiche-hugo', firstname: 'Hugo', lastname: 'Lemaire',
};

const charge = (/** @type {any} */ data) => ({
  data, isError: false, isLoading: false, refetch: jest.fn(),
});

/** @type {any} */
let arbre = null;
const mockNaviguer = jest.fn();

const monter = () => {
  act(() => {
    arbre = renderer.create(
      <MyLicenses navigation={{ canGoBack: () => true, goBack: jest.fn(), navigate: mockNaviguer }} route={{ params: {} }} />,
    );
  });
  return JSON.stringify(arbre.toJSON());
};
const texteDe = (/** @type {string} */ libelle) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.accessibilityRole === 'button' && typeof n.props?.onPress === 'function' && JSON.stringify(n.props?.accessibilityLabel || '').includes(libelle),
);

beforeEach(() => {
  mockAuth = { accountRoleKey: 'parent', userData: { documentId: 'u-paola' } };
  mockLiens = charge({ children: [HUGO], requests: [] });
  mockFiches = charge([FICHE_DE_HUGO, LINA]);
  mockLicences = charge({ 'u-hugo': cotisationDeHugo });
  mockCotisationsDesEnfants.mockImplementation(() => mockLicences);
  mockMesCotisations.mockImplementation(() => charge([]));
});

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  jest.clearAllMocks();
});

describe('FIN-PARENT — « Mes cotisations » d un compte Parent', () => {
  test('il voit la cotisation de son enfant relié, sous son nom, et jamais le refus « pas ouverte »', () => {
    const texte = monter();
    expect(texte).toContain('HUGO LEMAIRE');
    expect(texte).toContain('Saison 2026-2027');
    expect(texte).toContain('AS Montrivage');
    expect(texte).not.toContain('pas ouverte à ton profil');
    expect(mockCotisationsDesEnfants).toHaveBeenCalledWith(['u-hugo']);
  });

  test('un enfant sans compte est nommé, avec « aucune cotisation », et une fiche reliée n apparaît qu une fois', () => {
    const texte = monter();
    expect(texte).toContain('LINA RECETTE');
    expect(texte).toContain('Aucune cotisation pour l’instant.');
    expect(texte.match(/HUGO LEMAIRE/g)).toHaveLength(1);
  });

  test('il ne demande /licenses/me pour personne : le serveur le lui refuse', () => {
    monter();
    expect(mockMesCotisations).not.toHaveBeenCalled();
  });

  test('la carte se lit et ne s ouvre pas : aucun paiement, aucun détail refusé', () => {
    monter();
    expect(texteDe('Saison 2026-2027')).toHaveLength(0);
    expect(mockNaviguer).not.toHaveBeenCalled();
  });

  test('sans enfant : l écran le dit et mène à « Mes enfants »', () => {
    mockLiens = charge({ children: [], requests: [] });
    mockFiches = charge([]);
    mockLicences = charge(undefined);
    const texte = monter();
    expect(texte).toContain('Aucun enfant déclaré pour l’instant.');
    const bouton = arbre.root.findAll((/** @type {any} */ n) => n.props?.title === 'Mes enfants' && typeof n.props?.onPress === 'function');
    expect(bouton.length).toBeGreaterThan(0);
    act(() => bouton[0].props.onPress());
    // « Mes cotisations » vit sur la racine, « Mes enfants » dans ProfileStack : un nom nu ne mène nulle part
    // sur téléphone (allerDansLOnglet.test.js). Le site doit arriver à la même page.
    expect(mockNaviguer).toHaveBeenCalledWith('ProfileStack', { screen: 'MyChildren' });
    expect(buildWebPath(...mockNaviguer.mock.calls[0])).toBe('/profile/children');
  });

  test('une panne n est pas « aucune cotisation » : l écran dit l indisponibilité et propose de réessayer', () => {
    const refetch = jest.fn();
    mockLicences = {
      data: undefined, isError: true, isLoading: false, refetch,
    };
    const texte = monter();
    expect(texte).toContain('Cotisations indisponibles');
    expect(texte).not.toContain('Aucune cotisation pour l’instant.');
  });
});

describe('FIN-PARENT — (E6) un autre rôle ne change pas', () => {
  test('un joueur lit toujours SES cotisations par /licenses/me, sans la liste des enfants', () => {
    mockAuth = { accountRoleKey: 'player', userData: { documentId: 'u-joueur' } };
    mockMesCotisations.mockImplementation(() => charge([cotisationDeHugo]));
    const texte = monter();
    expect(texte).toContain('Saison 2026-2027');
    expect(mockMesCotisations).toHaveBeenCalled();
    expect(mockCotisationsDesEnfants).not.toHaveBeenCalled();
    expect(texteDe('Saison 2026-2027').length).toBeGreaterThan(0);
  });
});

describe('FIN-PARENT — getChildrenCurrentLicenses', () => {
  test('lit chaque enfant par sa licence courante ; 404 (aucune) et 403 (lien éteint) ne sont pas des pannes', async () => {
    const erreur = (/** @type {number} */ status) => Object.assign(new Error('refus'), { response: { status } });
    client.get
      .mockResolvedValueOnce({ data: { data: cotisationDeHugo } })
      .mockRejectedValueOnce(erreur(404))
      .mockRejectedValueOnce(erreur(403));
    await expect(getChildrenCurrentLicenses(['u-hugo', 'u-sans', 'u-majeur'])).resolves.toEqual({
      'u-hugo': cotisationDeHugo,
      'u-majeur': null,
      'u-sans': null,
    });
    expect(client.get.mock.calls.map(([url]) => url)).toEqual([
      '/licenses/users/u-hugo/current',
      '/licenses/users/u-sans/current',
      '/licenses/users/u-majeur/current',
    ]);
  });

  test('une vraie panne remonte : elle ne se déguise pas en « aucune cotisation »', async () => {
    client.get.mockRejectedValueOnce(Object.assign(new Error('panne'), { response: { status: 500 } }));
    await expect(getChildrenCurrentLicenses(['u-hugo'])).rejects.toThrow('panne');
  });
});
