import renderer, { act } from 'react-test-renderer';

import ClubLicenses from '../ClubLicenses';

/**
 * Y06 (E6) — LES DEUX GESTES QUE LE DIRIGEANT CHERCHE DANS LES COTISATIONS.
 *
 * 🗣️ Adel, 2026-08-19, capture a l appui : « non, toujours pas — je pense que la
 * session s est trompee d endroit », puis « ou ça, je peux ajouter cette
 * option ? » (deleguer la validation des paiements a un coach).
 *
 * 🔬 MESURE AVANT DE REFAIRE — les deux gestes EXISTENT, mais ailleurs :
 *   · « A payé » vit sur la FICHE d un membre (`ClubLicenseMemberDetail.js`,
 *     lot W02). La capture d Adel, elle, montre la LISTE : la carte n y portait
 *     que « Relancer » — et « À payer », qui ne sort que sur une exemptee.
 *   · la delegation vit dans « Modifier mon equipe » (`TeamEdit.js`,
 *     `authorizedPaymentValidators`, lot W02). Adel la cherchait la ou vit
 *     l argent : dans les cotisations.
 *
 * 🧨 LE PIEGE DE LIBELLE, remesure ici : « À payer » (remettre une exemption en
 * du) et « A payé » (encaisser) sont a UNE LETTRE l un de l autre et font le
 * CONTRAIRE. Ils restent MUTUELLEMENT EXCLUSIFS — le dernier temoin le fige.
 *
 * ⛔ CE QUE CE FICHIER NE MESURE PAS : la barriere. Une barriere qui n existe
 * que dans l app n en est pas une ; le refus vit dans le service licence
 * (admin, `canValidatePaymentsFor`). L ecran n a le droit que d OBEIR.
 */

/** @type {any} */
let mockAuthContexte;
/** @type {any} */
let mockDonneesAuth;
/** @type {any} */
let mockAffectations;
/** @type {any} */
let mockTableauDeBord;
/** @type {any[]} */
const mockBoutons = [];
/** @type {any[]} */
const mockNavigations = [];
const mockRequeteVide = { data: null, isError: false, isLoading: false };
const mockMutationFigee = {
  isPending: false,
  mutate: jest.fn(),
  mutateAsync: jest.fn(),
};

// PERF2 - l ecran importe desormais WithDataWrapper -> SkeletonLoader, qui
// tire MaskedView / LinearGradient / Reanimated : hors sujet dans cette
// suite. Meme mock que les suites EventPublishedShowcase.
jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonLoaderMock() { return null; },
);

jest.mock('@tanstack/react-query', () => ({ useMutation: () => mockMutationFigee }));

// ⚠️ `FlatList` planifie un `Batchinator` qui reveille `InteractionManager` APRES
// la fin du test : en suite complete, ça tue le worker (« environment has been
// torn down »). On rend donc les elements directement — c est la CARTE qu on
// observe, pas la virtualisation.
jest.mock('react-native/Libraries/Lists/FlatList', () => {
  const mockModule = function FlatListMock(
    /** @type {any} */ {
      data, ListEmptyComponent, ListHeaderComponent, renderItem,
    },
  ) {
    const { View } = jest.requireActual('react-native');
    const elements = data || [];
    return (
      <View>
        {ListHeaderComponent || null}
        {elements.length
          ? elements.map((/** @type {any} */ item, /** @type {number} */ index) => (
            renderItem({ index, item })
          ))
          : ListEmptyComponent || null}
      </View>
    );
  };
  // RN 0.79 lit `require(module).default` la ou 0.78 lisait le module entier :
  // le mock sert les DEUX formes, pour survivre aux deux versions.
  return Object.assign(mockModule, { default: mockModule });
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('@/store/appContext', () => ({ useAppContext: () => mockAuthContexte }));

jest.mock('@/domains/auth/useAuth', () => ({ __esModule: true, default: () => mockDonneesAuth }));

// La VRAIE table des roles serait un service ; on ne garde que la traduction
// « nom du role » -> cle, parce que c est elle qui ouvre ou ferme la vue.
jest.mock('@/domains/auth/authUseCases', () => ({
  getUserRoleKey: (/** @type {string} */ nom) => {
    const normalise = String(nom || '').toLowerCase();
    if (normalise.includes('dirigeant') || normalise.includes('president')) return 'president';
    if (normalise.includes('entra') || normalise.includes('coach')) return 'coach';
    return 'new';
  },
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
  deleteDraftLicenseCampaign: jest.fn(),
  duplicateLicenseCampaign: jest.fn(),
  sendBulkLicenseReminder: jest.fn(),
  sendLicenseReminder: jest.fn(),
  transitionLicenseCampaign: jest.fn(),
  unwaiveLicenseAssignment: jest.fn(),
  useCurrentLicenseCampaign: () => mockRequeteVide,
  useLicenseAssignments: () => mockAffectations,
  useLicenseCampaign: () => ({ data: CAMPAGNE, isError: false, isLoading: false }),
  useLicenseCampaigns: () => ({ data: { data: [CAMPAGNE] }, isError: false, isLoading: false }),
  useLicenseDashboard: () => mockTableauDeBord,
  useLicenseMutation: () => mockMutationFigee,
  useLicensePaymentReviews: () => mockRequeteVide,
}));

jest.mock('@/services/auth/authService', () => ({ switchManagedClub: jest.fn() }));
jest.mock('@/services/license/licenseService', () => ({
  connectLicenseHelloAsso: jest.fn(),
}));

jest.mock('@/components/templates/ScreenContainer', () => function ScreenMock({ children }) {
  return children;
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => function ModalMock({ children }) {
  return children;
});

jest.mock('@/components/molecules/clubSelector/ClubSelector', () => function ClubSelectorMock() {
  return null;
});
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => function AvatarMock() {
  return null;
});
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => function SegMock() {
  return null;
});
jest.mock('../MyLicenses', () => function MyLicensesMock() { return null; });

jest.mock('@/components/atoms/button/Button', () => function ButtonMock(/** @type {any} */ props) {
  mockBoutons.push(props);
  return null;
});

const CAMPAGNE = {
  currency: 'EUR',
  defaultAmountCents: 12000,
  documentId: 'camp-Y06',
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
    total: 1,
  },
};

