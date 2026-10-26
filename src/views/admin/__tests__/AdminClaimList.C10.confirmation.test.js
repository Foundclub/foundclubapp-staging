import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AdminClaimList from '../AdminClaimList';

/**
 * C10 / P9-09 et P9-16 — liste des revendications de club du SuperAdmin.
 *
 * P9-09 : « Accepter » (le demandeur devient proprietaire du club) et « Refuser »
 * partaient en un appui depuis la liste, alors que la fiche demande une
 * confirmation. LE CONTRAT : la liste demande la meme confirmation que la fiche.
 * P9-16 : pendant que l une des deux actions part sur une demande, les deux
 * boutons de CETTE demande sont eteints.
 */

/** @type {string} */
let mockEnCours = '';
const mockAccepter = jest.fn();
const mockRefuser = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));
jest.mock('@/services/admin/adminQueries', () => {
  const mutation = (/** @type {string} */ nom, /** @type {() => any} */ lire) => () => ({
    isPending: mockEnCours === nom,
    mutate: (/** @type {any[]} */ ...args) => lire()(...args),
    variables: mockEnCours === nom ? 'dem-1' : undefined,
  });
  return {
    useApproveClubClaim: mutation('accepter', () => mockAccepter),
    useGetClubClaimsRequestList: () => ({
      data: {
        data: [{
          club: { name: 'AS Test' },
          createdAt: '2026-10-20T10:00:00.000Z',
          documentId: 'dem-1',
          user: { firstname: 'Léa' },
        }],
      },
      error: null,
      isLoading: false,
      refetch: jest.fn(),
    }),
    useProcessAffiliationHelpRequest: mutation('traiter', () => jest.fn()),
    useRefuseAffiliationHelpRequest: mutation('refuserAide', () => jest.fn()),
    useRefuseClubClaim: mutation('refuser', () => mockRefuser),
  };
});
jest.mock('@/services/admin/adminWaitingPlayers', () => ({
  CLUB_ARRIVAL_INTEREST_KIND: 'club_arrival_interest',
}));
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
  mockEnCours = '';
  mockAccepter.mockClear();
  mockRefuser.mockClear();
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
  act(() => { arbre = renderer.create(<AdminClaimList />); });
  arbres.push(arbre);
  return arbre;
};

const bouton = (/** @type {any} */ arbre, /** @type {string} */ titre) => arbre.root
  .findAll((/** @type {any} */ n) => n.props?.title === titre
    && typeof n.props?.onPress === 'function')[0];

test.each([
  ['Accepter', mockAccepter],
  ['Refuser', mockRefuser],
])('P9-09 : « %s » depuis la liste demande une confirmation avant de partir', (titre, action) => {
  const arbre = monter();
  act(() => { bouton(arbre, titre).props.onPress(); });

  expect(action).not.toHaveBeenCalled();
  expect(alerte).toHaveBeenCalledTimes(1);
  const boutons = alerte.mock.calls[0][2];
  expect(boutons.find((/** @type {any} */ b) => b.style === 'cancel')).toBeTruthy();
  act(() => { boutons.find((/** @type {any} */ b) => b.style !== 'cancel').onPress(); });
  expect(action).toHaveBeenCalledTimes(1);
  expect(action.mock.calls[0][0]).toBe('dem-1');
});

test.each([
  ['accepter', 'Refuser'],
  ['refuser', 'Accepter'],
])('P9-16 : « %s » en cours éteint « %s » sur la même demande', (enCours, autre) => {
  mockEnCours = enCours;
  const arbre = monter();

  expect(bouton(arbre, autre).props.disabled).toBe(true);
});
