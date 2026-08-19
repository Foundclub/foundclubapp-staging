import renderer, { act } from 'react-test-renderer';

import ClubLicenseMemberDetail from '../ClubLicenseMemberDetail';

// W02 (E6) — « LE DIRIGEANT DOIT POUVOIR LAISSER LE CHOIX AUX COACHS DE POUVOIR
// VALIDER LES PAIEMENTS POUR LEURS EQUIPES » (Adel, 2026-08-19).
//
// + LA FINITION DEMANDEE DANS LE MEME SOUFFLE : « sur les fiches joueurs, ou tu
// vois Relancer, il faut aussi le bouton pour dire "a paye" » — renomme et
// remonte a cote de « Relancer », la ou Adel l a cherche deux fois.
//
// CE QUE CE FICHIER MESURE, ET CE QU IL NE MESURE PAS :
//   - il mesure l ECRAN : quels boutons apparaissent, pour qui, dans quel ordre ;
//   - il ne mesure PAS la barriere. Une barriere qui n existe que dans l app n en
//     est pas une : le refus vit dans le service licence
//     (admin/tests/authz/license-payment-validation-delegation.test.js).
//   ⇒ l ecran ne DECIDE rien, il OBEIT au verdict que le serveur pose sur la
//     fiche (`assignment.canValidatePayments`).
//
// LE PIEGE DE LIBELLE, MESURE ICI : la fiche porte deja « À payer » (T03, le
// miroir d « Exempter »). « A payé » et « À payer » cote a cote se confondraient.
// Ils sont donc MUTUELLEMENT EXCLUSIFS a l ecran — « À payer » ne sort que sur une
// cotisation exemptee, « A payé » jamais sur une exemptee — et le dernier temoin
// le fige.

/** @type {any[]} */
const mockBoutons = [];
const mockRequeteVide = { data: null, isError: false, isLoading: false };
const mockInsetsFiges = {
  bottom: 0, left: 0, right: 0, top: 0,
};
/** @type {any} */
let mockCotisationRequete;

const mockMutationFigee = {
  isPending: false,
  mutate: jest.fn(),
  mutateAsync: jest.fn(),
};

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsetsFiges,
}));

// Le VRAI theme, sans le contexte React qui le porte. Un mock en Proxy rend les
// echecs Jest illisibles (constat du lot paywall, 2026-08-02).
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

// Jamais `requireActual` sur un service : le client HTTP refuse de se charger
// sans `API_URL` et fait tomber la suite AVANT le premier rendu.
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
jest.mock('@/utils/mediaUrl', () => ({ resolveMediaUrl: (/** @type {string} */ url) => url }));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) {
    return children;
  },
);

jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function BottomModalMock({ children }) {
    return children;
  },
);

jest.mock('@/components/atoms/button/Button', () => function ButtonMock(/** @type {any} */ props) {
  mockBoutons.push(props);
  return null;
});

/**
 * Une cotisation de fiche joueur.
 * @param {any} [extra] - Champs a surcharger.
 * @returns {any} La cotisation.
 */
const cotisation = (extra = {}) => ({
  amountDueCents: 12000,
  amountPaidCents: 0,
  amountRemainingCents: 12000,
  campaign: {
    documentId: 'camp-W02', documentRequests: [], name: 'Cotisation seniors', paymentModes: { cash: true },
  },
  currency: 'EUR',
  documentId: 'assign-W02',
  documentSubmissions: [],
  installments: [],
  payments: [],
  receipts: [],
  status: 'pending',
  user: { firstname: 'Ana', lastname: 'Diaz' },
  ...extra,
});

/** @type {any} */
let arbreCourant = null;

/**
 * Monte la fiche joueur pour un profil donne.
 * @param {any} donnees - La cotisation affichee.
 * @param {any} params - Les parametres de route (scope, canManageLicenses).
 * @returns {any[]} Les props des boutons rendus.
 */
const monterLaFiche = (donnees, params) => {
  mockCotisationRequete = {
    data: donnees, isError: false, isLoading: false, refetch: jest.fn(),
  };
  mockBoutons.length = 0;

  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <ClubLicenseMemberDetail
        navigation={{ goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() }}
        route={{ params: { assignmentId: 'assign-W02', campaignId: 'camp-W02', ...params } }}
      />,
    );
  });
  arbreCourant = arbre;
  return mockBoutons;
};

const EN_DIRIGEANT = { canManageLicenses: true, scope: 'manager' };
const EN_COACH = { canManageLicenses: false, scope: 'coach' };

/**
 * @param {any[]} boutons - Les props de boutons recoltees.
 * @returns {string[]} Les intitules, dans l ordre d apparition.
 */
const intitules = (boutons) => boutons.map((props) => props.title).filter(Boolean);

