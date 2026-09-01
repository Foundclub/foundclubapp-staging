import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubLicenses from '../ClubLicenses';

// S06 (E6) — LES GESTES MUETS DU HUB DES COTISATIONS : L APP FAIT, MAIS ELLE NE
// DIT PAS.
//
// Constat d'Adel en recette de la `2.6.19` : « il manque un pop-up "votre
// campagne est maintenant en pause" » (point 11), puis « pareil » pour la
// suppression (point 12).
//
// 🔬 CE QUI MANQUAIT, MESURE : `useLicenseMutation`
// (licenseQueries.js:192-198) ne porte QU UN `onSuccess` — il vide le cache de
// la campagne. Aucun retour a l'ecran. Et le hub ne passait de rappels par appel
// (`mutate(vars, { onSuccess, onError })`) que pour UN seul geste sur six : la
// relance individuelle (ClubLicenses.js:1470-1482). Toutes les autres partaient
// donc sans un mot — succes comme echec.
//
// ⚠️ LE MESSAGE DOIT DIRE CE QUI A CHANGE POUR DE VRAI, pas « c'est fait » :
// la pause dit qu'un joueur ne peut plus payer, la suppression dit COMBIEN de
// cotisations sont parties. Le chiffre n'est pas calcule ici : il vient de
// `item.totals`, que la liste du serveur porte deja et que la confirmation
// d'avant-suppression utilise depuis R01.
//
// 🔒 ET LE TEMOIN QUI COMPTE VRAIMENT : un geste qui ECHOUE ne s'annonce jamais
// comme un succes. Le message se declenche sur la reponse du serveur, jamais sur
// l'appui — ce fichier le prouve en jouant les deux issues sur le meme geste.
//
// Point d'observation : les arguments de `Alert.alert`, et la reponse serveur
// qu'on joue a la main. Aucun pixel, aucune profondeur d'arbre.

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
// Chaque `mutate(variables, options)` est RANGE ici sans etre joue : c'est le
// test qui decide si le serveur accepte ou refuse, et quand.
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

// La feuille rend ses enfants : sans ca, les boutons du « … » n'existent pas
// dans l'arbre et il n'y a rien a appuyer.
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
 * La campagne du hub. `totals` est la forme exacte que le serveur ajoute a
 * chaque element de la liste (`listCampaigns` -> `totalsForAssignments`).
 * @param {any} totals - Les compteurs a simuler.
 * @param {string} status - Le statut de la campagne.
 * @returns {any} Une campagne de liste.
 */
const campagneAvec = (totals, status = 'active') => ({
  currency: 'EUR',
  defaultAmountCents: 12000,
  documentId: 'camp-S06',
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
    total: 0,
    ...totals,
  },
});

/** @type {any} */
let arbreCourant = null;

/**
 * Monte le hub, ouvre la feuille « … » de la campagne, et rend ses boutons.
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
 * Retrouve un bouton par son intitule exact.
 * @param {any[]} boutons - Les props de boutons recoltees.
 * @param {string} titre - Le titre exact recherche.
 * @returns {any} Le bouton, ou `undefined`.
 */
const boutonIntitule = (boutons, titre) => boutons.find((props) => props.title === titre);

/**
 * Appuie sur un bouton de la feuille, puis CONFIRME dans la fenetre qui suit.
 * @param {any[]} boutons - Les props de boutons recoltees.
 * @param {string} titre - Le titre du bouton de la feuille.
 * @param {string} confirmation - Le libelle a presser dans la confirmation.
 */
const gesteConfirme = (boutons, titre, confirmation) => {
  act(() => boutonIntitule(boutons, titre).onPress());
  const actions = Alert.alert.mock.calls[0][2];
  const valider = actions.find((/** @type {any} */ action) => action.text === confirmation);
  expect(valider).toBeDefined();
  Alert.alert.mockClear();
  act(() => valider.onPress());
};

/**
 * Les fenetres affichees, sous une forme lisible dans le message d'echec.
 * @returns {string[]} Les titres des fenetres.
 */
const titresAffiches = () => Alert.alert.mock.calls.map(([titre]) => titre);

