import renderer, { act } from 'react-test-renderer';

import AdminClubOnboardingList from '@/views/admin/AdminClubOnboardingList';
import ClubLicenseMemberDetail from '@/views/license/ClubLicenseMemberDetail';

/**
 * LOT NOTIF2 — TEMOIN T3 : LE FILET. VERT AVANT, VERT APRES.
 *
 * 🎯 CE QU IL SURVEILLE, ET POURQUOI IL EST AUSSI IMPORTANT QUE LA CORRECTION.
 * Le lot retire deux donnees personnelles du TEXTE des notifications, parce
 * qu un texte de notification s affiche sur l ECRAN VERROUILLE, lisible sans
 * deverrouiller le telephone :
 *   · le TYPE du document qu un membre envoie (« Certificat medical » — une
 *     donnee de SANTE, affichee chez tous les dirigeants du club) ;
 *   · le TELEPHONE et l E-MAIL du dirigeant qui demande l onboarding d un club.
 *
 * ⚠️ MAIS LA DONNEE NE DOIT PAS DISPARAITRE. Un dirigeant qui ne pourrait plus
 * joindre la personne, ou qui ne saurait plus QUEL document a ete depose, est un
 * defaut PIRE que celui qu on corrige. On DEPLACE la donnee derriere le
 * deverrouillage, on ne la supprime pas.
 *
 * 🧾 CE TEMOIN EST DONC UN FILET, PAS UNE CORRECTION : il doit etre VERT AVANT
 * le lot comme APRES. S il devient rouge, une fonction a ete detruite.
 */

/** @type {any} */
let mockCotisationRequete;
const mockRequeteVide = { data: null, isError: false, isLoading: false };
const mockMutationFigee = { isPending: false, mutate: jest.fn(), mutateAsync: jest.fn() };

/** @type {any} */
let mockOnboardingRequete;

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() }),
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

jest.mock('@/services/admin/adminQueries', () => ({
  useGetPendingClubOnboardingRequests: () => mockOnboardingRequete,
  useProcessAffiliationHelpRequest: () => mockMutationFigee,
  useRefuseAffiliationHelpRequest: () => mockMutationFigee,
}));

jest.mock('@/platform/links', () => ({ __esModule: true, default: { openUrl: jest.fn() } }));
jest.mock('@/platform/media', () => ({ __esModule: true, default: { pickDocument: jest.fn() } }));
jest.mock('@/platform/media/downloadRemoteFile', () => ({
  __esModule: true,
  downloadRemoteFile: jest.fn(),
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

jest.mock('@/components/atoms/button/Button', () => function ButtonMock() {
  return null;
});

const DOCUMENT_SENSIBLE = 'Certificat medical';
const TELEPHONE = '06 12 34 56 78';
const EMAIL = 'tresorier@as-saint-priest.fr';

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
 * Ramasse TOUT le texte reellement rendu par un arbre React.
 *
 * 🪤 `JSON.stringify(arbre.toJSON())` ne convient pas ici : une `FlatList` se
 * refere a elle-meme par `ListEmptyComponent`, ce qui fait une structure
 * circulaire. On parcourt donc l arbre et on ne garde que les chaines.
 * @param {any} noeud un noeud du rendu
 * @returns {string} tout le texte affiche, mis bout a bout
 */
const textesDe = (noeud) => {
  if (noeud === null || noeud === undefined || noeud === false) return '';
  if (typeof noeud === 'string') return noeud;
  if (typeof noeud === 'number') return String(noeud);
  if (Array.isArray(noeud)) return noeud.map(textesDe).join(' ');
  return textesDe(noeud.children);
};

/**
 * Rend un ecran et retourne le texte qu il affiche.
 * @param {any} element l ecran a monter
 * @returns {string} le texte rendu
 */
const rendu = (element) => {
  act(() => { arbre = renderer.create(element); });
  return textesDe(arbre.toJSON());
};

describe('T3 — le type du document reste visible dans l ecran du dirigeant', () => {
  it('la fiche cotisation NOMME le document depose, derriere le deverrouillage', () => {
    mockCotisationRequete = {
      data: {
        amountDueCents: 12000,
        amountPaidCents: 0,
        amountRemainingCents: 12000,
        campaign: {
          documentId: 'camp-NOTIF2',
          documentRequests: [{ documentId: 'req-1', name: DOCUMENT_SENSIBLE, required: true }],
          name: 'Cotisation seniors',
          paymentModes: { cash: true },
        },
        currency: 'EUR',
        documentId: 'assign-NOTIF2',
        documentSubmissions: [{
          documentId: 'sub-1',
          documentRequest: { documentId: 'req-1' },
          file: { url: '/uploads/certificat.pdf' },
          status: 'submitted',
          submittedAt: '2026-08-01',
        }],
        installments: [],
        payments: [],
        receipts: [],
        status: 'pending',
        user: { firstname: 'Robin', lastname: 'Masini' },
      },
      isError: false,
      isLoading: false,
      refetch: jest.fn(),
    };

    const texte = rendu(
      <ClubLicenseMemberDetail
        navigation={{ goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() }}
        route={{
          params: {
            assignmentId: 'assign-NOTIF2',
            campaignId: 'camp-NOTIF2',
            canManageLicenses: true,
            scope: 'manager',
          },
        }}
      />,
    );

    // 🧨 Si ceci devient rouge, la donnee a ete PERDUE et pas deplacee.
    expect(texte).toContain(DOCUMENT_SENSIBLE);
  });
});

describe('T3 — le contact du dirigeant reste visible dans l ecran superadmin', () => {
  it('la liste des onboardings affiche le telephone ET l e-mail', () => {
    mockOnboardingRequete = {
      data: {
        data: [{
          __typeLabel: 'CLUB A ONBOARDER',
          documentId: 'help-1',
          holderEmail: EMAIL,
          holderPhone: TELEPHONE,
          queryLabel: 'AS Saint-Priest',
          requester: { firstname: 'Karim', lastname: 'Benali' },
          requestKind: 'club_creation',
        }],
      },
      error: null,
      isLoading: false,
      refetch: jest.fn(),
    };

    const texte = rendu(<AdminClubOnboardingList />);

    // 🧨 Si ceci devient rouge, le superadmin ne peut plus joindre le dirigeant.
    expect(texte).toContain(TELEPHONE);
    expect(texte).toContain(EMAIL);
    expect(texte).toContain('Dirigeant à contacter');
  });
});
