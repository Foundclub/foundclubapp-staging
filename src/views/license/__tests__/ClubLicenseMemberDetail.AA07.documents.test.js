import renderer, { act } from 'react-test-renderer';

import ClubLicenseMemberDetail from '../ClubLicenseMemberDetail';

/**
 * AA07 / K2 — LES BOUTONS DU DOCUMENT, COTE CLUB.
 *
 * 🗣️ Adel, recette du 2026-08-20 (son point D-21) : « le depot marche. Mais les
 * boutons voir / valider / remplacer ne sont ni clairs ni comprehensibles, et
 * ils rendent une erreur quand on appuie dessus — sauf "ouvrir" ».
 *
 * 🎯 C EST CET ECRAN QU IL DECRIT : c est le seul des deux qui porte a la fois
 * « Voir la licence », « Valider », « A remplacer » ET un « Ouvrir le document »
 * qui, lui, marchait. Les trois qui echouaient ont un point commun que le
 * quatrieme n a pas : ils PARLENT AU SERVEUR, ou ils lisent le fichier par un
 * chemin different de celui qui les affiche.
 *
 * 🔬 LES DEUX CAUSES MESUREES DANS LE CODE :
 *
 * 1. 🧨 LE MOTIF « OBLIGATOIRE » QUI NE L ETAIT PAS — le serveur refuse une
 *    demande de remplacement sans motif (`admin/.../license.ts:2970` :
 *    « reason is required »). L ecran affichait bien l invite « Motif
 *    obligatoire », mais laissait valider a vide. Le geste partait, le serveur
 *    le rejetait, et l alerte GENERIQUE du client (`App.js:onMutationError`)
 *    disait « une erreur » sans jamais dire laquelle.
 *
 * 2. 🧨 LE BOUTON QUI SE CONTREDIT — « Voir la licence » s affichait sur
 *    `officialLicenseDocument.file.url` et agissait sur
 *    `officialLicenseDocument.SUBMISSION.file.url`.
 *
 * ⛔ CE QUE CE TEMOIN NE PROUVE PAS : qu il n existe AUCUNE autre cause serveur
 * (un 403 de permission, par exemple). Reproduire cela demande un vrai appel —
 * c est dit en clair dans le compte rendu, pas masque par un test vert.
 */

/** @type {any[]} */
const mockBoutons = [];
/** @type {any} */
let mockCotisationRequete;
const mockRequeteVide = { data: null, isError: false, isLoading: false };
const mockTelecharger = jest.fn(() => Promise.resolve({ opened: true, outcome: 'downloads' }));
const mockMutationFigee = { isPending: false, mutate: jest.fn(), mutateAsync: jest.fn() };

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

jest.mock('@/services/license/licenseQueries', () => ({
  addManualLicensePayment: jest.fn(),
  approveExternalLicensePayment: jest.fn(),
  generateLicenseReceipt: jest.fn(),
  refundLicensePayment: jest.fn(),
  rejectExternalLicensePayment: jest.fn(),
  reviewLicenseDocument: jest.fn(),
  sendLicenseReminder: jest.fn(),
  unwaiveLicenseAssignment: jest.fn(),
  updateLicenseAssignmentAmount: jest.fn(),
  uploadOfficialLicenseDocument: jest.fn(),
  useLicenseAssignment: () => mockCotisationRequete,
  useLicenseDashboard: () => mockRequeteVide,
  useLicenseMutation: () => mockMutationFigee,
  waiveLicenseAssignment: jest.fn(),
}));

jest.mock('@/platform/links', () => ({ __esModule: true, default: { openUrl: jest.fn() } }));
jest.mock('@/platform/media', () => ({ __esModule: true, default: { pickDocument: jest.fn() } }));
jest.mock('@/platform/media/downloadRemoteFile', () => ({
  __esModule: true,
  downloadRemoteFile: (/** @type {any} */ ...args) => mockTelecharger(...args),
}));
jest.mock('@/utils/mediaUrl', () => ({ resolveMediaUrl: (/** @type {string} */ url) => url }));

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

const DEMANDE = { documentId: 'req-1', name: 'Certificat medical', required: true };
const DEPOT = {
  documentId: 'sub-1',
  documentRequest: { documentId: 'req-1' },
  file: { url: '/uploads/certificat.pdf' },
  status: 'submitted',
  submittedAt: '2026-08-01',
};

