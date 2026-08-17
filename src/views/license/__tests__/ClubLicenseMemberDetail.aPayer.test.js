import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubLicenseMemberDetail from '../ClubLicenseMemberDetail';

// T03 (E6) — « SUR LES FICHES JOUEURS, OU TU VOIS "RELANCER", IL FAUT AUSSI LE
// BOUTON POUR DIRE "A PAYER" » (Adel, recette du 2026-08-17).
//
// ⚠️ CE FICHIER N AVAIT AUCUN TEST : le filet caracterisant vient donc avec le
// geste (E6).
//
// 🔬 CE QUE LA MESURE A TROUVE COTE SERVEUR, et ca change ce que le bouton doit
// faire : l action n existait pas, et « exempter » etait une PORTE A SENS
// UNIQUE. `status()` (admin, license.ts:811) rend `waived` tel quel avant tout
// calcul, et c est lui que `updateAssignmentAmount` comme `recalc` appellent.
// Une cotisation exemptee ne pouvait donc plus redevenir due par AUCUN chemin :
// ni « Modifier le montant », ni un encaissement.
// ⇒ « A payer » est le MIROIR d « Exempter la cotisation », et il s appuie sur
//   une action serveur neuve (POST /licenses/assignments/:id/unwaive).
//
// ⛔ AUCUN BOUTON INERTE : il n apparait que quand il a quelque chose a faire,
// c est-a-dire sur une cotisation exemptee. Ailleurs, remettre « a payer »
// n aurait aucun sens — et le serveur refuserait.
//
// Point d observation : les boutons rendus, et ce qui part vers le serveur.

/** @type {any[]} */
const mockBoutons = [];
/** @type {any[]} */
const mockEnvois = [];
const mockRequeteVide = { data: null, isError: false, isLoading: false };
const mockInsetsFiges = {
  bottom: 0, left: 0, right: 0, top: 0,
};
/** @type {any} */
let mockCotisationRequete;
/** @type {any} */
let mockDerniereFonctionDeMutation = null;

