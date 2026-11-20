/* eslint-disable max-len -- données de témoin sur une ligne */
import '@/theme/strings';

import { Platform } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import WebFloatingOverlay from '@/components/atoms/webFloatingOverlay/WebFloatingOverlay';

import MyLicenseDetail from '../MyLicenseDetail';

// RECOLTE-APP-51 (20/11/2026, testeur de la recette 50, 10:32, ligne M1365) — « Ma place », place de tournoi :
//   1. sur le site, « Payer ma place » (calque flottant) recouvrait la barre du bas : il se pose au-dessus,
//      à la hauteur des autres boutons flottants du site (`getFloatingActionBottomOffset`). Le téléphone ne
//      change pas (l'écran vit hors des onglets, sans barre).
//   2. la place d'une équipe refusée ou retirée (archivée) ne se paie plus (serveur : TOURNAMENT_TEAM_CLOSED) :
//      ni « Payer », ni relance du club, ni « Quelqu'un paie pour moi » ; la phrase de l'équipe fermée.
//      Le statut se lit sur la fiche du tournoi (`useTournamentPlaceClosed`, simulé ici).
// Preuve géométrique du point 1 : web/tests/components/m1365-payer-ma-place.spec.ts.

/** @type {boolean} */
let mockPlaceFermee = false;
jest.mock('../useTournamentTeamName', () => ({
  __esModule: true,
  default: () => '',
  useTournamentPlaceClosed: () => mockPlaceFermee,
}));

/** @type {any} */
let mockMesCotisations;
const mockMutationFigee = { isPending: false, mutate: jest.fn(), mutateAsync: jest.fn() };

jest.mock('@/services/license/licenseQueries', () => ({
  createLicenseCheckout: jest.fn(),
  declareExternalLicensePayment: jest.fn(),
  generateLicenseReceipt: jest.fn(),
  submitLicenseDocument: jest.fn(),
  useLicenseMutation: () => mockMutationFigee,
  useMyLicenseAssignment: () => ({
    data: null, isError: false, isLoading: false, refetch: jest.fn(),
  }),
  useMyLicenses: () => mockMesCotisations,
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
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
jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: { config: jest.fn(), fs: { dirs: { CacheDir: '/cache' }, stat: jest.fn() } },
}));
jest.mock('@/platform/links', () => ({ __esModule: true, default: { openUrl: jest.fn(), openUrlHere: jest.fn() } }));
jest.mock('@/platform/media', () => ({ __esModule: true, default: { pickDocument: jest.fn() } }));
jest.mock('@/platform/media/downloadRemoteFile', () => ({
  __esModule: true,
  downloadRemoteFile: jest.fn(),
}));
jest.mock('@/platform/share', () => ({ __esModule: true, default: { share: jest.fn() } }));
jest.mock('@/utils/mediaUrl', () => ({
  resolveMediaUrl: (/** @type {any} */ url) => (url ? `https://api.test${url}` : ''),
}));

/** @type {any} */
let arbre = null;
afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});
const monter = (/** @type {any} */ a) => {
  mockMesCotisations = {
    data: [a], isError: false, isLoading: false, refetch: jest.fn(),
  };
  act(() => {
    arbre = renderer.create(
      <MyLicenseDetail
        navigation={{ canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() }}
        route={{ params: { assignmentId: 'assign-1' } }}
      />,
    );
  });
  return arbre.root.findAll((/** @type {any} */ n) => n.type === 'Text')
    .map((/** @type {any} */ n) => [].concat(n.props.children).flat(9).join('').replace(/\s/g, ' '));
};


const PLACE = {
  amountDueCents: 2000,
  amountPaidCents: 0,
  amountRemainingCents: 2000,
  campaign: {
    club: { name: 'SIMU — club porteur de test' }, documentId: 'camp', documentRequests: [], name: 'Inscription - Tournoi - 05/12/2026', paymentModes: { stripe: true }, seasonLabel: '2026', status: 'active', targetConfig: { eventId: 'evt-1' }, type: 'tournament',
  },
  club: { name: 'SIMU — club porteur de test' },
  currency: 'EUR',
  documentId: 'assign-1',
  documentSubmissions: [],
  installments: [],
  payments: [],
  receipts: [],
  reminders: [{ amountRequestedCents: 2000, channel: 'push', documentId: 'rel-1', message: 'Il te reste 20,00 € à payer pour ta place dans l’équipe Test ouverte.', sentAt: '2026-11-19T10:00:00.000Z' }],
  securePaymentToken: 'jeton-1',
  status: 'pending',
};
const toutLeTexte = () => JSON.stringify(arbre.toJSON());
const calque = () => arbre.root.findAllByType(WebFloatingOverlay)[0];
const basDuCalque = () => [].concat(calque().props.style).reduce((/** @type {any} */ a, /** @type {any} */ s) => ({ ...a, ...s }), {}).bottom;

const OS_AVANT = Platform.OS;
afterEach(() => { Platform.OS = OS_AVANT; mockPlaceFermee = false; });

describe('M1365 — « Payer ma place » au-dessus de la barre du site', () => {
  test('🔴 site : le calque se pose au-dessus de la barre du bas (au moins 132 px du bord)', () => {
    Platform.OS = 'web';
    monter(PLACE);
    expect(basDuCalque()).toBeGreaterThanOrEqual(132);
  });

  test('téléphone : inchangé, 12 px au-dessus de la zone sûre (pas de barre sur cet écran)', () => {
    Platform.OS = 'ios';
    monter(PLACE);
    expect(basDuCalque()).toBe(12);
  });
});

describe('M1365 bis — la place d’une équipe fermée ne se paie plus', () => {
  test('🔴 équipe refusée ou retirée : ni « Payer », ni relance, ni « Quelqu’un paie pour moi » ; la phrase de l’équipe fermée', () => {
    mockPlaceFermee = true;
    monter(PLACE);
    expect(arbre.root.findAllByType(WebFloatingOverlay)).toHaveLength(0);
    const texte = toutLeTexte();
    expect(texte).toContain('Cette équipe a été refusée ou retirée du tournoi : sa place ne se paie plus.');
    expect(texte).not.toMatch(/Payer|Tu peux payer|Relance du club|Il te reste|Quelqu’un paie pour moi/);
  });

  test('contrôle : équipe ouverte, « Payer ma place » et la relance restent', () => {
    monter(PLACE);
    expect(arbre.root.findAllByType(WebFloatingOverlay)).toHaveLength(1);
    expect(toutLeTexte()).toContain('Relance du club');
  });
});
