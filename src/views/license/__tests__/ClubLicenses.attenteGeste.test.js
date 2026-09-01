import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubLicenses from '../ClubLicenses';

// T03 (E6) — « ON A L IMPRESSION QUE CA N A PAS MARCHE PENDANT QUELQUES
// SECONDES ».
//
// Adel, recette du 2026-08-17 (point 8) : « quand on appuie sur REPRENDRE, c est
// trop long avant de rouvrir la campagne ».
//
// 🔬 CE QUE LA MESURE DIT, ET ELLE CHANGE LA CORRECTION. Reprendre ne coute
// qu UN aller-retour cote app — il n y a donc RIEN a paralleliser ici, au
// contraire de la creation. C est le SERVEUR qui est long, et pour une raison
// nommee (`admin/src/api/license/services/license.ts:2562`) : `resume` declenche
// `syncCampaignAssignmentsInternal`, une boucle SERIE sur tous les membres du
// club qui, par membre concerne, cree la cotisation, cree ses echeances,
// re-hydrate l ensemble (~20 relations) et envoie une notification — puis
// `notifyCampaignMembers` repasse sur tout le monde (l. 2567).
// ⇒ la bonne correction n est pas d aller plus vite, c est de DIRE qu on
//   travaille, la ou le doigt a appuye.
//
// 🕳️ POURQUOI RIEN NE S AFFICHAIT — c est un defaut de placement, pas d oubli :
// les deux boutons qui portaient `isLoading={transitionMutation.isPending}`
// (ClubLicenses.js:2425 et 2588) sont DANS la feuille « … », et `fermerPuis`
// (l. 2564) la referme AVANT de lancer le geste. Le voyant existait donc, sur un
// bouton qui n etait plus a l ecran. La liste, elle, n avait rien.
//
// Point d observation : ce que la carte de la campagne affiche entre l appui et
// la reponse du serveur. Aucun pixel, aucune horloge.

/** @type {any} */
let mockAuthContexte;
/** @type {any} */
let mockDonneesAuth;
/** @type {any} */
let mockCampagnesRequete;
/** @type {any} */
let mockCampagneCouranteRequete;
/** @type {any[]} */
const mockBoutons = [];
/** @type {any[]} */
const mockEnvois = [];
const mockRequeteVide = { data: null, isError: false, isLoading: false };
const mockMutationFigee = {
  isPending: false,
  mutate: jest.fn((variables, options) => {
    mockEnvois.push({ options, variables });
  }),
  mutateAsync: jest.fn(),
};
const mockInsetsFiges = {
  bottom: 0, left: 0, right: 0, top: 0,
};

// PERF2 - l ecran importe desormais WithDataWrapper -> SkeletonLoader, qui
// tire MaskedView / LinearGradient / Reanimated : hors sujet dans cette
// suite. Meme mock que les suites EventPublishedShowcase.
jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonLoaderMock() { return null; },
);

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => mockMutationFigee,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsetsFiges,
}));

jest.mock('@/store/appContext', () => ({
  useAppContext: () => mockAuthContexte,
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockDonneesAuth,
}));

jest.mock('@/domains/auth/authUseCases', () => ({
  getUserRoleKey: (/** @type {string} */ nomDeRole) => (
    String(nomDeRole || '').toLowerCase().includes('dirigeant') ? 'president' : 'new'
  ),
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
  deleteDraftLicenseCampaign: jest.fn(),
  duplicateLicenseCampaign: jest.fn(),
  sendBulkLicenseReminder: jest.fn(),
  sendLicenseReminder: jest.fn(),
  transitionLicenseCampaign: jest.fn(),
  useCurrentLicenseCampaign: () => mockCampagneCouranteRequete,
  useLicenseAssignments: () => mockRequeteVide,
  useLicenseCampaign: () => mockRequeteVide,
  useLicenseCampaigns: () => mockCampagnesRequete,
  useLicenseDashboard: () => mockRequeteVide,
  useLicenseMutation: () => mockMutationFigee,
  useLicensePaymentReviews: () => mockRequeteVide,
}));

jest.mock('@/services/auth/authService', () => ({
  switchManagedClub: jest.fn(),
}));

jest.mock('@/services/license/licenseService', () => ({
  connectLicenseHelloAsso: jest.fn(),
}));

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

jest.mock('@/components/molecules/clubSelector/ClubSelector', () => function ClubSelectorMock() {
  return null;
});

jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => function ProfileAvatarMock() {
  return null;
});

jest.mock(
  '@/components/molecules/segmentedControl/SegmentedControl',
  () => function SegmentedControlMock() {
    return null;
  },
);

jest.mock('../MyLicenses', () => function MyLicensesMock() {
  return null;
});

jest.mock('@/components/atoms/button/Button', () => function ButtonMock(/** @type {any} */ props) {
  mockBoutons.push(props);
  return null;
});

/**
 * Une campagne de la liste du hub, dans le statut voulu.
 * @param {string} status - Le statut de la campagne.
 * @returns {any} Une campagne de liste.
 */
const campagneAu = (status) => ({
  currency: 'EUR',
  defaultAmountCents: 12000,
  documentId: 'camp-T03',
  name: 'Cotisation seniors',
  seasonLabel: '2026-2027',
  status,
  totals: {
    expectedCents: 0,
    manualReviewCount: 0,
    overdueCount: 0,
    paidCents: 0,
    paidCount: 0,
    partialCount: 0,
    remainingCents: 0,
    total: 4,
  },
});