const mockMutationFigee = {
  isPending: false,
  mutate: jest.fn((variables, options) => {
    mockEnvois.push({ options, variables });
  }),
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

// ⛔ Jamais `requireActual` sur un service : le client HTTP refuse de se charger
// sans `API_URL` et fait tomber la suite AVANT le premier rendu.
jest.mock('@/services/license/licenseQueries', () => ({
  addManualLicensePayment: jest.fn(),
  approveExternalLicensePayment: jest.fn(),
  generateLicenseReceipt: jest.fn(),
  refundLicensePayment: jest.fn(),
  rejectExternalLicensePayment: jest.fn(),
  reviewLicenseDocument: jest.fn(),
  sendLicenseReminder: jest.fn(),
  unwaiveLicenseAssignment: jest.fn(async () => ({ status: 'pending' })),
  updateLicenseAssignmentAmount: jest.fn(),
  uploadOfficialLicenseDocument: jest.fn(),
  useLicenseAssignment: () => mockCotisationRequete,
  useLicenseDashboard: () => mockRequeteVide,
  /**
   * Retient la DERNIERE fonction confiee : c est elle qui dit a quelle route
   * l ecran parle vraiment.
   * @param {any} fonction - La fonction de mutation.
   * @returns {any} La mutation figee.
   */
  useLicenseMutation: (fonction) => {
    mockDerniereFonctionDeMutation = fonction;
    return mockMutationFigee;
  },
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

const { unwaiveLicenseAssignment } = require('@/services/license/licenseQueries');

/**
 * Une cotisation de fiche joueur, dans le statut voulu.
 * @param {string} status - Le statut de la cotisation.
 * @param {any} [extra] - Champs a surcharger.
 * @returns {any} La cotisation.
 */
const cotisationAu = (status, extra = {}) => ({
  amountDueCents: 12000,
  amountPaidCents: 0,
  amountRemainingCents: status === 'waived' ? 0 : 12000,
  campaign: { documentId: 'camp-T03', documentRequests: [], name: 'Cotisation seniors' },
  currency: 'EUR',
  documentId: 'assign-T03',
  documentSubmissions: [],
  installments: [],
  payments: [],
  receipts: [],
  status,
  user: { firstname: 'Ana', lastname: 'Diaz' },
  waiveReason: status === 'waived' ? 'Bourse municipale' : null,
  ...extra,
});

/** @type {any} */
let arbreCourant = null;

/**
 * Monte la fiche joueur en tant que dirigeant, et rend les boutons.
 * @param {any} cotisation - La cotisation affichee.
 * @returns {any[]} Les props des boutons rendus.
 */
const monterLaFiche = (cotisation) => {
  mockCotisationRequete = {
    data: cotisation, isError: false, isLoading: false, refetch: jest.fn(),
  };
  mockBoutons.length = 0;

  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <ClubLicenseMemberDetail
        navigation={{ goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() }}
        route={{
          params: {
            assignmentId: 'assign-T03',
            campaignId: 'camp-T03',
            canManageLicenses: true,
            scope: 'manager',
          },
        }}
      />,
    );
  });
  arbreCourant = arbre;
  return mockBoutons;
};

/**
 * @param {any[]} boutons - Les props de boutons recoltees.
 * @returns {string[]} Les intitules, dans l ordre d apparition.
 */
const intitules = (boutons) => boutons.map((props) => props.title).filter(Boolean);

describe('T03 — « A payer » sur la fiche joueur', () => {
  beforeEach(() => {
    mockBoutons.length = 0;
    mockEnvois.length = 0;
    mockDerniereFonctionDeMutation = null;
    mockMutationFigee.mutate.mockClear();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    Alert.alert.mockRestore();
    if (!arbreCourant) return;
    act(() => arbreCourant.unmount());
    arbreCourant = null;
  });

  it('temoin 1 — une cotisation EXEMPTEE propose « A payer », a cote de « Relancer »', () => {
    const boutons = monterLaFiche(cotisationAu('waived'));

    expect(intitules(boutons)).toContain('À payer');
  });

  it('temoin 2 — ⛔ aucun bouton inerte : rien a remettre a payer, rien a proposer', () => {
    // Une cotisation en attente est DEJA a payer. Le bouton n aurait rien a
    // faire, et le serveur refuserait (ValidationError).
    expect(intitules(monterLaFiche(cotisationAu('pending')))).not.toContain('À payer');
    act(() => arbreCourant.unmount());
    arbreCourant = null;
    expect(intitules(monterLaFiche(cotisationAu('paid')))).not.toContain('À payer');
  });

  it('temoin 3 — le geste DEMANDE d abord, et ne part qu apres confirmation', () => {
    const boutons = monterLaFiche(cotisationAu('waived'));

    act(() => boutons.find((props) => props.title === 'À payer').onPress());

    // Rien n est parti sur l appui : une exemption annulee est une decision
    // d argent, elle se confirme.
    expect(mockEnvois).toHaveLength(0);
    expect(Alert.alert.mock.calls).toHaveLength(1);
    const [titre, corps, actions] = Alert.alert.mock.calls[0];
    expect(titre).toBe('Remettre cette cotisation à payer ?');
    // Ce que ca change pour la personne, en chiffres — pas « c est fait ».
    expect(corps).toContain('120,00');
    expect(corps).toContain('Ana Diaz');

    Alert.alert.mockClear();
    act(() => actions.find((/** @type {any} */ action) => action.text === 'À payer').onPress());

    expect(mockEnvois).toHaveLength(1);
  });

  it('temoin 4 — l ecran ne s annonce PAS avant la reponse du serveur', () => {
    const boutons = monterLaFiche(cotisationAu('waived'));
    act(() => boutons.find((props) => props.title === 'À payer').onPress());
    const actions = Alert.alert.mock.calls[0][2];
    Alert.alert.mockClear();
    act(() => actions.find((/** @type {any} */ action) => action.text === 'À payer').onPress());

    // La demande est partie : toujours aucun message de succes.
    expect(Alert.alert.mock.calls).toHaveLength(0);

    act(() => mockEnvois[0].options.onSuccess({}));

    expect(Alert.alert.mock.calls.map(([titre]) => titre)).toEqual(['Cotisation à payer']);
  });

  it('temoin 5 — un ECHEC s affiche sous le nom du geste, avec le message du serveur', () => {
    const boutons = monterLaFiche(cotisationAu('waived'));
    act(() => boutons.find((props) => props.title === 'À payer').onPress());
    const actions = Alert.alert.mock.calls[0][2];
    Alert.alert.mockClear();
    act(() => actions.find((/** @type {any} */ action) => action.text === 'À payer').onPress());

    act(() => mockEnvois[0].options.onError(new Error('Le serveur a dit non')));

    expect(Alert.alert.mock.calls[0][0]).toBe('Remise à payer impossible');
    expect(Alert.alert.mock.calls[0][1]).toBe('Le serveur a dit non');
  });

  it('temoin 6 — c est bien la route « unwaive » qui est appelee, pas une autre', async () => {
    monterLaFiche(cotisationAu('waived'));

    // La derniere mutation declaree par l ecran est celle du geste ajoute.
    await mockDerniereFonctionDeMutation({});

    expect(unwaiveLicenseAssignment).toHaveBeenCalledWith('assign-T03', {});
  });
});
