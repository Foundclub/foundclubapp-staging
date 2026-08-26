import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import GuideOffersRecap from '../GuideOffersRecap';

// Filet L10-A (docs/STRATEGIE_PAYWALL_2026_08_01.md) : l'ecran de comparaison des
// offres n'avait AUCUN test (E6). Il grisait l'offre Club derriere `clubVerified`
// alors que le serveur a acte le 2026-07-17 que la verification ne bloque plus la
// porte payante (subscription-permission.ts:751-756). Ces tests verrouillent le
// fait que l'offre Club est achetable, club verifie ou non.

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
  // L39 — deux requetes derriere le catalogue : le serveur et les prix du STORE.
  // Sans cle, la seconde recevrait le catalogue de la premiere.
  useQuery: (/** @type {any} */ options) => (
    String(options?.queryKey?.[0]) === 'subscription-store-prices'
      ? { data: undefined, isError: false, isLoading: false }
      : { ...mockCatalogQueryState, refetch: mockRefetchCatalog }
  ),
  useQueryClient: () => ({}),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockUseAuth(),
}));

jest.mock('@/services/subscription/subscriptionService', () => ({
  getSubscriptionCatalog: jest.fn(),
  trackSubscriptionFunnelEvent: (/** @type {any} */ ...args) => mockTrackFunnelEvent(...args),
}));

jest.mock('@/domains/subscription/subscriptionPurchaseRail', () => ({
  isSubscriptionPurchaseAvailable: (/** @type {any} */ ...args) => mockIsPurchaseAvailable(...args),
  performSubscriptionPurchase: (/** @type {any} */ ...args) => mockPerformPurchase(...args),
}));

jest.mock('@/domains/subscription/subscriptionRefresh', () => ({
  scheduleSubscriptionStateRefresh: (/** @type {any} */ ...args) => mockScheduleRefresh(...args),
}));

jest.mock('@/components/templates/ScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ children }) => <View>{children}</View> };
});

jest.mock('@/components/molecules/legalFooter/LegalFooter', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <View /> };
});

// Le vrai Button rend un TouchableOpacity + Text : le mock garde ce contrat.
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

// Le theme n'est ici qu'un porteur de styles : un proxy evite d'enumerer 40 tokens
// dont aucun n'a d'incidence sur ce qui est teste (textes et commandes).
jest.mock('@/theme/themeContext', () => {
  const styleLeaf = () => new Proxy({}, { get: () => ({}) });
  const styles = () => new Proxy({}, { get: () => styleLeaf() });
  const colorNames = () => new Proxy({}, {
    get: (/** @type {any} */ _target, /** @type {any} */ name) => `couleur-${String(name)}`,
  });

  return {
    __esModule: true,
    default: () => ({
      Alignments: styleLeaf(),
      ApplicationStyle: styles(),
      // Chaines opaques volontairement non-hex : le contrat de theme interdit les
      // litteraux hex hors allowlist, et un mock n'a pas besoin de vraies couleurs.
      Colors: colorNames(),
      Fonts: styleLeaf(),
      Images: styleLeaf(),
      Spaces: styles(),
    }),
  };
});

jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: (/** @type {any} */ ...args) => mockAlert(...args),
}));

/* Catalogue : copie fidele du catalogue STATIQUE du serveur
   (admin/src/api/subscription/services/subscription-catalog.ts). */
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

const authValue = ({
  clubVerified = false,
  club = { clubVerified, documentId: 'club-1' },
} = {}) => ({
  subscriptionSummary: { teamSlotSummary: { assigned: 0, available: 0, total: 0 } },
  userData: {
    club,
    documentId: 'user-1',
    myTeams: [{ documentId: 'team-1', name: 'U15' }],
    trainedTeams: [],
  },
});

const renderRecap = (auth = authValue()) => {
  mockUseAuth.mockReturnValue(auth);
  let tree;
  act(() => {
    tree = renderer.create(<GuideOffersRecap navigation={{ navigate: mockNavigate }} />);
  });
  return tree;
};

const allTexts = (/** @type {any} */ tree) => tree.root.findAllByType(Text)
  .map((/** @type {any} */ node) => (Array.isArray(node.props.children)
    ? node.props.children.join('') : String(node.props.children)));

const findByText = (/** @type {any} */ tree, /** @type {string} */ label) => tree.root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ touchable) => touchable.findAllByType(Text)
    .some((/** @type {any} */ node) => String(node.props.children) === label));

const hasTextContaining = (/** @type {any} */ tree, /** @type {string} */ part) => allTexts(tree)
  .some((/** @type {string} */ text) => text.includes(part));

