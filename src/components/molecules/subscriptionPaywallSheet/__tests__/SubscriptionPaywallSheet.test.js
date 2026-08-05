import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SubscriptionPaywallSheet from '../SubscriptionPaywallSheet';

// Filet L10-A (docs/STRATEGIE_PAYWALL_2026_08_01.md §1.4 et §5.3) : la feuille de
// vente n'avait AUCUN test (E6) — aucun fichier de test de app/ ne la citait.
// Ces tests caracterisent d'abord son comportement, puis verrouillent le chemin
// d'achat de l'offre Club ouvert par ce lot.

const mockGetSubscriptionCatalog = jest.fn();
const mockTrackFunnelEvent = jest.fn();
const mockPerformPurchase = jest.fn();
const mockIsPurchaseAvailable = jest.fn();
const mockScheduleRefresh = jest.fn();
const mockUseAuth = jest.fn();
const mockNavigate = jest.fn();
const mockAlert = jest.fn();

const mockRefetchCatalog = jest.fn();

let mockCatalogQueryState = { data: undefined, isError: false, isLoading: false };
let mockPurchaseIsPending = false;

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: mockPurchaseIsPending,
    mutateAsync: (/** @type {any} */ input) => options.mutationFn(input),
  }),
  useQuery: () => ({ ...mockCatalogQueryState, refetch: mockRefetchCatalog }),
  useQueryClient: () => ({}),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {any} */ fallback, /** @type {any} */ values) => {
      if (typeof fallback !== 'string') return key;
      if (!values) return fallback;
      return fallback.replace(/\{\{(\w+)\}\}/g, (/** @type {string} */ _match, /** @type {string} */ name) => String(values[name] ?? ''));
    },
  }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockUseAuth(),
}));

jest.mock('@/services/subscription/subscriptionService', () => ({
  getSubscriptionCatalog: (/** @type {any} */ ...args) => mockGetSubscriptionCatalog(...args),
  trackSubscriptionFunnelEvent: (/** @type {any} */ ...args) => mockTrackFunnelEvent(...args),
}));

jest.mock('@/domains/subscription/subscriptionPurchaseRail', () => ({
  isSubscriptionPurchaseAvailable: (/** @type {any} */ ...args) => mockIsPurchaseAvailable(...args),
  performSubscriptionPurchase: (/** @type {any} */ ...args) => mockPerformPurchase(...args),
}));

jest.mock('@/domains/subscription/subscriptionRefresh', () => ({
  scheduleSubscriptionStateRefresh: (/** @type {any} */ ...args) => mockScheduleRefresh(...args),
}));

// BottomModal repose sur @gorhom/bottom-sheet + BlurView + StartupPhaseContext :
// hors sujet ici, on garde un passe-plat qui respecte `isVisible`.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children, isVisible }) => (isVisible ? <View>{children}</View> : null),
  };
});

// Le vrai Button rend un TouchableOpacity + Text : le mock garde ce contrat pour
// que la recherche « bouton portant ce libelle » soit la meme partout.
jest.mock('@/components/atoms/button/Button', () => {
  const { Text: RNText, TouchableOpacity: RNTouchable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({
      disabled, isLoading, onPress, title,
    }) => (
      <RNTouchable
        accessibilityRole="button"
        accessibilityState={{ busy: Boolean(isLoading), disabled: Boolean(disabled) }}
        disabled={Boolean(disabled)}
        onPress={onPress}
      >
        <RNText>{title}</RNText>
      </RNTouchable>
    ),
  };
});

jest.mock('@/components/molecules/legalFooter/LegalFooter', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <View /> };
});

