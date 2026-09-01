import renderer, { act } from 'react-test-renderer';

import ClubLicenses from '../ClubLicenses';
import { LicenseSelectionChip } from '../licenseDesignSystem';

// T03 (E6) — « LES TEXTES NE SONT PAS CENTRES DANS LES BOUTONS ».
//
// Adel, recette du 2026-08-17 : « il faut regler les textes dans les boutons de
// l ecran filtres — "tous", "en attente", etc. — ils ne sont pas centres dans
// les boutons ».
//
// 🔬 POURQUOI, ET C EST MESURABLE : ces pastilles n avaient ni `alignItems` ni
// `justifyContent`. Tant qu elles sont seules, on ne voit rien — leur largeur
// EST celle du texte. Le defaut apparait des qu une VOISINE est plus haute :
//   · la rangee des filtres rapides est un `ScrollView horizontal`, dont le
//     conteneur de contenu est en `flexDirection: row` avec le `alignItems:
//     'stretch'` par defaut de Yoga ⇒ toutes les pastilles s etirent a la
//     hauteur de la plus grande, et « Filtres » (`FilterTrigger`) impose
//     `minHeight: 44` ;
//   · dans la feuille « Filtrer les membres », c est un `flexWrap` : une seule
//     option qui passe sur deux lignes etire toute sa ligne.
// Dans les deux cas la pastille grandit, mais son texte reste COLLE EN HAUT.
//
// 🧩 ET C EST BIEN LE MEME BOUTON, RECOPIE 4 FOIS (la question posee par le
// prompt) : `SelectionChip` (ClubLicenseCampaignSettings.js:1050) et les trois
// pastilles du hub (ClubLicenses.js:2089, 2645, 2661) portaient la meme palette,
// les memes 12/8 de marge et la meme `Fonts.p3Bold`. On corrige donc UNE fois,
// dans `licenseDesignSystem.js` — la ou vivent deja les briques partagees de ces
// ecrans.
//
// Point d observation : le style du conteneur pressable, et rien d autre.

/** @type {any} */
let mockAuthContexte;
/** @type {any} */
let mockDonneesAuth;
/** @type {any} */
let mockCampagnesRequete;
/** @type {any} */
let mockCampagneCouranteRequete;
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

jest.mock('@/components/atoms/button/Button', () => function ButtonMock() {
  return null;
});

/**
 * Aplatit un style React Native, quel que soit son emballage.
 * @param {any} style - Le style a aplatir.
 * @returns {any} Un objet unique.
 */
const aplatir = (style) => (Array.isArray(style)
  ? style.filter(Boolean).reduce((cumul, morceau) => ({ ...cumul, ...aplatir(morceau) }), {})
  : (style || {}));

/**
 * Le style du conteneur pressable qui porte ce libelle exact.
 * @param {any} arbre - L arbre monte.
 * @param {string} libelle - Le texte de la pastille.
 * @returns {any} Le style aplati du conteneur.
 */
const styleDeLaPastille = (arbre, libelle) => {
  const texte = arbre.root.findAll((noeud) => (
    typeof noeud.type === 'string' && noeud.props?.children === libelle
  ))[0];
  expect(texte).toBeDefined();
  // On remonte au premier ancetre HOTE qui porte un rayon de pastille : c est le
  // conteneur pressable, celui dont Adel dit que le texte n y est pas centre.
  let ancetre = texte.parent;
  while (ancetre && !aplatir(ancetre.props?.style).borderRadius) ancetre = ancetre.parent;
  expect(ancetre).toBeTruthy();
  return aplatir(ancetre.props.style);
};

/** @type {any} */
let arbreCourant = null;

/**
 * Monte le hub sur une campagne active, onglet « Membres » — c est la que vit
 * la rangee de filtres rapides.
 * @returns {any} L arbre monte.
 */
const monterLeHubSurLesMembres = () => {
  mockAuthContexte = [{ auth: { user: { role: { name: 'Dirigeant', type: 'dirigeant' } } } }];
  mockDonneesAuth = {
    activeClubId: 'club-hub',
    clubs: [{ documentId: 'club-hub', name: 'FC Test' }],
    refetchUserData: jest.fn(),
  };
  const campagne = {
    currency: 'EUR',
    defaultAmountCents: 12000,
    documentId: 'camp-T03',
    name: 'Cotisation seniors',
    seasonLabel: '2026-2027',
    status: 'active',
    totals: { total: 4 },
  };
  mockCampagneCouranteRequete = { data: campagne, isError: false, isLoading: false };
  mockCampagnesRequete = { data: { data: [campagne] }, isError: false, isLoading: false };

  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <ClubLicenses
        navigation={{
          addListener: () => () => {}, goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn(),
        }}
        route={{
          name: 'ClubLicenses',
          params: {
            campaignId: 'camp-T03', clubId: 'club-hub', initialDetailTab: 'members',
          },
        }}
      />,
    );
  });
  arbreCourant = arbre;
  return arbre;
};

describe('T03 — les libelles sont centres dans les boutons de filtres', () => {
  afterEach(() => {
    if (!arbreCourant) return;
    act(() => arbreCourant.unmount());
    arbreCourant = null;
  });

  it('temoin 1 — la pastille partagee centre son libelle dans les DEUX sens', () => {
    /** @type {any} */
    let arbre;
    act(() => {
      arbre = renderer.create(
        <LicenseSelectionChip label="En attente" onPress={() => {}} selected={false} />,
      );
    });
    arbreCourant = arbre;

    const style = styleDeLaPastille(arbre, 'En attente');
    expect(style.alignItems).toBe('center');
    expect(style.justifyContent).toBe('center');
    // 44 pt : la cible tactile accessible, la meme que `FilterTrigger` et que
    // `ChoiceChipGroup`. C est elle qui rend l etirement inoffensif.
    expect(style.minHeight).toBe(44);
  });

  it('temoin 2 — la variante douce de la feuille de filtres centre aussi', () => {
    /** @type {any} */
    let arbre;
    act(() => {
      arbre = renderer.create(
        <LicenseSelectionChip label="Tous" onPress={() => {}} selected variant="soft" />,
      );
    });
    arbreCourant = arbre;

    const style = styleDeLaPastille(arbre, 'Tous');
    expect(style.alignItems).toBe('center');
    expect(style.justifyContent).toBe('center');
    expect(style.minHeight).toBe(44);
  });

  it('temoin 3 — dans le hub, « En attente » et « Tous » sont bien centres', () => {
    const arbre = monterLeHubSurLesMembres();

    // Les libelles cites par Adel, tels qu ils apparaissent a l ecran.
    ['Tous', 'En attente', 'En retard'].forEach((libelle) => {
      const style = styleDeLaPastille(arbre, libelle);
      expect({ libelle, ...style }).toMatchObject({
        alignItems: 'center',
        justifyContent: 'center',
        libelle,
        minHeight: 44,
      });
    });
  });
});