const ctaTitles = (/** @type {any} */ tree) => allTexts(tree)
  .filter((/** @type {string} */ text) => text.startsWith('Débloquer'));

beforeEach(() => {
  jest.clearAllMocks();
  mockCatalogQueryState = { data: { data: CATALOG_ENTRIES }, isError: false, isLoading: false };
  mockPurchaseIsPending = false;
  mockIsPurchaseAvailable.mockReturnValue(true);
  mockPerformPurchase.mockResolvedValue({ ok: true });
});

describe('GuideOffersRecap — les deux offres sont proposees (comportement conserve)', () => {
  it('affiche les deux cartes d\'offre', () => {
    const texts = allTexts(renderRecap());

    expect(texts).toContain('Équipe');
    expect(texts).toContain('Club');
  });

  it('l\'offre Équipe reste selectionnee par defaut et achetable', async () => {
    const tree = renderRecap();
    expect(ctaTitles(tree)).toContain('Débloquer Équipe · 59,99 €/an');

    await act(async () => { findByText(tree, 'Débloquer Équipe · 59,99 €/an').props.onPress(); });

    expect(mockPerformPurchase).toHaveBeenCalledTimes(1);
    expect(mockPerformPurchase.mock.calls[0][0].catalogEntry.planCode).toBe('fc_team_1_yearly');
  });

  it('un catalogue en panne propose de reessayer', () => {
    mockCatalogQueryState = { data: undefined, isError: true, isLoading: false };
    const tree = renderRecap();

    expect(hasTextContaining(tree, 'Impossible de charger les tarifs')).toBe(true);
    act(() => { findByText(tree, 'Réessayer').props.onPress(); });
    expect(mockRefetchCatalog).toHaveBeenCalled();
  });
});

describe('GuideOffersRecap — l\'offre Club ne depend plus de la verification du club', () => {
  it.each([
    ['club non verifie', false],
    ['club verifie', true],
  ])('%s : la carte Club est selectionnable et affiche son prix', (_label, clubVerified) => {
    const tree = renderRecap(authValue({ clubVerified }));

    const clubCard = findByText(tree, 'Club');
    expect(clubCard.props.disabled).toBeFalsy();

    act(() => { clubCard.props.onPress(); });
    expect(ctaTitles(tree)).toContain('Débloquer Club S · 199,99 €/an');
  });

  it('l\'argument de vente Club reste lisible sans verification', () => {
    const tree = renderRecap(authValue({ clubVerified: false }));
    // Le grisage masquait aussi le resume de l'offre : la carte ne disait plus
    // ce qu'elle vendait, seulement pourquoi elle etait fermee.
    expect(hasTextContaining(tree, 'Installations, sponsors, cotisations du club')).toBe(true);
  });

  it('un club non verifie peut acheter l\'offre Club', async () => {
    const tree = renderRecap(authValue({ clubVerified: false }));

    const clubCard = findByText(tree, 'Club');
    expect(clubCard.props.disabled).toBeFalsy();
    act(() => { clubCard.props.onPress(); });
    await act(async () => {
      findByText(tree, 'Débloquer Club S · 199,99 €/an').props.onPress();
    });

    expect(mockPerformPurchase).toHaveBeenCalledTimes(1);
    const input = mockPerformPurchase.mock.calls[0][0];
    expect(input.catalogEntry.planCode).toBe('fc_club_tier_1_yearly');
    // Le serveur exige clubDocumentId pour une offre CLUB et n'attend aucun slot.
    expect(input.clubDocumentId).toBe('club-1');
    expect(input.teamDocumentIds).toEqual([]);
  });

  // `clubVerified` est balaye dans les deux sens : les 3 textes ne doivent plus
  // apparaitre, que le club soit verifie ou non.
  it.each([
    ['la promesse de blocage', 'Réservée aux clubs vérifiés', false],
    ['le renvoi vers la verification', 'Vérifier mon club', false],
    ['la mention de prerequis', 'club vérifié requis', true],
    ['la pastille de verification', 'club vérifié', false],
  ])('ne montre plus %s', (_label, deadText, clubVerified) => {
    const tree = renderRecap(authValue({ clubVerified }));
    expect(hasTextContaining(tree, deadText)).toBe(false);
  });

  it('sans club rattache, on n\'envoie pas un achat que le serveur refusera', async () => {
    const tree = renderRecap(authValue({ club: null }));

    act(() => { findByText(tree, 'Club').props.onPress(); });
    await act(async () => {
      findByText(tree, 'Débloquer Club S · 199,99 €/an').props.onPress();
    });

    expect(mockPerformPurchase).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalled();
  });
});

