import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AdminClubOnboardingList from '../AdminClubOnboardingList';

/**
 * C10 / P9-19 — clubs a onboarder (SuperAdmin) : « Refuser » une demande
 * d inscription de club partait en un appui. LE CONTRAT : il demande la meme
 * confirmation que la fiche ; « Traiter » et « Voir détail » ne changent pas.
 */

const mockRefuser = jest.fn();
const mockTraiter = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));
jest.mock('@/services/admin/adminQueries', () => {
  const mutation = (/** @type {() => any} */ lire) => () => ({
    isPending: false,
    mutate: (/** @type {any[]} */ ...args) => lire()(...args),
  });
  return {
    useGetPendingClubOnboardingRequests: () => ({
      data: {
        data: [{
          clubName: 'AS Neuve',
          createdAt: '2026-10-20T10:00:00.000Z',
          documentId: 'dem-1',
          user: { firstname: 'Léa' },
        }],
      },
      error: null,
      isLoading: false,
      refetch: jest.fn(),
    }),
    useProcessAffiliationHelpRequest: mutation(() => mockTraiter),
    useRefuseAffiliationHelpRequest: mutation(() => mockRefuser),
  };
});
jest.mock('@/services/client', () => ({ __esModule: true, default: {} }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ defaut) => (
      typeof defaut === 'string' ? defaut : cle
    ),
  }),
}));

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
      Images: {},
      Spaces: espaces,
    }),
  };
});

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock(
  '@/components/molecules/profileAvatar/ProfileAvatar',
  () => function ProfileAvatarMock() { return null; },
);

/** @type {any} */
let alerte;
/** @type {any[]} */
const arbres = [];

beforeEach(() => {
  mockRefuser.mockClear();
  mockTraiter.mockClear();
  alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  alerte.mockRestore();
  while (arbres.length) {
    const arbre = arbres.pop();
    act(() => { arbre.unmount(); });
  }
});

const monter = () => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(<AdminClubOnboardingList />); });
  arbres.push(arbre);
  return arbre;
};

const bouton = (/** @type {any} */ arbre, /** @type {string} */ titre) => arbre.root
  .findAll((/** @type {any} */ n) => n.props?.title === titre
    && typeof n.props?.onPress === 'function')[0];

test('P9-19 : « Refuser » demande une confirmation avant de partir', () => {
  const arbre = monter();
  act(() => { bouton(arbre, 'Refuser').props.onPress(); });

  expect(mockRefuser).not.toHaveBeenCalled();
  expect(alerte).toHaveBeenCalledTimes(1);
  const boutons = alerte.mock.calls[0][2];
  expect(boutons.find((/** @type {any} */ b) => b.style === 'cancel')).toBeTruthy();
  act(() => { boutons.find((/** @type {any} */ b) => b.style === 'destructive').onPress(); });
  expect(mockRefuser).toHaveBeenCalledTimes(1);
  expect(mockRefuser.mock.calls[0][0]).toEqual({ documentId: 'dem-1' });
});

test('P9-19 : « Traiter » reste en un appui', () => {
  const arbre = monter();
  act(() => { bouton(arbre, 'Traiter').props.onPress(); });

  expect(alerte).not.toHaveBeenCalled();
  expect(mockTraiter).toHaveBeenCalledTimes(1);
});