const EQUIPE_U15 = { documentId: 'team-u15', name: 'U15' };
const EQUIPE_SENIORS = { documentId: 'team-seniors', name: 'Seniors A' };

/**
 * Une cotisation de la liste.
 * @param {string} status - Le statut servi par le serveur.
 * @param {any} [extra] - Champs a surcharger (equipe, delegation...).
 * @returns {any} L affectation.
 */
const affectation = (status, extra = {}) => ({
  amountDueCents: 12000,
  amountRemainingCents: status === 'paid' || status === 'waived' ? 0 : 12000,
  currency: 'EUR',
  documentId: `assign-${status}`,
  status,
  team: EQUIPE_U15,
  user: { documentId: 'u1', firstname: 'Leo', lastname: 'Martin' },
  ...extra,
});

/** @type {any} */
let arbreCourant = null;

afterEach(() => {
  if (arbreCourant) {
    act(() => arbreCourant.unmount());
    arbreCourant = null;
  }
});

/**
 * Monte l ecran des cotisations.
 * @param {object} options - Le montage.
 * @param {any[]} [options.affectations] - Les cotisations servies.
 * @param {'dirigeant'|'coach'} [options.profil] - Qui regarde.
 * @param {string} [options.onglet] - L onglet ouvert ('members' par defaut).
 * @returns {string[]} Les intitules des boutons rendus, dans l ordre.
 */
const monterLesCotisations = ({
  affectations = [affectation('pending')],
  onglet,
  profil = 'dirigeant',
} = {}) => {
  mockBoutons.length = 0;
  mockNavigations.length = 0;
  const estCoach = profil === 'coach';
  mockAuthContexte = [{
    auth: {
      user: {
        role: estCoach
          ? { name: 'Entraineur', type: 'entraineur' }
          : { name: 'Dirigeant', type: 'dirigeant' },
      },
    },
  }];
  mockDonneesAuth = {
    activeClubId: 'club-y06',
    clubs: [{ documentId: 'club-y06', name: 'FC Test' }],
    refetchUserData: jest.fn(),
  };
  mockTableauDeBord = estCoach
    ? { data: { scope: 'coach' }, isError: false, isLoading: false }
    : { data: { scope: 'manager' }, isError: false, isLoading: false };
  mockAffectations = {
    data: { data: affectations },
    isError: false,
    isLoading: false,
  };

  act(() => {
    arbreCourant = renderer.create(
      <ClubLicenses
        navigation={{
          addListener: () => () => {},
          goBack: jest.fn(),
          navigate: (/** @type {any} */ ecran, /** @type {any} */ params) => {
            mockNavigations.push({ ecran, params });
          },
          setOptions: jest.fn(),
        }}
        route={{
          name: 'ClubLicenses',
          params: { campaignId: 'camp-Y06', clubId: 'club-y06', initialDetailTab: onglet },
        }}
      />,
    );
  });
  return mockBoutons.map((props) => props.title);
};