// L38 — cet ecran est la DEUXIEME des trois surfaces de vente de l'app. L33 a
// corrige la remise sur le carrousel ; ici la pilule annoncait encore « Annuel ·
// 2 mois offerts », c'est-a-dire -17 %, alors que la grille serveur donne -37 %
// sur l'offre Équipe. Deux surfaces sur trois sous-vendaient donc de plus de la
// moitie ce qu'Adel offre reellement (prix reconfirmes le 2026-08-05).
describe('GuideOffersRecap — la remise annoncee est celle DE LA CARTE (L38)', () => {
  it('l\'offre Équipe annonce sa vraie remise, jamais « 2 mois offerts »', () => {
    const tree = renderRecap();

    // 7,99 x 12 = 95,88 contre 59,99 l'annee -> -37 %.
    expect(hasTextContaining(tree, '−37 %')).toBe(true);
    expect(hasTextContaining(tree, '2 mois offerts')).toBe(false);
  });

  it('TEMOIN — sur un palier Club, la meme etiquette affiche −17 %', () => {
    // La correction ne doit pas remplacer un mensonge par un autre : Club suit
    // exactement x10, ou « 2 mois offerts » etait juste.
    const tree = renderRecap();

    act(() => { findByText(tree, 'Club').props.onPress(); });

    expect(hasTextContaining(tree, '−17 %')).toBe(true);
  });

  it('TEMOIN — en mensuel, ni remise ni equivalence ne sont affichees', () => {
    const tree = renderRecap();

    act(() => { findByText(tree, 'Mensuel').props.onPress(); });

    expect(hasTextContaining(tree, '−37 %')).toBe(false);
    expect(hasTextContaining(tree, '%')).toBe(false);
    expect(hasTextContaining(tree, 'soit ')).toBe(false);
  });
});

describe('S12-B — le recap du tour guide vend les PALIERS, pas l offre au licencie', () => {
  // Le catalogue de recette, plus les deux entrees au licencie que S12-A a
  // ajoutees cote serveur (subscription-catalog.ts:107-125).
  const CATALOGUE_AVEC_LICENCIE = [
    ...CATALOG_ENTRIES,
    ...['monthly', 'yearly'].map((billingPeriod) => ({
      billingPeriod,
      displayName: `Club au licencié · équipes illimitées (${billingPeriod === 'yearly' ? 'annuel' : 'mensuel'})`,
      isActive: true,
      maxTeams: null,
      planCode: `fc_club_licensee_${billingPeriod}`,
      pricingModel: 'per_licensee',
      providerProductId: `fc_club_licensee_${billingPeriod}`,
      referencePriceEurCents: billingPeriod === 'yearly' ? 250 : 25,
      requiresClubVerification: true,
      scopeType: 'CLUB',
      slotCount: null,
      unitPriceEurCents: billingPeriod === 'yearly' ? 250 : 25,
    })),
  ];

  beforeEach(() => {
    mockCatalogQueryState = {
      data: { data: CATALOGUE_AVEC_LICENCIE },
      isError: false,
      isLoading: false,
    };
  });

  it('LE TEMOIN — aucune pilule « Tier 0 » ne s invite dans les paliers Club', () => {
    // Defaut mesure le 2026-08-26 : cette liste alimente les pilules SANS
    // filtre de rang, contrairement au carrousel et a la feuille de vente. Le
    // rang de l offre au licencie vaut 0 (elle n a pas de palier), et son
    // libelle sortait donc en repli : « Tier 0 ».
    const arbre = renderRecap();
    const carteClub = findByText(arbre, 'Club');
    act(() => {
      carteClub.props.onPress();
    });

    expect(allTexts(arbre)).not.toContain('Tier 0');
    expect(allTexts(arbre)).toEqual(expect.arrayContaining(['S · ≤ 3', 'M · ≤ 8', 'L · illim.']));
  });

  it('⛔ et la carte repliee annonce 199,99 €, pas le prix UNITAIRE', () => {
    // Le tri par numero de palier placait l offre au licencie EN TETE (rang 0) :
    // `firstEntry` la designait, et la carte Club repliee affichait
    // « a partir de 2,50 €/an » au lieu de 199,99 €.
    const arbre = renderRecap();

    // Équipe est selectionne par defaut : la carte Club est donc repliee.
    expect(hasTextContaining(arbre, '199,99 €')).toBe(true);
    expect(hasTextContaining(arbre, '2,50 €')).toBe(false);
  });
});