/** @type {any} */
let arbreCourant = null;

/**
 * Monte le hub sur une campagne, ouvre sa feuille « … », et rend ses boutons.
 * @param {any} campagne - La campagne posee dans la liste du hub.
 * @returns {any[]} Les props des boutons de la feuille.
 */
const ouvrirLaFeuilleDActions = (campagne) => {
  mockAuthContexte = [{ auth: { user: { role: { name: 'Dirigeant', type: 'dirigeant' } } } }];
  mockDonneesAuth = {
    activeClubId: 'club-hub',
    clubs: [{ documentId: 'club-hub', name: 'FC Test' }],
    refetchUserData: jest.fn(),
  };
  mockCampagneCouranteRequete = { data: campagne, isError: false, isLoading: false };
  mockCampagnesRequete = { data: { data: [campagne] }, isError: false, isLoading: false };

  const navigation = {
    addListener: () => () => {},
    goBack: jest.fn(),
    navigate: jest.fn(),
    setOptions: jest.fn(),
  };

  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <ClubLicenses
        navigation={navigation}
        route={{ name: 'ClubLicenses', params: { clubId: 'club-hub' } }}
      />,
    );
  });
  arbreCourant = arbre;

  const ouvrirActions = arbre.root.findAll(
    (noeud) => typeof noeud.props?.accessibilityLabel === 'string'
      && noeud.props.accessibilityLabel.startsWith('Autres actions pour la campagne'),
  )[0];
  mockBoutons.length = 0;
  act(() => ouvrirActions.props.onPress());

  return mockBoutons;
};

/**
 * Appuie sur un bouton de la feuille, puis CONFIRME dans la fenetre qui suit.
 * @param {any[]} boutons - Les props de boutons recoltees.
 * @param {string} titre - Le titre du bouton de la feuille.
 * @param {string} confirmation - Le libelle a presser dans la confirmation.
 */
const gesteConfirme = (boutons, titre, confirmation) => {
  act(() => boutons.find((props) => props.title === titre).onPress());
  const actions = Alert.alert.mock.calls[0][2];
  const valider = actions.find((/** @type {any} */ action) => action.text === confirmation);
  expect(valider).toBeDefined();
  Alert.alert.mockClear();
  act(() => valider.onPress());
};

/**
 * Ce que la carte de campagne affiche comme geste en cours. Seuls les noeuds
 * HOTES sont gardes : un `<Text>` de React Native rend un composite ET un hote
 * qui portent le meme `testID`.
 * @returns {string[]} Les annonces visibles.
 */
const annoncesDeGeste = () => arbreCourant.root
  .findAll((noeud) => (
    typeof noeud.type === 'string'
    && noeud.props?.testID === 'license-campagne-geste-en-cours'
  ))
  .map((noeud) => noeud.props.children);

describe('T03 — reprendre une campagne ne laisse plus de silence', () => {
  beforeEach(() => {
    mockBoutons.length = 0;
    mockEnvois.length = 0;
    mockMutationFigee.mutate.mockClear();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    Alert.alert.mockRestore();
    if (!arbreCourant) return;
    act(() => arbreCourant.unmount());
    arbreCourant = null;
  });

  it('temoin 1 — entre l appui et la reponse, la carte DIT qu elle reprend', () => {
    const boutons = ouvrirLaFeuilleDActions(campagneAu('paused'));

    // Avant l appui : rien a annoncer.
    expect(annoncesDeGeste()).toEqual([]);

    gesteConfirme(boutons, 'Reprendre', 'Reprendre');

    // La demande est partie, le serveur n a pas encore repondu. C EST LA FENETRE
    // OU L ECRAN SE TAISAIT.
    expect(mockEnvois).toHaveLength(1);
    expect(Alert.alert.mock.calls).toHaveLength(0);
    expect(annoncesDeGeste()).toEqual(['Reprise en cours...']);
  });

  it('temoin 2 — quand le serveur repond, l annonce s efface et le resultat s affiche', () => {
    const boutons = ouvrirLaFeuilleDActions(campagneAu('paused'));
    gesteConfirme(boutons, 'Reprendre', 'Reprendre');

    act(() => mockEnvois[0].options.onSuccess({}));

    expect(annoncesDeGeste()).toEqual([]);
    expect(Alert.alert.mock.calls.map(([titre]) => titre)).toEqual(['Campagne reprise']);
  });

  it('temoin 3 — un REFUS efface l annonce aussi : jamais de carte figee', () => {
    const boutons = ouvrirLaFeuilleDActions(campagneAu('paused'));
    gesteConfirme(boutons, 'Reprendre', 'Reprendre');

    act(() => mockEnvois[0].options.onError(new Error('Le serveur a dit non')));

    expect(annoncesDeGeste()).toEqual([]);
    expect(Alert.alert.mock.calls.map(([titre]) => titre)).toEqual(['Reprise impossible']);
  });

  it('temoin 4 — la mise en pause parle aussi : les 6 etapes du cycle, pas une', () => {
    const boutons = ouvrirLaFeuilleDActions(campagneAu('active'));

    gesteConfirme(boutons, 'Mettre en pause', 'Mettre en pause');

    expect(annoncesDeGeste()).toEqual(['Mise en pause en cours...']);
  });
});