describe('W02 — « A payé » et la delegation aux coachs', () => {
  beforeEach(() => {
    mockBoutons.length = 0;
    mockMutationFigee.mutate.mockClear();
  });

  afterEach(() => {
    if (!arbreCourant) return;
    act(() => arbreCourant.unmount());
    arbreCourant = null;
  });

  it('temoin 7a — le bouton s appelle « A payé », plus « Valider un paiement »', () => {
    const titres = intitules(monterLaFiche(cotisation(), EN_DIRIGEANT));

    expect(titres).toContain('A payé');
    expect(titres).not.toContain('Valider un paiement');
  });

  it('temoin 7b — « A payé » se trouve JUSTE a cote de « Relancer »', () => {
    const titres = intitules(monterLaFiche(cotisation(), EN_DIRIGEANT));

    expect(titres.indexOf('A payé')).toBe(titres.indexOf('Relancer') + 1);
  });

  it('temoin 7c — les deux libelles proches ne sont JAMAIS a l ecran en meme temps', () => {
    // « À payer » (annuler une exemption) et « A payé » (encaisser) se
    // confondraient cote a cote. Ils vivent sur des statuts opposes.
    const surExemptee = intitules(monterLaFiche(
      cotisation({ amountRemainingCents: 0, status: 'waived', waiveReason: 'Bourse municipale' }),
      EN_DIRIGEANT,
    ));
    expect(surExemptee).toContain('À payer');
    expect(surExemptee).not.toContain('A payé');

    act(() => arbreCourant.unmount());
    arbreCourant = null;

    const surDue = intitules(monterLaFiche(cotisation(), EN_DIRIGEANT));
    expect(surDue).toContain('A payé');
    expect(surDue).not.toContain('À payer');
  });

  it('temoin 2 (ecran) — un coach a qui le serveur accorde le droit voit « A payé »', () => {
    const titres = intitules(monterLaFiche(cotisation({ canValidatePayments: true }), EN_COACH));

    expect(titres).toContain('A payé');
  });

  it('temoin 4 (ecran) — un coach SANS delegation ne voit pas « A payé »', () => {
    const titres = intitules(monterLaFiche(cotisation({ canValidatePayments: false }), EN_COACH));

    expect(titres).not.toContain('A payé');
    // Il garde ce qu il avait deja : relancer.
    expect(titres).toContain('Relancer');
  });

  it('temoin 4b (ecran) — une fiche muette (vieux serveur) ne donne rien au coach', () => {
    // Fail-closed : tant que le serveur ne dit pas oui, l app dit non.
    const titres = intitules(monterLaFiche(cotisation(), EN_COACH));

    expect(titres).not.toContain('A payé');
  });

  it('temoin 3 (ecran) — la delegation ne donne QUE l encaissement, rien d autre', () => {
    // La caisse, oui. Le montant du a payer et l exemption, non : ce sont des
    // decisions de club, et le serveur les refuse au coach.
    const titres = intitules(monterLaFiche(cotisation({ canValidatePayments: true }), EN_COACH));

    expect(titres).not.toContain('Modifier le montant');
    expect(titres).not.toContain('Exempter la cotisation');
  });

  it('temoin 5 (ecran) — le dirigeant garde tous ses boutons (non-regression)', () => {
    const titres = intitules(monterLaFiche(cotisation(), EN_DIRIGEANT));

    expect(titres).toEqual(expect.arrayContaining([
      'Relancer', 'A payé', 'Modifier le montant', 'Exempter la cotisation',
    ]));
  });
});

// Y06 — LA LISTE OUVRE CETTE FENETRE-CI, elle n en recopie pas une seconde.
// La carte d un membre porte desormais « A payé » (`ClubLicenses.js`) ; elle
// emmene ici avec `openPaymentModal`. C est le seul formulaire d encaissement
// du depot — deux formulaires pour le meme geste d argent, ce sont deux verites
// qui divergent.
describe('Y06 — arriver depuis la liste avec la fenetre d encaissement ouverte', () => {
  beforeEach(() => {
    mockBoutons.length = 0;
  });

  afterEach(() => {
    if (!arbreCourant) return;
    act(() => arbreCourant.unmount());
    arbreCourant = null;
  });

  it('temoin 1c — le parametre ouvre la fenetre sans un appui de plus', () => {
    const titres = intitules(monterLaFiche(
      cotisation(),
      { ...EN_DIRIGEANT, openPaymentModal: true },
    ));

    // Les deux boutons de la fenetre : elle est bien montee.
    expect(titres).toContain('Annuler');
    expect(titres).toContain('Valider');
  });

  it('sans le parametre, aucune fenetre ne s ouvre toute seule', () => {
    const titres = intitules(monterLaFiche(cotisation(), EN_DIRIGEANT));

    expect(titres).not.toContain('Annuler');
  });

  it('🔒 temoin 2c — un coach SANS delegation n ouvre rien, meme avec le parametre', () => {
    // 💰 Fail-closed : le parametre de navigation ne donne AUCUN droit. Le rendu
    // de la fenetre reste garde par le verdict du serveur.
    const titres = intitules(monterLaFiche(
      cotisation({ canValidatePayments: false }),
      { ...EN_COACH, openPaymentModal: true },
    ));

    expect(titres).not.toContain('Annuler');
    expect(titres).not.toContain('A payé');
  });
});