/**
 * Retrouve un bouton par son intitule.
 * @param {string} titre - L intitule cherche.
 * @returns {any} Les props du bouton, ou `undefined`.
 */
const bouton = (titre) => mockBoutons.find((props) => props.title === titre);

describe('Y06 · geste 1 — « A payé » sur la carte de la LISTE', () => {
  it('temoin 1 — la carte d un membre porte « A payé »', () => {
    expect(monterLesCotisations()).toContain('A payé');
  });

  it('temoin 1b — il se tient JUSTE a cote de « Relancer »', () => {
    const titres = monterLesCotisations();

    expect(titres.indexOf('A payé')).toBe(titres.indexOf('Relancer') + 1);
  });

  it('🔒 temoin 2 — un coach ne voit pas « A payé » dans la liste', () => {
    // 💰 C est de l argent : la liste entiere est fermee a l entraineur, qui n y
    // trouve que la vue limitee a ses equipes. Sa delegation eventuelle ne
    // s exerce que depuis la fiche d un membre, ou le serveur l a nommee.
    const titres = monterLesCotisations({ profil: 'coach' });

    expect(titres).not.toContain('A payé');
  });

  it('🔒 temoin 3 — rien a encaisser, pas de bouton : soldee ou exemptee', () => {
    expect(monterLesCotisations({ affectations: [affectation('paid')] })).not.toContain('A payé');
    expect(monterLesCotisations({ affectations: [affectation('waived')] })).not.toContain('A payé');
  });

  it('🧨 temoin 3b — « À payer » et « A payé » ne sont JAMAIS sur la meme carte', () => {
    const surExemptee = monterLesCotisations({ affectations: [affectation('waived')] });
    expect(surExemptee).toContain('À payer');
    expect(surExemptee).not.toContain('A payé');

    const surDue = monterLesCotisations({ affectations: [affectation('pending')] });
    expect(surDue).toContain('A payé');
    expect(surDue).not.toContain('À payer');
  });

  it('le bouton n est pas inerte : il ouvre la fiche du membre sur la fenetre de paiement', () => {
    // 🧩 UNE SEULE FENETRE D ENCAISSEMENT dans le depot : celle de la fiche. La
    // liste y emmene, elle n en recopie pas une seconde — un formulaire d argent
    // en double, c est deux verites qui divergent.
    monterLesCotisations();

    act(() => { bouton('A payé').onPress(); });

    expect(mockNavigations).toHaveLength(1);
    expect(mockNavigations[0].params).toMatchObject({
      assignmentId: 'assign-pending',
      campaignId: 'camp-Y06',
      openPaymentModal: true,
    });
  });
});

describe('Y06 · geste 3 — les cotisations emmenent vers la delegation', () => {
  it('temoin 6 — l onglet Paiements porte un renvoi vers le reglage de la delegation', () => {
    const titres = monterLesCotisations({ onglet: 'payments' });

    expect(titres).toContain('Régler pour U15');
  });

  it('temoin 6b — le renvoi emmene sur l ecran de modification de CETTE equipe', () => {
    monterLesCotisations({ onglet: 'payments' });

    act(() => { bouton('Régler pour U15').onPress(); });

    expect(mockNavigations).toHaveLength(1);
    expect(mockNavigations[0].params).toMatchObject({
      params: { clubId: 'club-y06', teamId: 'team-u15' },
      screen: 'TeamEdit',
    });
  });

  it('⚠️ temoin 6c — une campagne qui couvre PLUSIEURS equipes les nomme toutes', () => {
    // Une campagne appartient a un CLUB, pas a une equipe (schema Strapi
    // `license-campaign` : relation `club`). La delegation, elle, se donne
    // equipe par equipe. Un renvoi vers UNE seule equipe serait donc faux.
    const titres = monterLesCotisations({
      affectations: [
        affectation('pending'),
        affectation('partial', { documentId: 'assign-seniors', team: EQUIPE_SENIORS }),
      ],
      onglet: 'payments',
    });

    expect(titres).toContain('Régler pour U15');
    expect(titres).toContain('Régler pour Seniors A');
  });

  it('🔒 temoin 7 — un coach ne voit pas ce renvoi', () => {
    // 💰 Seul le dirigeant du club peut poser la delegation (admin,
    // `canDelegatePaymentValidation`). Montrer le chemin a qui ne peut pas
    // l emprunter, c est promettre un droit qui n existe pas.
    const titres = monterLesCotisations({ onglet: 'payments', profil: 'coach' });

    expect(titres).not.toContain('Régler pour U15');
  });
});