jest.mock('@/theme/themeContext', () => {
  const emptyStyles = (/** @type {(string|number)[]} */ keys) => Object.fromEntries(
    keys.map((key) => [key, {}]),
  );

  return {
    __esModule: true,
    default: () => ({
      Alignments: {
        alignCenter: {}, fill: {}, justifyCenter: {}, row: {},
      },
      ApplicationStyle: {
        backgroundColor: { primary700: {} },
        borderColor: { primary100: {} },
        borderRadius100: {},
        borderRadius12: {},
        borderWidth1: {},
      },
      // Chaines opaques volontairement non-hex : le contrat de theme interdit les
      // litteraux hex hors allowlist, et un mock n'a pas besoin de vraies couleurs.
      Colors: {
        neutral00: 'couleur-blanc',
        primary200: 'couleur-primaire-claire',
        primary500: 'couleur-primaire',
        primary900: 'couleur-encre',
        success500: 'couleur-succes',
      },
      Fonts: emptyStyles([
        'h1Bold', 'h3Bold', 'neutral00', 'neutral100', 'neutral300',
        'p1', 'p1Bold', 'p2', 'p2Bold', 'p3', 'p3Bold', 'p4Bold',
        'primary100', 'primary200', 'primary500',
      ]),
      Spaces: {
        gap: emptyStyles([4, 8, 12, 16]),
        marginTop: emptyStyles([4]),
        padding: emptyStyles([16]),
        paddingBottom: emptyStyles([8, 24]),
        paddingTop: emptyStyles([16, 24]),
        paddingVertical: emptyStyles([12]),
      },
    }),
  };
});

jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: (/** @type {any} */ ...args) => mockAlert(...args),
}));

/* ------------------------------------------------------------------ */
/* Catalogue : copie fidele du catalogue STATIQUE du serveur           */
/* (admin/src/api/subscription/services/subscription-catalog.ts)       */
/* ------------------------------------------------------------------ */

const TEAM_PRICES = {
  1: { monthly: 799, yearly: 5999 },
  2: { monthly: 1299, yearly: 9999 },
  3: { monthly: 1699, yearly: 12999 },
};
const CLUB_TIERS = {
  1: {
    label: 'Club S', maxTeams: 3, monthly: 1999, yearly: 19999,
  },
  2: {
    label: 'Club M', maxTeams: 8, monthly: 3499, yearly: 34999,
  },
  3: {
    label: 'Club L', maxTeams: null, monthly: 5499, yearly: 54999,
  },
};

const CATALOG_ENTRIES = [
  ...[1, 2, 3].flatMap((slotCount) => ['monthly', 'yearly'].map((billingPeriod) => ({
    billingPeriod,
    displayName: `Équipe · ${slotCount} équipe${slotCount > 1 ? 's' : ''}`,
    isActive: true,
    maxTeams: null,
    planCode: `fc_team_${slotCount}_${billingPeriod}`,
    providerProductId: `fc_team_${slotCount}_${billingPeriod}`,
    referencePriceEurCents: TEAM_PRICES[slotCount][billingPeriod],
    requiresClubVerification: false,
    scopeType: 'TEAM',
    slotCount,
  }))),
  ...[1, 2, 3].flatMap((tier) => ['monthly', 'yearly'].map((billingPeriod) => ({
    billingPeriod,
    displayName: CLUB_TIERS[tier].label,
    isActive: true,
    maxTeams: CLUB_TIERS[tier].maxTeams,
    planCode: `fc_club_tier_${tier}_${billingPeriod}`,
    providerProductId: `fc_club_tier_${tier}_${billingPeriod}`,
    referencePriceEurCents: CLUB_TIERS[tier][billingPeriod],
    requiresClubVerification: true,
    scopeType: 'CLUB',
    slotCount: null,
  }))),
];

/* ------------------------------------------------------------------ */

const TEAM_QUOTA_DECISION = {
  allowed: false,
  paywall: 'TEAM_LIMIT',
  reason: 'FREE_QUOTA_EXHAUSTED',
  remainingFreeUses: 0,
  requiredPlan: ['TEAM', 'CLUB'],
};

// Les 3 murs « premier achat Club » mesures par l'audit (§1.2).
const FACILITY_DECISION = {
  allowed: false,
  paywall: 'FACILITY_MANAGE_REQUIRED',
  reason: 'SUBSCRIPTION_REQUIRED',
  remainingFreeUses: null,
  requiredPlan: ['CLUB'],
};
const SPONSOR_DECISION = { ...FACILITY_DECISION, paywall: 'SPONSOR_MANAGE_REQUIRED' };
const DUES_DECISION = { ...FACILITY_DECISION, paywall: 'DUES_CAMPAIGN_CREATE_REQUIRED' };

// Palier Club plein : l'utilisateur a DEJA une offre Club (§1.2, derniere ligne).
const CLUB_TIER_LIMIT_DECISION = {
  allowed: false,
  paywall: 'CLUB_TIER_TEAM_LIMIT',
  reason: 'CLUB_TIER_LIMIT_REACHED',
  remainingFreeUses: 0,
  requiredPlan: ['CLUB'],
};

