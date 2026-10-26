import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AdminPopupCampaignDetail from '../AdminPopupCampaignDetail';

/**
 * C10 / P9-21 — fiche d une campagne de popup du SuperAdmin.
 *
 * LE SYMPTOME : « Publier » (la popup part chez les utilisateurs) et « Archiver »
 * (definitif) partaient en un appui. LE CONTRAT : les deux demandent une
 * confirmation ; rien ne part avant le bouton de confirmation. « Dupliquer »
 * (un brouillon neuf) reste en un appui.
 */

const mockPublier = jest.fn(() => Promise.resolve({}));
const mockArchiver = jest.fn(() => Promise.resolve({}));
const mockDupliquer = jest.fn(() => Promise.resolve({}));
/** @type {string} */
let mockStatut = 'draft';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useRoute: () => ({ params: { campaignId: 'camp-1' } }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
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
      Spaces: espaces,
    }),
  };
});

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock(
  '@/components/organisms/popup/GlobalPromptModal',
  () => function GlobalPromptModalMock() { return null; },
);
jest.mock(
  '@/views/admin/components/AdminStateView',
  () => function AdminStateViewMock() { return null; },
);
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress, testID: `bouton-${props.title}` },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

jest.mock('@/services/inAppPopupCampaign/inAppPopupCampaignQueries', () => {
  // Les doubles sont lus A L APPEL : la fabrique tourne avant l initialisation des `const`.
  const mutation = (/** @type {() => any} */ lire) => () => ({
    isPending: false,
    mutateAsync: (/** @type {any[]} */ ...args) => lire()(...args),
  });
  return {
    useArchiveInAppPopupCampaign: mutation(() => mockArchiver),
    useDuplicateInAppPopupCampaign: mutation(() => mockDupliquer),
    useGetInAppPopupCampaign: () => ({
      data: {
        data: {
          actions: [], documentId: 'camp-1', name: 'Rentrée', status: mockStatut, title: 'Titre',
        },
      },
      error: null,
      isLoading: false,
      refetch: jest.fn(),
    }),
    useGetInAppPopupCampaignStats: () => ({
      data: undefined, error: null, isLoading: false, refetch: jest.fn(),
    }),
    usePauseInAppPopupCampaign: mutation(() => () => Promise.resolve({})),
    usePublishInAppPopupCampaign: mutation(() => mockPublier),
  };
});

jest.mock('@/utils/mediaUrl', () => ({ resolveMediaUrl: () => null }));
jest.mock('@/utils/errors/displayError', () => ({ getErrorMessage: () => 'erreur' }));

/** @type {any} */
let alerte;
/** @type {any[]} */
const arbres = [];

beforeEach(() => {
  mockStatut = 'draft';
  mockPublier.mockClear();
  mockArchiver.mockClear();
  mockDupliquer.mockClear();
  alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  alerte.mockRestore();
  while (arbres.length) {
    const arbre = arbres.pop();
    act(() => { arbre.unmount(); });
  }
});

/**
 * Monte la fiche et appuie sur le bouton nomme.
 * @param {string} titre - Le titre du bouton.
 * @returns {Promise<void>} Fini quand l appui est traite.
 */
const appuyer = async (titre) => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(<AdminPopupCampaignDetail />); });
  arbres.push(arbre);
  await act(async () => { arbre.root.findByProps({ testID: `bouton-${titre}` }).props.onPress(); });
};

/**
 * Appuie sur le bouton de confirmation de la derniere alerte.
 * @returns {Promise<void>} Fini quand l action est partie.
 */
const confirmer = async () => {
  const boutons = alerte.mock.calls.at(-1)[2];
  expect(boutons.find((/** @type {any} */ b) => b.style === 'cancel')).toBeTruthy();
  await act(async () => {
    boutons.find((/** @type {any} */ b) => b.style !== 'cancel').onPress();
  });
};

test('P9-21/1 — Publier : rien ne part sans confirmation, puis la campagne part', async () => {
  await appuyer('Publier');

  expect(mockPublier).not.toHaveBeenCalled();
  expect(alerte).toHaveBeenCalledTimes(1);
  await confirmer();
  expect(mockPublier).toHaveBeenCalledWith({ documentId: 'camp-1' });
});

test('P9-21/2 — Archiver : rien sans confirmation, qui dit que c est definitif', async () => {
  mockStatut = 'live';
  await appuyer('Archiver');

  expect(mockArchiver).not.toHaveBeenCalled();
  expect(String(alerte.mock.calls[0][1])).toMatch(/définitif/);
  await confirmer();
  expect(mockArchiver).toHaveBeenCalledWith({ documentId: 'camp-1' });
});

test('P9-21/3 — Dupliquer reste en un appui', async () => {
  await appuyer('Dupliquer');

  expect(alerte).not.toHaveBeenCalled();
  expect(mockDupliquer).toHaveBeenCalledTimes(1);
});