/**
 * Une cotisation de fiche joueur, avec une piece deposee.
 * @param {any} [extra] champs a surcharger
 * @returns {any} la cotisation
 */
const cotisation = (extra = {}) => ({
  amountDueCents: 12000,
  amountPaidCents: 0,
  amountRemainingCents: 12000,
  campaign: {
    documentId: 'camp-AA07',
    documentRequests: [DEMANDE],
    name: 'Cotisation seniors',
    paymentModes: { cash: true },
  },
  currency: 'EUR',
  documentId: 'assign-AA07',
  documentSubmissions: [DEPOT],
  installments: [],
  payments: [],
  receipts: [],
  status: 'pending',
  user: { firstname: 'Ana', lastname: 'Diaz' },
  ...extra,
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
 * Monte la fiche en dirigeant.
 * @param {any} donnees la cotisation affichee
 * @returns {any[]} les props des boutons rendus
 */
const monter = (donnees) => {
  mockBoutons.length = 0;
  mockCotisationRequete = {
    data: donnees, isError: false, isLoading: false, refetch: jest.fn(),
  };
  act(() => {
    arbre = renderer.create(
      <ClubLicenseMemberDetail
        navigation={{ goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() }}
        route={{
          params: {
            assignmentId: 'assign-AA07',
            campaignId: 'camp-AA07',
            canManageLicenses: true,
            scope: 'manager',
          },
        }}
      />,
    );
  });
  return mockBoutons;
};

/**
 * @param {string} morceau texte cherche dans le titre
 * @returns {any} le bouton correspondant
 */
const bouton = (morceau) => mockBoutons.find(
  (item) => String(item?.title || '').toLowerCase().includes(morceau.toLowerCase()),
);

describe('AA07 / K2 — cote club : des boutons qui disent ce qu ils font', () => {
  it('« Valider » ne se confond plus avec le « Valider » des paiements', () => {
    monter(cotisation());

    // 📛 AVANT : deux boutons « Valider » sur le MEME ecran — un pour le
    // paiement, un pour le document. Adel : « ni clairs ni comprehensibles ».
    expect(bouton('Accepter ce document')).toBeTruthy();
    expect(bouton('Demander un remplacement')).toBeTruthy();
  });

  it('le document depose peut etre TELECHARGE, pas seulement ouvert', async () => {
    monter(cotisation());

    expect(bouton('Ouvrir le document')).toBeTruthy();
    const telechargement = bouton('Télécharger');
    expect(telechargement).toBeTruthy();

    await act(async () => { await telechargement.onPress(); });
    expect(mockTelecharger).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/uploads/certificat.pdf' }),
    );
  });

  it('« la licence » s ouvre meme quand le serveur ne remplit que `file`', async () => {
    const ouvrirUrl = require('@/platform/links').default.openUrl;
    monter(cotisation({
      officialLicenseDocument: {
        file: { url: '/uploads/licence.pdf' },
        request: { name: 'Licence officielle' },
        submission: { documentId: 'sub-lic', status: 'validated' },
      },
    }));

    const voir = bouton('Ouvrir la licence');
    expect(voir).toBeTruthy();

    await act(async () => { await voir.onPress(); });
    expect(ouvrirUrl).toHaveBeenCalledWith('/uploads/licence.pdf');
  });
});

describe('AA07 / K2 — le motif « obligatoire » l est vraiment', () => {
  it('une demande de remplacement SANS motif ne part pas au serveur', () => {
    monter(cotisation());

    act(() => { bouton('Demander un remplacement').onPress(); });
    const valider = mockBoutons.filter((item) => item?.title === 'Valider').pop();
    expect(valider).toBeTruthy();

    mockMutationFigee.mutate.mockClear();
    act(() => { valider.onPress(); });

    // 🧨 AVANT : le geste partait a vide, le serveur repondait
    // « reason is required », et l ecran affichait « une erreur ».
    expect(mockMutationFigee.mutate).not.toHaveBeenCalled();
  });

  it('le refus DIT ce qui manque, au lieu de se taire', () => {
    monter(cotisation());
    act(() => { bouton('Demander un remplacement').onPress(); });
    const valider = mockBoutons.filter((item) => item?.title === 'Valider').pop();
    act(() => { valider.onPress(); });

    expect(JSON.stringify(arbre.toJSON())).toContain('le membre recevra ce motif');
  });
});
