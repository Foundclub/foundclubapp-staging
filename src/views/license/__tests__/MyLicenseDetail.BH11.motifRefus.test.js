import renderer, { act } from 'react-test-renderer';

import MyLicenseDetail from '../MyLicenseDetail';

/**
 * AA07 / K2 — LES PIECES ET LA LICENCE, DANS LE NOUVEAU DETAIL.
 * Reecrit pour S9, vague S, sous l architecture A.
 *
 * 🗣️ Adel, recette du 2026-08-20 (son point D-21) : « le depot marche. Mais les
 * boutons voir / valider / remplacer ne sont ni clairs ni comprehensibles, et
 * ils rendent une erreur quand on appuie dessus — sauf "ouvrir" ». Et : « on
 * doit pouvoir TELECHARGER le document ».
 *
 * 🔁 CE QUI A CHANGE : la section « Documents a fournir » et la section « Ma
 * licence » fusionnent en UN bloc « Mon dossier », et les gestes passent de
 * boutons pleine largeur a des cibles de 44 px sur la ligne. Le pack le
 * demande — mais LES TROIS GARANTIES, ELLES, NE BOUGENT PAS :
 *
 *   1. 🧨 LE BOUTON QUI SE CONTREDIT — « ma licence » s affichait sur
 *      `officialLicenseDocument.file.url` mais AGISSAIT sur
 *      `officialLicenseDocument.SUBMISSION.file.url`. Deux chemins pour un seul
 *      bouton : des que le serveur remplit l un sans l autre, le bouton
 *      apparait et repond « Document indisponible ».
 *   2. 🚫 LE TELECHARGEMENT — il POSE le fichier dans le telephone, la ou
 *      « ouvrir » se contente de l AFFICHER. Deux gestes, deux libelles.
 *   3. 🔒 AUCUN BOUTON SANS FICHIER — reparer la contradiction ne doit pas
 *      faire apparaitre un geste la ou il n y a rien a ouvrir.
 */

/** @type {any} */
let mockMesCotisations;
const mockOuvrirUrl = jest.fn();
const mockTelecharger = jest.fn(() => Promise.resolve({ opened: true, outcome: 'downloads' }));
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

// S9-bis — `MemberTopBar` reutilise desormais `HeaderBackButton`, le composant
// de retour des 65 autres ecrans. Il appelle `useNavigation()` en interne (pour
// pouvoir se passer d un `onPress`), ce qui exige un navigateur autour. C est le
// meme mock que les suites qui montent deja cet entete (AttendanceSheets,
// DetectionRotationBoard...).
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

jest.mock('@/components/molecules/bottomModal/BottomModal', () => function ModalMock(
  /** @type {any} */ { children },
) {
  return children;
});

// AA07 / K2 — le telechargement natif charge `react-native-blob-util`, absent
// des `transformIgnorePatterns` du projet : chaque suite qui l atteint le mocke
// elle-meme, comme les 9 qui le faisaient deja.
jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: { config: jest.fn(), fs: { dirs: { CacheDir: '/cache' }, stat: jest.fn() } },
}));

jest.mock('@/platform/links', () => ({
  __esModule: true,
  default: { openUrl: (/** @type {any} */ ...args) => mockOuvrirUrl(...args) },
}));
jest.mock('@/platform/media', () => ({ __esModule: true, default: { pickDocument: jest.fn() } }));
jest.mock('@/platform/media/downloadRemoteFile', () => ({
  __esModule: true,
  downloadRemoteFile: (/** @type {any} */ ...args) => mockTelecharger(...args),
}));
jest.mock('@/platform/share', () => ({ __esModule: true, default: { share: jest.fn() } }));

jest.mock('@/utils/mediaUrl', () => ({
  resolveMediaUrl: (/** @type {any} */ url) => (url ? `https://api.test${url}` : ''),
}));

const DEMANDE = {
  documentId: 'req-1',
  name: 'Certificat medical',
  required: true,
  templateFile: { url: '/uploads/modele-certificat.pdf' },
};

const DEPOT = {
  documentId: 'sub-1',
  documentRequest: { documentId: 'req-1' },
  file: { url: '/uploads/mon-certificat.pdf' },
  status: 'submitted',
  submittedAt: '2026-08-01',
};

/**
 * Construit une cotisation, en laissant le test choisir la forme exacte de la
 * licence officielle — c est cette forme qui revele le defaut n°1.
 * @param {any} officialLicenseDocument la licence telle que le serveur la rend
 * @returns {any} une affectation de cotisation complete
 */
const cotisation = (officialLicenseDocument = null) => ({
  amountDueCents: 18000,
  amountPaidCents: 0,
  amountRemainingCents: 18000,
  campaign: {
    club: { name: 'FC Nord' },
    documentId: 'camp-1',
    documentRequests: [DEMANDE],
    name: 'Cotisation 2026',
    paymentModes: {},
    seasonLabel: '2026-2027',
    status: 'active',
  },
  club: { name: 'FC Nord' },
  currency: 'EUR',
  documentId: 'assign-1',
  documentSubmissions: [DEPOT],
  installments: [],
  officialLicenseDocument,
  payments: [],
  receipts: [],
  status: 'pending',
});

/** @type {any} */
let arbre = null;

afterEach(() => {
  if (arbre) {
    act(() => arbre.unmount());
    arbre = null;
  }
  jest.clearAllMocks();
});

/**
 * Monte le detail sur une cotisation donnee.
 * @param {any} affectation la cotisation a afficher
 * @returns {void}
 */
const monter = (affectation) => {
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

// BH11 (BUGHUNT 24/10) P5-16 — banc copie de MyLicenseDetail.AA07.documents.test.js.
// Un depot VALIDE (ou renvoye apres un refus) ne s affiche plus avec l ancien motif.
describe('BH11 P5-16 — le motif de refus ne suit que le refus', () => {
  const texte = () => JSON.stringify(arbre.toJSON());

  test('un dépôt validé n affiche pas l ancien motif', () => {
    const c = cotisation();
    c.documentSubmissions = [{ ...DEPOT, refusalReason: 'Photo floue', status: 'validated' }];
    monter(c);
    expect(texte()).not.toContain('Photo floue');
  });

  test('un dépôt à remplacer affiche son motif', () => {
    const c = cotisation();
    c.documentSubmissions = [{ ...DEPOT, refusalReason: 'Photo floue', status: 'to_replace' }];
    monter(c);
    expect(texte()).toContain('Photo floue');
  });
});