describe('S06 — le hub des cotisations annonce ce qu il vient de faire', () => {
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

  it('temoin 2 — la pause annonce CE QU ELLE ARRETE, une fois le serveur d accord', () => {
    const boutons = ouvrirLaFeuilleDActions(campagneAvec({ total: 8 }));

    gesteConfirme(boutons, 'Mettre en pause', 'Mettre en pause');

    // Rien n'est annonce sur l'appui : la demande est partie, c'est tout.
    expect(mockEnvois).toHaveLength(1);
    expect(titresAffiches()).toEqual([]);

    // Le serveur repond.
    act(() => mockEnvois[0].options.onSuccess({}));

    expect(titresAffiches()).toEqual(['Campagne en pause']);
    const corps = Alert.alert.mock.calls[0][1];
    expect(corps).toContain('Cotisation seniors');
    // Ce que ca arrete, nomme — pas « c'est fait ».
    expect(corps).toMatch(/ne peuvent plus payer/i);
    expect(corps).toMatch(/reprendre/i);
  });

  it('temoin 3 — la suppression annonce COMBIEN de cotisations sont parties', () => {
    const boutons = ouvrirLaFeuilleDActions(campagneAvec({ total: 8 }));

    gesteConfirme(boutons, 'Supprimer', 'Supprimer');

    expect(mockEnvois).toHaveLength(1);
    expect(titresAffiches()).toEqual([]);

    act(() => mockEnvois[0].options.onSuccess({}));

    expect(titresAffiches()).toEqual(['Campagne supprimée']);
    const corps = Alert.alert.mock.calls[0][1];
    expect(corps).toContain('Cotisation seniors');
    // Le chiffre de la confirmation d'avant-suppression, reutilise.
    expect(corps).toContain('8 cotisations');
  });

  it('temoin 3 bis — une seule cotisation ne se dit pas au pluriel', () => {
    const boutons = ouvrirLaFeuilleDActions(campagneAvec({ total: 1 }));

    gesteConfirme(boutons, 'Supprimer', 'Supprimer');
    act(() => mockEnvois[0].options.onSuccess({}));

    const corps = Alert.alert.mock.calls[0][1];
    expect(corps).toContain('1 cotisation');
    expect(corps).not.toContain('1 cotisations');
  });

  it('🔒 temoin 4 — une PAUSE qui echoue ne s annonce JAMAIS comme un succes', () => {
    const boutons = ouvrirLaFeuilleDActions(campagneAvec({ total: 8 }));

    gesteConfirme(boutons, 'Mettre en pause', 'Mettre en pause');
    act(() => mockEnvois[0].options.onError({ message: 'Accès refusé' }));

    expect(titresAffiches()).not.toContain('Campagne en pause');
    expect(titresAffiches()).toEqual(['Mise en pause impossible']);
    // Le message du serveur est REAFFICHE : c'est lui qui nomme ce qui bloque.
    expect(Alert.alert.mock.calls[0][1]).toContain('Accès refusé');
  });

  it('🔒 temoin 4 — une SUPPRESSION qui echoue ne s annonce JAMAIS comme un succes', () => {
    const boutons = ouvrirLaFeuilleDActions(campagneAvec({ total: 8 }));

    gesteConfirme(boutons, 'Supprimer', 'Supprimer');
    act(() => mockEnvois[0].options.onError({ message: 'Campagne verrouillée' }));

    expect(titresAffiches()).not.toContain('Campagne supprimée');
    expect(titresAffiches()).toEqual(['Suppression impossible']);
    expect(Alert.alert.mock.calls[0][1]).toContain('Campagne verrouillée');
  });

  it('temoin 5 — « Dupliquer », de la MEME famille, parle aussi', () => {
    // 🔎 Trouve en cherchant les gestes de la meme famille (§1 bis) : lui non
    // plus ne disait rien, ni en succes ni en echec.
    const boutons = ouvrirLaFeuilleDActions(campagneAvec({ total: 8 }));

    gesteConfirme(boutons, 'Dupliquer', 'Dupliquer');
    expect(titresAffiches()).toEqual([]);
    act(() => mockEnvois[0].options.onSuccess({}));
    expect(titresAffiches()).toEqual(['Copie créée']);
    // La copie est un BROUILLON, et l'originale n'a pas bouge : le message le dit.
    expect(Alert.alert.mock.calls[0][1]).toMatch(/brouillon/i);
  });

  it('🔒 temoin 5 bis — une duplication qui echoue ne s annonce pas comme une copie creee', () => {
    const boutons = ouvrirLaFeuilleDActions(campagneAvec({ total: 8 }));

    gesteConfirme(boutons, 'Dupliquer', 'Dupliquer');
    act(() => mockEnvois[0].options.onError({ message: 'Refus du serveur' }));

    expect(titresAffiches()).not.toContain('Copie créée');
    expect(titresAffiches()).toEqual(['Duplication impossible']);
  });
});
