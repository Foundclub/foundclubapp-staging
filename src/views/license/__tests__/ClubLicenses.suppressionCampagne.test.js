import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubLicenses from '../ClubLicenses';

// R01 (E6) — TEMOIN N°2, MOITIE APP : UNE CAMPAGNE NE SE SUPPRIME QUE SUR UN
// GESTE EXPLICITE, ET LA CONFIRMATION DIT CE QU ON PERD.
//
// Constat d Adel en recette le 2026-08-13 : « impossible de supprimer une
// campagne volontairement, il n y a pas de bouton prevu ».
//
// Il en existait bien un — « Supprimer le brouillon » — mais il ne s affiche que
// pour une campagne NON LANCEE, et seulement dans la vue detaillee. La feuille
// « … » du hub, celle qu on ouvre depuis la liste, n en avait aucun.
//
// 🔒 Ce que ce fichier verrouille, et l ordre compte :
//   1. le bouton EXISTE dans la feuille « … » ;
//   2. il ne supprime RIEN tout seul — il ouvre une confirmation ;
//   3. la confirmation NOMME le nombre de cotisations qui partent ;
//   4. si la campagne a encaisse, elle n est PAS supprimable : on propose
//      d archiver, et aucune suppression n est envoyee.
//
// ⚠️ Ce fichier monte le hub avec sa vraie feuille modale (contrairement a
// ClubLicenses.test.js, qui la remplace par du vide) : sans ca, les boutons de
// la feuille n existent pas dans l arbre et il n y a rien a appuyer.

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
const mockRequeteVide = { data: null, isError: false, isLoading: false };
const mockMutationFigee = { isPending: false, mutate: jest.fn(), mutateAsync: jest.fn() };
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

// `authUseCases` tire le magasin de session et la navigation : on le double
// entierement plutot que de faire dependre ce filet de la couche de stockage.
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
  /**
   * La mutation de SUPPRESSION est distinguee des autres par sa position : elle
   * est la derniere posee par l ecran (ClubLicenses.js:1036).
   * @returns {any} Une mutation inerte, observable.
   */
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

// ⚠️ LA DIFFERENCE AVEC ClubLicenses.test.js : ici la feuille rend ses enfants.
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
 * @returns {any} Une campagne de liste.
 */
const campagneAvec = (totals) => ({
  currency: 'EUR',
  defaultAmountCents: 12000,
  documentId: 'camp-R01',
  name: 'Cotisation seniors',
  seasonLabel: '2026-2027',
  status: 'active',
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

  // Le « … » de la carte porte un libelle d accessibilite stable
  // (ClubLicenses.js:812) : c est par lui qu on ouvre la feuille.
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

describe('R01 — supprimer une campagne depuis le hub', () => {
  beforeEach(() => {
    mockBoutons.length = 0;
    mockMutationFigee.mutate.mockClear();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    Alert.alert.mockRestore();
    if (!arbreCourant) return;
    act(() => arbreCourant.unmount());
    arbreCourant = null;
  });

  it('temoin 2 — la feuille « … » propose bien « Supprimer »', () => {
    const boutons = ouvrirLaFeuilleDActions(campagneAvec({ total: 8 }));

    expect(boutonIntitule(boutons, 'Supprimer')).toBeDefined();
  });

  it('temoin 2 — appuyer sur « Supprimer » ne supprime RIEN : ca demande d abord', () => {
    const boutons = ouvrirLaFeuilleDActions(campagneAvec({ total: 8 }));

    act(() => boutonIntitule(boutons, 'Supprimer').onPress());

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(mockMutationFigee.mutate).not.toHaveBeenCalled();
  });

  it('temoin 2 — la confirmation NOMME le nombre de cotisations qui partent', () => {
    const boutons = ouvrirLaFeuilleDActions(campagneAvec({ total: 8 }));

    act(() => boutonIntitule(boutons, 'Supprimer').onPress());

    const [titre, corps, actions] = Alert.alert.mock.calls[0];
    expect(titre).toBe('Supprimer cette campagne ?');
    expect(corps).toContain('Cotisation seniors');
    expect(corps).toContain('8 cotisations');
    expect(corps).toContain('Aucun paiement');
    expect(corps).toContain('irréversible');
    // Le geste destructeur n'est jamais le choix par defaut.
    expect(actions[0].style).toBe('cancel');
    expect(actions[1].style).toBe('destructive');
    expect(actions[1].text).toBe('Supprimer');
  });

  it('temoin 2 — une campagne QUI A ENCAISSE n est pas supprimable : on propose d archiver', () => {
    const boutons = ouvrirLaFeuilleDActions(campagneAvec({
      paidCents: 24000, paidCount: 2, total: 8,
    }));

    act(() => boutonIntitule(boutons, 'Supprimer').onPress());

    const [titre, corps, actions] = Alert.alert.mock.calls[0];
    expect(titre).toBe('Suppression impossible');
    // Le montant est nomme, pas seulement le fait qu'il existe.
    // `\s` plutot qu'un espace insecable ecrit en clair : `Intl` glisse un
    // U+202F devant le « € » en francais, invisible a l'oeil et interdit par
    // la porte lint. En JS, `\s` couvre U+00A0 comme U+202F.
    expect(corps.replace(/\s/g, ' ')).toContain('240,00 €');
    expect(corps).toContain('2 membres');
    expect(corps).toMatch(/archive/i);
    // ⛔ AUCUNE suppression proposee, et surtout aucune envoyee.
    expect(actions.some((action) => action.style === 'destructive')).toBe(false);
    expect(mockMutationFigee.mutate).not.toHaveBeenCalled();
  });
});
