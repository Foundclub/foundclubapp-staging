/* eslint-disable max-len -- données de témoin sur une ligne, comme PublicLicensePayment.T-PARENT.test.js */
// I18N-1 : le vrai i18next en français (fr.js + replis), comme les témoins voisins de l'écran.
import '@/theme/strings';

import renderer, { act } from 'react-test-renderer';

import Button from '@/components/atoms/button/Button';

import { createLicenseCheckout } from '@/services/license/licenseQueries';

import MyLicenseDetail from '../MyLicenseDetail';

/**
 * T-TAILLE (16/11) — CARACTÉRISANT : « Mes licences » → détail d'une PLACE DE TOURNOI.
 *
 * Question du chef du tournoi : ce détail peut-il payer une place sans passer par la page web,
 * celle qui demande la taille du maillot ? Réponse du code, verrouillée ici : NON.
 * La campagne d'un tournoi n'active que Stripe (admin `tournament-payment.js`, `ensureCampaign`),
 * et cet écran ne paie jamais par Stripe (`normalizePaymentModes` : `stripe: false` ; seuls HelloAsso et le lien du
 * club). Donc aucun bouton « Payer » ni « J'ai payé hors app », et aucun appel à la route connectée.
 * Une licence ordinaire garde son bouton « Payer » (témoin de contrôle).
 * Si ce témoin rougit (Stripe ajouté à cet écran), le sélecteur de maillot doit y venir aussi.
 *
 * T-PAGES-A, point 3 (17/11, impasse vue par le testeur) — la place de tournoi a maintenant SON bouton
 * « Payer ma place » : il ouvre la page de paiement publique (`/licenses/pay/<jeton>`, celle de « Payer ma
 * place » sur la page d'équipe, avec le maillot et l'autorisation parentale), dans le même onglet sur le
 * site. Toujours aucun paiement connecté (Stripe) depuis cet écran, ni « J'ai payé hors app ».
 * Ancienne assertion : « ni Payer, ni hors app » ; nouvelle : « Payer ma place » seul, vers la page publique.
 */

/** @type {any} */
let mockMesCotisations;
const mockMutationFigee = { isPending: false, mutate: jest.fn(), mutateAsync: jest.fn() };

// RECOLTE-APP-51 (M1365 bis) : l équipe de la place se lit sur la fiche du tournoi (react-query + compte
// connecté) ; ici, une place qui se paie (comportement d avant).
jest.mock('../useTournamentTeamName', () => ({
  __esModule: true,
  default: () => '',
  useTournamentPlaceClosed: () => false,
}));
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

const mockNavigationContexte = { goBack: jest.fn(), navigate: jest.fn() };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigationContexte,
}));

// S9-ter — le bouton flottant lit le retrait bas systeme. Meme mock que les
// suites qui montent deja un calque (ClubDetails.AB05, ClubDetails.V01...).
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

// ⚠️ MESURE : la feuille du menu ⋯ n est PAS montee tant qu on n a pas appuye
// dessus (`{menuVisible ? <BottomModal…`). Un temoin qui cherche « paie pour
// moi » dans l arbre au repos passerait donc au vert POUR LA MAUVAISE RAISON —
// il verrait une absence, pas un retrait. Le temoin OUVRE donc le menu.
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

const place = (modes, type) => ({
  amountDueCents: 2000,
  amountPaidCents: 0,
  amountRemainingCents: 2000,
  campaign: {
    club: { name: 'FoundClub x AR Soccer' },
    documentId: 'camp-tournoi',
    documentRequests: [],
    name: 'Tournoi FoundClub x AR Soccer',
    paymentModes: modes,
    seasonLabel: '2026',
    status: 'active',
    type,
  },
  club: { name: 'FoundClub x AR Soccer' },
  currency: 'EUR',
  documentId: 'assign-1',
  documentSubmissions: [],
  installments: [],
  payments: [],
  receipts: [],
  securePaymentToken: 'jeton-de-test',
  status: 'pending',
});
const MODES_DU_TOURNOI = {
  bank_transfer: false, card_physical: false, cash: false, check: false, custom: false, external_link: false, helloasso: false, stripe: true,
};

/** @type {any} */
let arbre = null;
afterEach(() => {
  if (arbre) {
    act(() => arbre.unmount());
    arbre = null;
  }
  jest.clearAllMocks();
});
const monter = (/** @type {any} */ affectation) => {
  mockMesCotisations = {
    data: [affectation], isError: false, isLoading: false, refetch: jest.fn(),
  };
  act(() => {
    arbre = renderer.create(
      <MyLicenseDetail
        navigation={{ canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() }}
        route={{ params: { assignmentId: 'assign-1' } }}
      />,
    );
  });
};
const titres = () => arbre.root.findAllByType(Button).map((/** @type {any} */ b) => String(b.props.title));

describe('T-TAILLE — « Mes licences » ne paie pas une place de tournoi', () => {
  it('🔴 place de tournoi (Stripe seul) : « Payer ma place » ouvre la page publique, ni « hors app » ni paiement connecté', async () => {
    monter(place(MODES_DU_TOURNOI, 'tournament'));
    expect(titres().filter((titre) => /Payer|hors app/.test(titre))).toEqual(['Payer ma place']);
    const [payer] = arbre.root.findAllByType(Button).filter((/** @type {any} */ b) => b.props.title === 'Payer ma place');
    await act(async () => { await payer.props.onPress(); });
    const liens = jest.requireMock('@/platform/links').default;
    expect(liens.openUrlHere).toHaveBeenCalledWith(expect.stringMatching(/\/licenses\/pay\/jeton-de-test$/));
    expect(createLicenseCheckout).not.toHaveBeenCalled();
  });

  it('contrôle : une licence avec HelloAsso garde son bouton « Payer »', () => {
    monter(place({ helloasso: true }, 'license'));
    expect(titres().some((titre) => /Payer/.test(titre))).toBe(true);
  });
});