const baseAuthValue = (overrides = {}) => ({
  subscriptionSummary: { teamSlotSummary: { assigned: 0, available: 0, total: 0 } },
  userData: {
    club: { documentId: 'club-du-payeur' },
    documentId: 'user-1',
    myTeams: [{ documentId: 'team-1', name: 'U15' }],
    role: { type: 'president' },
    trainedTeams: [],
  },
  ...overrides,
});

const renderSheet = ({
  auth = baseAuthValue(),
  clubDocumentId = 'club-1',
  decision = TEAM_QUOTA_DECISION,
  isVisible = true,
} = {}) => {
  mockUseAuth.mockReturnValue(auth);
  let tree;
  act(() => {
    tree = renderer.create(
      <SubscriptionPaywallSheet
        close={jest.fn()}
        clubDocumentId={clubDocumentId}
        decision={decision}
        isVisible={isVisible}
        navigation={{ navigate: mockNavigate }}
      />,
    );
  });
  return tree;
};

const allTexts = (/** @type {any} */ tree) => tree.root.findAllByType(Text)
  .map((/** @type {any} */ node) => (Array.isArray(node.props.children)
    ? node.props.children.join('') : String(node.props.children)));

const findButtonByText = (/** @type {any} */ tree, /** @type {string} */ label) => tree.root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ touchable) => touchable.findAllByType(Text)
    .some((/** @type {any} */ node) => String(node.props.children) === label));

const purchasedPlanCode = () => mockPerformPurchase.mock.calls[0][0].catalogEntry.planCode;

const hasTextContaining = (/** @type {any} */ tree, /** @type {string} */ part) => allTexts(tree)
  .some((/** @type {string} */ text) => text.includes(part));

beforeEach(() => {
  jest.clearAllMocks();
  mockCatalogQueryState = { data: { data: CATALOG_ENTRIES }, isError: false, isLoading: false };
  mockPurchaseIsPending = false;
  mockIsPurchaseAvailable.mockReturnValue(true);
  mockPerformPurchase.mockResolvedValue({ ok: true });
});

/* ================================================================== */
/* 1. Caracterisation : ce qui existait AVANT le lot L10-A            */
/* ================================================================== */

describe('SubscriptionPaywallSheet — gardes d\'affichage (comportement historique)', () => {
  it('ne rend rien sans decision', () => {
    expect(renderSheet({ decision: null }).toJSON()).toBeNull();
  });

  it('ne rend rien quand la feuille est fermee', () => {
    expect(renderSheet({ isVisible: false }).toJSON()).toBeNull();
  });

  it('un profil qui ne peut pas acheter ne voit ni prix ni bouton d\'achat', () => {
    const auth = baseAuthValue();
    auth.userData.role = { type: 'player' };
    const tree = renderSheet({ auth, decision: FACILITY_DECISION });

    expect(allTexts(tree)).toContain("Cette action n'est pas disponible pour ce profil.");
    expect(findButtonByText(tree, 'Fermer')).toBeTruthy();
    expect(hasTextContaining(tree, '199,99 €')).toBe(false);
  });
});

describe('SubscriptionPaywallSheet — feuille de quota Équipe (inchangee par L10-A)', () => {
  it('affiche les paliers Équipe, le prix annuel et le bouton d\'achat', () => {
    const tree = renderSheet({ decision: TEAM_QUOTA_DECISION });
    const texts = allTexts(tree);

    expect(texts).toContain('Offre Équipe');
    expect(texts).toContain('Tu veux créer une 2ᵉ équipe ?');
    expect(texts).toContain('1 équipe');
    expect(texts).toContain('2 équipes');
    expect(texts).toContain('3 équipes');
    // Palier 2 preselectionne (2ᵉ equipe) : 99,99 €/an.
    expect(texts).toContain('99,99 €');
    expect(texts).toContain('/an');
    expect(findButtonByText(tree, 'Débloquer 2 équipes')).toBeTruthy();
    expect(findButtonByText(tree, 'Comparer les offres')).toBeTruthy();
    expect(findButtonByText(tree, 'Plus tard')).toBeTruthy();
  });

  it('achete le palier Équipe selectionne avec les equipes du coach', async () => {
    const tree = renderSheet({ decision: TEAM_QUOTA_DECISION });

    await act(async () => {
      findButtonByText(tree, 'Débloquer 2 équipes').props.onPress();
    });

    expect(mockPerformPurchase).toHaveBeenCalledTimes(1);
    const input = mockPerformPurchase.mock.calls[0][0];
    expect(input.catalogEntry.planCode).toBe('fc_team_2_yearly');
    expect(input.teamDocumentIds).toEqual(['team-1']);
    expect(mockScheduleRefresh).toHaveBeenCalled();
  });

  it('tant que le catalogue charge, le bouton reste desactive', () => {
    mockCatalogQueryState = { data: undefined, isError: false, isLoading: true };
    const tree = renderSheet({ decision: TEAM_QUOTA_DECISION });

    const cta = findButtonByText(tree, 'Chargement des tarifs…');
    expect(cta).toBeTruthy();
    expect(cta.props.disabled).toBe(true);
  });
});

