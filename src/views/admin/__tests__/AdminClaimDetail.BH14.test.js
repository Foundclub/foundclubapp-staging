/* eslint-disable max-len */
import renderer, { act } from 'react-test-renderer';

import AdminClaimDetail from '../AdminClaimDetail';

// BH14 P9-16 (BUGHUNT 24/10/2026) — « Accepter » et « Refuser » pouvaient partir en même temps sur
// la même demande : pendant que l'une est en cours, les deux boutons sont éteints.

/** @type {string} */
let mockEnCours = '';
const mutation = (/** @type {string} */ nom) => ({
  isPending: mockEnCours === nom, mutate: jest.fn(), mutateAsync: jest.fn(),
});

jest.setTimeout(30000);

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() }),
  useRoute: () => ({ params: { requestId: 'dem-1', requestType: 'claim' } }),
}));
jest.mock('@/services/admin/adminQueries', () => ({
  useApproveClubClaim: () => mutation('accepter'),
  useGetClubClaimRequest: () => ({
    data: {
      data: {
        club: { name: 'AS Test' }, documentId: 'dem-1', status: 'pending', user: { firstname: 'Léa' },
      },
    },
    error: null,
    isLoading: false,
    refetch: jest.fn(),
  }),
  useProcessAffiliationHelpRequest: () => mutation('traiter'),
  useRefuseAffiliationHelpRequest: () => mutation('refuserAide'),
  useRefuseClubClaim: () => mutation('refuser'),
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

const bouton = (/** @type {any} */ arbre, /** @type {string} */ titre) => arbre.root
  .findAll((/** @type {any} */ n) => n.props?.title === titre && typeof n.props?.onPress === 'function')[0];

test.each([
  ['accepter', 'Refuser'],
  ['refuser', 'Accepter la demande'],
])('P9-16 : « %s » en cours éteint « %s »', async (enCours, autre) => {
  mockEnCours = enCours;
  /** @type {any} */
  let arbre;
  await act(async () => { arbre = renderer.create(<AdminClaimDetail />); });
  expect(bouton(arbre, autre).props.disabled).toBe(true);
});