/* ================================================================== */
/* 2. Le trou commercial que L10-A referme                            */
/* ================================================================== */

describe('SubscriptionPaywallSheet — murs qui exigent l\'offre Club', () => {
  it.each([
    ['FACILITY_MANAGE_REQUIRED', FACILITY_DECISION, 'gestion des installations du club'],
    ['SPONSOR_MANAGE_REQUIRED', SPONSOR_DECISION, 'gestion des sponsors du club'],
    ['DUES_CAMPAIGN_CREATE_REQUIRED', DUES_DECISION, 'campagnes de cotisation'],
  ])('%s : prix Club et achat direct', (_key, decision, sentence) => {
    const tree = renderSheet({ decision });
    const texts = allTexts(tree);

    expect(texts).toContain('Offre Club');
    expect(hasTextContaining(tree, sentence)).toBe(true);
    // Les 3 paliers du catalogue serveur, avec le prix annuel du palier retenu.
    expect(texts).toContain('Club S');
    expect(texts).toContain('Club M');
    expect(texts).toContain('Club L');
    expect(texts).toContain('199,99 €');
    expect(texts).toContain('/an');
    expect(findButtonByText(tree, 'Débloquer Club S')).toBeTruthy();
    // La porte de sortie decidee par Adel (Q3) reste en place.
    expect(findButtonByText(tree, 'Comparer les offres')).toBeTruthy();
    expect(findButtonByText(tree, 'Plus tard')).toBeTruthy();
  });

  it('l\'achat Club porte le club du contexte et aucun slot d\'equipe', async () => {
    const tree = renderSheet({
      clubDocumentId: 'club-des-installations',
      decision: FACILITY_DECISION,
    });

    await act(async () => {
      findButtonByText(tree, 'Débloquer Club S').props.onPress();
    });

    expect(mockPerformPurchase).toHaveBeenCalledTimes(1);
    const input = mockPerformPurchase.mock.calls[0][0];
    expect(input.catalogEntry.planCode).toBe('fc_club_tier_1_yearly');
    // Le serveur exige clubDocumentId pour une offre CLUB
    // (subscription-billing.ts:427) et n'attend aucun slot d'equipe.
    expect(input.clubDocumentId).toBe('club-des-installations');
    expect(input.teamDocumentIds).toEqual([]);
    expect(mockScheduleRefresh).toHaveBeenCalled();
  });

  it('sans club dans le contexte, on retombe sur le club du compte', async () => {
    const tree = renderSheet({ clubDocumentId: null, decision: FACILITY_DECISION });

    await act(async () => {
      findButtonByText(tree, 'Débloquer Club S').props.onPress();
    });

    expect(mockPerformPurchase.mock.calls[0][0].clubDocumentId).toBe('club-du-payeur');
  });

  it('sans aucun club rattache, on n\'envoie pas un achat que le serveur refusera', async () => {
    const auth = baseAuthValue();
    auth.userData.club = null;
    const tree = renderSheet({ auth, clubDocumentId: null, decision: FACILITY_DECISION });

    await act(async () => {
      findButtonByText(tree, 'Débloquer Club S').props.onPress();
    });

    expect(mockPerformPurchase).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalled();
  });

  it('le palier Club choisi pilote le prix et le plan achete', async () => {
    const tree = renderSheet({ decision: FACILITY_DECISION });

    act(() => { findButtonByText(tree, 'Club M').props.onPress(); });
    expect(allTexts(tree)).toContain('349,99 €');

    await act(async () => {
      findButtonByText(tree, 'Débloquer Club M').props.onPress();
    });
    expect(purchasedPlanCode()).toBe('fc_club_tier_2_yearly');
  });

  it('ne repete pas « Offre conseillée » : les paliers Club sont deja a l\'ecran', () => {
    const tree = renderSheet({ decision: FACILITY_DECISION });
    expect(hasTextContaining(tree, 'Offre conseillée')).toBe(false);
  });

  it('dit ce qui distingue les paliers Club : le nombre d\'equipes couvertes', () => {
    const tree = renderSheet({ decision: FACILITY_DECISION });
    expect(hasTextContaining(tree, "Jusqu'à 3 équipes du club")).toBe(true);

    act(() => { findButtonByText(tree, 'Club L').props.onPress(); });
    expect(hasTextContaining(tree, 'Équipes du club illimitées')).toBe(true);
  });

  it('le mensuel Club est proposable et change le plan achete', async () => {
    const tree = renderSheet({ decision: FACILITY_DECISION });

    act(() => { findButtonByText(tree, 'Mensuel').props.onPress(); });
    expect(allTexts(tree)).toContain('19,99 €');
    expect(allTexts(tree)).toContain('/mois');

    await act(async () => {
      findButtonByText(tree, 'Débloquer Club S').props.onPress();
    });
    expect(purchasedPlanCode()).toBe('fc_club_tier_1_monthly');
  });
});

describe('SubscriptionPaywallSheet — palier Club plein (CLUB_TIER_TEAM_LIMIT)', () => {
  it('ne propose pas un achat que le serveur refuserait : renvoie vers la gestion d\'offre', () => {
    const auth = baseAuthValue({
      subscriptionSummary: {
        activePlanCodes: ['fc_club_tier_1_yearly'],
        hasClubPlan: true,
        teamSlotSummary: { assigned: 0, available: 0, total: 0 },
      },
    });
    const tree = renderSheet({ auth, decision: CLUB_TIER_LIMIT_DECISION });

    expect(allTexts(tree)).toContain('Limite d équipes atteinte');
    // Un second achat Club sur un club deja couvert leve CLUB_ALREADY_COVERED
    // (subscription-billing.ts:617) : la montee de palier passe par le
    // CARROUSEL, qui sait deja faire un changement de plan.
    // L33 — la destination change (`SubscriptionOffers` et non plus le hub) et
    // le libelle avec elle : depuis un mur payant, le hub n'a plus aucune offre
    // a montrer. C'est le temoin anti-regression de L10-A, cote appelant.
    const cta = findButtonByText(tree, 'Voir les offres');
    expect(cta).toBeTruthy();
    act(() => { cta.props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('ProfileStack', { screen: 'SubscriptionOffers' });
    expect(findButtonByText(tree, 'Débloquer Club S')).toBeFalsy();
  });
});

/* ================================================================== */
/* 3. Panne de catalogue : le catalogue serveur est STATIQUE          */
/* ================================================================== */

describe('SubscriptionPaywallSheet — catalogue indisponible', () => {
  it.each([
    ['quota Équipe', TEAM_QUOTA_DECISION],
    ['offre Club', FACILITY_DECISION],
  ])('%s : annonce des tarifs indisponibles', (_label, decision) => {
    mockCatalogQueryState = { data: undefined, isError: true, isLoading: false };
    const tree = renderSheet({ decision });

    expect(hasTextContaining(tree, 'Tarifs indisponibles')).toBe(true);
    expect(findButtonByText(tree, 'Chargement des tarifs…')).toBeFalsy();
    // La sortie reste ouverte : on ne pige pas l'utilisateur dans une feuille morte.
    expect(findButtonByText(tree, 'Comparer les offres')).toBeTruthy();
    expect(findButtonByText(tree, 'Plus tard')).toBeTruthy();
  });

  it('propose de relancer le chargement des tarifs', () => {
    mockCatalogQueryState = { data: undefined, isError: true, isLoading: false };
    const tree = renderSheet({ decision: FACILITY_DECISION });

    const retry = findButtonByText(tree, 'Réessayer');
    expect(retry).toBeTruthy();
    act(() => { retry.props.onPress(); });
    expect(mockRefetchCatalog).toHaveBeenCalled();
  });

  it('une reponse vide est traitee comme une panne, pas comme un chargement', () => {
    mockCatalogQueryState = { data: { data: [] }, isError: false, isLoading: false };
    const tree = renderSheet({ decision: TEAM_QUOTA_DECISION });

    expect(hasTextContaining(tree, 'Tarifs indisponibles')).toBe(true);
  });
});
